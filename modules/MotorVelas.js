// ═══════════════════════════════════════════════════════════════
//  MotorVelas.js — Dibuja velas (candlesticks) en canvas 2D
//  Maneja el renderizado, pan (arrastrar) y zoom horizontal.
//  Dependencias: EstadoPrecio.js (recibe instancia en constructor)
// ═══════════════════════════════════════════════════════════════
window.MD = window.MD || {};

const CANDLE_BODY_RATIO = 0.7;

MD.CandleEngine = class CandleEngine {
    constructor(canvas, priceState) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ps = priceState;
        this.visibleCount = 80;
        this._panOffset = 0;      // candles back from latest (integer, ≥0)
        this._panAccumPx = 0;     // sub-candle pixel accumulator
        this._panFractional = 0;  // fractional candle offset for smooth render
    }

    /**
     * Clamp _panOffset to valid bounds.
     * maxBack = max candles we can scroll back, leaving at least 1 candle visible.
     */
    _clampOffset(totalCandles) {
        const maxBack = Math.max(0, totalCandles - 1);
        if (this._panOffset > maxBack) this._panOffset = maxBack;
        if (this._panOffset < 0) this._panOffset = 0;
    }

    /**
     * Get the visible slice of candles for auto-range calculation.
     */
    visible(all) {
        if (!all.length) return [];
        this._clampOffset(all.length);

        const end = all.length - this._panOffset;
        const start = Math.max(0, end - this.visibleCount);
        return all.slice(start, end);
    }

    computeAutoRange(all) {
        const vis = this.visible(all);
        if (!vis.length) return;
        let lo = Infinity, hi = -Infinity;
        vis.forEach(c => { if (c.low < lo) lo = c.low; if (c.high > hi) hi = c.high; });
        this.ps.setAutoRange(lo, hi);
    }

    render(w, h, all) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, w, h);
        if (!all.length) return;

        this._clampOffset(all.length);

        // ── Calculate visible window ──
        const end = all.length - this._panOffset;
        if (end <= 0) return;

        // How many candles CAN we actually show?
        // Use min(visibleCount, total available) so candles stay a normal size
        const effectiveCount = Math.min(this.visibleCount, all.length);
        const idealStart = end - effectiveCount;
        const start = Math.max(0, idealStart - 1);
        const actualEnd = Math.min(all.length, end + 1);
        const vis = all.slice(start, actualEnd);
        if (!vis.length) return;

        // Space is based on effectiveCount so candles don't shrink to nothing
        const space = w / effectiveCount;
        const bodyW = Math.max(1, space * CANDLE_BODY_RATIO);
        const p2y = (p) => this.ps.priceToY(p, h);

        // Fractional pixel shift for sub-candle smooth panning
        const fracShift = this._panFractional * space;

        // Slot alignment: right-align candles in the chart area
        // vis[0] at array index `start` maps to slot (start - idealStart)
        const slotOffset = start - idealStart;

        vis.forEach((c, i) => {
            const slot = i + slotOffset;
            const x = slot * space + space / 2 + fracShift;

            // Cull candles that are fully off-screen
            if (x < -space || x > w + space) return;

            const up = c.close >= c.open;
            const bTop = p2y(Math.max(c.open, c.close));
            const bBot = p2y(Math.min(c.open, c.close));
            const bH = Math.max(1, bBot - bTop);
            const col = up ? '#22c55e' : '#ef4444';

            // Wick
            ctx.strokeStyle = col; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, p2y(c.high));
            ctx.lineTo(x, p2y(c.low));
            ctx.stroke();

            // Body
            ctx.fillStyle = up ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)';
            ctx.fillRect(x - bodyW / 2, bTop, bodyW, bH);
            ctx.strokeStyle = col; ctx.lineWidth = 0.5;
            ctx.strokeRect(x - bodyW / 2, bTop, bodyW, bH);
        });

        // Current price dashed line (only when viewing the latest candles)
        if (this._panOffset === 0) {
            const last = all[all.length - 1];
            if (last) {
                const y = p2y(last.close);
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = last.close >= last.open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }

    zoom(factor) {
        this.visibleCount = Math.max(15, Math.min(300, Math.round(this.visibleCount * factor)));
    }

    /**
     * Pan the chart by deltaPx pixels.
     * Returns true if at least one full candle was crossed (for auto-range decisions).
     * Does NOT touch autoRange — the controller decides when to recalculate.
     */
    pan(deltaPx, chartWidth) {
        const candleWidth = chartWidth / this.visibleCount;
        this._panAccumPx += deltaPx;
        let moved = false;

        // Integer part: move full candles
        const candleDelta = Math.trunc(this._panAccumPx / candleWidth);
        if (candleDelta !== 0) {
            this._panAccumPx -= candleDelta * candleWidth;
            this._panOffset += candleDelta;
            if (this._panOffset < 0) this._panOffset = 0;
            // Note: upper clamp happens in render() via _clampOffset
            moved = true;
        }

        // Fractional part: smooth sub-candle shift
        this._panFractional = this._panAccumPx / candleWidth;
        return moved;
    }

    /** Reset all pan state to origin */
    resetPan() {
        this._panOffset = 0;
        this._panAccumPx = 0;
        this._panFractional = 0;
    }
};
