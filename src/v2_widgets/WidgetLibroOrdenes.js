/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  WidgetLibroOrdenes.js — Libro de Órdenes Autónomo v4                  ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Arquitectura AUTÓNOMA (sin dependencias externas):                     ║
 * ║    · WebSocket propio → ws://host:puertoBook (orderbook.py)            ║
 * ║    · _OBStore    — capa de datos (niveles de precio)                   ║
 * ║    · _OBRenderer — scroll virtual de filas DOM                         ║
 * ║    · _OBCanvas   — canvas de barras de profundidad                     ║
 * ║    · Vinculado al bus:                                                  ║
 * ║        CAMBIO_ACTIVO  → limpiar + subscribe al nuevo símbolo           ║
 * ║        CAMBIO_PRECIO  → ajustar rowHeight (zoom sync con gráfica)      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

// ─────────────────────────────────────────────────────────────────────────────
//  CSS AUTO-INYECTADO (scoped con prefijo .ob4-)
// ─────────────────────────────────────────────────────────────────────────────
(function _inyectarEstilosOB() {
    if (document.getElementById('ob4-styles')) return;
    const s = document.createElement('style');
    s.id = 'ob4-styles';
    s.textContent = `
.ob4-root {
    display:flex; flex-direction:column; height:100%; width:100%;
    overflow:hidden; font-family:'Outfit','Segoe UI',sans-serif;
    background:var(--bg-secondary,#111827); color:var(--text-primary,#e2e8f0);
    --ob4-green:#22c55e; --ob4-green-l:#86efac; --ob4-green-t:#4ade80;
    --ob4-red:#ef4444;   --ob4-red-l:#fca5a5;   --ob4-red-t:#f87171;
    --ob4-amber:#f59e0b; --ob4-border:#1e293b;   --ob4-muted:#475569;
    --ob4-row-h:18px;
}
/* Header */
.ob4-header {
    padding:6px 10px; border-bottom:1px solid var(--ob4-border);
    display:flex; align-items:center; justify-content:space-between;
    height:28px; flex-shrink:0;
}
.ob4-title { font-size:12px; font-weight:600; }
.ob4-status { font-size:10px; color:var(--ob4-muted); transition:color .3s; }
.ob4-status.ok { color:var(--ob4-green); }

/* Summary */
.ob4-summary {
    display:flex; border-bottom:1px solid var(--ob4-border); flex-shrink:0;
}
.ob4-side { flex:1; padding:6px 8px; text-align:center; }
.ob4-side.bid { border-right:1px solid var(--ob4-border); }
.ob4-side-lbl {
    font-size:8px; text-transform:uppercase; letter-spacing:1px;
    color:var(--ob4-muted); margin-bottom:2px;
}
.ob4-side.bid .ob4-side-lbl { color:var(--ob4-green-t); }
.ob4-side.ask .ob4-side-lbl { color:var(--ob4-red-t); }
.ob4-side-price {
    font-family:'Outfit',sans-serif; font-size:16px; font-weight:700; display:block;
}
.ob4-side.bid .ob4-side-price { color:var(--ob4-green-l); }
.ob4-side.ask .ob4-side-price { color:var(--ob4-red-l); }

/* Mid row */
.ob4-mid {
    display:flex; align-items:center; justify-content:center;
    padding:3px 8px; gap:10px; flex-shrink:0; min-height:24px;
    background:rgba(245,158,11,.08);
    border-top:1px solid rgba(245,158,11,.2);
    border-bottom:1px solid rgba(245,158,11,.2);
    font-family:'Outfit',sans-serif; font-size:11px; font-weight:600;
    color:var(--ob4-amber);
}
.ob4-mid-spd { font-size:9px; font-weight:400; color:#94a3b8; }

/* Table */
.ob4-table-wrap {
    flex:1; display:flex; flex-direction:column;
    overflow:hidden; position:relative;
}
.ob4-col-hdr {
    display:flex; align-items:center; padding:3px 4px;
    font-size:8px; font-weight:500; color:var(--ob4-muted);
    text-transform:uppercase; letter-spacing:.4px;
    border-bottom:1px solid var(--ob4-border); flex-shrink:0;
    background:var(--bg-secondary,#111827); z-index:2; position:relative;
}
.ob4-col-hdr span { text-align:center; }
.ob4-col-hdr .h-monto { width:44px; text-align:right; }
.ob4-col-hdr .h-acum  { width:36px; text-align:right; }
.ob4-col-hdr .h-qty   { width:34px; text-align:right; }
.ob4-col-hdr .h-bid   { flex:1; text-align:right; color:var(--ob4-green-t); padding-right:4px; }
.ob4-col-hdr .h-ask   { flex:1; text-align:left;  color:var(--ob4-red-t);   padding-left:4px; }

/* Viewport */
.ob4-vp {
    flex:1; overflow-y:auto; overflow-x:hidden; position:relative;
    scrollbar-width:thin; scrollbar-color:#1e293b transparent;
}
.ob4-vp::-webkit-scrollbar { width:3px; }
.ob4-vp::-webkit-scrollbar-thumb { background:#1e293b; border-radius:2px; }
.ob4-spacer { width:100%; pointer-events:none; }
.ob4-pool { position:absolute; top:0; left:0; right:0; will-change:transform; }

/* Filas */
.ob4-row {
    display:flex; align-items:center; height:var(--ob4-row-h,18px);
    min-height:var(--ob4-row-h,18px); position:relative;
    font-family:'JetBrains Mono',monospace; font-size:9px;
    overflow:hidden; padding:0 4px;
    transition:background .12s ease;
}
.ob4-row:hover { background:rgba(148,163,184,.06) !important; }
.ob4-row.best-row { background:rgba(245,158,11,.06); }
.ob4-row span { z-index:1; position:relative; text-shadow:0 0 4px rgba(0,0,0,.9); }
.ob4-row .c-monto { width:44px; text-align:right; color:#94a3b8; font-size:8px; }
.ob4-row .c-acum  { width:36px; text-align:right; color:#64748b; font-size:8px; }
.ob4-row .c-qty   { width:34px; text-align:right; color:#e2e8f0; }
.ob4-row .c-bid   { flex:1; text-align:right; padding-right:4px; color:var(--ob4-green-l); font-weight:500; }
.ob4-row .c-ask   { flex:1; text-align:left;  padding-left:4px;  color:var(--ob4-red-l);   font-weight:500; }
.ob4-row .empty   { color:#1e293b !important; }
.ob4-row .filler  { color:#334155 !important; font-weight:400 !important; }
.ob4-row .real-bid { color:var(--ob4-green-l) !important; font-weight:600 !important; }
.ob4-row .real-ask { color:var(--ob4-red-l)   !important; font-weight:600 !important; }

/* Canvas overlay */
.ob4-canvas {
    position:absolute; top:0; left:0; width:100%; height:100%;
    pointer-events:none; z-index:0;
}

/* Footer */
.ob4-footer {
    padding:4px 10px; border-top:1px solid var(--ob4-border);
    font-size:9px; color:var(--ob4-muted);
    display:flex; justify-content:space-between; flex-shrink:0;
}

/* Tooltip hover */
.ob4-tip {
    position:fixed; z-index:200; background:rgba(15,23,42,.95);
    border:1px solid rgba(59,130,246,.3); border-radius:6px;
    padding:6px 10px; font-family:'JetBrains Mono',monospace;
    font-size:10px; color:#e2e8f0; pointer-events:none;
    display:none; backdrop-filter:blur(8px);
    white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,.4);
}
`;
    document.head.appendChild(s);
})();

