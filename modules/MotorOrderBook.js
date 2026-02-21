// ═══════════════════════════════════════════════════════════════
//  OrderbookEngine.js — Módulo Independiente de OrderBook
//  Autor: donTrading · 2026
//  Auto-contenido: CSS, DOM, Canvas, Datos — Zero dependencias
// ═══════════════════════════════════════════════════════════════
'use strict';

(function () {

    // ─────────────────────────────────────────────
    //  CSS AUTO-INJECTION
    // ─────────────────────────────────────────────
    const STYLE_ID = 'ob-engine-styles';
    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
/* ═══ ORDERBOOK ENGINE — Scoped Styles ═══ */

.obe-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    font-family: 'Outfit', 'Segoe UI', sans-serif;
    background: var(--bg-secondary, #111827);
    color: var(--text-primary, #e2e8f0);
    --obe-green: #22c55e;
    --obe-green-light: #86efac;
    --obe-green-text: #4ade80;
    --obe-red: #ef4444;
    --obe-red-light: #fca5a5;
    --obe-red-text: #f87171;
    --obe-amber: #f59e0b;
    --obe-border: #1e293b;
    --obe-muted: #475569;
    --obe-row-h: 18px;
}

/* ── Header ── */
.obe-header {
    padding: 6px 10px;
    border-bottom: 1px solid var(--obe-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 28px;
    flex-shrink: 0;
}
.obe-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary, #e2e8f0);
}
.obe-status {
    font-size: 10px;
    color: var(--obe-muted);
    transition: color 0.3s;
}
.obe-status.connected { color: var(--obe-green); }

/* ── Summary Bar ── */
.obe-summary {
    display: flex;
    border-bottom: 1px solid var(--obe-border);
    flex-shrink: 0;
}
.obe-sum-side {
    flex: 1;
    padding: 6px 8px;
    text-align: center;
}
.obe-sum-side.bid { border-right: 1px solid var(--obe-border); }
.obe-sum-label {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--obe-muted);
    margin-bottom: 2px;
}
.obe-sum-side.bid .obe-sum-label { color: var(--obe-green-text); }
.obe-sum-side.ask .obe-sum-label { color: var(--obe-red-text); }
.obe-sum-price {
    font-family: 'Outfit', sans-serif;
    font-size: 16px;
    font-weight: 700;
    display: block;
}
.obe-sum-side.bid .obe-sum-price { color: var(--obe-green-light); }
.obe-sum-side.ask .obe-sum-price { color: var(--obe-red-light); }

/* ── Mid Row ── */
.obe-mid-row {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3px 8px;
    background: rgba(245,158,11,0.08);
    border-top: 1px solid rgba(245,158,11,0.2);
    border-bottom: 1px solid rgba(245,158,11,0.2);
    font-family: 'Outfit', sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: var(--obe-amber);
    gap: 10px;
    flex-shrink: 0;
    min-height: 24px;
}
.obe-mid-spread {
    font-size: 9px;
    font-weight: 400;
    color: #94a3b8;
}

/* ── Table Wrap ── */
.obe-table-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
}

/* ── Column Headers ── */
.obe-col-headers {
    display: flex;
    align-items: center;
    padding: 3px 4px;
    font-size: 8px;
    font-weight: 500;
    color: var(--obe-muted);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    border-bottom: 1px solid var(--obe-border);
    flex-shrink: 0;
    z-index: 2;
    position: relative;
    background: var(--bg-secondary, #111827);
}
.obe-col-headers span { text-align: center; }
.obe-col-headers .hdr-monto { width: 44px; text-align: right; }
.obe-col-headers .hdr-total { width: 36px; text-align: right; }
.obe-col-headers .hdr-qty   { width: 34px; text-align: right; }
.obe-col-headers .hdr-bid   { flex: 1; text-align: right; color: var(--obe-green-text); padding-right: 4px; }
.obe-col-headers .hdr-ask   { flex: 1; text-align: left;  color: var(--obe-red-text);   padding-left: 4px; }

/* ── Virtual Viewport ── */
.obe-viewport {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    scrollbar-width: thin;
    scrollbar-color: #1e293b transparent;
}
.obe-viewport::-webkit-scrollbar { width: 3px; }
.obe-viewport::-webkit-scrollbar-track { background: transparent; }
.obe-viewport::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
.obe-spacer { width: 100%; pointer-events: none; }
.obe-pool {
    position: absolute;
    top: 0; left: 0; right: 0;
    will-change: transform;
}

/* ── Dual Row ── */
.obe-row {
    display: flex;
    align-items: center;
    height: var(--obe-row-h, 18px);
    min-height: var(--obe-row-h, 18px);
    position: relative;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    cursor: default;
    overflow: hidden;
    padding: 0 4px;
    transition: background 0.15s ease;
}
.obe-row:hover { background: rgba(148,163,184,0.06) !important; }
.obe-row.best-row { background: rgba(245,158,11,0.06); }

.obe-row span {
    z-index: 1;
    position: relative;
    text-shadow: 0 0 4px rgba(0,0,0,0.9);
}

.obe-row .d-total { width: 36px; text-align: right; color: #64748b; font-size: 8px; }
.obe-row .d-qty   { width: 34px; text-align: right; color: #e2e8f0; }
.obe-row .d-monto { width: 44px; text-align: right; color: #94a3b8; font-size: 8px; }
.obe-row .d-bid   { flex: 1; text-align: right; padding-right: 4px; color: var(--obe-green-light); font-weight: 500; }
.obe-row .d-ask   { flex: 1; text-align: left;  padding-left: 4px;  color: var(--obe-red-light);   font-weight: 500; }

.obe-row .d-bid.empty, .obe-row .d-ask.empty { color: #1e293b; }
.obe-row .d-qty.empty, .obe-row .d-total.empty, .obe-row .d-monto.empty { color: transparent; }
.obe-row .d-bid.filler, .obe-row .d-ask.filler { color: #334155; font-weight: 400; }
.obe-row .d-qty.real-bid { color: var(--obe-green-light); font-weight: 600; }
.obe-row .d-qty.real-ask { color: var(--obe-red-light);   font-weight: 600; }

/* ── Tooltip de Precio Promedio (hover) ── */
.obe-tooltip {
    position: fixed;
    z-index: 100;
    background: rgba(15,23,42,0.95);
    border: 1px solid rgba(59,130,246,0.3);
    border-radius: 6px;
    padding: 6px 10px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #e2e8f0;
    pointer-events: none;
    display: none;
    backdrop-filter: blur(8px);
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}

/* ── Canvas Overlay ── */
.obe-canvas {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 0;
}

/* ── Footer ── */
.obe-footer {
    padding: 4px 10px;
    border-top: 1px solid var(--obe-border);
    font-size: 9px;
    color: var(--obe-muted);
    display: flex;
    justify-content: space-between;
    flex-shrink: 0;
}
`;
        document.head.appendChild(style);
    }

    // ═════════════════════════════════════════════
    //  1. ORDER BOOK STORE — Pure Data Layer
    // ═════════════════════════════════════════════
    class OrderBookStore {
        constructor() {
            this.bidMap = new Map();
            this.askMap = new Map();
            this.bidArray = [];
            this.askArray = [];
            this.midPrice = 0;
            this.bestBid = 0;
            this.bestAsk = 0;
            this.spread = 0;
            this._dirty = false;
            this._version = 0;
            this._step = 0.01;
            // One-way ratchet: never generate fewer levels than this
            // ── EXPANDIDO a 500 para mostrar profundidad completa ──
            this._maxLevelsSeen = 500;
        }

        /** Feed raw book snapshot from WS */
        update(book) {
            if (!book) return;
            this.midPrice = book.mid_price || 0;
            this.bestBid = book.best_bid || 0;
            this.bestAsk = book.best_ask || 0;
            this.spread = book.spread || 0;

            this.bidMap.clear();
            const bids = book.bids || [];
            for (let i = 0; i < bids.length; i++) {
                const l = bids[i];
                const p = Math.round(l.precio * 100) / 100;
                this.bidMap.set(p, (this.bidMap.get(p) || 0) + l.tamano);
            }

            this.askMap.clear();
            const asks = book.asks || [];
            for (let i = 0; i < asks.length; i++) {
                const l = asks[i];
                const p = Math.round(l.precio * 100) / 100;
                this.askMap.set(p, (this.askMap.get(p) || 0) + l.tamano);
            }

            this._rebuildArrays();
            this._dirty = true;
            this._version++;
        }

        _rebuildArrays() {
            const step = this._step;
            // Always rebuild at least as many levels as we've ever needed
            const targetLevels = this._maxLevelsSeen;

            // === BIDS: bestBid → downward ===
            const bidStart = this.bestBid > 0 ? this.bestBid : 0;
            if (bidStart <= 0) { this.bidArray = []; }
            else {
                const bidEnd = Math.round((bidStart - targetLevels * step) * 100) / 100;
                this.bidArray = [];
                let cumBid = 0;
                let cumMontoBid = 0;  // ── SET FX: Monto acumulado ──
                for (let p = Math.round(bidStart * 100) / 100;
                    p >= bidEnd;
                    p = Math.round((p - step) * 100) / 100) {
                    const qty = this.bidMap.get(p) || 0;
                    cumBid += qty;
                    cumMontoBid += qty * p;  // Monto = cantidad × precio
                    this.bidArray.push({ price: p, qty, cumQty: cumBid, monto: cumMontoBid, real: qty > 0 });
                }
            }

            // === ASKS: bestAsk → upward ===
            const askStart = this.bestAsk > 0 ? this.bestAsk : 0;
            if (askStart <= 0) { this.askArray = []; }
            else {
                const askEnd = Math.round((askStart + targetLevels * step) * 100) / 100;
                this.askArray = [];
                let cumAsk = 0;
                let cumMontoAsk = 0;  // ── SET FX: Monto acumulado ──
                for (let p = Math.round(askStart * 100) / 100;
                    p <= askEnd;
                    p = Math.round((p + step) * 100) / 100) {
                    const qty = this.askMap.get(p) || 0;
                    cumAsk += qty;
                    cumMontoAsk += qty * p;  // Monto = cantidad × precio
                    this.askArray.push({ price: p, qty, cumQty: cumAsk, monto: cumMontoAsk, real: qty > 0 });
                }
            }
        }

        /**
         * Ensure at least `neededCount` levels exist. 
         * Called by VirtualRenderer when scroll approaches the edge.
         * Extends arrays on demand for infinite scroll.
         */
        ensureLevels(neededCount) {
            // Ratchet up — future _rebuildArrays will also produce at least this many
            if (neededCount > this._maxLevelsSeen) {
                this._maxLevelsSeen = neededCount;
            }

            const step = this._step;

            // Extend bids downward on the fly
            if (this.bidArray.length > 0 && this.bidArray.length < neededCount) {
                const lastBid = this.bidArray[this.bidArray.length - 1];
                let cumBid = lastBid.cumQty;
                let cumMonto = lastBid.monto || 0;  // ── SET FX ──
                let p = Math.round((lastBid.price - step) * 100) / 100;
                while (this.bidArray.length < neededCount) {
                    const qty = this.bidMap.get(p) || 0;
                    cumBid += qty;
                    cumMonto += qty * p;
                    this.bidArray.push({ price: p, qty, cumQty: cumBid, monto: cumMonto, real: qty > 0 });
                    p = Math.round((p - step) * 100) / 100;
                }
            }

            // Extend asks upward on the fly
            if (this.askArray.length > 0 && this.askArray.length < neededCount) {
                const lastAsk = this.askArray[this.askArray.length - 1];
                let cumAsk = lastAsk.cumQty;
                let cumMonto = lastAsk.monto || 0;  // ── SET FX ──
                let p = Math.round((lastAsk.price + step) * 100) / 100;
                while (this.askArray.length < neededCount) {
                    const qty = this.askMap.get(p) || 0;
                    cumAsk += qty;
                    cumMonto += qty * p;
                    this.askArray.push({ price: p, qty, cumQty: cumAsk, monto: cumMonto, real: qty > 0 });
                    p = Math.round((p + step) * 100) / 100;
                }
            }
        }

        get totalLevels() {
            return Math.max(this.bidArray.length, this.askArray.length);
        }

        /** Get max values for visible window normalization */
        getMaxes(startIdx, count) {
            let maxVol = 1, maxCum = 1;
            const end = Math.min(startIdx + count, Math.max(this.bidArray.length, this.askArray.length));
            for (let i = startIdx; i < end; i++) {
                const bid = this.bidArray[i];
                const ask = this.askArray[i];
                if (bid) {
                    if (bid.qty > maxVol) maxVol = bid.qty;
                    if (bid.cumQty > maxCum) maxCum = bid.cumQty;
                }
                if (ask) {
                    if (ask.qty > maxVol) maxVol = ask.qty;
                    if (ask.cumQty > maxCum) maxCum = ask.cumQty;
                }
            }
            return { maxVol, maxCum };
        }

        /** Public snapshot for external tools */
        snapshot() {
            return {
                midPrice: this.midPrice,
                bestBid: this.bestBid,
                bestAsk: this.bestAsk,
                spread: this.spread,
                bidLevels: this.bidArray.length,
                askLevels: this.askArray.length,
                bidArray: this.bidArray,
                askArray: this.askArray,
                version: this._version
            };
        }
    }

    class VirtualRenderer {
        constructor(store, elements) {
            this.store = store;
            this.viewport = elements.viewport;
            this.spacer = elements.spacer;
            this.pool = elements.pool;
            this.wrapEl = elements.tableWrap;
            this.midPriceEl = elements.midPrice;
            this.spreadEl = elements.spread;
            this.bestBidEl = elements.bestBid;
            this.bestAskEl = elements.bestAsk;
            this._rows = [];
            this._rowH = 18;
            this._lastInfo = null;
            this._lastSpacerH = 0;
        }

        /** Set row height externally (from syncScale) */
        setRowHeight(h) {
            this._rowH = Math.max(8, Math.min(80, h));
        }

        /** Main render pass — returns renderInfo for canvas */
        render() {
            if (!this.store.midPrice) return null;

            // Smart price format: crypto ($80K+) gets toLocaleString, stocks get toFixed(2)
            const _fp = (v) => v >= 1000
                ? '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '$' + v.toFixed(2);

            // Update summary bar
            this._setText(this.midPriceEl, _fp(this.store.midPrice));
            this._setText(this.spreadEl, '$' + this.store.spread.toFixed(4));
            this._setText(this.bestBidEl, _fp(this.store.bestBid));
            this._setText(this.bestAskEl, _fp(this.store.bestAsk));

            const rowH = this._rowH;
            let totalRows = this.store.totalLevels;
            if (totalRows === 0) return null;

            const vpH = this.viewport.clientHeight;
            const scrollTop = this.viewport.scrollTop;

            // Calculate which rows are visible
            const startIdx = Math.max(0, Math.floor(scrollTop / rowH) - 2);
            const visibleCount = Math.ceil(vpH / rowH) + 5;
            const neededEndIdx = startIdx + visibleCount;

            // ── Infinite scroll: expand data if approaching the edge ──
            const EDGE_BUFFER = 50; // Start loading 50 rows before the end
            if (neededEndIdx + EDGE_BUFFER > totalRows) {
                this.store.ensureLevels(neededEndIdx + EDGE_BUFFER + 100);
                totalRows = this.store.totalLevels; // Re-read after expansion
            }

            const endIdx = Math.min(totalRows, neededEndIdx);
            const actualCount = endIdx - startIdx;

            // ── Spacer: oversize so scrollbar never hits bottom ──
            const spacerH = (totalRows + 100) * rowH;
            if (Math.abs(spacerH - this._lastSpacerH) > rowH) {
                this.spacer.style.height = spacerH + 'px';
                this._lastSpacerH = spacerH;
            }
            this.wrapEl.style.setProperty('--obe-row-h', rowH + 'px');

            this._ensurePool(actualCount);

            const poolTop = startIdx * rowH;
            this.pool.style.transform = `translateY(${poolTop}px)`;

            const bestBidR = Math.round(this.store.bestBid * 100) / 100;
            const bestAskR = Math.round(this.store.bestAsk * 100) / 100;

            for (let i = 0; i < actualCount; i++) {
                const dataIdx = startIdx + i;
                const r = this._rows[i];
                const ch = r.el.children;
                const bid = this.store.bidArray[dataIdx] || null;
                const ask = this.store.askArray[dataIdx] || null;

                const isBestBid = bid && bid.real && bid.price === bestBidR;
                const isBestAsk = ask && ask.real && ask.price === bestAskR;

                // Class diffing
                let cls = 'obe-row';
                if (isBestBid) cls += ' best-bid';
                if (isBestAsk) cls += ' best-ask';
                if (isBestBid || isBestAsk) cls += ' best-row';
                if (r.el.className !== cls) r.el.className = cls;

                // Bid: [0]=monto [1]=total [2]=qty [3]=price
                this._setText(ch[0], bid && bid.monto > 0 ? this._fmtMonto(bid.monto) : '');
                this._setText(ch[1], bid && bid.cumQty > 0 ? this._fmt(bid.cumQty) : '');
                this._setText(ch[2], bid && bid.qty > 0 ? this._fmt(bid.qty) : '');
                this._setText(ch[3], bid ? _fp(bid.price).replace('$', '') : '');

                ch[3].className = 'd-bid' + (bid ? (bid.real ? '' : ' filler') : ' empty');
                ch[2].className = 'd-qty' + (bid && bid.qty > 0 ? ' real-bid' : ' empty');
                ch[1].className = 'd-total' + (bid && bid.cumQty > 0 ? '' : ' empty');
                ch[0].className = 'd-monto' + (bid && bid.monto > 0 ? '' : ' empty');

                // Ask: [4]=price [5]=qty [6]=total [7]=monto
                this._setText(ch[4], ask ? _fp(ask.price).replace('$', '') : '');
                this._setText(ch[5], ask && ask.qty > 0 ? this._fmt(ask.qty) : '');
                this._setText(ch[6], ask && ask.cumQty > 0 ? this._fmt(ask.cumQty) : '');
                this._setText(ch[7], ask && ask.monto > 0 ? this._fmtMonto(ask.monto) : '');

                ch[4].className = 'd-ask' + (ask ? (ask.real ? '' : ' filler') : ' empty');
                ch[5].className = 'd-qty' + (ask && ask.qty > 0 ? ' real-ask' : ' empty');
                ch[6].className = 'd-total' + (ask && ask.cumQty > 0 ? '' : ' empty');
                ch[7].className = 'd-monto' + (ask && ask.monto > 0 ? '' : ' empty');

                // ── SET FX: Guardar datos para tooltip de Precio Promedio ──
                r.bidData = bid;
                r.askData = ask;
                r.dataIdx = dataIdx;
            }

            this._lastInfo = { startIdx, actualCount, rowH, poolTop, vpH, scrollTop };
            return this._lastInfo;
        }

        _ensurePool(count) {
            // Only grow the pool — never remove rows to avoid DOM thrashing
            while (this._rows.length < count) {
                const row = document.createElement('div');
                row.className = 'obe-row';
                // ── SET FX: 8 columnas: Monto|Total|Qty|Bid | Ask|Qty|Total|Monto ──
                row.innerHTML =
                    '<span class="d-monto"></span>' +
                    '<span class="d-total"></span>' +
                    '<span class="d-qty"></span>' +
                    '<span class="d-bid"></span>' +
                    '<span class="d-ask"></span>' +
                    '<span class="d-qty"></span>' +
                    '<span class="d-total"></span>' +
                    '<span class="d-monto"></span>';
                this.pool.appendChild(row);
                this._rows.push({ el: row, dataIdx: -1, bidData: null, askData: null });
            }
            // Hide surplus rows (display:none avoids layout cost)
            for (let i = 0; i < this._rows.length; i++) {
                const show = i < count;
                if (this._rows[i].el.style.display !== (show ? '' : 'none')) {
                    this._rows[i].el.style.display = show ? '' : 'none';
                }
            }
        }

        /** Update-only text: skip if same */
        _setText(el, txt) {
            if (el.textContent !== txt) el.textContent = txt;
        }

        _fmt(v) {
            if (!v) return '0';
            if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
            if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
            return v.toString();
        }

        // ── SET FX: Formatea monto (valor monetario acumulado) ──
        _fmtMonto(v) {
            if (!v || v <= 0) return '';
            if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
            if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
            return '$' + v.toFixed(0);
        }

        destroy() {
            this._rows = [];
            this.pool.innerHTML = '';
        }
    }

    // ═════════════════════════════════════════════
    //  3. DEPTH CANVAS — Data-driven (zero DOM reads)
    // ═════════════════════════════════════════════
    class DepthCanvas {
        constructor(canvas, store, tableWrap) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.store = store;
            this.wrapEl = tableWrap;
            this._pulsePhase = 0;
        }

        render(renderInfo) {
            const ctx = this.ctx;
            let w = this.wrapEl.clientWidth;
            let h = this.wrapEl.clientHeight;

            // Resize canvas to match container
            const dpr = window.devicePixelRatio || 1;
            if (this.canvas.width !== Math.round(w * dpr) ||
                this.canvas.height !== Math.round(h * dpr)) {
                this.canvas.width = Math.round(w * dpr);
                this.canvas.height = Math.round(h * dpr);
                this.canvas.style.width = w + 'px';
                this.canvas.style.height = h + 'px';
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }

            ctx.clearRect(0, 0, w, h);
            if (!renderInfo || !this.store.midPrice) return;

            const { startIdx, actualCount, rowH, poolTop, scrollTop } = renderInfo;
            const cx = w / 2;
            const bestBidR = Math.round(this.store.bestBid * 100) / 100;
            const bestAskR = Math.round(this.store.bestAsk * 100) / 100;

            this._pulsePhase = (this._pulsePhase + 0.02) % 1;
            const pulseA = 0.4 + 0.3 * Math.sin(this._pulsePhase * Math.PI * 2);

            const colHdr = this.wrapEl.querySelector('.obe-col-headers');
            const colHdrH = colHdr ? colHdr.offsetHeight : 0;

            const { maxVol, maxCum } = this.store.getMaxes(startIdx, actualCount);

            for (let i = 0; i < actualCount; i++) {
                const dataIdx = startIdx + i;
                const bid = this.store.bidArray[dataIdx];
                const ask = this.store.askArray[dataIdx];
                const y = poolTop + i * rowH - scrollTop + colHdrH;
                if (y + rowH < 0 || y > h) continue;

                const isBB = bid && bid.real && bid.price === bestBidR;
                const isBA = ask && ask.real && ask.price === bestAskR;

                // ── Bid depth (cumulative) ──
                if (bid && bid.cumQty > 0) {
                    const cr = bid.cumQty / maxCum;
                    const dW = Math.max(3, cr * cx * 0.92);
                    const aE = bid.real ? (0.10 + cr * 0.22) : (0.06 + cr * 0.12);
                    const g = ctx.createLinearGradient(cx - dW, 0, cx, 0);
                    g.addColorStop(0, 'rgba(34,197,94,0.02)');
                    g.addColorStop(1, `rgba(34,197,94,${aE.toFixed(3)})`);
                    ctx.fillStyle = g;
                    ctx.fillRect(cx - dW, y + 0.5, dW, rowH - 1);
                    ctx.fillStyle = `rgba(34,197,94,${(0.2 + cr * 0.5).toFixed(2)})`;
                    ctx.fillRect(cx - dW, y + 1, 1.5, rowH - 2);
                }

                // ── Ask depth (cumulative) ──
                if (ask && ask.cumQty > 0) {
                    const cr = ask.cumQty / maxCum;
                    const dW = Math.max(3, cr * cx * 0.92);
                    const aE = ask.real ? (0.10 + cr * 0.22) : (0.06 + cr * 0.12);
                    const g = ctx.createLinearGradient(cx, 0, cx + dW, 0);
                    g.addColorStop(0, `rgba(239,68,68,${aE.toFixed(3)})`);
                    g.addColorStop(1, 'rgba(239,68,68,0.02)');
                    ctx.fillStyle = g;
                    ctx.fillRect(cx, y + 0.5, dW, rowH - 1);
                    ctx.fillStyle = `rgba(239,68,68,${(0.2 + cr * 0.5).toFixed(2)})`;
                    ctx.fillRect(cx + dW - 1.5, y + 1, 1.5, rowH - 2);
                }

                // ── Bid volume bar ──
                if (bid && bid.qty > 0) {
                    const r = bid.qty / maxVol;
                    const bW = Math.max(3, r * cx * 0.85);
                    const a = isBB ? pulseA + 0.2 : (0.12 + r * 0.38);
                    const g = ctx.createLinearGradient(cx - bW, 0, cx, 0);
                    g.addColorStop(0, `rgba(34,197,94,${(a * 0.1).toFixed(3)})`);
                    g.addColorStop(0.6, `rgba(34,197,94,${a.toFixed(3)})`);
                    g.addColorStop(1, `rgba(34,197,94,${(a * 1.15).toFixed(3)})`);
                    ctx.fillStyle = g;
                    ctx.fillRect(cx - bW, y + 0.5, bW, rowH - 1);
                    ctx.fillStyle = `rgba(34,197,94,${(isBB ? 0.9 : 0.3 + r * 0.5).toFixed(2)})`;
                    ctx.fillRect(cx - bW, y + 1, 1.5, rowH - 2);
                    if (isBB) {
                        ctx.shadowColor = 'rgba(34,197,94,0.6)'; ctx.shadowBlur = 10;
                        ctx.fillStyle = 'rgba(34,197,94,0.08)';
                        ctx.fillRect(0, y, cx, rowH);
                        ctx.shadowBlur = 0;
                    }
                }

                // ── Ask volume bar ──
                if (ask && ask.qty > 0) {
                    const r = ask.qty / maxVol;
                    const bW = Math.max(3, r * cx * 0.85);
                    const a = isBA ? pulseA + 0.2 : (0.12 + r * 0.38);
                    const g = ctx.createLinearGradient(cx, 0, cx + bW, 0);
                    g.addColorStop(0, `rgba(239,68,68,${(a * 1.15).toFixed(3)})`);
                    g.addColorStop(0.4, `rgba(239,68,68,${a.toFixed(3)})`);
                    g.addColorStop(1, `rgba(239,68,68,${(a * 0.1).toFixed(3)})`);
                    ctx.fillStyle = g;
                    ctx.fillRect(cx, y + 0.5, bW, rowH - 1);
                    ctx.fillStyle = `rgba(239,68,68,${(isBA ? 0.9 : 0.3 + r * 0.5).toFixed(2)})`;
                    ctx.fillRect(cx + bW - 1.5, y + 1, 1.5, rowH - 2);
                    if (isBA) {
                        ctx.shadowColor = 'rgba(239,68,68,0.6)'; ctx.shadowBlur = 10;
                        ctx.fillStyle = 'rgba(239,68,68,0.08)';
                        ctx.fillRect(cx, y, cx, rowH);
                        ctx.shadowBlur = 0;
                    }
                }
            }
        }
    }

    // ═════════════════════════════════════════════
    //  4. ORDERBOOK ENGINE — Public API
    // ═════════════════════════════════════════════
    class OrderbookEngine {
        /**
         * Mount the OrderBook into any container element.
         * @param {HTMLElement} container - The target div to mount into
         */
        constructor(container) {
            if (!container) throw new Error('[OrderbookEngine] Container element is required');
            this._container = container;
            this._rafId = null;
            this._loggedFirst = false;

            // Build DOM
            this._buildDOM(container);

            // Internal engines
            this.store = new OrderBookStore();
            this._renderer = new VirtualRenderer(this.store, this._els);
            this._canvas = new DepthCanvas(this._els.canvas, this.store, this._els.tableWrap);

            // Self-driven render loop
            this._startLoop();

            console.log('%c[ORDERBOOK ENGINE] ✅ Montado en:', 'color:#22c55e;font-weight:bold', container.id || container.className);
        }

        // ─── PUBLIC API ───────────────────────────

        /**
         * Feed raw book data from WebSocket.
         * @param {Object} data - Book snapshot { bids, asks, mid_price, best_bid, best_ask, spread, ... }
         */
        feedBook(data) {
            this.store.update(data);

            if (!this._loggedFirst && this.store.bidArray.length) {
                this._loggedFirst = true;
                console.log('%c[ORDERBOOK ENGINE] 📦 Primer snapshot:', 'color:#22c55e;font-weight:bold', {
                    bidLevels: this.store.bidArray.length,
                    askLevels: this.store.askArray.length,
                    bestBid: this.store.bestBid,
                    bestAsk: this.store.bestAsk
                });
            }

            // Update footer stats if provided
            if (data.spread !== undefined) {
                this._setText(this._els.footerSpread, '$' + data.spread.toFixed(4));
            }
            if (data.updates !== undefined) {
                this._setText(this._els.footerUpdates, data.updates.toLocaleString());
            }
        }

        /**
         * Synchronize scale with chart zoom.
         * Called by the chart's render loop with current price range.
         * @param {number} minPrice - Bottom of visible price range
         * @param {number} maxPrice - Top of visible price range
         */
        syncScale(minPrice, maxPrice) {
            if (!minPrice || !maxPrice || minPrice >= maxPrice) return;
            const range = maxPrice - minPrice;

            // Auto-recalibrate _baseRange on first call or when range shifts
            // dramatically (e.g. switching from 1m to 5s timeframe)
            if (!this._baseRange || range / this._baseRange > 2.5 || this._baseRange / range > 2.5) {
                this._baseRange = range;
            }

            const zoomFactor = range / this._baseRange;
            const scaleRatio = 1.0 / Math.max(0.01, zoomFactor);
            const clampedRatio = Math.max(0.3, Math.min(5.0, scaleRatio));
            const rowH = 18 * clampedRatio;

            this._renderer.setRowHeight(rowH);
        }

        /**
         * Reset the base range (call when chart resets zoom or changes symbol/timeframe).
         */
        resetScale() {
            this._baseRange = null;
        }

        /**
         * Get decoded data for external tools.
         * @returns {Object} Snapshot of current book state
         */
        getData() {
            return this.store.snapshot();
        }

        /**
         * Set connection status indicator.
         * @param {string} text
         * @param {boolean} connected
         */
        setStatus(text, connected) {
            this._els.status.textContent = text;
            this._els.status.className = 'obe-status' + (connected ? ' connected' : '');
        }

        /**
         * Destroy the engine: cancel rAF, clear DOM.
         */
        destroy() {
            if (this._rafId) cancelAnimationFrame(this._rafId);
            this._renderer.destroy();
            this._container.innerHTML = '';
            console.log('%c[ORDERBOOK ENGINE] 🗑️ Destruido', 'color:#ef4444');
        }

        // ─── INTERNAL ─────────────────────────────

        _buildDOM(container) {
            container.innerHTML = '';
            container.classList.add('obe-root');

            const html = `
                <div class="obe-header">
                    <span class="obe-title">📊 DOM Depth</span>
                    <span class="obe-status" data-el="status">Conectando...</span>
                </div>
                <div class="obe-summary">
                    <div class="obe-sum-side bid">
                        <div class="obe-sum-label">DEMANDAS ↑</div>
                        <div class="obe-sum-price" data-el="bestBid">$—</div>
                    </div>
                    <div class="obe-sum-side ask">
                        <div class="obe-sum-label">OFERTAS ↓</div>
                        <div class="obe-sum-price" data-el="bestAsk">$—</div>
                    </div>
                </div>
                <div class="obe-mid-row">
                    <span data-el="midPrice">$—</span>
                    <span class="obe-mid-spread">Spd: <span data-el="spread">—</span></span>
                </div>
                <div class="obe-table-wrap" data-el="tableWrap">
                    <canvas class="obe-canvas" data-el="canvas"></canvas>
                    <div class="obe-col-headers">
                        <span class="hdr-monto">Monto</span>
                        <span class="hdr-total">Acum</span>
                        <span class="hdr-qty">Qty</span>
                        <span class="hdr-bid">Bid</span>
                        <span class="hdr-ask">Ask</span>
                        <span class="hdr-qty">Qty</span>
                        <span class="hdr-total">Acum</span>
                        <span class="hdr-monto">Monto</span>
                    </div>
                    <div class="obe-viewport" data-el="viewport">
                        <div class="obe-spacer" data-el="spacer"></div>
                        <div class="obe-pool" data-el="pool"></div>
                    </div>
                </div>
                <div class="obe-footer">
                    <span>Spread: <span data-el="footerSpread">—</span></span>
                    <span>Upd: <span data-el="footerUpdates">0</span></span>
                </div>
            `;
            container.innerHTML = html;

            // Collect element references
            this._els = {};
            container.querySelectorAll('[data-el]').forEach(el => {
                this._els[el.dataset.el] = el;
            });

            // ── SET FX: Tooltip de Precio Promedio (hover sobre filas) ──
            this._tooltip = document.createElement('div');
            this._tooltip.className = 'obe-tooltip';
            document.body.appendChild(this._tooltip);

            this._els.pool.addEventListener('mouseover', (e) => {
                const row = e.target.closest('.obe-row');
                if (!row) return;
                const idx = Array.from(this._els.pool.children).indexOf(row);
                if (idx < 0 || idx >= this._renderer._rows.length) return;
                const r = this._renderer._rows[idx];
                const bid = r.bidData;
                const ask = r.askData;

                let lines = [];
                if (bid && bid.cumQty > 0 && bid.monto > 0) {
                    const avgBid = bid.monto / bid.cumQty;
                    lines.push(`Bid Prom: $${avgBid.toFixed(2)} | Vol: ${bid.cumQty}`);
                }
                if (ask && ask.cumQty > 0 && ask.monto > 0) {
                    const avgAsk = ask.monto / ask.cumQty;
                    lines.push(`Ask Prom: $${avgAsk.toFixed(2)} | Vol: ${ask.cumQty}`);
                }
                if (lines.length === 0) {
                    this._tooltip.style.display = 'none';
                    return;
                }

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

        _startLoop() {
            const loop = () => {
                const info = this._renderer.render();
                this._canvas.render(info);
                this._rafId = requestAnimationFrame(loop);
            };
            this._rafId = requestAnimationFrame(loop);
        }

        _setText(el, txt) {
            if (el && el.textContent !== txt) el.textContent = txt;
        }
    }

    // ─── EXPORT ───────────────────────────────────
    window.OrderbookEngine = OrderbookEngine;

})();
