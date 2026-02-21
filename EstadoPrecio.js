// ═══════════════════════════════════════════════════════════════
//  EstadoPrecio.js — Estado compartido del eje de precio (Y)
//  Maneja priceMin/priceMax, zoom vertical, auto-rango,
//  y conversión precio↔pixel para chart + orderbook.
//  Dependencias: ninguna
// ═══════════════════════════════════════════════════════════════
window.MD = window.MD || {};

MD.SharedPriceState = class SharedPriceState {
    constructor() {
        this.priceMin = 0;
        this.priceMax = 0;
        this.autoRange = true;
        this.manualScale = 1.0;
        this._lastDataMid = 0;
        this._lastDataRange = 1;
        this._offScreenSince = 0;
        // Zoom factor: 1.0 = auto range, <1 = zoomed in, >1 = zoomed out
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

    // ── Zoom Tipo 2: Wheel sobre eje Y — zoom centrado en datos ──
    applyManualZoom(deltaY, _centerRatio) {
        this.autoRange = false;
        const range = this.priceMax - this.priceMin;
        if (range <= 0) { this.resetZoom(); return; }

        // Factor proporcional según scroll
        const sensitivity = 0.006;
        const rawDelta = Math.sign(deltaY) * Math.min(Math.abs(deltaY) * sensitivity, 0.10);
        const factor = 1 + rawDelta;
        let newRange = range * factor;

        // ── Safety clamps: NUNCA rango nulo, negativo, o excesivo ──
        const MIN_RANGE = 0.005;
        const MAX_RANGE = Math.max(this._lastDataRange * 6, 10);
        newRange = Math.max(MIN_RANGE, Math.min(MAX_RANGE, newRange));

        // ── LOCK-TO-CENTER: usar centro del viewport actual (estable entre frames) ──
        const center = (this.priceMin + this.priceMax) / 2;
        this.priceMin = center - newRange / 2;
        this.priceMax = center + newRange / 2;

        // Actualizar zoom factor para el OrderBook ecualizador
        this._zoomFactor = this._lastDataRange > 0 ? newRange / this._lastDataRange : 1.0;
    }

    // ── Zoom Tipo 2: Drag sobre eje Y — zoom vertical con lock-to-center ──
    applyManualDrag(deltaPx, axisHeight) {
        this.autoRange = false;
        const range = this.priceMax - this.priceMin;
        if (range <= 0 || axisHeight <= 0) { this.resetZoom(); return; }

        // Drag arriba (deltaPx negativo) = zoom in (rango se reduce)
        // Drag abajo (deltaPx positivo) = zoom out (rango se expande)
        const sensitivity = 0.004;
        const factor = 1 + deltaPx * sensitivity;
        let newRange = range * factor;

        // ── Safety clamps ──
        const MIN_RANGE = 0.005;
        const MAX_RANGE = Math.max(this._lastDataRange * 6, 10);
        newRange = Math.max(MIN_RANGE, Math.min(MAX_RANGE, newRange));

        // ── LOCK-TO-CENTER: usar centro del viewport actual (NO se mueve con el cursor) ──
        const center = (this.priceMin + this.priceMax) / 2;
        this.priceMin = center - newRange / 2;
        this.priceMax = center + newRange / 2;

        // Actualizar zoom factor para el OrderBook ecualizador
        this._zoomFactor = this._lastDataRange > 0 ? newRange / this._lastDataRange : 1.0;
    }

    // Obtener el scale ratio para el OrderBook ecualizador
    // scaleRatio > 1 = zoom in (filas más altas), < 1 = zoom out (filas más bajas)
    getObScaleRatio() {
        if (this._zoomFactor <= 0 || !isFinite(this._zoomFactor)) return 1.0;
        // Invertir: zoomFactor pequeño = zoom in = filas más grandes
        const ratio = 1.0 / this._zoomFactor;
        // Clamp entre 0.3x y 5x para evitar filas imposibles
        return Math.max(0.3, Math.min(5.0, ratio));
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
};