// ─────────────────────────────────────────────────────────────────────────────
//  _OBStore — Capa de datos (niveles infinitos de precio)
// ─────────────────────────────────────────────────────────────────────────────
class _OBStore {
    constructor() {
        this.bidMap = new Map();
        this.askMap = new Map();
        this.bidArray = [];
        this.askArray = [];
        this.midPrice = 0;
        this.bestBid = 0;
        this.bestAsk = 0;
        this.spread = 0;
        this._step = 0.01;
        this._maxLevels = 500;
        this._BASE_LEVELS = 500;
    }

    /**
     * Paso dinámico según el precio del activo:
     * <$10     → $0.001  (pennystock)
     * $10-999  → $0.01   (stocks normales)
     * $1000+   → $0.10   (acciones caras / ETFs)
     * $5000+   → $0.50   (crypto mid-range)
     * $10000+  → $1.00   (BTC)
     */
    _computeStep(price) {
        if (!price || price <= 0) return 0.01;
        if (price >= 10000) return 1.00;
        if (price >= 5000) return 0.50;
        if (price >= 1000) return 0.10;
        if (price >= 10) return 0.01;
        return 0.001;
    }

    /** Redondea al step exacto para evitar floating-point drift */
    _snap(p) {
        const factor = Math.max(1, Math.round(1 / this._step));
        return Math.round(p * factor) / factor;
    }

    /** Feed desde WS: {bids, asks, best_bid, best_ask, spread, mid_price} */
    update(book) {
        if (!book) return;

        const prevBestBid = this.bestBid;
        this.midPrice = book.mid_price || 0;
        this.bestBid = book.best_bid || 0;
        this.bestAsk = book.best_ask || 0;
        this.spread = book.spread || 0;

        // Recalcular step si el precio cambió significativamente (otro activo)
        const refPrice = this.bestBid || this.bestAsk || this.midPrice;
        const newStep = this._computeStep(refPrice);
        if (newStep !== this._step) {
            this._step = newStep;
            this._maxLevels = this._BASE_LEVELS;   // ← resetear expansión al nuevo step
        }

        // Detectar cambio de activo (precio saltó >5%) → resetear niveles expandidos
        if (prevBestBid > 0 && this.bestBid > 0) {
            const pctChange = Math.abs(this.bestBid - prevBestBid) / prevBestBid;
            if (pctChange > 0.05) {
                this._maxLevels = this._BASE_LEVELS;
            }
        }

        // Construir mapas con snap al step
        this.bidMap.clear();
        for (const l of (book.bids || [])) {
            if (!l || !l.precio || !l.tamano) continue;
            const p = this._snap(l.precio);
            this.bidMap.set(p, (this.bidMap.get(p) || 0) + l.tamano);
        }

        this.askMap.clear();
        for (const l of (book.asks || [])) {
            if (!l || !l.precio || !l.tamano) continue;
            const p = this._snap(l.precio);
            this.askMap.set(p, (this.askMap.get(p) || 0) + l.tamano);
        }

        this._rebuild();
    }

