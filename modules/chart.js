// ═══════════════════════════════════════════════════════════════
//  MarketDepth Core — Controlador principal
//  Módulos: SharedPriceState, OhlcAggregator, CandleEngine,
//           Crosshair, PriceAxisRenderer, OrderbookEngine
// ═══════════════════════════════════════════════════════════════
(() => {
    'use strict';

    const WS_GRAFICO = 'ws://localhost:8765';           // dirección WebSocket del gráfico de velas
    const WS_LIBRO_ORDENES = 'ws://localhost:8766';     // dirección WebSocket del libro de órdenes
    const MS_RECONEXION = 3000;                         // milisegundos antes de reintentar conexión

    // ══════════════════════════════════════════════════
    //  CONTROLADOR PRINCIPAL
    // ══════════════════════════════════════════════════
    class MarketDepthCore {
        constructor() {
            this.estadoPrecio = new MD.SharedPriceState(); // estado compartido de rango de precios

            // Referencias al DOM (elementos HTML del documento)
            this.contenedorGrafico = document.getElementById('chart-wrap');       // div que envuelve el gráfico
            this.canvasVelas = document.getElementById('candle-canvas');     // canvas donde se dibujan las velas
            this.canvasCruceta = document.getElementById('crosshair-canvas'); // canvas de la línea cruceta del ratón
            this.elementoEjePrecio = document.getElementById('price-axis');       // contenedor del eje de precios
            this.canvasEjePrecio = document.getElementById('price-axis-canvas');// canvas donde se dibuja el eje de precios

            // Motores (cada uno maneja una parte del renderizado)
            this.agrupadorVelas = new MD.OHLCAggregator(60);                                  // agrupa ticks en velas OHLC
            this.motorVelas = new MD.CandleEngine(this.canvasVelas, this.estadoPrecio);    // dibuja las velas en el canvas
            this.cruceta = new MD.Crosshair(this.canvasCruceta);                        // dibuja la cruceta del ratón
            this.renderizadorEje = new MD.PriceAxisRenderer(this.canvasEjePrecio, this.estadoPrecio); // dibuja el eje de precios

            // Motor del libro de órdenes — módulo independiente
            this.motorLibroOrdenes = new OrderbookEngine(document.getElementById('ob-engine-mount'));
            window.obEngine = this.motorLibroOrdenes; // acceso global para herramientas externas

            // Estado general de la aplicación
            this.estaPausado = false;       // si el usuario pausó la recepción de datos
            this.simboloActual = '';          // símbolo/instrumento activo (ej: "BTCUSDT")
            this.precioActual = 0;           // último precio recibido
            this.primerPrecio = 0;           // primer precio de la sesión (para calcular cambio %)
            this.maximoSesion = -Infinity;   // precio más alto de toda la sesión
            this.minimoSesion = Infinity;    // precio más bajo de toda la sesión
            this.volumenTotal = 0;           // cantidad total de ticks procesados como volumen
            this.totalTicks = 0;           // contador total de ticks recibidos
            this.totalMensajes = 0;           // contador total de mensajes WebSocket recibidos
            this.ticksCrudos = [];          // array con todos los ticks crudos {time, value}

            // Cuadros por segundo / Ticks por segundo
            this.contadorCuadros = 0;           // cuántos frames se han dibujado en el último segundo
            this.ultimoTiempoFps = Date.now();  // timestamp de la última medición de FPS
            this.cuadrosPorSegundo = 60;          // FPS actual
            this.ticksPorSegundo = 0;           // TPS actual (ticks recibidos por segundo)
            this.contadorTicksVentana = 0;           // ticks acumulados en la ventana de 1 segundo
            this.ultimoTiempoTps = Date.now();  // timestamp de la última medición de TPS

            // Estados de arrastre (drag) del ratón
            this._arrastreEje = false;   // si el usuario está arrastrando el eje de precios
            this._arrastreEjeInicioY = 0;      // posición Y donde inició el arrastre del eje
            this._arrastreGrafico = false;   // si el usuario está arrastrando el gráfico (pan horizontal)
            this._arrastreGraficoInicioX = 0;      // posición X donde inició el arrastre del gráfico

            // WebSockets
            this.wsGrafico = null;            // conexión WebSocket para datos de precio/velas
            this.wsLibroOrdenes = null;            // conexión WebSocket para el libro de órdenes

            // Throttle del eje de tiempo (evita actualizar demasiado frecuente)
            this._ultimaActualizacionEjeTiempo = 0;

            this._redimensionar();
            this._vincularEventos();
            this._iniciarBucleDibujo();
            this._conectarGrafico();
            this._conectarLibroOrdenes();

            console.log('%c[SISTEMA] 🚀 MarketDepthCore inicializado', 'color:#06b6d4;font-weight:bold');
        }

        // ─── REDIMENSIONAR CANVAS ─────────────────────────────
        _redimensionar() {
            const proporcionPixeles = window.devicePixelRatio || 1; // ratio de píxeles del dispositivo (retina = 2)

            const ajustarCanvas = (canvas, ancho, alto) => {
                const anchoPixeles = Math.round(ancho * proporcionPixeles);
                const altoPixeles = Math.round(alto * proporcionPixeles);
                canvas.width = anchoPixeles;
                canvas.height = altoPixeles;
                canvas.style.width = ancho + 'px';
                canvas.style.height = alto + 'px';
                canvas.getContext('2d').setTransform(proporcionPixeles, 0, 0, proporcionPixeles, 0, 0);
            };

            const anchoGrafico = this.contenedorGrafico.clientWidth;
            const altoGrafico = this.contenedorGrafico.clientHeight;
            [this.canvasVelas, this.canvasCruceta].forEach(c => ajustarCanvas(c, anchoGrafico, altoGrafico));
            this.anchoGrafico = anchoGrafico;
            this.altoGrafico = altoGrafico;

            const anchoEjePrecio = this.elementoEjePrecio.clientWidth;
            const altoEjePrecio = this.elementoEjePrecio.clientHeight;
            ajustarCanvas(this.canvasEjePrecio, anchoEjePrecio, altoEjePrecio);
            this.anchoEje = anchoEjePrecio;
            this.altoEje = altoEjePrecio;

            console.log(`%c[REDIMENSIÓN] 📐 Gráfico: ${anchoGrafico}x${altoGrafico} | DPR: ${proporcionPixeles}`, 'color:#94a3b8');
        }

        // ─── VINCULAR EVENTOS ─────────────────────────────
        _vincularEventos() {
            window.addEventListener('resize', () => this._redimensionar());

            // Cruceta sobre el gráfico — seguir movimiento del ratón
            this.canvasCruceta.addEventListener('mousemove', (e) => {
                if (this._arrastreGrafico) return; // no actualizar cruceta durante pan
                const rectangulo = this.canvasCruceta.getBoundingClientRect();
                this.cruceta.mx = e.clientX - rectangulo.left;  // posición X del ratón relativa al canvas
                this.cruceta.my = e.clientY - rectangulo.top;   // posición Y del ratón relativa al canvas
                this.cruceta.on = true;                          // activar cruceta
                this._actualizarTooltip();
            });
            this.canvasCruceta.addEventListener('mouseleave', () => {
                this.cruceta.on = false; // desactivar cruceta al salir del canvas
                document.getElementById('crosshair-info').style.display = 'none';
            });

            // ─── PAN DEL GRÁFICO: click+arrastrar → desplazar historial de velas ───
            this.canvasCruceta.addEventListener('mousedown', (e) => {
                this._arrastreGrafico = true;
                this._arrastreGraficoInicioX = e.clientX;
                this.motorVelas._panAccumPx = 0;
                this.canvasCruceta.style.cursor = 'grabbing'; // cambiar cursor a "mano cerrada"
                console.log('%c[PAN] 🖱️ Arrastre iniciado en x=' + e.clientX, 'color:#f59e0b');
                e.preventDefault();
            });

            // Zoom horizontal (rueda del ratón sobre el gráfico)
            this.canvasCruceta.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (e.shiftKey) {
                    // Shift + rueda = zoom vertical
                    const rectangulo = this.canvasCruceta.getBoundingClientRect();
                    const ratioCentro = (e.clientY - rectangulo.top) / rectangulo.height;
                    this.estadoPrecio.applyManualZoom(e.deltaY > 0 ? 5 : -5, ratioCentro);
                } else {
                    // Solo rueda = zoom horizontal (más/menos velas visibles)
                    this.motorVelas.zoom(e.deltaY > 0 ? 1.08 : 0.92);
                }
            }, { passive: false });

            // Eje de precios: rueda → zoom vertical
            this.elementoEjePrecio.addEventListener('wheel', (e) => {
                e.preventDefault();
                const rectangulo = this.elementoEjePrecio.getBoundingClientRect();
                const ratioCentro = (e.clientY - rectangulo.top) / rectangulo.height;
                this.estadoPrecio.applyManualZoom(e.deltaY > 0 ? 6 : -6, ratioCentro);
            }, { passive: false });

            // Eje de precios: arrastrar → zoom vertical (Zoom Tipo 2)
            this.elementoEjePrecio.addEventListener('mousedown', (e) => {
                this._arrastreEje = true;
                this._arrastreEjeInicioY = e.clientY;
                this.elementoEjePrecio.style.cursor = 'ns-resize';  // cursor de redimensión vertical
                document.body.style.cursor = 'ns-resize';
                e.preventDefault();
            });

            // ─── MANEJADORES GLOBALES DE RATÓN (pan + arrastre de eje) ───
            window.addEventListener('mousemove', (e) => {
                if (this._arrastreEje) {
                    const deltaY = e.clientY - this._arrastreEjeInicioY; // distancia vertical arrastrada
                    this._arrastreEjeInicioY = e.clientY;
                    const rectangulo = this.elementoEjePrecio.getBoundingClientRect();
                    this.estadoPrecio.applyManualDrag(deltaY, rectangulo.height);
                }
                if (this._arrastreGrafico) {
                    const deltaX = e.clientX - this._arrastreGraficoInicioX; // distancia horizontal arrastrada
                    this._arrastreGraficoInicioX = e.clientX;
                    if (deltaX !== 0) {
                        this.motorVelas.pan(-deltaX, this.anchoGrafico);
                    }
                }
            });

            window.addEventListener('mouseup', () => {
                if (this._arrastreEje) {
                    this._arrastreEje = false;
                    this.elementoEjePrecio.style.cursor = 'ns-resize';
                    document.body.style.cursor = '';
                }
                if (this._arrastreGrafico) {
                    this._arrastreGrafico = false;
                    this.canvasCruceta.style.cursor = 'crosshair'; // restaurar cursor cruceta
                    // Ajustar a cuadrícula: resetear offset fraccional
                    this.motorVelas._panFractional = 0;
                    this.motorVelas._panAccumPx = 0;
                    console.log('%c[PAN] 🖱️ Arrastre terminado | offset=' + this.motorVelas._panOffset, 'color:#22c55e');
                }
            });

            // Doble click: eje de precios → resetear zoom, gráfico → resetear pan
            this.elementoEjePrecio.addEventListener('dblclick', () => {
                this.estadoPrecio.resetZoom();
            });

            this.canvasCruceta.addEventListener('dblclick', () => {
                this.motorVelas._panOffset = 0;
                this.motorVelas._panFractional = 0;
                this.motorVelas._panAccumPx = 0;
                this.estadoPrecio.autoRange = true;
            });

            // Botones de la barra de herramientas
            document.getElementById('btn-pause').addEventListener('click', (e) => {
                this.estaPausado = !this.estaPausado;
                e.target.textContent = this.estaPausado ? '▶ Reanudar' : '⏸ Pausar';
                this._establecerEstado(
                    this.estaPausado ? 'connecting' : 'live',
                    this.estaPausado ? 'PAUSED' : 'LIVE'
                );
            });

            document.getElementById('btn-reset').addEventListener('click', () => location.reload());

            // Botones de timeframe (5s, 1m, 5m, 15m, etc.)
            document.querySelectorAll('[data-tf]').forEach(boton => {
                boton.addEventListener('click', (e) => {
                    document.querySelectorAll('[data-tf]').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    const segundos = parseInt(e.target.dataset.tf); // intervalo en segundos
                    this.agrupadorVelas.changeInterval(segundos, this.ticksCrudos);
                    this.estadoPrecio.resetZoom();
                    this.motorVelas._panOffset = 0;
                    this.motorVelas._panAccumPx = 0;
                    this.motorVelas._panFractional = 0;
                    // Ajustar cantidad de velas visibles según el timeframe
                    if (segundos >= 900) this.motorVelas.visibleCount = 40;  // 15m+
                    else if (segundos >= 300) this.motorVelas.visibleCount = 60;  // 5m
                    else this.motorVelas.visibleCount = 80;  // 1m, 5s
                });
            });

            // Cambio de símbolo/instrumento
            document.getElementById('symbol-select').addEventListener('change', (e) => {
                const simboloAnterior = this.simboloActual;
                const simbolo = e.target.value;
                this.simboloActual = simbolo;
                const mensaje = JSON.stringify({ action: 'subscribe', symbol: simbolo });
                if (this.wsGrafico?.readyState === WebSocket.OPEN) this.wsGrafico.send(mensaje);
                if (this.wsLibroOrdenes?.readyState === WebSocket.OPEN) this.wsLibroOrdenes.send(mensaje);
                this.estadoPrecio.resetZoom();

                // ── ULTRA-VALIDACIÓN: Limpiar OB del activo anterior ──
                // Resetear datos del store para que no persistan precios del activo previo
                this.motorLibroOrdenes.store.midPrice = 0;
                this.motorLibroOrdenes.store.bestBid = 0;
                this.motorLibroOrdenes.store.bestAsk = 0;
                this.motorLibroOrdenes.store.spread = 0;
                this.motorLibroOrdenes.store.bidMap.clear();
                this.motorLibroOrdenes.store.askMap.clear();
                this.motorLibroOrdenes.store.bidArray = [];
                this.motorLibroOrdenes.store.askArray = [];
                this.motorLibroOrdenes.store._dirty = true;
                this.motorLibroOrdenes.store._version++;

                // Limpiar DOM del OB para que no queden textos residuales
                const r = this.motorLibroOrdenes._renderer;
                if (r) {
                    if (r.midPriceEl) r.midPriceEl.textContent = '$—';
                    if (r.bestBidEl) r.bestBidEl.textContent = '$—';
                    if (r.bestAskEl) r.bestAskEl.textContent = '$—';
                    if (r.spreadEl) r.spreadEl.textContent = '$—';
                    if (r.spacer) r.spacer.style.height = '0px';
                    // Limpiar filas visibles del pool
                    if (r._rows) r._rows.forEach(row => row.el.style.display = 'none');
                }
                // Limpiar spread del panel de métricas
                document.getElementById('m-spread').textContent = '$—';

                // Resetear bandera de primer mensaje para que loguee el próximo
                this._primerMensajeLibro = false;
                this.motorLibroOrdenes._loggedFirst = false;

                console.log(`%c[SÍMBOLO] 🔄 ${simboloAnterior} → ${simbolo} | OB limpiado`, 'color:#a78bfa;font-weight:bold');
            });
        }

        // ─── CONEXIÓN WS DEL GRÁFICO (8765) ────────────────────
        _conectarGrafico() {
            const tiempoInicio = performance.now();
            this._establecerEstado('connecting', 'CONECTANDO...');
            console.log('%c[CONEXIÓN] 🔌 Conectando a WS Gráfico: ' + WS_GRAFICO, 'color:#f59e0b;font-weight:bold');
            this.wsGrafico = new WebSocket(WS_GRAFICO);

            this.wsGrafico.onopen = () => {
                const tiempoTranscurrido = (performance.now() - tiempoInicio).toFixed(0);
                this._establecerEstado('live', 'LIVE');
                console.log(`%c[CONEXIÓN] ✅ WS Gráfico CONECTADO | Tiempo: ${tiempoTranscurrido}ms`, 'color:#22c55e;font-weight:bold;font-size:13px');
            };

            this.wsGrafico.onmessage = (e) => {
                const tiempoMsg = performance.now();
                this.totalMensajes++;
                let mensaje;
                try { mensaje = JSON.parse(e.data); } catch { return; }

                if (mensaje.type === 'symbols') this._alRecibirSimbolos(mensaje.symbols);
                if (mensaje.type === 'init') {
                    this._alRecibirInicio(mensaje);
                    const tiempoTranscurrido = (performance.now() - tiempoMsg).toFixed(1);
                    console.log(`%c[CONEXIÓN] 📊 Datos iniciales | ${tiempoTranscurrido}ms | ${(mensaje.data || []).length} ticks`, 'color:#06b6d4;font-weight:bold');
                }
                if (mensaje.type === 'tick') this._alRecibirTick(mensaje);
                if (mensaje.type === 'session') this._alRecibirSesion(mensaje);
            };

            this.wsGrafico.onclose = () => {
                this._establecerEstado('disconnected', 'DESCONECTADO');
                console.log('%c[CONEXIÓN] ❌ WS Gráfico desconectado — reconectando...', 'color:#ef4444;font-weight:bold');
                setTimeout(() => this._conectarGrafico(), MS_RECONEXION);
            };
            this.wsGrafico.onerror = () => this.wsGrafico.close();
        }

        // ─── CONEXIÓN WS DEL LIBRO DE ÓRDENES (8766) ────────────────
        _conectarLibroOrdenes() {
            const tiempoInicio = performance.now();
            this.motorLibroOrdenes.setStatus('Conectando...', false);
            console.log('%c[CONEXIÓN] 🔌 Conectando a WS Libro de Órdenes: ' + WS_LIBRO_ORDENES, 'color:#f59e0b');
            this.wsLibroOrdenes = new WebSocket(WS_LIBRO_ORDENES);

            this.wsLibroOrdenes.onopen = () => {
                const tiempoTranscurrido = (performance.now() - tiempoInicio).toFixed(0);
                this.motorLibroOrdenes.setStatus('LIVE', true);
                console.log(`%c[CONEXIÓN] ✅ WS Libro de Órdenes CONECTADO | Tiempo: ${tiempoTranscurrido}ms`, 'color:#22c55e;font-weight:bold');
            };

            this.wsLibroOrdenes.onmessage = (e) => {
                let mensaje;
                try { mensaje = JSON.parse(e.data); } catch { return; }
                if (!this._primerMensajeLibro) {
                    this._primerMensajeLibro = true; // bandera: ya se recibió el primer mensaje del libro
                    console.log('%c[LIBRO_ÓRDENES] 📨 Primer mensaje WS recibido:', 'color:#06b6d4;font-weight:bold', {
                        type: mensaje.type, symbol: mensaje.symbol,
                        bids: mensaje.bids?.length, asks: mensaje.asks?.length,
                        mid_price: mensaje.mid_price, best_bid: mensaje.best_bid, best_ask: mensaje.best_ask
                    });
                }
                // ── ULTRA-VALIDACIÓN: Solo procesar datos del símbolo activo ──
                if (mensaje.type === 'book') {
                    // Validar que el símbolo del mensaje coincida EXACTAMENTE con el activo seleccionado
                    if (this.simboloActual && mensaje.symbol !== this.simboloActual) {
                        // Ignorar snapshots de otros activos (ej: BTC llega pero estás en TSLA)
                        return;
                    }
                    // Validar que el snapshot tiene datos válidos (mid_price > 0)
                    if (!mensaje.mid_price || mensaje.mid_price <= 0) {
                        // Snapshot vacío (mercado cerrado sin datos sintéticos) → no alimentar al motor
                        return;
                    }
                    this.motorLibroOrdenes.feedBook(mensaje);
                    if (mensaje.spread !== undefined) {
                        document.getElementById('m-spread').textContent = '$' + mensaje.spread.toFixed(4);
                    }
                }
            };

            this.wsLibroOrdenes.onclose = () => {
                this.motorLibroOrdenes.setStatus('Desconectado', false);
                console.log('%c[CONEXIÓN] ❌ WS Libro de Órdenes desconectado — reconectando...', 'color:#ef4444');
                setTimeout(() => this._conectarLibroOrdenes(), MS_RECONEXION);
            };
            this.wsLibroOrdenes.onerror = () => this.wsLibroOrdenes.close();
        }

        // Actualizar indicador visual de estado de conexión
        _establecerEstado(estado, texto) {
            document.getElementById('status-dot').className = 'status-dot ' + estado;
            document.getElementById('status-text').textContent = texto;
        }

        // Cuando el servidor envía la lista de símbolos disponibles
        _alRecibirSimbolos(simbolos) {
            const selector = document.getElementById('symbol-select');
            selector.innerHTML = '';
            simbolos.forEach(s => {
                const opcion = document.createElement('option');
                opcion.value = s;
                opcion.textContent = s;
                selector.appendChild(opcion);
            });
            if (simbolos.length) {
                this.simboloActual = simbolos[0];
                selector.value = simbolos[0];
            }
            console.log(`%c[CONEXIÓN] 📋 Símbolos: ${simbolos.join(', ')}`, 'color:#94a3b8');
        }

        // Cuando el servidor envía los datos iniciales (histórico de ticks)
        _alRecibirInicio(mensaje) {
            this.simboloActual = mensaje.symbol;
            this.ticksCrudos = mensaje.data || [];    // ticks crudos históricos recibidos del servidor
            this.maximoSesion = -Infinity;
            this.minimoSesion = Infinity;
            this.volumenTotal = 0;
            this.totalTicks = 0;
            this.primerPrecio = 0;
            this.agrupadorVelas.fromHistory(this.ticksCrudos); // reconstruir velas desde los ticks
            this.estadoPrecio.resetZoom();

            if (this.ticksCrudos.length) {
                this.primerPrecio = this.ticksCrudos[0].value;
                this.ticksCrudos.forEach(tick => {
                    if (tick.value > this.maximoSesion) this.maximoSesion = tick.value;
                    if (tick.value < this.minimoSesion) this.minimoSesion = tick.value;
                    this.precioActual = tick.value;
                    this.totalTicks++;
                });
                this.volumenTotal = this.ticksCrudos.length;
            }

            console.log(`%c[DATOS] 📈 ${mensaje.symbol}: ${this.ticksCrudos.length} puntos | $${this.minimoSesion?.toFixed(2) || '—'} – $${this.maximoSesion > -Infinity ? this.maximoSesion.toFixed(2) : '—'}`, 'color:#a78bfa;font-weight:bold');
        }

        // Cuando el servidor envía información de la sesión de mercado
        _alRecibirSesion(mensaje) {
            const etiqueta = document.getElementById('session-badge');
            const SESION_CORTA = {
                'PRE_MARKET': 'PRE-MARKET',
                'REGULAR': 'REGULAR',
                'AFTER_HOURS': 'AFTER HOURS',
                'CLOSED': 'CERRADO'
            };
            etiqueta.textContent = SESION_CORTA[mensaje.session] || mensaje.session;
            etiqueta.className = 'session-badge ' + mensaje.session;
            console.log(`%c[SESIÓN] ${mensaje.label} | ${mensaje.time_et}`, 'color:#f59e0b;font-weight:bold');
        }

        // Cuando llega un nuevo tick de precio en tiempo real
        _alRecibirTick(mensaje) {
            if (this.estaPausado) return; // ignorar ticks si está pausado
            const { value: precio, time: tiempo } = mensaje;
            this.ticksCrudos.push({ time: tiempo, value: precio }); // guardar tick crudo
            // Limitar memoria: si hay más de 50,000 ticks, quedarse con los últimos 30,000
            if (this.ticksCrudos.length > 50000) this.ticksCrudos = this.ticksCrudos.slice(-30000);

            this.precioActual = precio;
            if (!this.primerPrecio) this.primerPrecio = precio;
            if (precio > this.maximoSesion) this.maximoSesion = precio;
            if (precio < this.minimoSesion) this.minimoSesion = precio;
            this.volumenTotal++;
            this.totalTicks++;
            this.contadorTicksVentana++;

            this.agrupadorVelas.tick(tiempo, precio); // alimentar el agrupador con el nuevo tick
            document.getElementById('m-last').textContent = '$' + precio.toFixed(2);
            document.getElementById('m-ticks').textContent = this.totalTicks.toLocaleString();
            document.getElementById('m-candles').textContent = this.agrupadorVelas.all().length;
        }

        // Actualizar tooltip con datos OHLC de la vela bajo el cursor
        _actualizarTooltip() {
            const todasLasVelas = this.agrupadorVelas.all();
            const velasVisibles = this.motorVelas.visible(todasLasVelas);
            const espacioEntreVelas = this.anchoGrafico / this.motorVelas.visibleCount;
            const indiceVela = Math.floor(this.cruceta.mx / espacioEntreVelas); // a qué vela apunta el ratón
            if (indiceVela >= 0 && indiceVela < velasVisibles.length) {
                const vela = velasVisibles[indiceVela];
                const panelInfo = document.getElementById('crosshair-info');
                panelInfo.style.display = 'block';
                const esAlcista = vela.close >= vela.open; // true si la vela subió
                const claseColor = esAlcista ? 'positive' : 'negative';
                document.getElementById('ci-open').textContent = '$' + vela.open.toFixed(2);
                document.getElementById('ci-high').textContent = '$' + vela.high.toFixed(2);
                document.getElementById('ci-low').textContent = '$' + vela.low.toFixed(2);
                document.getElementById('ci-close').textContent = '$' + vela.close.toFixed(2);
                document.getElementById('ci-vol').textContent = vela.volume.toLocaleString();
                ['ci-open', 'ci-high', 'ci-low', 'ci-close'].forEach(id => {
                    document.getElementById(id).className = 'val ' + claseColor;
                });
            }
        }

        // ─── BUCLE DE RENDERIZADO (se ejecuta ~60 veces por segundo) ────────────────────────
        _iniciarBucleDibujo() {
            const bucle = () => {
                this.contadorCuadros++;
                const ahora = Date.now();

                // Calcular FPS (cuadros por segundo)
                if (ahora - this.ultimoTiempoFps >= 1000) {
                    this.cuadrosPorSegundo = this.contadorCuadros;
                    this.contadorCuadros = 0;
                    this.ultimoTiempoFps = ahora;
                    document.getElementById('stat-fps').textContent = this.cuadrosPorSegundo;
                }
                // Calcular TPS (ticks por segundo)
                if (ahora - this.ultimoTiempoTps >= 1000) {
                    this.ticksPorSegundo = this.contadorTicksVentana;
                    this.contadorTicksVentana = 0;
                    this.ultimoTiempoTps = ahora;
                    document.getElementById('stat-tps').textContent = this.ticksPorSegundo;
                }

                const todasLasVelas = this.agrupadorVelas.all();

                // Auto-rango: calcular rango de precios desde las velas visibles
                this.motorVelas.computeAutoRange(todasLasVelas);

                // ── AUTO-RECUPERACIÓN: NaN=instantáneo, fuera de pantalla=retardado 2s ──
                if (!this.estadoPrecio.autoRange) {
                    if (!this.estadoPrecio.hasValidRange()) {
                        // Rango de precios inválido (NaN) → recuperar inmediatamente
                        console.warn('[SEGURIDAD] Rango de precios inválido — auto-recuperando');
                        this.estadoPrecio.resetZoom();
                        this.motorVelas.computeAutoRange(todasLasVelas);
                        this.estadoPrecio._offScreenSince = 0;
                    } else {
                        // Verificar si las velas están fuera de la vista
                        const velasVisibles = this.motorVelas.visible(todasLasVelas);
                        if (velasVisibles.length > 0) {
                            let minimoVisible = Infinity, maximoVisible = -Infinity;
                            velasVisibles.forEach(vela => {
                                if (vela.low < minimoVisible) minimoVisible = vela.low;
                                if (vela.high > maximoVisible) maximoVisible = vela.high;
                            });
                            if (maximoVisible < this.estadoPrecio.priceMin || minimoVisible > this.estadoPrecio.priceMax) {
                                // Velas completamente fuera de pantalla
                                if (!this.estadoPrecio._offScreenSince) {
                                    this.estadoPrecio._offScreenSince = ahora; // marcar inicio
                                } else if (ahora - this.estadoPrecio._offScreenSince > 1000) {
                                    // Llevan más de 1s fuera → recuperar
                                    console.warn('[SEGURIDAD] Velas fuera de pantalla por 2s — auto-recuperando');
                                    this.estadoPrecio.resetZoom();
                                    this.motorVelas.computeAutoRange(todasLasVelas);
                                    this.estadoPrecio._offScreenSince = 0;
                                }
                            } else {
                                this.estadoPrecio._offScreenSince = 0; // velas visibles, todo bien
                            }
                        }
                    }
                } else {
                    this.estadoPrecio._offScreenSince = 0;
                }

                // Renderizar todos los componentes visuales
                this.motorVelas.render(this.anchoGrafico, this.altoGrafico, todasLasVelas);
                this.cruceta.render(this.anchoGrafico, this.altoGrafico);
                this.renderizadorEje.render(this.anchoEje, this.altoEje, this.precioActual, this.primerPrecio);
                this.motorLibroOrdenes.syncScale(this.estadoPrecio.priceMin, this.estadoPrecio.priceMax);

                // Actualizar eje de tiempo (máximo cada 500ms)
                if (ahora - this._ultimaActualizacionEjeTiempo > 500) {
                    this._ultimaActualizacionEjeTiempo = ahora;
                    this._actualizarEjeTiempo(todasLasVelas);
                }

                this._actualizarInterfaz();
                requestAnimationFrame(bucle);
            };
            requestAnimationFrame(bucle);
        }

        // Actualizar indicadores de la interfaz (precio, cambio %, volumen, etc.)
        _actualizarInterfaz() {
            const precio = this.precioActual;
            if (!precio) return;
            const cambio = precio - this.primerPrecio;                                    // cambio absoluto en dólares
            const porcentaje = this.primerPrecio ? (cambio / this.primerPrecio * 100) : 0;    // cambio porcentual
            const esPositivo = cambio >= 0;

            document.getElementById('live-price').textContent = '$' + precio.toFixed(2);
            document.getElementById('live-price').className = 'ticker-price ' + (esPositivo ? 'positive' : 'negative');
            document.getElementById('live-change').textContent = `${esPositivo ? '+' : ''}${cambio.toFixed(2)} (${porcentaje.toFixed(2)}%)`;
            document.getElementById('live-change').className = 'ticker-change ' + (esPositivo ? 'bg-positive' : 'bg-negative');
            document.getElementById('stat-vol').textContent = this.volumenTotal > 1000 ? (this.volumenTotal / 1000).toFixed(0) + 'K' : this.volumenTotal;
            document.getElementById('stat-high').textContent = this.maximoSesion > -Infinity ? '$' + this.maximoSesion.toFixed(2) : '$—';
            document.getElementById('stat-low').textContent = this.minimoSesion < Infinity ? '$' + this.minimoSesion.toFixed(2) : '$—';
        }

        // Actualizar las etiquetas del eje horizontal de tiempo
        _actualizarEjeTiempo(todasLasVelas) {
            const contenedorTiempo = document.getElementById('time-axis');
            contenedorTiempo.innerHTML = '';
            const velasVisibles = this.motorVelas.visible(todasLasVelas);
            if (!velasVisibles.length) return;
            const espacioEntreVelas = this.anchoGrafico / this.motorVelas.visibleCount;
            const paso = Math.max(1, Math.floor(this.motorVelas.visibleCount / 8)); // mostrar ~8 etiquetas
            velasVisibles.forEach((vela, indice) => {
                if (indice % paso === 0) {
                    const posicionX = indice * espacioEntreVelas + espacioEntreVelas / 2;
                    const fecha = new Date(vela.time * 1000);
                    const etiqueta = document.createElement('div');
                    etiqueta.className = 'time-label';
                    etiqueta.style.left = posicionX + 'px';
                    etiqueta.textContent =
                        fecha.getHours().toString().padStart(2, '0') + ':' +
                        fecha.getMinutes().toString().padStart(2, '0') + ':' +
                        fecha.getSeconds().toString().padStart(2, '0');
                    contenedorTiempo.appendChild(etiqueta);
                }
            });
        }
    }

    // ─── ARRANQUE ────────────────────────────
    window.addEventListener('DOMContentLoaded', () => {
        console.log('%c╔═══════════════════════════════════════════════════════╗', 'color:#06b6d4');
        console.log('%c║ MarketDepth Core — CHART + DOM DEPTH                 ║', 'color:#06b6d4;font-weight:bold;font-size:13px');
        console.log('%c╚═══════════════════════════════════════════════════════╝', 'color:#06b6d4');
        console.log('%c[CONEXIÓN] ⏱ Iniciando conexiones WebSocket...', 'color:#f59e0b');
        window.app = new MarketDepthCore();
    });
})();