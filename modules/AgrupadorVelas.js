// ═══════════════════════════════════════════════════════════════
//  AgrupadorVelas.js — Agrupa ticks crudos en velas OHLC
//  Convierte datos {time, value} en barras Open/High/Low/Close
//  según el intervalo seleccionado (5s, 1m, 5m, 15m, 1H).
//  Dependencias: ninguna
// ═══════════════════════════════════════════════════════════════
window.MD = window.MD || {};

MD.OHLCAggregator = class OHLCAggregator {
    constructor(sec = 60) {
        this.intervalSec = sec;
        this.candles = [];
        this.current = null;
    }

    bucket(t) { return Math.floor(t / this.intervalSec) * this.intervalSec; }

    tick(t, p) {
        const b = this.bucket(t);
        if (this.current && this.current.time === b) {
            this.current.high = Math.max(this.current.high, p);
            this.current.low = Math.min(this.current.low, p);
            this.current.close = p;
            this.current.volume++;
        } else {
            if (this.current) this.candles.push({ ...this.current });
            this.current = { time: b, open: p, high: p, low: p, close: p, volume: 1 };
        }
    }

    fromHistory(data) {
        this.candles = []; this.current = null;
        for (const d of data) this.tick(d.time, d.value);
    }

    changeInterval(sec, raw) {
        this.intervalSec = sec;
        if (raw && raw.length) this.fromHistory(raw);
    }

    all() {
        const a = [...this.candles];
        if (this.current) a.push(this.current);
        return a;
    }
};
