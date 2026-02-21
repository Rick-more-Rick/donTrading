// ═══════════════════════════════════════════════════════════════
//  EjePrecio.js — Renderiza el eje de precio (columna derecha)
//  Dibuja la escala de precios, gridlines, y la etiqueta
//  verde/roja del precio actual.
//  Dependencias: EstadoPrecio.js (recibe instancia en constructor)
// ═══════════════════════════════════════════════════════════════
window.MD = window.MD || {};

MD.PriceAxisRenderer = class PriceAxisRenderer {
    constructor(canvas, priceState) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ps = priceState;
    }

    render(w, h, currentPrice, firstPrice) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, w, h);
        const range = this.ps.priceMax - this.ps.priceMin;
        if (range <= 0) return;

        const step = this._niceStep(range, 20);
        const start = Math.ceil(this.ps.priceMin / step) * step;
        // Smart decimals: large prices (crypto) → 0, sub-cent zoom → 3, normal → 2
        const decimals = step >= 10 ? 0 : step < 0.01 ? 3 : 2;

        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'right';

        for (let p = start; p < this.ps.priceMax; p += step) {
            const y = this.ps.priceToY(p, h);
            if (y < 5 || y > h - 5) continue;

            ctx.strokeStyle = 'rgba(30,41,59,0.3)';
            ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(6, y); ctx.stroke();
            ctx.fillText(decimals === 0 ? '$' + p.toLocaleString() : '$' + p.toFixed(decimals), w - 6, y + 3);
        }

        if (currentPrice && currentPrice > 0) {
            const y = this.ps.priceToY(currentPrice, h);
            if (y > 0 && y < h) {
                const up = currentPrice >= (firstPrice || currentPrice);
                ctx.fillStyle = up ? '#22c55e' : '#ef4444';
                const tagH = 18;
                ctx.beginPath();
                ctx.roundRect(2, y - tagH / 2, w - 4, tagH, 3);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = '11px "JetBrains Mono", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(decimals === 0 ? '$' + currentPrice.toLocaleString() : '$' + currentPrice.toFixed(decimals), w / 2, y + 4);
            }
        }
    }

    _niceStep(range, ticks) {
        if (range <= 0) return 0.01;
        const r = range / ticks;
        const pow = Math.pow(10, Math.floor(Math.log10(r)));
        const f = r / pow;
        let n;
        if (f <= 1.5) n = 1; else if (f <= 3) n = 2; else if (f <= 7) n = 5; else n = 10;
        // Allow sub-cent steps (0.001) for deep zoom, and large steps for crypto
        return Math.max(0.001, Math.min(10000, n * pow));
    }
};
