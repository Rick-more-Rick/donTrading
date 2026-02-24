/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  motores_chart.js — Motores internos de la Gráfica de Velas            ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Contiene (sin dependencias externas ni window.MD):                     ║
 * ║    SharedPriceState   — estado compartido de rango/zoom vertical        ║
 * ║    OHLCAggregator     — agrupa ticks en velas OHLC por timeframe        ║
 * ║    CandleEngine       — renderiza velas, pan horizontal, zoom           ║
 * ║    Crosshair          — líneas del cursor sobre el canvas               ║
 * ║    PriceAxisRenderer  — eje de precio con etiquetas y tag de precio     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

// ─────────────────────────────────────────────────────────────────────────────
//  SharedPriceState — Estado compartido del eje Y (zoom vertical)
// ─────────────────────────────────────────────────────────────────────────────
class SharedPriceState {
    constructor() {
        this.priceMin = 0;
        this.priceMax = 0;
        this.autoRange = true;
        this.manualScale = 1.0;
        this._lastDataMid = 0;
        this._lastDataRange = 1;
        this._offScreenSince = 0;
        this._zoomFactor = 1.0;
    }

    setAutoRange(min, max) {
        if (isFinite(min) && isFinite(max) && max > min) {
            this._lastDataMid = (min + max) / 2;
            this._lastDataRange = max - min;
        }
        if (!this.autoRange) return;
        if (!isFinite(min) || !isFinite(max) || min >= max) return;
        const range = max - min;
        const padding = Math.max(range * 0.08, 0.01);
        this.priceMin = min - padding;
        this.priceMax = max + padding;
        this._zoomFactor = 1.0;
    }

    // Zoom: scroll wheel sobre el eje Y
    applyManualZoom(deltaY, _centerRatio) {
        this.autoRange = false;
        const range = this.priceMax - this.priceMin;
        if (range <= 0) { this.resetZoom(); return; }
        const sensitivity = 0.006;
        const rawDelta = Math.sign(deltaY) * Math.min(Math.abs(deltaY) * sensitivity, 0.10);
        let newRange = range * (1 + rawDelta);
        const MIN_RANGE = 0.005;
        const MAX_RANGE = Math.max(this._lastDataRange * 6, 10);
        newRange = Math.max(MIN_RANGE, Math.min(MAX_RANGE, newRange));
        const center = (this.priceMin + this.priceMax) / 2;
        this.priceMin = center - newRange / 2;
        this.priceMax = center + newRange / 2;
        this._zoomFactor = this._lastDataRange > 0 ? newRange / this._lastDataRange : 1.0;
    }

    // Zoom: arrastrar sobre el eje Y
    applyManualDrag(deltaPx, axisHeight) {
        this.autoRange = false;
        const range = this.priceMax - this.priceMin;
        if (range <= 0 || axisHeight <= 0) { this.resetZoom(); return; }
        const sensitivity = 0.004;
        let newRange = range * (1 + deltaPx * sensitivity);
        const MIN_RANGE = 0.005;
        const MAX_RANGE = Math.max(this._lastDataRange * 6, 10);
        newRange = Math.max(MIN_RANGE, Math.min(MAX_RANGE, newRange));
        const center = (this.priceMin + this.priceMax) / 2;
        this.priceMin = center - newRange / 2;
        this.priceMax = center + newRange / 2;
        this._zoomFactor = this._lastDataRange > 0 ? newRange / this._lastDataRange : 1.0;
    }

    // Ratio de escala inversa para el libro de órdenes
    getObScaleRatio() {
        if (this._zoomFactor <= 0 || !isFinite(this._zoomFactor)) return 1.0;
        return Math.max(0.3, Math.min(5.0, 1.0 / this._zoomFactor));
    }

    hasValidRange() {
        return isFinite(this.priceMax) && isFinite(this.priceMin) &&
            (this.priceMax - this.priceMin) > 0.0001;
    }

    resetZoom() {
        this.autoRange = true;
        this.manualScale = 1.0;
        this._zoomFactor = 1.0;
    }

    priceToY(price, height) {
        const range = this.priceMax - this.priceMin;
        if (!isFinite(range) || range <= 0.0001) return height / 2;
        return height * (1 - (price - this.priceMin) / range);
    }

    yToPrice(y, height) {
        return this.priceMax - (y / height) * (this.priceMax - this.priceMin);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  OHLCAggregator — Agrupa ticks en velas OHLC por timeframe
// ─────────────────────────────────────────────────────────────────────────────
class OHLCAggregator {
    /**
     * @param {number} sec — Intervalo en segundos (60 = 1 minuto por defecto)
     */
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
        this.candles = [];
        this.current = null;
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
}

// ─────────────────────────────────────────────────────────────────────────────
//  CandleEngine — Renderiza velas, pan horizontal y zoom (ex MotorVelas.js)
// ─────────────────────────────────────────────────────────────────────────────
const _RATIO_CUERPO_VELA = 0.7;

class CandleEngine {
    constructor(canvas, estadoPrecio) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.estadoPrecio = estadoPrecio;
        this.velasVisibles = 80;
        this._desplazamiento = 0;
        this._pixelesAcumulados = 0;
        this._fraccionDesplazamiento = 0;
    }

    _limitarDesplazamiento(totalVelas) {
        const maxRetroceso = Math.max(0, totalVelas - 1);
        if (this._desplazamiento > maxRetroceso) this._desplazamiento = maxRetroceso;
        if (this._desplazamiento < 0) this._desplazamiento = 0;
    }

    visible(todas) {
        if (!todas.length) return [];
        this._limitarDesplazamiento(todas.length);
        const fin = todas.length - this._desplazamiento;
        const inicio = Math.max(0, fin - this.velasVisibles);
        return todas.slice(inicio, fin);
    }

    computeAutoRange(todas) {
        const velasEnPantalla = this.visible(todas);
        if (!velasEnPantalla.length) return;
        let minimo = Infinity, maximo = -Infinity;
        for (const v of velasEnPantalla) {
            if (v.low < minimo) minimo = v.low;
            if (v.high > maximo) maximo = v.high;
        }
        this.estadoPrecio.setAutoRange(minimo, maximo);
    }

    render(ancho, alto, todas) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, ancho, alto);
        if (!todas.length) return;

