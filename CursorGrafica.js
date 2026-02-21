// ═══════════════════════════════════════════════════════════════
//  CursorGrafica.js — Líneas del cursor (crosshair) al pasar
//  el mouse sobre la gráfica de velas.
//  Dependencias: ninguna
// ═══════════════════════════════════════════════════════════════
window.MD = window.MD || {};

MD.Crosshair = class Crosshair {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.mx = -1; this.my = -1;
        this.on = false;
    }

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
};
