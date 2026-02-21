// ═══════════════════════════════════════════════════════════════
//  AgrupadorVelas.js — Agrupa ticks crudos en velas OHLC
//  Convierte datos {time, value} en barras Open/High/Low/Close
//  según el intervalo seleccionado (5s, 1m, 5m, 15m, 1H).
//  Dependencias: ninguna
// ═══════════════════════════════════════════════════════════════
window.MD = window.MD || {}; // Espacio de nombres global para MarketDepth

MD.OHLCAggregator = class OHLCAggregator {
    /**
     * Constructor del agrupador de velas OHLC.
     * @param {number} sec — Intervalo en segundos para cada vela (por defecto 60 = 1 minuto)
     */
    constructor(sec = 60) {
        this.intervalSec = sec;   // intervaloSegundos — duración de cada vela en segundos
        this.candles = [];        // velas — array de velas OHLC ya cerradas/completadas
        this.current = null;      // velaActual — la vela que se está formando en este momento
    }

    /**
     * bucket (cubo/agrupador) — Calcula a qué intervalo de tiempo pertenece un timestamp.
     * Ejemplo: si intervalo=60 y t=1708300045, devuelve 1708300020 (inicio del minuto).
     * Esto "redondea hacia abajo" el tiempo para agrupar ticks en la misma vela.
     * @param {number} t — marcaDeTiempo (timestamp en segundos)
     * @returns {number} — inicio del intervalo al que pertenece este timestamp
     */
    bucket(t) { return Math.floor(t / this.intervalSec) * this.intervalSec; }

    /**
     * tick — Procesa un tick individual (un precio en un momento dado).
     * Si el tick pertenece a la vela actual, actualiza máximo/mínimo/cierre.
     * Si es de un nuevo intervalo, cierra la vela actual y abre una nueva.
     * @param {number} t — marcaDeTiempo (timestamp en segundos)
     * @param {number} p — precio del tick
     */
    tick(t, p) {
        const b = this.bucket(t); // inicioIntervalo — a qué vela pertenece este tick
        if (this.current && this.current.time === b) {
            // El tick pertenece a la vela actual → actualizar valores
            this.current.high = Math.max(this.current.high, p);   // máximo — precio más alto de la vela
            this.current.low = Math.min(this.current.low, p);     // mínimo — precio más bajo de la vela
            this.current.close = p;                                // cierre — último precio registrado
            this.current.volume++;                                 // volumen — cantidad de ticks en esta vela
        } else {
            // Nuevo intervalo → cerrar vela anterior y crear una nueva
            if (this.current) this.candles.push({ ...this.current }); // guardar vela completada
            this.current = {
                time: b,      // tiempo — inicio del intervalo de esta vela
                open: p,      // apertura — primer precio de la vela
                high: p,      // máximo — precio más alto (por ahora solo hay uno)
                low: p,       // mínimo — precio más bajo (por ahora solo hay uno)
                close: p,     // cierre — último precio (por ahora es el mismo)
                volume: 1     // volumen — primer tick contado
            };
        }
    }

    /**
     * fromHistory (desdeHistórico) — Reconstruye todas las velas a partir de ticks históricos.
     * Limpia todo y reprocesa cada tick uno por uno.
     * @param {Array} data — datosCrudos — array de objetos {time, value}
     */
    fromHistory(data) {
        this.candles = [];      // limpiar velas anteriores
        this.current = null;    // limpiar vela en formación
        for (const d of data) this.tick(d.time, d.value); // reprocesar cada tick
    }

    /**
     * changeInterval (cambiarIntervalo) — Cambia el timeframe y recalcula velas.
     * @param {number} sec — nuevoIntervaloSegundos
     * @param {Array} raw — ticksCrudos — datos originales para recalcular
     */
    changeInterval(sec, raw) {
        this.intervalSec = sec;                          // actualizar intervalo
        if (raw && raw.length) this.fromHistory(raw);    // recalcular si hay datos
    }

    /**
     * all (todas) — Devuelve todas las velas: las cerradas + la que se está formando.
     * @returns {Array} — todasLasVelas — array completo para dibujar en el gráfico
     */
    all() {
        const a = [...this.candles];                     // copiar velas cerradas
        if (this.current) a.push(this.current);          // añadir vela en formación
        return a;
    }
};