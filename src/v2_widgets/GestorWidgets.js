/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  GestorWidgets.js — Mediador Central de WebSockets y Datos             ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Responsabilidades:                                                     ║
 * ║    1. Gestionar conexiones WebSocket (:8765 chart, :8766 orderbook)    ║
 * ║    2. Suscribirse a activos y distribuir datos via BusEventos          ║
 * ║    3. Reaccionar a CAMBIO_ACTIVO y CAMBIO_TIMEFRAME                   ║
 * ║    4. limpiarMemoria() para evitar fugas al cambiar de activo          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

class GestorWidgets {

    /**
     * @param {Object} opciones
     * @param {string} [opciones.host='localhost'] - Host de los servidores WS
     * @param {number} [opciones.puertoChart=8765] - Puerto del ChartServer
     * @param {number} [opciones.puertoBook=8766] - Puerto del OrderBookServer
     */
    constructor(opciones = {}) {
        this._host = opciones.host || 'localhost';
        this._puertoChart = opciones.puertoChart || 8765;
        this._puertoBook = opciones.puertoBook || 8766;

        /** @type {WebSocket|null} */
        this._wsChart = null;
        /** @type {WebSocket|null} */
        this._wsBook = null;

        /** @type {string} Símbolo actualmente activo */
        this._simboloActual = '';

        /** @type {number} Timeframe actual en segundos */
        this._timeframeActual = 60;

        /** @type {number} Contador de ticks recibidos */
        this._contadorTicks = 0;

        /** @type {number} Intentos de reconexión */
        this._reconexionesChart = 0;
        this._reconexionesBook = 0;
        this._maxReconexiones = 20;

        /** @type {number|null} Timers de reconexión */
        this._timerReconexionChart = null;
        this._timerReconexionBook = null;

        /** @type {Function[]} Desuscripciones del bus */
        this._desuscripciones = [];

        // Métricas
        this._ticksPorSegundo = 0;
        this._ultimoConteo = 0;
        this._timerMetricas = null;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  INICIALIZACIÓN
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Arranca el gestor: conecta WebSockets y escucha eventos del bus.
     */
    iniciar() {
        console.log('[GestorWidgets] Iniciando mediador central...');

        // Escuchar cambios de activo y timeframe desde los selectores
        this._desuscripciones.push(
            busEventos.suscribir(EVENTOS.CAMBIO_ACTIVO, (datos) => {
                this._alCambiarActivo(datos);
            })
        );

        this._desuscripciones.push(
            busEventos.suscribir(EVENTOS.CAMBIO_TIMEFRAME, (datos) => {
                this._alCambiarTimeframe(datos);
            })
        );

        // Conectar WebSockets
        this._conectarChart();
        this._conectarBook();

        // Métricas periódicas
        this._timerMetricas = setInterval(() => {
            this._ticksPorSegundo = this._contadorTicks - this._ultimoConteo;
            this._ultimoConteo = this._contadorTicks;
        }, 1000);
    }

    /**
     * Detiene todo: cierra WebSockets, limpia timers, desuscribe eventos.
     */
    detener() {
        console.log('[GestorWidgets] Deteniendo...');

        clearInterval(this._timerMetricas);
        clearTimeout(this._timerReconexionChart);
        clearTimeout(this._timerReconexionBook);

        if (this._wsChart) {
            this._wsChart.onclose = null; // Prevenir reconexión
            this._wsChart.close();
            this._wsChart = null;
        }

        if (this._wsBook) {
            this._wsBook.onclose = null;
            this._wsBook.close();
            this._wsBook = null;
        }

        for (const desuscribir of this._desuscripciones) {
            desuscribir();
        }
        this._desuscripciones = [];
    }

    // ══════════════════════════════════════════════════════════════════════
    //  WEBSOCKET — CHART SERVER (:8765)
    // ══════════════════════════════════════════════════════════════════════

    _conectarChart() {
        const url = `ws://${this._host}:${this._puertoChart}`;
        console.log(`[GestorWidgets] Conectando a ChartServer: ${url}`);

        busEventos.emitir(EVENTOS.CONEXION_ESTADO, { tipo: 'chart', conectado: false, estado: 'conectando' });

        try {
            this._wsChart = new WebSocket(url);
        } catch (error) {
            console.error('[GestorWidgets] Error creando WebSocket Chart:', error);
            this._programarReconexion('chart');
            return;
        }

        this._wsChart.onopen = () => {
            console.log('[GestorWidgets] ✅ ChartServer conectado');
            this._reconexionesChart = 0;
            busEventos.emitir(EVENTOS.CONEXION_ESTADO, { tipo: 'chart', conectado: true, estado: 'conectado' });
        };

        this._wsChart.onmessage = (evento) => {
            this._procesarMensajeChart(evento.data);
        };

        this._wsChart.onclose = () => {
            console.warn('[GestorWidgets] ❌ ChartServer desconectado');
            busEventos.emitir(EVENTOS.CONEXION_ESTADO, { tipo: 'chart', conectado: false, estado: 'desconectado' });
            this._programarReconexion('chart');
        };

        this._wsChart.onerror = (error) => {
            console.error('[GestorWidgets] Error en ChartServer WS:', error);
        };
    }

    _procesarMensajeChart(crudo) {
        let datos;
        try {
            datos = JSON.parse(crudo);
        } catch (e) {
            return;
        }

        switch (datos.type) {
            case 'symbols':
                busEventos.emitir(EVENTOS.SIMBOLOS_DISPONIBLES, { simbolos: datos.symbols });
                break;

            case 'init':
                busEventos.emitir(EVENTOS.DATOS_INIT, {
                    simbolo: datos.symbol,
                    datos: datos.data,
                    timeframe: datos.timeframe || 60,
                    fuente: datos.source || 'desconocida',
                    velas_cargadas: datos.candles_loaded || 0,
                });
                break;

            case 'tick':
                this._contadorTicks++;
                busEventos.emitir(EVENTOS.DATOS_TICK, {
                    simbolo: datos.symbol,
                    time: datos.time,
                    value: datos.value,
                });
                break;

            case 'session':
                busEventos.emitir(EVENTOS.SESION_MERCADO, {
                    session: datos.session,
                    label: datos.label,
                    time_et: datos.time_et,
                    is_open: datos.is_open,
                    is_weekend: datos.is_weekend,
                });
                break;

            case 'data_info':
                console.log('[GestorWidgets] Fuente de datos:', datos.message);
                break;
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  WEBSOCKET — ORDER BOOK SERVER (:8766)
    // ══════════════════════════════════════════════════════════════════════

    _conectarBook() {
        const url = `ws://${this._host}:${this._puertoBook}`;
        console.log(`[GestorWidgets] Conectando a OrderBookServer: ${url}`);

        busEventos.emitir(EVENTOS.CONEXION_ESTADO, { tipo: 'book', conectado: false, estado: 'conectando' });

        try {
            this._wsBook = new WebSocket(url);
        } catch (error) {
            console.error('[GestorWidgets] Error creando WebSocket Book:', error);
            this._programarReconexion('book');
            return;
        }

        this._wsBook.onopen = () => {
            console.log('[GestorWidgets] ✅ OrderBookServer conectado');
            this._reconexionesBook = 0;
            busEventos.emitir(EVENTOS.CONEXION_ESTADO, { tipo: 'book', conectado: true, estado: 'conectado' });

            // Si ya hay un símbolo seleccionado, suscribirse
            if (this._simboloActual) {
                this._enviarSuscripcionBook(this._simboloActual);
            }
        };

        this._wsBook.onmessage = (evento) => {
            this._procesarMensajeBook(evento.data);
        };

        this._wsBook.onclose = () => {
            console.warn('[GestorWidgets] ❌ OrderBookServer desconectado');
            busEventos.emitir(EVENTOS.CONEXION_ESTADO, { tipo: 'book', conectado: false, estado: 'desconectado' });
            this._programarReconexion('book');
        };

        this._wsBook.onerror = (error) => {
            console.error('[GestorWidgets] Error en OrderBookServer WS:', error);
        };
    }

    _procesarMensajeBook(crudo) {
        let datos;
        try {
            datos = JSON.parse(crudo);
        } catch (e) {
            return;
        }

        if (datos.type === 'book') {
            busEventos.emitir(EVENTOS.DATOS_BOOK, {
                simbolo: datos.symbol || datos.simbolo,
                bids: datos.bids || [],
                asks: datos.asks || [],
                best_bid: datos.best_bid || 0,
                best_ask: datos.best_ask || 0,
                spread: datos.spread || 0,
                mid_price: datos.mid_price || 0,
                updates: datos.updates || 0,
                num_exchanges_bid: datos.num_exchanges_bid || 0,
                num_exchanges_ask: datos.num_exchanges_ask || 0,
            });
        }
        // 'symbols' del OB server se ignora (usamos los del chart server)
    }

    // ══════════════════════════════════════════════════════════════════════
    //  RECONEXIÓN CON BACKOFF EXPONENCIAL
    // ══════════════════════════════════════════════════════════════════════

    _programarReconexion(tipo) {
        const esChart = tipo === 'chart';
        let intentos = esChart ? this._reconexionesChart : this._reconexionesBook;

        if (intentos >= this._maxReconexiones) {
            console.error(`[GestorWidgets] Máximo de reconexiones alcanzado para ${tipo}`);
            return;
        }

        if (esChart) this._reconexionesChart++;
        else this._reconexionesBook++;

        intentos = esChart ? this._reconexionesChart : this._reconexionesBook;
        const espera = Math.min(1000 * Math.pow(2, intentos), 30000);

        console.log(`[GestorWidgets] Reconectando ${tipo} en ${espera / 1000}s (intento ${intentos}/${this._maxReconexiones})`);

        const timer = setTimeout(() => {
            if (esChart) this._conectarChart();
            else this._conectarBook();
        }, espera);

        if (esChart) this._timerReconexionChart = timer;
        else this._timerReconexionBook = timer;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  CAMBIO DE ACTIVO — Limpieza + re-suscripción
    // ══════════════════════════════════════════════════════════════════════

    _alCambiarActivo(datos) {
        const nuevoSimbolo = datos.simbolo;
        if (nuevoSimbolo === this._simboloActual) return;

        console.log(`[GestorWidgets] Cambiando activo: ${this._simboloActual} → ${nuevoSimbolo}`);

        // Limpiar memoria del activo anterior
        this.limpiarMemoria();

        this._simboloActual = nuevoSimbolo;

        // Re-suscribir en ChartServer
        if (this._wsChart && this._wsChart.readyState === WebSocket.OPEN) {
            this._wsChart.send(JSON.stringify({
                action: 'subscribe',
                symbol: nuevoSimbolo,
            }));
        }

        // Re-suscribir en OrderBookServer
        this._enviarSuscripcionBook(nuevoSimbolo);
    }

    _enviarSuscripcionBook(simbolo) {
        if (this._wsBook && this._wsBook.readyState === WebSocket.OPEN) {
            this._wsBook.send(JSON.stringify({
                action: 'subscribe',
                symbol: simbolo,
            }));
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  CAMBIO DE TIMEFRAME
    // ══════════════════════════════════════════════════════════════════════

    _alCambiarTimeframe(datos) {
        const nuevoTF = datos.timeframe_seg;
        if (nuevoTF === this._timeframeActual) return;

        console.log(`[GestorWidgets] Cambiando timeframe: ${this._timeframeActual}s → ${nuevoTF}s`);
        this._timeframeActual = nuevoTF;

        // Pedir al ChartServer que recargue el historial para este timeframe
        if (this._wsChart && this._wsChart.readyState === WebSocket.OPEN) {
            this._wsChart.send(JSON.stringify({
                action: 'set_timeframe',
                timeframe: nuevoTF,
            }));
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  LIMPIEZA DE MEMORIA — Evitar fugas al cambiar activo
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Limpia datos en memoria del activo anterior.
     * Los widgets individuales deben escuchar CAMBIO_ACTIVO para resetear
     * sus propios buffers, pero aquí se resetean los contadores globales.
     */
    limpiarMemoria() {
        this._contadorTicks = 0;
        this._ultimoConteo = 0;
        this._ticksPorSegundo = 0;
        console.log('[GestorWidgets] Memoria limpiada para cambio de activo');
    }

    // ══════════════════════════════════════════════════════════════════════
    //  MÉTRICAS PÚBLICAS
    // ══════════════════════════════════════════════════════════════════════

    obtenerMetricas() {
        return {
            ticks_totales: this._contadorTicks,
            ticks_por_segundo: this._ticksPorSegundo,
            chart_conectado: this._wsChart?.readyState === WebSocket.OPEN,
            book_conectado: this._wsBook?.readyState === WebSocket.OPEN,
            simbolo_actual: this._simboloActual,
            timeframe_actual: this._timeframeActual,
            reconexiones_chart: this._reconexionesChart,
            reconexiones_book: this._reconexionesBook,
        };
    }
}