        this._limitarDesplazamiento(todas.length);

        const fin = todas.length - this._desplazamiento;
        if (fin <= 0) return;

        const cantidadEfectiva = Math.min(this.velasVisibles, todas.length);
        const inicioIdeal = fin - cantidadEfectiva;
        const inicioReal = Math.max(0, inicioIdeal - 1);
        const finReal = Math.min(todas.length, fin + 1);
        const velasADibujar = todas.slice(inicioReal, finReal);
        if (!velasADibujar.length) return;

        const espacioEntreVelas = ancho / cantidadEfectiva;
        const anchoCuerpo = Math.max(1, espacioEntreVelas * _RATIO_CUERPO_VELA);
        const precioAPixelY = (precio) => this.estadoPrecio.priceToY(precio, alto);
        const desplFracPx = this._fraccionDesplazamiento * espacioEntreVelas;
        const offsetRanura = inicioReal - inicioIdeal;

        for (let idx = 0; idx < velasADibujar.length; idx++) {
            const vela = velasADibujar[idx];
            const ranura = idx + offsetRanura;
            const centroX = ranura * espacioEntreVelas + espacioEntreVelas / 2 + desplFracPx;
            if (centroX < -espacioEntreVelas || centroX > ancho + espacioEntreVelas) continue;

            const esAlcista = vela.close >= vela.open;
            const topeCuerpo = precioAPixelY(Math.max(vela.open, vela.close));
            const baseCuerpo = precioAPixelY(Math.min(vela.open, vela.close));
            const alturaCuerpo = Math.max(1, baseCuerpo - topeCuerpo);
            const colorVela = esAlcista ? '#22c55e' : '#ef4444';

            ctx.strokeStyle = colorVela;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(centroX, precioAPixelY(vela.high));
            ctx.lineTo(centroX, precioAPixelY(vela.low));
            ctx.stroke();

            ctx.fillStyle = esAlcista ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)';
            ctx.fillRect(centroX - anchoCuerpo / 2, topeCuerpo, anchoCuerpo, alturaCuerpo);
            ctx.strokeStyle = colorVela;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(centroX - anchoCuerpo / 2, topeCuerpo, anchoCuerpo, alturaCuerpo);
        }

        // Línea punteada del precio actual (más reciente)
        if (this._desplazamiento === 0) {
            const ultima = todas[todas.length - 1];
            if (ultima) {
                const posY = precioAPixelY(ultima.close);
                const esAlcista = ultima.close >= ultima.open;
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = esAlcista ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(0, posY); ctx.lineTo(ancho, posY); ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }

    zoom(factor) {
        this.velasVisibles = Math.max(15, Math.min(300, Math.round(this.velasVisibles * factor)));
    }

    pan(deltaPx, anchoGrafico) {
        const anchoVela = anchoGrafico / this.velasVisibles;
        this._pixelesAcumulados += deltaPx;
        let seMovio = false;
        const velasMovidas = Math.trunc(this._pixelesAcumulados / anchoVela);
        if (velasMovidas !== 0) {
            this._pixelesAcumulados -= velasMovidas * anchoVela;
            this._desplazamiento += velasMovidas;
            if (this._desplazamiento < 0) this._desplazamiento = 0;
            seMovio = true;
        }
        this._fraccionDesplazamiento = this._pixelesAcumulados / anchoVela;
        return seMovio;
    }

    resetPan() {
        this._desplazamiento = 0;
        this._pixelesAcumulados = 0;
        this._fraccionDesplazamiento = 0;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Crosshair — Líneas del cursor sobre el canvas
// ─────────────────────────────────────────────────────────────────────────────
class Crosshair {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.mx = -1;
        this.my = -1;
        this.on = false;
    }

    update(x, y) { this.mx = x; this.my = y; this.on = true; }
    hide() { this.on = false; }

    render(w, h) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, w, h);
        if (!this.on || this.mx < 0) return;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(148,163,184,0.25)';
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(0, this.my); ctx.lineTo(w, this.my); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(this.mx, 0); ctx.lineTo(this.mx, h); ctx.stroke();
        ctx.setLineDash([]);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PriceAxisRenderer — Eje de precio con etiquetas y tag del precio actual
// ─────────────────────────────────────────────────────────────────────────────
class PriceAxisRenderer {
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
            ctx.fillText(
                decimals === 0 ? '$' + p.toLocaleString() : '$' + p.toFixed(decimals),
                w - 6, y + 3
            );
        }

        if (currentPrice && currentPrice > 0) {
            const y = this.ps.priceToY(currentPrice, h);
            if (y > 0 && y < h) {
                const up = currentPrice >= (firstPrice || currentPrice);
                const tagH = 18;
                ctx.fillStyle = up ? '#22c55e' : '#ef4444';
                ctx.beginPath();
                ctx.roundRect(2, y - tagH / 2, w - 4, tagH, 3);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = '11px "JetBrains Mono", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(
                    decimals === 0 ? '$' + currentPrice.toLocaleString() : '$' + currentPrice.toFixed(decimals),
                    w / 2, y + 4
                );
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
        return Math.max(0.001, Math.min(10000, n * pow));
    }
}
