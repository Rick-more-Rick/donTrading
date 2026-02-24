/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  GestorWidgets.js — Mediador Central (solo Chart :8765)                ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Responsabilidades:                                                     ║
 * ║    1. Gestionar la conexión WebSocket :8765 (chart.py)                 ║
 * ║    2. Distribuir DATOS_INIT, DATOS_TICK, SESION_MERCADO via bus        ║
 * ║    3. Reaccionar a CAMBIO_ACTIVO y CAMBIO_TIMEFRAME                   ║
 * ║  NOTA: El WS del Order Book (:8766) lo gestiona WidgetLibroOrdenes     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

class GestorWidgets {

    /**
     * @param {Object} opciones
     * @param {string} [opciones.host='localhost']
     * @param {number} [opciones.puertoChart=8765]
     */
    constructor(opciones = {}) {
        this._host = opciones.host || 'localhost';
        this._puertoChart = opciones.puertoChart || 8765;

        /** @type {WebSocket|null} */
        this._wsChart = null;

        this._simboloActual = '';
        this._timeframeActual = 60;
        this._contadorTicks = 0;
        this._reconexionesChart = 0;
        this._maxReconexiones = 20;
        this._timerReconexionChart = null;
        this._desuscripciones = [];

        // Métricas
        this._ticksPorSegundo = 0;
        this._ultimoConteo = 0;
        this._timerMetricas = null;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  INICIALIZACIÓN
    // ══════════════════════════════════════════════════════════════════════

    iniciar() {
        console.log('[GestorWidgets] Iniciando mediador de Chart...');

        this._desuscripciones.push(
            busEventos.suscribir(EVENTOS.CAMBIO_ACTIVO, datos => this._alCambiarActivo(datos))
        );
        this._desuscripciones.push(
            busEventos.suscribir(EVENTOS.CAMBIO_TIMEFRAME, datos => this._alCambiarTimeframe(datos))
        );

        this._conectarChart();

        this._timerMetricas = setInterval(() => {
            this._ticksPorSegundo = this._contadorTicks - this._ultimoConteo;
            this._ultimoConteo = this._contadorTicks;
        }, 1000);
    }

    detener() {
        console.log('[GestorWidgets] Deteniendo...');
        clearInterval(this._timerMetricas);
        clearTimeout(this._timerReconexionChart);

        if (this._wsChart) {
            this._wsChart.onclose = null;
            this._wsChart.close();
            this._wsChart = null;
        }

        for (const fn of this._desuscripciones) fn();
        this._desuscripciones = [];
    }

    // ══════════════════════════════════════════════════════════════════════
    //  WEBSOCKET — CHART SERVER (:8765)
    // ══════════════════════════════════════════════════════════════════════

    _conectarChart() {
        const url = `ws://${this._host}:${this._puertoChart}`;
        console.log(`[GestorWidgets] Conectando ChartServer: ${url}`);
        busEventos.emitir(EVENTOS.CONEXION_ESTADO, { tipo: 'chart', conectado: false, estado: 'conectando' });

        try {
            this._wsChart = new WebSocket(url);
        } catch (err) {
            console.error('[GestorWidgets] Error creando WS Chart:', err);
            this._programarReconexion();
            return;
        }

        this._wsChart.onopen = () => {
            console.log('[GestorWidgets] ✅ ChartServer conectado');
            this._reconexionesChart = 0;
            busEventos.emitir(EVENTOS.CONEXION_ESTADO, { tipo: 'chart', conectado: true, estado: 'conectado' });

            if (this._simboloActual) {
                console.log(`[GestorWidgets] 🔄 Re-suscribiendo a '${this._simboloActual}' tras conectar`);
                this._wsChart.send(JSON.stringify({
                    action: 'subscribe',
                    symbol: this._simboloActual,
                }));
            }
        };

        this._wsChart.onmessage = e => this._procesarMensajeChart(e.data);

        this._wsChart.onclose = () => {
            console.warn('[GestorWidgets] ❌ ChartServer desconectado');
            busEventos.emitir(EVENTOS.CONEXION_ESTADO, { tipo: 'chart', conectado: false, estado: 'desconectado' });
            this._programarReconexion();
        };

        this._wsChart.onerror = err => {
            console.error('[GestorWidgets] Error WS Chart:', err);
        };
    }

    _procesarMensajeChart(crudo) {
        let datos;
        try { datos = JSON.parse(crudo); } catch { return; }

        switch (datos.type) {
            case 'symbols':
                busEventos.emitir(EVENTOS.SIMBOLOS_DISPONIBLES, { simbolos: datos.symbols });
                break;

            case 'init_ohlc':
                busEventos.emitir(EVENTOS.DATOS_INIT, {
                    simbolo: datos.symbol,
                    candles: datos.candles,
                    datos: null,
                    timeframe: datos.timeframe || 60,
                    fuente: datos.source || 'polygon_rest',
                    velas_cargadas: datos.candles_loaded || 0,
                });
                break;

            case 'init':
                busEventos.emitir(EVENTOS.DATOS_INIT, {
                    simbolo: datos.symbol,
                    datos: datos.data,
                    candles: null,
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
                    next_open: datos.next_open,
                });
                break;

            case 'data_info':
                console.log('[GestorWidgets] Fuente de datos:', datos.message);
                break;
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  RECONEXIÓN
    // ══════════════════════════════════════════════════════════════════════

    _programarReconexion() {
        if (this._reconexionesChart >= this._maxReconexiones) {
            console.error('[GestorWidgets] Máximo de reconexiones alcanzado para chart');
            return;
        }
        this._reconexionesChart++;
        const espera = Math.min(1000 * Math.pow(2, this._reconexionesChart), 30000);
        console.log(`[GestorWidgets] Reconectando chart en ${espera / 1000}s (intento ${this._reconexionesChart}/${this._maxReconexiones})`);
        this._timerReconexionChart = setTimeout(() => this._conectarChart(), espera);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  CAMBIO DE ACTIVO
    // ══════════════════════════════════════════════════════════════════════

    _alCambiarActivo(datos) {
        const nuevo = datos.simbolo;
        const cambioReal = nuevo !== this._simboloActual;

        if (cambioReal) {
            console.log(`[GestorWidgets] Cambiando activo: ${this._simboloActual || '—'} → ${nuevo}`);
            this.limpiarMemoria();
        } else {
            console.log(`[GestorWidgets] Re-suscribiendo a '${nuevo}' (mismo activo)`);
        }

        this._simboloActual = nuevo;

        if (this._wsChart && this._wsChart.readyState === WebSocket.OPEN) {
            this._wsChart.send(JSON.stringify({ action: 'subscribe', symbol: nuevo }));
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

        if (this._wsChart && this._wsChart.readyState === WebSocket.OPEN) {
            this._wsChart.send(JSON.stringify({ action: 'set_timeframe', timeframe: nuevoTF }));
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  LIMPIEZA DE MEMORIA
    // ══════════════════════════════════════════════════════════════════════

    limpiarMemoria() {
        this._contadorTicks = 0;
        this._ultimoConteo = 0;
        this._ticksPorSegundo = 0;
        console.log('[GestorWidgets] Memoria limpiada');
    }

    // ══════════════════════════════════════════════════════════════════════
    //  MÉTRICAS PÚBLICAS
    // ══════════════════════════════════════════════════════════════════════

    obtenerMetricas() {
        return {
            ticks_totales: this._contadorTicks,
            ticks_por_segundo: this._ticksPorSegundo,
            chart_conectado: this._wsChart?.readyState === WebSocket.OPEN,
            simbolo_actual: this._simboloActual,
            timeframe_actual: this._timeframeActual,
            reconexiones_chart: this._reconexionesChart,
        };
    }
}