    reset() {
        this.bidMap.clear();
        this.askMap.clear();
        this.bidArray = [];
        this.askArray = [];
        this.midPrice = this.bestBid = this.bestAsk = this.spread = 0;
        this._maxLevels = this._BASE_LEVELS;   // ← CRUCIAL al cambiar activo
        this._step = 0.01;
    }

    _rebuild() {
        const n = this._maxLevels;
        const step = this._step;

        // Centro de referencia: bestBid/bestAsk, con midPrice como fallback
        const bidStart = this.bestBid > 0 ? this._snap(this.bestBid)
            : this.midPrice > 0 ? this._snap(this.midPrice) : 0;
        const askStart = this.bestAsk > 0 ? this._snap(this.bestAsk)
            : this.midPrice > 0 ? this._snap(this.midPrice + step) : 0;

        // BIDS: desde bidStart hacia abajo
        if (bidStart <= 0) {
            this.bidArray = [];
        } else {
            this.bidArray = [];
            let cum = 0, cumM = 0;
            let p = bidStart;
            for (let i = 0; i < n; i++) {
                const qty = this.bidMap.get(p) || 0;
                cum += qty;
                cumM += qty * p;
                this.bidArray.push({ price: p, qty, cumQty: cum, monto: cumM, real: qty > 0 });
                p = this._snap(p - step);
                if (p <= 0) break;   // seguridad: nunca precio negativo
            }
        }

        // ASKS: desde askStart hacia arriba
        if (askStart <= 0) {
            this.askArray = [];
        } else {
            this.askArray = [];
            let cum = 0, cumM = 0;
            let p = askStart;
            for (let i = 0; i < n; i++) {
                const qty = this.askMap.get(p) || 0;
                cum += qty;
                cumM += qty * p;
                this.askArray.push({ price: p, qty, cumQty: cum, monto: cumM, real: qty > 0 });
                p = this._snap(p + step);
            }
        }
    }

    /** Expande bajo demanda cuando el scroll se acerca al borde */
    ensureLevels(n) {
        if (n > this._maxLevels) this._maxLevels = n;
        const step = this._step;

        if (this.bidArray.length > 0 && this.bidArray.length < n) {
            let last = this.bidArray[this.bidArray.length - 1];
            let cum = last.cumQty, cumM = last.monto || 0;
            let p = this._snap(last.price - step);
            while (this.bidArray.length < n && p > 0) {
                const qty = this.bidMap.get(p) || 0;
                cum += qty; cumM += qty * p;
                this.bidArray.push({ price: p, qty, cumQty: cum, monto: cumM, real: qty > 0 });
                p = this._snap(p - step);
            }
        }

        if (this.askArray.length > 0 && this.askArray.length < n) {
            let last = this.askArray[this.askArray.length - 1];
            let cum = last.cumQty, cumM = last.monto || 0;
            let p = this._snap(last.price + step);
            while (this.askArray.length < n) {
                const qty = this.askMap.get(p) || 0;
                cum += qty; cumM += qty * p;
                this.askArray.push({ price: p, qty, cumQty: cum, monto: cumM, real: qty > 0 });
                p = this._snap(p + step);
            }
        }
    }

    get totalLevels() {
        return Math.max(this.bidArray.length, this.askArray.length);
    }

