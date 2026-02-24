/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  WidgetGraficaVelas.js — Gráfica de Velas en Tiempo Real                  ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Motores internos (de motores_chart.js — sin dependencias externas):        ║
 * ║    SharedPriceState  → rango de precios / zoom vertical                     ║
 * ║    OHLCAggregator    → agrupa ticks en velas OHLC por timeframe             ║
 * ║    CandleEngine      → renderiza velas, pan horizontal, zoom                ║
 * ║    Crosshair         → líneas del cursor sobre la gráfica                   ║
 * ║                                                                              ║
 * ║  Características:                                                            ║
 * ║    ✓ Historial de hasta 500 velas por activo                               ║
 * ║    ✓ Pan (arrastrar) horizontal suave con fracción sub-vela                 ║
 * ║    ✓ Zoom horizontal (scroll) y vertical (Shift+scroll)                     ║
 * ║    ✓ Pausa manual + banner de Bolsa Cerrada automático                      ║
 * ║    ✓ Cada activo tiene su propio estado aislado                             ║
 * ║    ✓ Emite CAMBIO_PRECIO para sincronizar el WidgetGraficaEje y el OB      ║
 * ║  Dependencias: motores_chart.js (cargar antes en Pruebav2.html)             ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

class WidgetGraficaVelas extends ClaseBaseWidget {

    // ════════════════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ════════════════════════════════════════════════════════════════════════