    getMaxes(start, count) {
        let maxVol = 1, maxCum = 1;
        const end = Math.min(start + count, Math.max(this.bidArray.length, this.askArray.length));
        for (let i = start; i < end; i++) {
            const b = this.bidArray[i], a = this.askArray[i];
            if (b) { if (b.qty > maxVol) maxVol = b.qty; if (b.cumQty > maxCum) maxCum = b.cumQty; }
            if (a) { if (a.qty > maxVol) maxVol = a.qty; if (a.cumQty > maxCum) maxCum = a.cumQty; }
        }
        return { maxVol, maxCum };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  _OBRenderer — Scroll virtual de filas DOM
// ─────────────────────────────────────────────────────────────────────────────
class _OBRenderer {
    constructor(store, els) {
        this.store = store;
        this.vp = els.vp;
        this.spacer = els.spacer;
        this.pool = els.pool;
        this.wrapEl = els.tableWrap;
        this.midEl = els.midPrice;
        this.spdEl = els.spread;
        this.bidEl = els.bestBid;
        this.askEl = els.bestAsk;
        this._rows = [];
        this._rowH = 18;
        this._lastInfo = null;
        this._lastSH = 0;
    }

    setRowHeight(h) { this._rowH = Math.max(8, Math.min(80, h)); }

    render() {
        // CORREGIDO: no esperar midPrice — usar bestBid o bestAsk como fallback
        const refPrice = this.store.midPrice || this.store.bestBid || this.store.bestAsk;
        if (!refPrice) return null;

        const _fp = v => v >= 1000
            ? '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '$' + v.toFixed(2);

        this._set(this.midEl, _fp(this.store.midPrice));
        this._set(this.spdEl, '$' + this.store.spread.toFixed(4));
        this._set(this.bidEl, _fp(this.store.bestBid));
        this._set(this.askEl, _fp(this.store.bestAsk));

        const rowH = this._rowH;
        let totalRows = this.store.totalLevels;
        if (totalRows === 0) return null;

        const vpH = this.vp.clientHeight;
        const scrollTop = this.vp.scrollTop;
        const startIdx = Math.max(0, Math.floor(scrollTop / rowH) - 2);
        const visCount = Math.ceil(vpH / rowH) + 5;
        const neededEnd = startIdx + visCount;

        if (neededEnd + 50 > totalRows) {
            this.store.ensureLevels(neededEnd + 150);
            totalRows = this.store.totalLevels;
        }

        const endIdx = Math.min(totalRows, neededEnd);
        const actualCount = endIdx - startIdx;
        const spacerH = (totalRows + 100) * rowH;

        if (Math.abs(spacerH - this._lastSH) > rowH) {
            this.spacer.style.height = spacerH + 'px';
            this._lastSH = spacerH;
        }
        this.wrapEl.style.setProperty('--ob4-row-h', rowH + 'px');
        this._growPool(actualCount);

        const poolTop = startIdx * rowH;
        this.pool.style.transform = `translateY(${poolTop}px)`;

        const bbR = Math.round(this.store.bestBid * 100) / 100;
        const baR = Math.round(this.store.bestAsk * 100) / 100;

        for (let i = 0; i < actualCount; i++) {
            const di = startIdx + i;
            const r = this._rows[i];
            const ch = r.el.children;
            const bid = this.store.bidArray[di] || null;
            const ask = this.store.askArray[di] || null;

            const isBB = bid && bid.real && bid.price === bbR;
            const isBA = ask && ask.real && ask.price === baR;

            let cls = 'ob4-row';
            if (isBB || isBA) cls += ' best-row';
            if (r.el.className !== cls) r.el.className = cls;

            // Bid side: [0]=monto [1]=acum [2]=qty [3]=precio
            this._set(ch[0], bid && bid.monto > 0 ? this._fmtM(bid.monto) : '');
            this._set(ch[1], bid && bid.cumQty > 0 ? this._fmt(bid.cumQty) : '');
            this._set(ch[2], bid && bid.qty > 0 ? this._fmt(bid.qty) : '');
            this._set(ch[3], bid ? _fp(bid.price).replace('$', '') : '');
            ch[3].className = 'c-bid' + (bid ? (bid.real ? '' : ' filler') : ' empty');
            ch[2].className = 'c-qty' + (bid && bid.qty > 0 ? ' real-bid' : ' empty');
            ch[1].className = 'c-acum' + (bid && bid.cumQty > 0 ? '' : ' empty');
            ch[0].className = 'c-monto' + (bid && bid.monto > 0 ? '' : ' empty');

            // Ask side: [4]=precio [5]=qty [6]=acum [7]=monto
            this._set(ch[4], ask ? _fp(ask.price).replace('$', '') : '');
            this._set(ch[5], ask && ask.qty > 0 ? this._fmt(ask.qty) : '');
            this._set(ch[6], ask && ask.cumQty > 0 ? this._fmt(ask.cumQty) : '');
            this._set(ch[7], ask && ask.monto > 0 ? this._fmtM(ask.monto) : '');
            ch[4].className = 'c-ask' + (ask ? (ask.real ? '' : ' filler') : ' empty');
            ch[5].className = 'c-qty' + (ask && ask.qty > 0 ? ' real-ask' : ' empty');
            ch[6].className = 'c-acum' + (ask && ask.cumQty > 0 ? '' : ' empty');
            ch[7].className = 'c-monto' + (ask && ask.monto > 0 ? '' : ' empty');

            r.bidData = bid; r.askData = ask; r.dataIdx = di;
        }

        this._lastInfo = { startIdx, actualCount, rowH, poolTop, vpH, scrollTop };
        return this._lastInfo;
    }

    _growPool(count) {
        while (this._rows.length < count) {
            const el = document.createElement('div');
            el.className = 'ob4-row';
            el.innerHTML =
                '<span class="c-monto"></span><span class="c-acum"></span>' +
                '<span class="c-qty"></span><span class="c-bid"></span>' +
                '<span class="c-ask"></span><span class="c-qty"></span>' +
                '<span class="c-acum"></span><span class="c-monto"></span>';
            this.pool.appendChild(el);
            this._rows.push({ el, dataIdx: -1, bidData: null, askData: null });
        }
        for (let i = 0; i < this._rows.length; i++) {
            const show = i < count;
            if (this._rows[i].el.style.display !== (show ? '' : 'none'))
                this._rows[i].el.style.display = show ? '' : 'none';
        }
    }

    _set(el, txt) { if (el.textContent !== txt) el.textContent = txt; }
    _fmt(v) { if (!v) return '0'; if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'; if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return `${v}`; }
    _fmtM(v) { if (!v || v <= 0) return ''; if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M'; if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K'; return '$' + v.toFixed(0); }
    destroy() { this._rows = []; this.pool.innerHTML = ''; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  _OBCanvas — Canvas de barras de volumen/profundidad
// ─────────────────────────────────────────────────────────────────────────────
class _OBCanvas {
    constructor(canvas, store, tableWrap) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.store = store;
        this.wrapEl = tableWrap;
        this._pulse = 0;
    }

    render(info) {
        const ctx = this.ctx;
        const w = this.wrapEl.clientWidth;
        const h = this.wrapEl.clientHeight;
        const dpr = window.devicePixelRatio || 1;

        if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
            this.canvas.width = Math.round(w * dpr);
            this.canvas.height = Math.round(h * dpr);
            this.canvas.style.width = w + 'px';
            this.canvas.style.height = h + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        ctx.clearRect(0, 0, w, h);
        if (!info || !this.store.midPrice) return;

        const { startIdx, actualCount, rowH, poolTop, scrollTop } = info;
        const cx = w / 2;
        const bbR = Math.round(this.store.bestBid * 100) / 100;
        const baR = Math.round(this.store.bestAsk * 100) / 100;

        this._pulse = (this._pulse + 0.02) % 1;
        const pulse = 0.4 + 0.3 * Math.sin(this._pulse * Math.PI * 2);

        const colHdr = this.wrapEl.querySelector('.ob4-col-hdr');
        const hdrH = colHdr ? colHdr.offsetHeight : 0;
        const { maxVol, maxCum } = this.store.getMaxes(startIdx, actualCount);

        for (let i = 0; i < actualCount; i++) {
            const di = startIdx + i;
            const bid = this.store.bidArray[di];
            const ask = this.store.askArray[di];
            const y = poolTop + i * rowH - scrollTop + hdrH;
            if (y + rowH < 0 || y > h) continue;

            const isBB = bid && bid.real && bid.price === bbR;
            const isBA = ask && ask.real && ask.price === baR;

            // Bid: profundidad acumulada (fondo)
            if (bid && bid.cumQty > 0) {
                const cr = bid.cumQty / maxCum;
                const dW = Math.max(3, cr * cx * 0.92);
                const aE = bid.real ? (.10 + cr * .22) : (.06 + cr * .12);
                const g = ctx.createLinearGradient(cx - dW, 0, cx, 0);
                g.addColorStop(0, 'rgba(34,197,94,.02)');
                g.addColorStop(1, `rgba(34,197,94,${aE.toFixed(3)})`);
                ctx.fillStyle = g; ctx.fillRect(cx - dW, y + .5, dW, rowH - 1);
                ctx.fillStyle = `rgba(34,197,94,${(.2 + cr * .5).toFixed(2)})`;
                ctx.fillRect(cx - dW, y + 1, 1.5, rowH - 2);
            }

            // Ask: profundidad acumulada (fondo)
            if (ask && ask.cumQty > 0) {
                const cr = ask.cumQty / maxCum;
                const dW = Math.max(3, cr * cx * 0.92);
                const aE = ask.real ? (.10 + cr * .22) : (.06 + cr * .12);
                const g = ctx.createLinearGradient(cx, 0, cx + dW, 0);
                g.addColorStop(0, `rgba(239,68,68,${aE.toFixed(3)})`);
                g.addColorStop(1, 'rgba(239,68,68,.02)');
                ctx.fillStyle = g; ctx.fillRect(cx, y + .5, dW, rowH - 1);
                ctx.fillStyle = `rgba(239,68,68,${(.2 + cr * .5).toFixed(2)})`;
                ctx.fillRect(cx + dW - 1.5, y + 1, 1.5, rowH - 2);
            }

            // Bid: barra de volumen instantáneo
            if (bid && bid.qty > 0) {
                const r = bid.qty / maxVol;
                const bW = Math.max(3, r * cx * 0.85);
                const a = isBB ? pulse + .2 : (.12 + r * .38);
                const g = ctx.createLinearGradient(cx - bW, 0, cx, 0);
                g.addColorStop(0, `rgba(34,197,94,${(a * .1).toFixed(3)})`);
                g.addColorStop(.6, `rgba(34,197,94,${a.toFixed(3)})`);
                g.addColorStop(1, `rgba(34,197,94,${(a * 1.15).toFixed(3)})`);
                ctx.fillStyle = g; ctx.fillRect(cx - bW, y + .5, bW, rowH - 1);
                ctx.fillStyle = `rgba(34,197,94,${(isBB ? .9 : .3 + r * .5).toFixed(2)})`;
                ctx.fillRect(cx - bW, y + 1, 1.5, rowH - 2);
                if (isBB) {
                    ctx.shadowColor = 'rgba(34,197,94,.6)'; ctx.shadowBlur = 10;
                    ctx.fillStyle = 'rgba(34,197,94,.08)'; ctx.fillRect(0, y, cx, rowH);
                    ctx.shadowBlur = 0;
                }
            }

            // Ask: barra de volumen instantáneo
            if (ask && ask.qty > 0) {
                const r = ask.qty / maxVol;
                const bW = Math.max(3, r * cx * 0.85);
                const a = isBA ? pulse + .2 : (.12 + r * .38);
                const g = ctx.createLinearGradient(cx, 0, cx + bW, 0);
                g.addColorStop(0, `rgba(239,68,68,${(a * 1.15).toFixed(3)})`);
                g.addColorStop(.4, `rgba(239,68,68,${a.toFixed(3)})`);
                g.addColorStop(1, `rgba(239,68,68,${(a * .1).toFixed(3)})`);
                ctx.fillStyle = g; ctx.fillRect(cx, y + .5, bW, rowH - 1);
                ctx.fillStyle = `rgba(239,68,68,${(isBA ? .9 : .3 + r * .5).toFixed(2)})`;
                ctx.fillRect(cx + bW - 1.5, y + 1, 1.5, rowH - 2);
                if (isBA) {
                    ctx.shadowColor = 'rgba(239,68,68,.6)'; ctx.shadowBlur = 10;
                    ctx.fillStyle = 'rgba(239,68,68,.08)'; ctx.fillRect(cx, y, cx, rowH);
                    ctx.shadowBlur = 0;
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  WidgetLibroOrdenes — Widget principal (autónomo)
// ─────────────────────────────────────────────────────────────────────────────
class WidgetLibroOrdenes extends ClaseBaseWidget {

    /**
     * @param {HTMLElement} contenedor
     * @param {Object}  [config]
     * @param {string}  [config.simbolo='']     Símbolo inicial
     * @param {string}  [config.host='localhost']
     * @param {number}  [config.puertoBook=8766]
     */
    constructor(contenedor, config = {}) {
        super(contenedor, config);

        this._simbolo = config.simbolo || '';
        this._host = config.host || 'localhost';
        this._puerto = config.puertoBook || 8766;

        // WebSocket propio al orderbook.py
        /** @type {WebSocket|null} */
        this._ws = null;
        this._wsReconexiones = 0;
        this._maxReconexiones = 20;
        this._timerReconexion = null;
        this._detenido = false;

        // Estado
        this._primerDato = false;
        this._timerNoData = null;
        this._baseRange = null;   // para syncScale

        // Motores internos (se crean en renderizar)
        /** @type {_OBStore|null}    */ this._store = null;
        /** @type {_OBRenderer|null} */ this._renderer = null;
        /** @type {_OBCanvas|null}   */ this._canvas = null;
        /** @type {number|null}      */ this._rafId = null;

        // Elementos DOM (se asignan en _buildDOM)
        this._els = {};
    }

    // ══════════════════════════════════════════════════════════════════════
    //  CICLO DE VIDA
    // ══════════════════════════════════════════════════════════════════════

    renderizar() {
        this.contenedor.style.cssText =
            'display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;';

        this._buildDOM();
        this._store = new _OBStore();
        this._renderer = new _OBRenderer(this._store, this._els);
        this._canvas = new _OBCanvas(this._els.canvas, this._store, this._els.tableWrap);

        this._iniciarLoop();
        this._conectarWS();
        this._suscribirBus();

        this._setStatus('Conectando…', false);
        console.log(`[WidgetLibroOrdenes] 🟢 Iniciado | símbolo: ${this._simbolo || '(ninguno)'} | WS: ws://${this._host}:${this._puerto}`);
    }

    destruir() {
        this._detenido = true;
        clearTimeout(this._timerNoData);
        clearTimeout(this._timerReconexion);

        if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
        if (this._ws) { this._ws.onclose = null; this._ws.close(); this._ws = null; }
        if (this._renderer) { this._renderer.destroy(); }

        // Quitar tooltip del body si existe
        if (this._tooltip && this._tooltip.parentNode)
            this._tooltip.parentNode.removeChild(this._tooltip);

        super.destruir();
        console.log('[WidgetLibroOrdenes] 🗑️ Destruido');
    }

    // ══════════════════════════════════════════════════════════════════════
    //  DOM
    // ══════════════════════════════════════════════════════════════════════

    _buildDOM() {
        this.contenedor.classList.add('ob4-root');
        this.contenedor.innerHTML = `
            <div class="ob4-header">
                <span class="ob4-title">📊 DOM Depth</span>
                <span class="ob4-status" data-el="status">Conectando…</span>
            </div>
            <div class="ob4-summary">
                <div class="ob4-side bid">
                    <div class="ob4-side-lbl">DEMANDAS ↑</div>
                    <div class="ob4-side-price" data-el="bestBid">$—</div>
                </div>
                <div class="ob4-side ask">
                    <div class="ob4-side-lbl">OFERTAS ↓</div>
                    <div class="ob4-side-price" data-el="bestAsk">$—</div>
                </div>
            </div>
            <div class="ob4-mid">
                <span data-el="midPrice">$—</span>
                <span class="ob4-mid-spd">Spd: <span data-el="spread">—</span></span>
            </div>
            <div class="ob4-table-wrap" data-el="tableWrap">
                <canvas class="ob4-canvas" data-el="canvas"></canvas>
                <div class="ob4-col-hdr">
                    <span class="h-monto">Monto</span>
                    <span class="h-acum">Acum</span>
                    <span class="h-qty">Qty</span>
                    <span class="h-bid">Bid</span>
                    <span class="h-ask">Ask</span>
                    <span class="h-qty">Qty</span>
                    <span class="h-acum">Acum</span>
                    <span class="h-monto">Monto</span>
                </div>
                <div class="ob4-vp" data-el="vp">
                    <div class="ob4-spacer" data-el="spacer"></div>
                    <div class="ob4-pool"   data-el="pool"></div>
                </div>
            </div>
            <div class="ob4-footer">
                <span>Spread: <span data-el="footerSpread">—</span></span>
                <span>Upd: <span data-el="footerUpd">0</span></span>
            </div>
        `;

        this.contenedor.querySelectorAll('[data-el]').forEach(el => {
            this._els[el.dataset.el] = el;
        });

        // Tooltip de precio promedio al hacer hover sobre las filas
        this._tooltip = document.createElement('div');
        this._tooltip.className = 'ob4-tip';
        document.body.appendChild(this._tooltip);

        this._els.pool.addEventListener('mouseover', e => {
            const row = e.target.closest('.ob4-row');
            if (!row || !this._renderer) return;
            const idx = Array.from(this._els.pool.children).indexOf(row);
            if (idx < 0 || idx >= this._renderer._rows.length) return;
            const r = this._renderer._rows[idx];
            const lines = [];
            if (r.bidData && r.bidData.cumQty > 0 && r.bidData.monto > 0)
                lines.push(`Bid Prom: $${(r.bidData.monto / r.bidData.cumQty).toFixed(2)} | Vol: ${r.bidData.cumQty}`);
            if (r.askData && r.askData.cumQty > 0 && r.askData.monto > 0)
                lines.push(`Ask Prom: $${(r.askData.monto / r.askData.cumQty).toFixed(2)} | Vol: ${r.askData.cumQty}`);
            if (!lines.length) { this._tooltip.style.display = 'none'; return; }
            this._tooltip.innerHTML = lines.join('<br>');
            this._tooltip.style.display = 'block';
            const rect = row.getBoundingClientRect();
            this._tooltip.style.left = (rect.left - 10) + 'px';
            this._tooltip.style.top = (rect.top - 40) + 'px';
        });
        this._els.pool.addEventListener('mouseleave', () => {
            this._tooltip.style.display = 'none';
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    //  WEBSOCKET PROPIO → orderbook.py (:8766)
    // ══════════════════════════════════════════════════════════════════════

    _conectarWS() {
        if (this._detenido) return;
        const url = `ws://${this._host}:${this._puerto}`;
        console.log(`[WidgetLibroOrdenes] 🔌 Conectando WS → ${url}`);
        busEventos.emitir(EVENTOS.CONEXION_ESTADO, { tipo: 'book', conectado: false, estado: 'conectando' });

        try {
            this._ws = new WebSocket(url);
        } catch (err) {
            console.error('[WidgetLibroOrdenes] Error creando WS:', err);
            this._programarReconexion();
            return;
        }

        this._ws.onopen = () => {
            console.log('[WidgetLibroOrdenes] ✅ WS conectado');
            this._wsReconexiones = 0;
            this._setStatus('Conectado', true);
            busEventos.emitir(EVENTOS.CONEXION_ESTADO, { tipo: 'book', conectado: true, estado: 'conectado' });
            // Si ya hay símbolo seleccionado, suscribirse ahora
            if (this._simbolo) {
                this._enviarSubscribe(this._simbolo);
            }
        };

        this._ws.onmessage = e => this._procesarMensaje(e.data);

        this._ws.onclose = () => {
            console.warn('[WidgetLibroOrdenes] ❌ WS desconectado');
            this._setStatus('Desconectado…', false);
            busEventos.emitir(EVENTOS.CONEXION_ESTADO, { tipo: 'book', conectado: false, estado: 'desconectado' });
            this._programarReconexion();
        };

        this._ws.onerror = err => {
            console.error('[WidgetLibroOrdenes] Error WS:', err);
        };
    }

    _programarReconexion() {
        if (this._detenido) return;
        if (this._wsReconexiones >= this._maxReconexiones) {
            console.error('[WidgetLibroOrdenes] Máximo de reconexiones alcanzado');
            this._setStatus('Sin conexión', false);
            return;
        }
        this._wsReconexiones++;
        const espera = Math.min(1000 * Math.pow(2, this._wsReconexiones), 30000);
        console.log(`[WidgetLibroOrdenes] Reconectando en ${espera / 1000}s (intento ${this._wsReconexiones}/${this._maxReconexiones})`);
        this._timerReconexion = setTimeout(() => this._conectarWS(), espera);
    }

    _enviarSubscribe(simbolo) {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            this._ws.send(JSON.stringify({ action: 'subscribe', symbol: simbolo }));
            console.log(`[WidgetLibroOrdenes] 📡 Subscribe → ${simbolo}`);
        }
    }

    _procesarMensaje(crudo) {
        let datos;
        try { datos = JSON.parse(crudo); } catch { return; }

        if (datos.type !== 'book') return;

        const rawBids = datos.bids || [];
        const rawAsks = datos.asks || [];

        // Ignorar snapshots vacíos (solo limpiar si ya había datos)
        if (rawBids.length === 0 && rawAsks.length === 0) {
            if (this._store) this._store.reset();
            return;
        }

        // Primer dato tras cambio de activo
        if (!this._primerDato) {
            this._primerDato = true;
            clearTimeout(this._timerNoData);
            this._setStatus('', true);
            console.log(`[WidgetLibroOrdenes] 📖 Primer snapshot → ${this._simbolo} | bids: ${rawBids.length} | asks: ${rawAsks.length}`);
        }

        if (this._store) {
            this._store.update({
                bids: rawBids,
                asks: rawAsks,
                best_bid: datos.best_bid ?? 0,
                best_ask: datos.best_ask ?? 0,
                spread: datos.spread ?? 0,
                mid_price: datos.mid_price ?? 0,
            });
        }

        // ── Sincronizar precio con la gráfica ──────────────────────────────
        // Emitir PRECIO_OB_SYNC con el mid_price del L2 para que WidgetGraficaVelas
        // actualice su display de precio. Se usa un evento dedicado (NO DATOS_TICK)
        // para evitar que el precio del book se procese como trade y genere velas falsas.
        const midPrice = datos.mid_price ?? 0;
        const simbolo = datos.symbol || datos.simbolo || this._simbolo;
        if (midPrice > 0 && simbolo) {
            busEventos.emitir(EVENTOS.PRECIO_OB_SYNC, {
                simbolo,
                value: midPrice,
                best_bid: datos.best_bid ?? 0,
                best_ask: datos.best_ask ?? 0,
            });
        }

        // Actualizar footer
        if (this._els.footerSpread && datos.spread !== undefined)
            this._els.footerSpread.textContent = '$' + datos.spread.toFixed(4);
        if (this._els.footerUpd && datos.updates !== undefined)
            this._els.footerUpd.textContent = datos.updates.toLocaleString();
    }

    // ══════════════════════════════════════════════════════════════════════
    //  BUS DE EVENTOS
    // ══════════════════════════════════════════════════════════════════════

    _suscribirBus() {
        // ── CAMBIO_ACTIVO → limpiar y suscribir al nuevo símbolo ──────────
        this._escuchar(EVENTOS.CAMBIO_ACTIVO, datos => {
            const nuevo = datos.simbolo;
            if (!nuevo) return;

            const cambioReal = nuevo !== this._simbolo;
            this._simbolo = nuevo;
            this._primerDato = false;

            if (this._store) {
                this._store.reset();
                this._baseRange = null;   // resetear zoom sync
            }

            this._setStatus(`${nuevo}…`, false);

            // Enviar subscribe al WS propio
            this._enviarSubscribe(nuevo);

            // Timer: si en 8s no llegan datos, avisar
            clearTimeout(this._timerNoData);
            this._timerNoData = setTimeout(() => {
                if (!this._primerDato) {
                    this._setStatus(`Sin datos: ${nuevo}`, false);
                    console.warn(`[WidgetLibroOrdenes] ⚠ Sin datos en 8s para ${nuevo}`);
                }
            }, 8000);

            if (cambioReal)
                console.log(`[WidgetLibroOrdenes] 🔄 CAMBIO_ACTIVO → ${nuevo}`);
        });

        // ── CAMBIO_PRECIO → sincronizar zoom de filas con la gráfica ──────
        this._escuchar(EVENTOS.CAMBIO_PRECIO, datos => {
            if (!this._renderer) return;
            const min = datos.precioMin ?? datos.min_price;
            const max = datos.precioMax ?? datos.max_price;
            if (typeof min !== 'number' || typeof max !== 'number' || max <= min) return;

            const range = max - min;
            if (!this._baseRange || range / this._baseRange > 2.5 || this._baseRange / range > 2.5)
                this._baseRange = range;

            const zoom = range / this._baseRange;
            const clamped = Math.max(0.3, Math.min(5.0, 1.0 / Math.max(0.01, zoom)));
            this._renderer.setRowHeight(18 * clamped);
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    //  LOOP DE RENDERIZADO
    // ══════════════════════════════════════════════════════════════════════

    _iniciarLoop() {
        const tick = () => {
            if (this._renderer && this._canvas) {
                const info = this._renderer.render();
                this._canvas.render(info);
            }
            this._rafId = requestAnimationFrame(tick);
        };
        this._rafId = requestAnimationFrame(tick);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  HELPERS
    // ══════════════════════════════════════════════════════════════════════

    _setStatus(txt, ok) {
        if (!this._els.status) return;
        this._els.status.textContent = txt;
        this._els.status.className = 'ob4-status' + (ok ? ' ok' : '');
    }
}