    constructor(contenedor, configuracion = {}) {
        super(contenedor, configuracion);

        // ── Motores (instanciados al renderizar, cuando el DOM existe) ──
        /** @type {SharedPriceState} */
        this.estadoPrecio = null;
        /** @type {OHLCAggregator} */
        this.agregador = null;
        /** @type {CandleEngine} */
        this.motorVelas = null;
        /** @type {Crosshair} */
        this.crosshair = null;

        // ── Estado por activo ──
        this._simbolo = configuracion.simbolo || 'AAPL';
        this._mercado = configuracion.mercado || 'NASDAQ';
        this._timeframe = configuracion.timeframe || 60;   // segundos
        this._precisionPrecio = configuracion.precision || 2;
        this._esCrypto = false;

        // ── Cache de velas por símbolo (evita re-llamar REST al revisitar) ──
        // Formato: simbolo → { candles, rawTicks, timeframe, ts }
        this._symbolCache = new Map();

        // Buffer de ticks crudos (max 50 000, para recalcular al cambiar TF)
        this._rawTicks = [];

        // Estado de precio en tiempo real
        this._precioActual = 0;
        this._precioInicial = 0;
        this._sessionHigh = -Infinity;
        this._sessionLow = Infinity;

        // Pausa y sesión
        this._pausaManual = false;
        this._pausaAutomatica = false;  // pausa por cierre de mercado (automática)
        this._mercadoCerrado = false;
        this._sesionAnterior = null;    // para detectar transiciones de sesión

        // ── Sistema de Banderas de Sesión ──
        // Cada bandera: { timestamp, precio, tipo, label, color, fijada }
        // fijada=false → sigue el precio actual; fijada=true → precio fijo al cerrar la sesión
        this._banderas = [];
        this._maxBanderas = 50;        // límite para eventos históricos


        // Arrastre
        this._dragging = false;
        this._dragStartX = 0;

        // rAF
        this._rafId = null;
        this._ultimoTimeAxis = 0;
        this._ultimoEmitPrecio = 0;

        // Dimensiones del canvas
        this._cw = 0;
        this._ch = 0;

        // Handlers de eventos del DOM (para poder limpiarlos en destruir())
        this._hdMouseMove = null;
        this._hdMouseUp = null;

        // Referencia al eje (se inyecta desde fuera)
        this._widgetEje = null;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  CICLO DE VIDA
    // ════════════════════════════════════════════════════════════════════════

    inicializar() {
        super.inicializar();

        // Verificar que motores_chart.js está cargado
        if (typeof SharedPriceState === 'undefined') {
            console.error('[WidgetGraficaVelas] ❌ motores_chart.js no está cargado. ' +
                'Carga motores_chart.js antes que WidgetGraficaVelas.js en Pruebav2.html.');
            return;
        }

        // Suscripciones al bus de eventos
        this._escuchar(EVENTOS.CAMBIO_ACTIVO, (payload) => this._alCambiarActivo(payload));
        this._escuchar(EVENTOS.CAMBIO_TIMEFRAME, (payload) => this._alCambiarTimeframe(payload));

        // Datos que llegan del GestorWidgets via bus
        this._escuchar(EVENTOS.DATOS_INIT, (payload) => this._onInit(payload));
        this._escuchar(EVENTOS.DATOS_TICK, (payload) => this._onTick(payload));
        this._escuchar(EVENTOS.SESION_MERCADO, (payload) => this._onSession(payload));

        // ── Sincronización de precio con el Order Book ──────────────────────
        // PRECIO_OB_SYNC llega con el mid_price del L2 (Polygon Quotes WS).
        // Solo actualizamos _precioActual y el display — NO el agregador de velas.
        this._escuchar(EVENTOS.PRECIO_OB_SYNC, (payload) => {
            const sym = payload.simbolo || payload.symbol;
            if (sym && sym !== this._simbolo) return;   // filtrar por activo activo
            const p = payload.value;
            if (typeof p !== 'number' || !isFinite(p) || p <= 0) return;
            this._precioActual = p;
            this._actualizarPrecioUI();                 // actualizar display sin tocar velas
        });
    }

    renderizar() {
        this.contenedor.innerHTML = '';
        this.contenedor.classList.add('v2-grafica-wrap');

        // ── Zona principal: canvas + overlay ──
        this._zonaChart = document.createElement('div');
        this._zonaChart.className = 'v2-grafica-zona';

        // Canvas de velas (dibujado por MotorVelas)
        this._canvasVelas = document.createElement('canvas');
        this._canvasVelas.className = 'v2-canvas-velas';
        this._zonaChart.appendChild(this._canvasVelas);

        // Canvas del crosshair (capa sobre las velas)
        this._canvasCrosshair = document.createElement('canvas');
        this._canvasCrosshair.className = 'v2-canvas-crosshair';
        this._zonaChart.appendChild(this._canvasCrosshair);

        // ── Tooltip OHLCV (esquina superior izquierda) ──
        this._tooltip = document.createElement('div');
        this._tooltip.className = 'v2-grafica-tooltip';
        this._tooltip.style.display = 'none';
        this._zonaChart.appendChild(this._tooltip);

        // ── Banner "Bolsa Cerrada" ──
        this._banner = this._crearBanner();
        this._zonaChart.appendChild(this._banner);

        // ── Banner de "Pausa Manual" ──
        this._bannerPausa = this._crearBannerPausa();
        this._zonaChart.appendChild(this._bannerPausa);

        // ── Overlay de carga ──
        this._overlayLoading = this._crearOverlayLoading();
        this._zonaChart.appendChild(this._overlayLoading);

        // ── Toolbar interna (símbolo + timeframe + controles) ──
        this._toolbar = this._crearToolbar();
        this._zonaChart.appendChild(this._toolbar);

        // ── Eje de tiempo (barra inferior) ──
        this._ejeTiempo = document.createElement('div');
        this._ejeTiempo.className = 'v2-eje-tiempo';

        // Ensamblar
        this.contenedor.appendChild(this._zonaChart);
        this.contenedor.appendChild(this._ejeTiempo);

        // Instanciar motores con los canvas ya en el DOM
        this._inicializarMotores();

        // Escuchar redimensionado del contenedor
        this._resizeObserver = new ResizeObserver(() => this._resize());
        this._resizeObserver.observe(this._zonaChart);

        // Eventos de interacción
        this._bindEventos();

        // Redibujar en base al canvas actual (primer intento — DOM puede no tener layout aún)
        this._resize();

        // Segundo intento después de un frame: garantiza que el CSS grid ya calculó el layout
        setTimeout(() => this._resize(), 0);
        setTimeout(() => this._resize(), 100);

        // Iniciar bucle rAF
        this._iniciarLoop();
    }

    destruir() {
        if (this._rafId) cancelAnimationFrame(this._rafId);
        if (this._resizeObserver) this._resizeObserver.disconnect();

        // Handlers globales
        if (this._hdMouseMove) window.removeEventListener('mousemove', this._hdMouseMove);
        if (this._hdMouseUp) window.removeEventListener('mouseup', this._hdMouseUp);

        super.destruir();
    }

    // ════════════════════════════════════════════════════════════════════════
    //  API PÚBLICA
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Vincula el widget del eje de precio para que comparta el SharedPriceState.
     * @param {WidgetGraficaEje} widgetEje
     */
    vincularEje(widgetEje) {
        this._widgetEje = widgetEje;
        if (widgetEje && this.estadoPrecio) {
            widgetEje.actualizarEstadoPrecio(this.estadoPrecio);
        }
    }

    /**
     * Alimenta datos históricos + ticks (llamado por GestorWidgets o desde fuera).
     * @param {object} msg — mensaje tipo 'init' del WS: { symbol, data[], source }
     */
    cargarInicio(msg) {
        this._procesarMensajeChart({ type: 'init', ...msg });
    }

    /**
     * Alimenta un tick en tiempo real.
     * @param {object} msg — { type:'tick', value, time, symbol }
     */
    feedTick(msg) {
        this._procesarMensajeChart(msg);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  INICIALIZACIÓN INTERNA
    // ════════════════════════════════════════════════════════════════════════

    _inicializarMotores() {
        this.estadoPrecio = new SharedPriceState();
        this.agregador = new OHLCAggregator(this._timeframe);
        this.motorVelas = new CandleEngine(this._canvasVelas, this.estadoPrecio);
        this.crosshair = new Crosshair(this._canvasCrosshair);

        // Compartir estadoPrecio con el eje (si ya está vinculado)
        if (this._widgetEje) {
            this._widgetEje.actualizarEstadoPrecio(this.estadoPrecio);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  EVENTOS DE USUARIO (pan, zoom, crosshair, doble clic)
    // ════════════════════════════════════════════════════════════════════════

    _bindEventos() {
        const cc = this._canvasCrosshair;

        // ── Crosshair: mover ──
        cc.addEventListener('mousemove', (e) => {
            if (this._dragging) return;
            const r = cc.getBoundingClientRect();
            this.crosshair.mx = e.clientX - r.left;
            this.crosshair.my = e.clientY - r.top;
            this.crosshair.on = true;
            this._mostrarTooltip(e.clientX - r.left);
        });

        cc.addEventListener('mouseleave', () => {
            this.crosshair.on = false;
            if (this._tooltip) this._tooltip.style.display = 'none';
        });

        // ── Pan horizontal: arrastrar ──
        cc.addEventListener('mousedown', (e) => {
            this._dragging = true;
            this._dragStartX = e.clientX;
            this.crosshair.on = false;
            cc.style.cursor = 'grabbing';
            e.preventDefault();
        });

        // Handlers globales para pan (siguen funcionando si el cursor sale del canvas)
        this._hdMouseMove = (e) => {
            if (!this._dragging) return;
            const dx = e.clientX - this._dragStartX;
            this._dragStartX = e.clientX;
            if (dx !== 0) {
                const moved = this.motorVelas.pan(-dx, this._cw);
                if (moved) this.estadoPrecio.autoRange = true;
            }
        };
        this._hdMouseUp = () => {
            if (!this._dragging) return;
            this._dragging = false;
            cc.style.cursor = 'crosshair';
            this.crosshair.on = true;
            // Snap fraccional al soltar
            this.motorVelas._fraccionDesplazamiento = 0;
            this.motorVelas._pixelesAcumulados = 0;
            this.estadoPrecio.autoRange = true;
        };
        window.addEventListener('mousemove', this._hdMouseMove);
        window.addEventListener('mouseup', this._hdMouseUp);

        // ── Zoom horizontarl (scroll normal) y vertical (Shift+scroll) ──
        cc.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.shiftKey) {
                // Zoom vertical
                const rect = cc.getBoundingClientRect();
                const centerRatio = (e.clientY - rect.top) / rect.height;
                this.estadoPrecio.applyManualZoom(e.deltaY > 0 ? 5 : -5, centerRatio);
            } else {
                // Zoom horizontal (más velas / menos velas)
                this.motorVelas.zoom(e.deltaY > 0 ? 1.08 : 0.92);
            }
        }, { passive: false });

        // ── Doble clic: reset pan ──
        cc.addEventListener('dblclick', () => {
            this.motorVelas.resetPan();
            this.estadoPrecio.autoRange = true;
        });

        // Touch básico para mobile (pan)
        let _touchX = 0;
        cc.addEventListener('touchstart', (e) => {
            _touchX = e.touches[0].clientX;
            e.preventDefault();
        }, { passive: false });
        cc.addEventListener('touchmove', (e) => {
            const dx = _touchX - e.touches[0].clientX;
            _touchX = e.touches[0].clientX;
            const moved = this.motorVelas.pan(dx, this._cw);
            if (moved) this.estadoPrecio.autoRange = true;
            e.preventDefault();
        }, { passive: false });
    }

    // ════════════════════════════════════════════════════════════════════════
    //  RESIZE (DPR correcto)
    // ════════════════════════════════════════════════════════════════════════

    _resize() {
        if (!this._zonaChart) return;
        const dpr = window.devicePixelRatio || 1;

        // getBoundingClientRect da dimensiones reales aunque el contenido sea position:absolute
        const rect = this._zonaChart.getBoundingClientRect();
        let w = Math.round(rect.width);
        let h = Math.round(rect.height);

        // Fallback: leer del contenedor padre si la zona no tiene dimensiones
        if (!w || !h) {
            const prect = this.contenedor.getBoundingClientRect();
            w = Math.round(prect.width);
            h = Math.round(prect.height) - 22; // restar eje de tiempo (22px)
        }

        if (!w || !h) return;

        const fijar = (canvas) => {
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        fijar(this._canvasVelas);
        fijar(this._canvasCrosshair);
        this._cw = w;
        this._ch = h;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  BUCLE DE RENDERIZADO (60 fps)
    // ════════════════════════════════════════════════════════════════════════

    _iniciarLoop() {
        const loop = () => {
            this._rafId = requestAnimationFrame(loop);
            if (!this.motorVelas) return;

            // Si las dimensiones son 0, intentar resize (puede ocurrir justo al montar el widget)
            if (!this._cw) { this._resize(); return; }

            const todas = this.agregador.all();

            // Auto-rango de precio según velas visibles
            this.motorVelas.computeAutoRange(todas);

            // Auto-recuperación: si el rango se invalida, resetear
            if (!this.estadoPrecio.autoRange && !this._dragging) {
                if (!this.estadoPrecio.hasValidRange()) {
                    this.estadoPrecio.resetZoom();
                    this.motorVelas.computeAutoRange(todas);
                }
            }

            // Renderizar velas y crosshair
            this.motorVelas.render(this._cw, this._ch, todas);

            // Renderizar banderas de sesión (sobre el mismo canvas de velas, encima de velas)
            this.dibujarBanderas(this.motorVelas.ctx, this._cw, this._ch, todas);

            this.crosshair.render(this._cw, this._ch);

            // Eje de tiempo (cada 500ms para no sobrecargar el DOM)
            const ahora = Date.now();
            if (ahora - this._ultimoTimeAxis > 500) {
                this._ultimoTimeAxis = ahora;
                this._actualizarEjeTiempo(todas);
            }

            // Emitir precio hacia el Eje y el OrderBook (throttle 100ms)
            if (ahora - this._ultimoEmitPrecio > 100 && this._precioActual) {
                this._ultimoEmitPrecio = ahora;
                this._emitir(EVENTOS.CAMBIO_PRECIO, {
                    simbolo: this._simbolo,
                    precio: this._precioActual,
                    precioMin: this.estadoPrecio.priceMin,
                    precioMax: this.estadoPrecio.priceMax,
                });
            }
        };
        requestAnimationFrame(loop);

        // ── DIAGNÓSTICO: log único 200ms después de iniciar ──
        setTimeout(() => {
            const rect = this._zonaChart?.getBoundingClientRect();
            console.log(
                `[GraficaVelas] 🔧 DIAGNÓSTICO loop | _cw=${this._cw} _ch=${this._ch} | ` +
                `zona=${rect?.width?.toFixed(0)}x${rect?.height?.toFixed(0)} | ` +
                `velas=${this.agregador?.all()?.length} | ` +
                `priceMin=${this.estadoPrecio?.priceMin?.toFixed(2)} priceMax=${this.estadoPrecio?.priceMax?.toFixed(2)}`
            );
        }, 200);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  PROCESAMIENTO DE MENSAJES DEL WEBSOCKET
    // ════════════════════════════════════════════════════════════════════════

    _procesarMensajeChart(msg) {
        switch (msg.type) {
            case 'init': this._onInit(msg); break;
            case 'tick': this._onTick(msg); break;
            case 'session': this._onSession(msg); break;
        }
    }

    _onInit(payload) {
        if (!this.agregador) return;

        // Actualizar timeframe si viene en el payload
        if (payload.timeframe) {
            this._timeframe = payload.timeframe;
            this.agregador.intervalSec = payload.timeframe;
        }

        // Resetear estado del historial
        this._rawTicks = [];
        this._precioActual = 0;
        this._precioInicial = 0;
        this._sessionHigh = -Infinity;
        this._sessionLow = Infinity;
        this.agregador.candles = [];
        this.agregador.current = null;
        this.estadoPrecio.resetZoom();
        this.motorVelas.resetPan();

        // Limpiar banderas de sesión: nuevo historial → banderas frescas
        this._banderas = [];
        this._sesionAnterior = null;

        const sym = payload.simbolo || payload.symbol || this._simbolo;

        // ── CASO 1: Velas OHLC reales {time, open, high, low, close, volume} ──
        if (payload.candles && payload.candles.length) {
            const velas = payload.candles;
            // Cargar directamente en el agregador sin re-procesar
            this.agregador.candles = velas.slice(0, -1);  // todas menos la última
            this.agregador.current = velas[velas.length - 1] || null;  // última como "en formación"
            // Reconstruir rawTicks a partir del close de cada vela
            this._rawTicks = velas.map(v => ({ time: v.time, value: v.close }));
            if (velas.length) {
                const primera = velas[0];
                const ultima = velas[velas.length - 1];
                this._precioInicial = primera.open;
                this._precioActual = ultima.close;
                // FIX (A): usar reduce para evitar RangeError con arrays grandes (500+ velas)
                this._sessionHigh = velas.reduce((max, v) => v.high > max ? v.high : max, -Infinity);
                this._sessionLow = velas.reduce((min, v) => v.low < min ? v.low : min, Infinity);
            }

            // ── Guardar en cache para este símbolo + timeframe ──
            this._symbolCache.set(`${sym}_${this._timeframe}`, {
                candles: velas,
                ts: Date.now(),
            });

            // Ocultar overlay de carga
            this._ocultarOverlayLoading();
            this._actualizarTitulo();
            this._actualizarPrecioUI();   // mostrar precio desde el histórico

            // Reconstruir banderas históricas a partir de los timestamps del histórico
            // (Solo para stocks — crypto opera 24/7)
            // FIX (B): usar método estático compartido para detección de crypto
            const esCryptoLocal = WidgetGraficaVelas._esCriptomoneda(sym);
            const esForexLocal = /^[A-Z]{6}$/.test((sym || '').toUpperCase()) && !esCryptoLocal;  // EURUSD, XAUUSD…
            if (!esCryptoLocal && !esForexLocal) {
                this._detectarBanderasHistoricas(velas);
            }


            console.log(`[GraficaVelas] 📊 Init OHLC ${sym}: ${velas.length} velas (${this._timeframe}s) | Fuente: ${payload.fuente || '—'}`);
            return;
        }

        // ── CASO 2: Ticks crudos {time, value} (formato legacy) ──
        const rawData = payload.datos || payload.data || [];
        this._rawTicks = rawData;
        this.agregador.fromHistory(rawData);
        if (rawData.length) {
            this._precioInicial = rawData[0].value;
            for (const t of rawData) {
                this._precioActual = t.value;
                if (t.value > this._sessionHigh) this._sessionHigh = t.value;
                if (t.value < this._sessionLow) this._sessionLow = t.value;
            }
        }
        // Ocultar overlay
        this._ocultarOverlayLoading();
        this._actualizarTitulo();

        const velas = this.agregador.all();
        console.log(`[GraficaVelas] 📊 Init ${sym}: ${rawData.length} ticks → ${velas.length} velas (${this._timeframe}s) | Fuente: ${payload.fuente || '—'}`);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  DETECCIÓN DE SESIONES EN HISTÓRICO
    // ════════════════════════════════════════════════════════════════════════

    /**
     * _sesionDesdeTiempo — Dada una marca de tiempo Unix (segundos UTC),
     * devuelve el nombre de la sesión de mercado correspondiente.
     * Usa hora ET (EST = UTC-5 en invierno, EDT = UTC-4 en verano).
     * Bandas aproximadas (ET):
     *   04:00 - 09:30  → pre_market
     *   09:30 - 16:00  → regular
     *   16:00 - 20:00  → after_hours
     *   resto           → closed
     */
    _sesionDesdeTiempo(tsUnix) {
        // FIX (4): usar Intl.DateTimeFormat con timeZone 'America/New_York' para
        // calcular la hora ET de forma correcta, incluyendo DST automáticamente.
        const fecha = new Date(tsUnix * 1000);

        const partes = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: 'numeric',
            weekday: 'short',
            hour12: false,
        }).formatToParts(fecha);

        const get = (type) => partes.find(p => p.type === type)?.value ?? '';
        const weekday = get('weekday');          // 'Sat', 'Sun', 'Mon'…
        const horaET = parseInt(get('hour'), 10) + parseInt(get('minute'), 10) / 60;

        if (weekday === 'Sat' || weekday === 'Sun') return 'closed';

        if (horaET >= 4.0 && horaET < 9.5) return 'pre_market';
        if (horaET >= 9.5 && horaET < 16.0) return 'regular';
        if (horaET >= 16.0 && horaET < 20.0) return 'after_hours';
        return 'closed';
    }

    /**
     * _detectarBanderasHistoricas — Escanea las velas del histórico,
     * detecta cada cambio de sesión y crea la bandera correspondiente.
     * Se llama UNA vez al cargar _onInit.
     */
    _detectarBanderasHistoricas(velas) {
        if (!velas || velas.length < 2) return;

        // En timeframes >= 1H cada vela no representa un minuto → la sesión por timestamp
        // no puede detectar transiciones intra-día. Saltamos para evitar banderas erróneas.
        const tf = this._timeframe || 60;
        if (tf >= 3600) {
            console.log(`[GraficaVelas] 🚩 Banderas históricas omitidas en timeframe >= 1H (tf=${tf}s)`);
            return;
        }

        // ── Solo 3 banderas: OPEN (9:30 ET), AFTER (16:00 ET), CIERRE (20:00 ET) ──
        // Reglas:
        //   regular      ← desde pre_market o closed  → OPEN
        //   after_hours  ← desde regular              → AFTER
        //   closed       ← desde after_hours          → CIERRE (fin de trading)
        // NO se genera bandera para: pre_market, ni closed desde otro estado que no sea after_hours

        let sesionPrevia = this._sesionDesdeTiempo(velas[0].time);
        let banderasCreadas = 0;
        let ultimaSesion = sesionPrevia;

        // FIX (C): set de timestamps usados para evitar banderas duplicadas
        const tsUsados = new Set();

        for (let i = 1; i < velas.length; i++) {
            const vela = velas[i];
            const sesion = this._sesionDesdeTiempo(vela.time);
            ultimaSesion = sesion;

            if (sesion !== sesionPrevia) {
                // Guard: no crear dos banderas en el mismo timestamp
                if (!tsUsados.has(vela.time)) {
                    // ── OPEN: mercado regular abre desde pre_market o closed ──
                    if (sesion === 'regular') {
                        this._banderas.push({
                            tipo: 'OPEN', label: 'OPEN', color: '#22c55e',
                            timestamp: vela.time, precio: vela.open, fijada: true
                        });
                        tsUsados.add(vela.time);
                        banderasCreadas++;
                    }
                    // ── AFTER: inicia after-hours (solo desde regular) ──
                    else if (sesion === 'after_hours' && sesionPrevia === 'regular') {
                        this._banderas.push({
                            tipo: 'AFTER', label: 'AFTER', color: '#fb923c',
                            timestamp: vela.time, precio: vela.open, fijada: true
                        });
                        tsUsados.add(vela.time);
                        banderasCreadas++;
                    }
                    // ── CIERRE: trading termina (after_hours → closed) ──
                    else if (sesion === 'closed' && sesionPrevia === 'after_hours') {
                        this._banderas.push({
                            tipo: 'CIERRE', label: 'CIERRE', color: '#6b7280',
                            timestamp: vela.time, precio: vela.open, fijada: true
                        });
                        tsUsados.add(vela.time);
                        banderasCreadas++;
                    }
                }
                sesionPrevia = sesion;
            }
        }

        this._sesionAnterior = ultimaSesion;

        if (this._banderas.length > this._maxBanderas) {
            this._banderas = this._banderas.slice(-this._maxBanderas);
        }

        console.log(`[GraficaVelas] 🚩 ${banderasCreadas} banderas históricas (OPEN/AFTER/CIERRE) | sesión: ${ultimaSesion}`);
    }

    _onTick(payload) {
        if (!this.agregador) return;
        if (this._pausaManual) return;
        if (this._pausaAutomatica && !this._esCrypto) return;  // pausa automática por cierre de mercado
        if (this._mercadoCerrado && !this._esCrypto) return;

        // GestorWidgets emite: { simbolo, time, value }
        const sym = payload.simbolo || payload.symbol;
        if (sym && sym !== this._simbolo) return;  // filtrar por activo

        const p = payload.value;
        const t = payload.time;
        if (typeof p !== 'number' || !isFinite(p)) return;

        this._rawTicks.push({ time: t, value: p });
        if (this._rawTicks.length > 50000) this._rawTicks = this._rawTicks.slice(-30000);

        const prevPrecio = this._precioActual;
        this._precioActual = p;
        if (!this._precioInicial) this._precioInicial = p;
        if (p > this._sessionHigh) this._sessionHigh = p;
        if (p < this._sessionLow) this._sessionLow = p;

        // ── Log en consola: confirmar datos en tiempo real ──
        // Solo loguea cada 5 ticks para no saturar la consola
        this._tickCount = (this._tickCount || 0) + 1;
        if (this._tickCount % 5 === 1) {
            const cambio = prevPrecio > 0 ? (p - prevPrecio).toFixed(3) : 'n/a';
            console.log(`[📡 ${this._simbolo}] Tick #${this._tickCount} | $${p.toFixed(2)} | Δ${cambio} | ${new Date(t * 1000).toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} ET`);
        }

        // Actualizar display de precio en el toolbar
        this._actualizarPrecioUI();

        this.agregador.tick(t, p);
    }

    _onSession(msg) {
        // Detectar tipo de sesión
        const CRYPTO_SYMBOLS = new Set([
            'BTCUSD', 'ETHUSD', 'DOGEUSD', 'SOLUSD', 'XRPUSD',
            'ADAUSD', 'LTCUSD', 'AVAXUSD', 'LINKUSD', 'MATICUSD',
            'BNBUSD', 'DOTUSD', 'UNIUSD', 'ATOMUSD',
        ]);
        this._esCrypto = CRYPTO_SYMBOLS.has((this._simbolo || '').toUpperCase());

        const estabaCerrado = this._mercadoCerrado;

        if (this._esCrypto) {
            this._mercadoCerrado = false;
            this._pausaAutomatica = false;
            this._ocultarBanner();
            this._actualizarBadgeSesion({ session: 'regular', label: '24/7', is_open: true });
            return;
        }

        // Normalizar nombre de sesión (servidor puede enviar CLOSED, closed, after hours, etc.)
        const sesionRaw = (msg.session || '').toLowerCase().trim();
        const sesion = sesionRaw.replace(/\s+/g, '_'); // 'after hours' → 'after_hours'

        const ahoraTs = Math.floor(Date.now() / 1000);
        const sesionAnterior = this._sesionAnterior;
        this._sesionAnterior = sesion;

        // ─── Detectar transiciones de sesión ───────────────────────────────
        const transicion = sesion !== sesionAnterior;

        if (transicion && sesionAnterior !== null) {
            // Fijar precio en la bandera anterior (si existe y no está fijada)
            const ultimaBandera = this._banderas[this._banderas.length - 1];
            if (ultimaBandera && !ultimaBandera.fijada) {
                ultimaBandera.precio = this._precioActual || ultimaBandera.precio;
                ultimaBandera.fijada = true;
            }

            // ── Solo 3 banderas en tiempo real: OPEN, AFTER, CIERRE ──
            // OPEN  → cuando regular comienza (desde pre_market o closed)
            if (sesion === 'regular') {
                this.anadirBandera({ tipo: 'OPEN', label: 'OPEN', color: '#22c55e', timestamp: ahoraTs });
            }
            // AFTER → cuando after_hours comienza (solo desde regular)
            else if (sesion === 'after_hours' && sesionAnterior === 'regular') {
                this.anadirBandera({ tipo: 'AFTER', label: 'AFTER', color: '#fb923c', timestamp: ahoraTs });
            }
            // CIERRE → cuando trading termina (after_hours → closed)
            else if (sesion === 'closed' && sesionAnterior === 'after_hours') {
                this.anadirBandera({ tipo: 'CIERRE', label: 'CIERRE', color: '#6b7280', timestamp: ahoraTs });
            }
        }

        // ─── Gestión de pausa automática ───────────────────────────────────
        this._mercadoCerrado = (sesion === 'closed');

        if (this._mercadoCerrado && !estabaCerrado) {
            // Acaba de cerrarse → pausar y emitir evento
            // FIX (1): llamar directamente al método correcto (evitar alias confuso)
            this._pausarGraficaAutomatica();
            this._emitir(EVENTOS.ESTADO_MERCADO_CERRADO, {
                simbolo: this._simbolo,
                timestamp: ahoraTs,
                es_fin_semana: msg.is_weekend || false,
            });
        } else if (!this._mercadoCerrado && estabaCerrado) {
            // Acaba de abrirse → reanudar y emitir evento
            this._reanudarGraficaAutomatica();
            this._emitir(EVENTOS.ESTADO_MERCADO_ABIERTO, {
                simbolo: this._simbolo,
                timestamp: ahoraTs,
                sesion,
            });
        }

        // ─── Badge de sesión en toolbar ────────────────────────────────────
        this._actualizarBadgeSesion({
            session: sesion,
            label: msg.label || msg.session || sesion,
            is_open: msg.is_open,
        });

        // ─── Banner de bolsa cerrada ────────────────────────────────────────
        if (this._mercadoCerrado) {
            const textoSubtitulo = msg.is_weekend
                ? 'Reapertura: Lunes 4:00 AM ET'
                : `Próxima sesión: ${msg.next_open || 'PRE-MARKET 4:00 AM ET'}`;
            this._mostrarBanner(textoSubtitulo);
        } else {
            this._ocultarBanner();
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  SISTEMA DE BANDERAS DE SESIÓN
    // ════════════════════════════════════════════════════════════════════════

    /**
     * anadirBandera — Registra una nueva bandera en el sistema.
     * La bandera sigue el precio actual hasta fijarse al cerrarse la sesión.
     */
    anadirBandera({ tipo, label, color, timestamp }) {
        const ts = timestamp || Math.floor(Date.now() / 1000);
        const bandera = {
            tipo,
            label,
            color,
            timestamp: ts,
            precio: this._precioActual || 0,
            fijada: false,   // pasa a true cuando llega la siguiente transición
        };
        this._banderas.push(bandera);

        // Evitar acumulación excesiva (mantener las últimas N)
        if (this._banderas.length > this._maxBanderas) {
            this._banderas = this._banderas.slice(-this._maxBanderas);
        }

        console.log(`[GraficaVelas] 🚩 Bandera añadida: ${tipo} (${label}) @ ts=${ts} precio=${bandera.precio}`);
    }

    /**
     * dibujarBanderas — Renderiza todas las banderas sobre el canvas de velas.
     * Llamado dentro del bucle rAF con las mismas coordenadas que las velas.
     */
    dibujarBanderas(ctx, ancho, alto, todasLasVelas) {
        if (!this._banderas.length || !todasLasVelas.length) return;
        if (!this.motorVelas || !this.estadoPrecio) return;

        const motor = this.motorVelas;
        const estado = this.estadoPrecio;

        const totalVelas = todasLasVelas.length;
        const cantidadEfectiva = Math.min(motor.velasVisibles, totalVelas);
        if (cantidadEfectiva <= 0) return;

        const espacioEntreVelas = ancho / cantidadEfectiva;
        const fracPx = (motor._fraccionDesplazamiento || 0) * espacioEntreVelas;

        // Índices del viewport (misma lógica que MotorVelas)
        const fin = totalVelas - (motor._desplazamiento || 0);
        const inicioIdx = Math.max(0, fin - cantidadEfectiva);
        const finIdx = Math.min(fin, totalVelas - 1);

        const tsInicio = todasLasVelas[inicioIdx]?.time ?? 0;
        const tsFin = todasLasVelas[finIdx]?.time ?? 0;
        if (!tsInicio || !tsFin) return;

        // ── Búsqueda binaria de un timestamp en el array de velas ──
        const buscarIdx = (ts) => {
            let lo = inicioIdx, hi = finIdx;
            while (lo < hi) {
                const mid = (lo + hi + 1) >> 1;
                if (todasLasVelas[mid].time <= ts) lo = mid;
                else hi = mid - 1;
            }
            return lo;
        };

        const PALO_ALTO = 60;
        const BANDERA_W = 36;
        const BANDERA_H = 14;
        const RADIO = 2;

        ctx.save();
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        for (const bandera of this._banderas) {
            const ts = bandera.timestamp;

            // Descartar banderas fuera del viewport
            if (ts < tsInicio || ts > tsFin) continue;

            // Posición X: índice dentro del viewport → píxeles (mismo método que MotorVelas)
            const idx = buscarIdx(ts);
            const idxEnVista = idx - inicioIdx;          // 0 = primer candle visible
            const x = (idxEnVista + 0.5) * espacioEntreVelas - fracPx;

            // Clamp: no salir de los bordes del canvas
            const xDib = Math.max(4, Math.min(ancho - BANDERA_W - 4, x));

            // Posición Y basada en precio
            const precioBandera = bandera.fijada ? bandera.precio : (this._precioActual || bandera.precio);
            const y = estado.priceToY(precioBandera, alto);

            const colorBase = bandera.color;
            const colorBg = colorBase + '22';

            // ── Palo vertical (hacia arriba desde el precio) ──
            const yPunta = Math.max(BANDERA_H + 4, y - PALO_ALTO);
            ctx.strokeStyle = colorBase;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.7;
            ctx.setLineDash([3, 2]);
            ctx.beginPath();
            ctx.moveTo(xDib, y);
            ctx.lineTo(xDib, yPunta);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1.0;

            // ── Punto de anclaje en el precio ──
            ctx.fillStyle = colorBase;
            ctx.beginPath();
            ctx.arc(xDib, y, 3, 0, Math.PI * 2);
            ctx.fill();

            // ── Rectángulo de la bandera ──
            const flagY = yPunta - BANDERA_H;
            ctx.shadowColor = colorBase + '66';
            ctx.shadowBlur = 6;
            ctx.fillStyle = colorBg;
            ctx.strokeStyle = colorBase;
            ctx.lineWidth = 1;
            this._roundRect(ctx, xDib, flagY, BANDERA_W, BANDERA_H, RADIO);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            // ── Etiqueta ──
            ctx.fillStyle = colorBase;
            ctx.fillText(bandera.label, xDib + 4, flagY + BANDERA_H / 2);
        }

        ctx.restore();
    }

    /** Utilidad: dibuja un rectángulo con esquinas redondeadas */
    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    /**
     * pausarGraficaAutomatica — Activa pausa automática por cierre de mercado.
     * A diferencia de la pausa manual, no muestra el banner de pausa sino el de "cerrada".
     */
    _pausarGraficaAutomatica() {
        this._pausaAutomatica = true;
        console.log('[GraficaVelas] ⏸ Gráfica pausada automáticamente (mercado cerrado)');
    }

    // Alias en español para la API pública
    pausarGrafica() { this._pausarGraficaAutomatica(); }

    /**
     * reanudarGraficaAutomatica — Desactiva la pausa automática al abrirse el mercado.
     * La gráfica continúa exactamente desde donde estaba (la última bandera de cierre).
     */
    _reanudarGraficaAutomatica() {
        this._pausaAutomatica = false;
        console.log('[GraficaVelas] ▶ Gráfica reanudada automáticamente (mercado abierto)');
    }

    // Alias en español para la API pública
    reanudarGrafica() { this._reanudarGraficaAutomatica(); }

    // FIX (1): alias eliminado — la llamada en _onSession ya usa _pausarGraficaAutomatica directamente



    // ════════════════════════════════════════════════════════════════════════
    //  REACCIÓN A EVENTOS DEL BUS
    // ════════════════════════════════════════════════════════════════════════

    _alCambiarActivo(payload) {
        const { simbolo, mercado, configuracion: cfg } = payload;
        this._simbolo = simbolo;
        this._mercado = mercado || this._mercado;
        this._precisionPrecio = cfg?.precision ?? 2;

        // FIX (B): usar método estático compartido
        this._esCrypto = WidgetGraficaVelas._esCriptomoneda(simbolo);

        // Limpiar estado del activo anterior
        this._rawTicks = [];
        this._precioActual = 0;
        this._precioInicial = 0;
        this._sessionHigh = -Infinity;
        this._sessionLow = Infinity;
        this._mercadoCerrado = false;
        this._pausaManual = false;
        this._pausaAutomatica = false;
        this._banderas = [];          // limpiar banderas al cambiar de activo
        this._sesionAnterior = null;  // resetear estado de transición
        this._ocultarBanner();
        this._ocultarBannerPausa();

        if (this.agregador) {
            this.agregador.candles = [];
            this.agregador.current = null;
        }
        if (this.estadoPrecio) this.estadoPrecio.resetZoom();
        if (this.motorVelas) this.motorVelas.resetPan();

        // Actualizar título inmediatamente con el nuevo símbolo
        this._actualizarTitulo();

        // ── Intentar cargar desde cache (respuesta instantánea) ──
        const cacheKey = `${simbolo}_${this._timeframe}`;
        const cached = this._symbolCache.get(cacheKey);
        const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de validez

        if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
            console.log(`[GraficaVelas] ⚡ Cache hit para ${simbolo} (${this._timeframe}s) — cargando instantáneo`);
            try {
                // FIX (6): guard con try/catch para que un fallo en _onInit no deje el overlay visible
                this._onInit({
                    simbolo,
                    candles: cached.candles,
                    timeframe: this._timeframe,
                    fuente: 'cache_local',
                });
            } catch (err) {
                console.error('[GraficaVelas] ❌ Error al cargar cache:', err);
                this._ocultarOverlayLoading();
            }
        } else {
            // Mostrar overlay de carga mientras llega el REST
            this._mostrarOverlayLoading(simbolo);
        }

        console.log(`[GraficaVelas] 🔄 Activo cambiado → ${simbolo} (${mercado || '—'})`);
    }

    _alCambiarTimeframe(payload) {
        if (!this.agregador) return;
        const seg = payload.timeframe_seg || payload.segundos || payload.value || 60;

        // FIX (3): guardar TF anterior ANTES de cambiarlo para invalidar la clave correcta
        const tfAnterior = this._timeframe;
        this._timeframe = seg;
        this.agregador.changeInterval(seg, this._rawTicks);
        this.estadoPrecio.resetZoom();
        this.motorVelas.resetPan();

        // Invalidar la entrada del TF anterior (no el nuevo)
        const anteriorKey = `${this._simbolo}_${tfAnterior}`;
        if (this._symbolCache.has(anteriorKey)) this._symbolCache.delete(anteriorKey);

        // Mostrar overlay mientras llegan datos del nuevo TF
        this._mostrarOverlayLoading(this._simbolo);
        this._actualizarTitulo();

        // Ajustar cantidad de velas visibles según timeframe
        if (seg >= 3600) this.motorVelas.velasVisibles = 40;   // 1H+
        else if (seg >= 900) this.motorVelas.velasVisibles = 50;   // 15m
        else if (seg >= 300) this.motorVelas.velasVisibles = 60;   // 5m
        else this.motorVelas.velasVisibles = 80;   // 1m, 5s, 30s

        console.log(`[GraficaVelas] ⏱ Timeframe: ${seg}s | Velas visibles: ${this.motorVelas.velasVisibles}`);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  TOOLTIP OHLCV (al pasar el cursor)
    // ════════════════════════════════════════════════════════════════════════

    _mostrarTooltip(cursorX) {
        if (!this.motorVelas || !this._tooltip) return;
        const todas = this.agregador.all();
        const vis = this.motorVelas.visible(todas);
        if (!vis.length) return;

        const espacio = this._cw / this.motorVelas.velasVisibles;
        const idx = Math.floor(cursorX / espacio);
        if (idx < 0 || idx >= vis.length) {
            this._tooltip.style.display = 'none';
            return;
        }
        const c = vis[idx];
        const fmt = (v) => {
            if (typeof v !== 'number') return '—';
            return this._precisionPrecio >= 5
                ? v.toFixed(this._precisionPrecio)
                : '$' + v.toFixed(this._precisionPrecio || 2);
        };

        const fecha = new Date(c.time * 1000);
        const hora = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const subida = c.close >= c.open;

        this._tooltip.style.display = 'block';
        this._tooltip.innerHTML = `
            <span class="v2-tt-hora">${hora}</span>
            <span class="v2-tt-dato ${subida ? 'alza' : 'baja'}">O ${fmt(c.open)}</span>
            <span class="v2-tt-dato ${subida ? 'alza' : 'baja'}">H ${fmt(c.high)}</span>
            <span class="v2-tt-dato ${subida ? 'alza' : 'baja'}">L ${fmt(c.low)}</span>
            <span class="v2-tt-dato ${subida ? 'alza' : 'baja'}">C ${fmt(c.close)}</span>
            <span class="v2-tt-vol">Vol ${(c.volume || 0).toLocaleString()}</span>
        `;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  EJE DE TIEMPO (barra inferior)
    // ════════════════════════════════════════════════════════════════════════

    _actualizarEjeTiempo(todas) {
        if (!this._ejeTiempo || !this.motorVelas) return;
        const vis = this.motorVelas.visible(todas);
        if (!vis.length) { this._ejeTiempo.innerHTML = ''; return; }

        const espacio = this._cw / this.motorVelas.velasVisibles;
        const paso = Math.max(1, Math.floor(this.motorVelas.velasVisibles / 8));

        this._ejeTiempo.innerHTML = '';
        vis.forEach((c, i) => {
            if (i % paso !== 0) return;
            const x = i * espacio + espacio / 2;
            const d = new Date(c.time * 1000);

            // Formato según timeframe
            let lbl;
            if (this._timeframe < 3600) {
                lbl = d.getHours().toString().padStart(2, '0') + ':' +
                    d.getMinutes().toString().padStart(2, '0');
            } else {
                lbl = d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
            }

            const etq = document.createElement('div');
            etq.className = 'v2-etq-tiempo';
            etq.style.left = x + 'px';
            etq.textContent = lbl;
            this._ejeTiempo.appendChild(etq);
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    //  TOOLBAR INTERNA
    // ════════════════════════════════════════════════════════════════════════

    _crearToolbar() {
        const bar = document.createElement('div');
        bar.className = 'v2-toolbar-grafica';

        // ── Bloque de identificación del activo ──
        const bloqueSimbolo = document.createElement('div');
        bloqueSimbolo.className = 'v2-grafica-bloque-simbolo';

        this._tituloGrafica = document.createElement('span');
        this._tituloGrafica.className = 'v2-grafica-titulo';

        this._subtituloTF = document.createElement('span');
        this._subtituloTF.className = 'v2-grafica-subtitulo-tf';

        bloqueSimbolo.appendChild(this._tituloGrafica);
        bloqueSimbolo.appendChild(this._subtituloTF);
        bar.appendChild(bloqueSimbolo);
        this._actualizarTitulo();

        // ── Bloque precio en tiempo real ──
        this._elPrecioInfo = document.createElement('div');
        this._elPrecioInfo.className = 'v2-grafica-precio-info';
        this._elPrecioInfo.innerHTML = '<span class="v2-precio-valor">—</span><span class="v2-precio-cambio"></span>';
        bar.appendChild(this._elPrecioInfo);

        // Espaciador
        const spacer = document.createElement('span');
        spacer.style.flex = '1';
        bar.appendChild(spacer);

        // ── Badge de sesión de mercado ──
        this._badgeSesion = document.createElement('span');
        this._badgeSesion.className = 'v2-badge-sesion';
        this._badgeSesion.textContent = '...';
        bar.appendChild(this._badgeSesion);

        // ── Botón Pausa / Reanudar ──
        const btnPausa = document.createElement('button');
        btnPausa.className = 'v2-btn-toolbar';
        btnPausa.innerHTML = '⏸';
        btnPausa.title = 'Pausar / Reanudar';
        btnPausa.addEventListener('click', () => {
            this._pausaManual = !this._pausaManual;
            btnPausa.innerHTML = this._pausaManual ? '▶' : '⏸';
            btnPausa.title = this._pausaManual ? 'Reanudar' : 'Pausar';
            if (this._pausaManual) {
                this._mostrarBannerPausa();
            } else {
                this._ocultarBannerPausa();
            }
        });
        bar.appendChild(btnPausa);

        // ── Botón Reset Pan ──
        const btnReset = document.createElement('button');
        btnReset.className = 'v2-btn-toolbar';
        btnReset.innerHTML = '⟳';
        btnReset.title = 'Reset vista (doble clic también funciona)';
        btnReset.addEventListener('click', () => {
            this.motorVelas.resetPan();
            this.estadoPrecio.resetZoom();
        });
        bar.appendChild(btnReset);

        return bar;
    }

    // Badge de sesión: muestra Pre-Market / Regular / After Hours / Cerrado
    _actualizarBadgeSesion(payload) {
        if (!this._badgeSesion) return;
        const { session, label, is_open } = payload;

        // Mapa sesión → { texto, clase CSS }
        const config = {
            'regular': { texto: '● Regular', clase: 'sesion-regular' },
            'pre_market': { texto: '○ Pre-Market', clase: 'sesion-pre' },
            'after_hours': { texto: '○ After Hours', clase: 'sesion-after' },
            'closed': { texto: '■ Cerrado', clase: 'sesion-cerrado' },
        };

        const cfg = config[session] || { texto: label || session, clase: 'sesion-cerrado' };

        // Limpiar clases anteriores
        this._badgeSesion.className = 'v2-badge-sesion ' + cfg.clase;
        this._badgeSesion.textContent = cfg.texto;
        this._badgeSesion.title = `Sesión de mercado: ${label || session}`;
    }

    _actualizarTitulo() {
        if (!this._tituloGrafica) return;
        this._tituloGrafica.textContent = this._simbolo || '—';

        if (this._subtituloTF) {
            // Etiqueta legible del timeframe
            const tfMap = { 5: '5s', 60: '1m', 300: '5m', 900: '15m', 1800: '30m', 3600: '1H', 14400: '4H', 86400: '1D' };
            const tfLabel = tfMap[this._timeframe] || `${this._timeframe}s`;
            this._subtituloTF.textContent = tfLabel;
        }
    }

    /**
     * _actualizarPrecioUI — Actualiza el bloque de precio/cambio% en el toolbar.
     * Se llama en _onTick (tiempo real) y al cargar el histórico (_onInit).
     */
    _actualizarPrecioUI() {
        if (!this._elPrecioInfo) return;
        const precio = this._precioActual;
        if (!precio || precio <= 0) return;

        const elValor = this._elPrecioInfo.querySelector('.v2-precio-valor');
        const elCambio = this._elPrecioInfo.querySelector('.v2-precio-cambio');
        if (!elValor || !elCambio) return;

        // Formatear precio con 2 decimales (crypto puede tener más)
        const decimales = precio >= 1000 ? 2 : precio >= 10 ? 2 : precio >= 1 ? 3 : 4;
        elValor.textContent = '$' + precio.toFixed(decimales);

        // Calcular cambio % respecto al precio de apertura de sesión
        if (this._precioInicial > 0) {
            const diff = precio - this._precioInicial;
            const pct = (diff / this._precioInicial) * 100;
            const signo = diff >= 0 ? '+' : '';
            const positvo = diff >= 0;
            elCambio.textContent = ` ${signo}${diff.toFixed(decimales)} (${signo}${pct.toFixed(2)}%)`;
            elCambio.style.color = positvo ? '#22c55e' : '#ef4444';
        } else {
            elCambio.textContent = '';
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  BANNER "BOLSA CERRADA"
    // ════════════════════════════════════════════════════════════════════════

    _crearBanner() {
        const banner = document.createElement('div');
        banner.className = 'v2-banner-cerrada';
        banner.style.display = 'none';
        banner.innerHTML = `
            <div class="v2-banner-icono">🏦</div>
            <div class="v2-banner-titulo">Bolsa Cerrada</div>
            <div class="v2-banner-sub" id="v2-banner-sub-${this._id}">
                Fuera del horario regular de mercado
            </div>
            <div class="v2-banner-nota">
                Puedes navegar el historial libremente
            </div>
        `;
        return banner;
    }

    _mostrarBanner(subtitulo) {
        if (!this._banner) return;
        this._banner.style.display = 'flex';
        const sub = this._banner.querySelector('[id^="v2-banner-sub"]');
        if (sub) sub.textContent = subtitulo;
    }

    _ocultarBanner() {
        if (this._banner) this._banner.style.display = 'none';
    }

    // ════════════════════════════════════════════════════════════════════════
    //  BANNER "PAUSA MANUAL"
    // ════════════════════════════════════════════════════════════════════════

    _crearBannerPausa() {
        const b = document.createElement('div');
        b.className = 'v2-banner-pausa';
        b.style.display = 'none';
        b.innerHTML = `
            <div class="v2-banner-pausa-icono">⏸</div>
            <div class="v2-banner-pausa-txt">Gráfica pausada</div>
        `;
        return b;
    }

    _mostrarBannerPausa() {
        if (this._bannerPausa) this._bannerPausa.style.display = 'flex';
    }

    _ocultarBannerPausa() {
        if (this._bannerPausa) this._bannerPausa.style.display = 'none';
    }

    // ════════════════════════════════════════════════════════════════════════
    //  OVERLAY DE CARGA
    // ════════════════════════════════════════════════════════════════════════

    _crearOverlayLoading() {
        const ov = document.createElement('div');
        ov.className = 'v2-overlay-loading';
        ov.style.display = 'none';
        ov.innerHTML = `
            <div class="v2-loading-spinner"></div>
            <div class="v2-loading-simbolo">—</div>
            <div class="v2-loading-texto">Cargando histórico...</div>
        `;
        return ov;
    }

    _mostrarOverlayLoading(simbolo) {
        if (!this._overlayLoading) return;
        const el = this._overlayLoading.querySelector('.v2-loading-simbolo');
        if (el) el.textContent = simbolo || '...';
        this._overlayLoading.style.display = 'flex';
    }

    _ocultarOverlayLoading() {
        if (this._overlayLoading) this._overlayLoading.style.display = 'none';
    }

    // ── ID único para elementos ──
    get _id() { return this.contenedor.id || Math.random().toString(36).slice(2, 7); }

    // ════════════════════════════════════════════════════════════════════════
    //  UTILIDADES ESTÁTICAS
    // ════════════════════════════════════════════════════════════════════════

    /**
     * FIX (B): Detecta si un símbolo es una criptomoneda.
     * Método estático para evitar duplicar la expresión regular en múltiples lugares.
     * @param {string} simbolo
     * @returns {boolean}
     */
    static _esCriptomoneda(simbolo) {
        return /BTC|ETH|DOGE|SOL|XRP|ADA|LTC|AVAX|LINK|MATIC|BNB|DOT|UNI|ATOM/i.test(simbolo || '');
    }
}
