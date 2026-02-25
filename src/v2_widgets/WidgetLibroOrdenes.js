/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  WidgetLibroOrdenes.js — Libro de Órdenes Autónomo v5                  ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Arquitectura AUTÓNOMA (sin dependencias externas):                     ║
 * ║    · WebSocket propio → ws://host:puertoBook (orderbook.py)            ║
 * ║    · _OBStore    — capa de datos (niveles de precio)                   ║
 * ║    · _OBRenderer — scroll virtual de filas DOM completamente desacoplado║
 * ║    · _OBCanvas   — canvas de barras de profundidad                     ║
 * ║    · Vinculado al bus:                                                  ║
 * ║        CAMBIO_ACTIVO  → limpiar + subscribe al nuevo símbolo           ║
 * ║    · Zoom propio (botones − / ● / +) independiente del chart           ║
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
/* ── Reset base ─────────────────────────────────────────── */
.ob4-root {
    display:flex; flex-direction:column; height:100%; width:100%;
    overflow:hidden; font-family:'Outfit','Segoe UI',sans-serif;
    background:#0d1117; color:#c9d1d9;
    --green:#22c55e; --green-l:#bbf7d0; --green-t:rgba(34,197,94,.28);
    --red:#ef4444;   --red-l:#fecaca;   --red-t:rgba(239,68,68,.24);
    --amber:#f59e0b; --border:#21262d; --muted:#8b949e;
    --row-h:20px;
}
/* ── Animación de ecualizador para las barras ───────────────── */
@keyframes ob4-bid-pulse {
    0%   { box-shadow: 2px 0 8px rgba(34,197,94,.0); }
    40%  { box-shadow: 2px 0 12px rgba(34,197,94,.9); }
    100% { box-shadow: 2px 0 4px  rgba(34,197,94,.0); }
}
@keyframes ob4-ask-pulse {
    0%   { box-shadow: -2px 0 8px rgba(239,68,68,.0); }
    40%  { box-shadow: -2px 0 12px rgba(239,68,68,.9); }
    100% { box-shadow: -2px 0 4px  rgba(239,68,68,.0); }
}
.ob4-bar-bid-pulse { animation: ob4-bid-pulse 0.22s ease-out !important; }
.ob4-bar-ask-pulse { animation: ob4-ask-pulse 0.22s ease-out !important; }
/* ── Header ─────────────────────────────────────────────── */
.ob4-header {
    display:flex; align-items:center; gap:6px;
    padding:4px 8px; height:30px; flex-shrink:0;
    border-bottom:1px solid var(--border);
    background:#161b22;
}
.ob4-title { font-size:11px; font-weight:700; letter-spacing:.5px; flex:1; color:#e6edf3; }
.ob4-status { font-size:10px; color:var(--muted); transition:color .3s; }
.ob4-status.ok { color:var(--green); }
/* zoom buttons */
.ob4-zoom { display:flex; align-items:center; gap:2px; }
.ob4-zoom button {
    background:#21262d; border:1px solid #30363d; color:var(--muted);
    font-size:12px; font-weight:700; width:18px; height:18px;
    border-radius:3px; cursor:pointer; padding:0;
    display:flex; align-items:center; justify-content:center;
    transition:background .12s, color .12s;
}
.ob4-zoom button:hover { background:rgba(245,158,11,.2); color:var(--amber); border-color:var(--amber); }
.ob4-zoom-lbl { font-size:8px; color:var(--muted); width:22px; text-align:center; font-family:monospace; }
/* ── Sesión de mercado badge ─────────────────────────────── */
.ob4-session-badge {
    font-size:8px; font-weight:700; letter-spacing:.5px;
    padding:1px 5px; border-radius:3px; text-transform:uppercase;
    border:1px solid transparent; line-height:14px; flex-shrink:0;
}
.ob4-sess-open   { background:rgba(34,197,94,.15);  color:var(--green);   border-color:rgba(34,197,94,.3); }
.ob4-sess-pre    { background:rgba(56,189,248,.12);  color:#38bdf8;        border-color:rgba(56,189,248,.3); }
.ob4-sess-after  { background:rgba(251,146,60,.12);  color:#fb923c;        border-color:rgba(251,146,60,.3); }
.ob4-sess-closed { background:rgba(239,68,68,.1);   color:var(--red);     border-color:rgba(239,68,68,.25); }
/* ── Summary (best bid/ask) ──────────────────────────────── */
.ob4-summary {
    display:flex; border-bottom:1px solid var(--border); flex-shrink:0; background:#161b22;
}
.ob4-side { flex:1; padding:5px 8px; text-align:center; }
.ob4-side.bid { border-right:1px solid var(--border); }
.ob4-side-lbl { font-size:8px; text-transform:uppercase; letter-spacing:1px; color:var(--muted); margin-bottom:1px; }
.ob4-side.bid .ob4-side-lbl { color:var(--green); }
.ob4-side.ask .ob4-side-lbl { color:var(--red); }
.ob4-side-price { font-family:'JetBrains Mono',monospace; font-size:14px; font-weight:700; display:block; }
.ob4-side.bid .ob4-side-price { color:var(--green-l); }
.ob4-side.ask .ob4-side-price { color:var(--red-l); }
/* ── Mid / spread ────────────────────────────────────────── */
.ob4-mid {
    display:flex; align-items:center; justify-content:center; gap:10px;
    padding:2px 8px; min-height:22px; flex-shrink:0;
    background:rgba(245,158,11,.06);
    border-top:1px solid rgba(245,158,11,.18); border-bottom:1px solid rgba(245,158,11,.18);
    font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:600; color:var(--amber);
}
.ob4-mid-spd { font-size:9px; font-weight:400; color:var(--muted); }
/* ── Table wrapper ───────────────────────────────────────── */
.ob4-table-wrap { flex:1; display:flex; flex-direction:column; overflow:hidden; position:relative; }
/* Column header */
.ob4-col-hdr {
    display:grid;
    grid-template-columns: 1fr 62px 56px 62px 1fr;
    align-items:center; height:20px; flex-shrink:0;
    border-bottom:1px solid var(--border); background:#161b22;
    font-size:8px; font-weight:600; text-transform:uppercase; letter-spacing:.5px; color:var(--muted);
    padding:0;
}
.ob4-col-hdr .h-bid-acum { text-align:right; color:rgba(34,197,94,.6); padding-right:6px; }
.ob4-col-hdr .h-bid-px   { text-align:right; padding-right:4px; border-left:1px solid var(--border); padding-left:2px; }
.ob4-col-hdr .h-monto    { text-align:center; color:rgba(245,158,11,.55); font-size:7px; letter-spacing:0; }
.ob4-col-hdr .h-ask-px   { text-align:left;  padding-left:4px;  border-right:1px solid var(--border); padding-right:2px; }
.ob4-col-hdr .h-ask-acum { text-align:left;  color:rgba(239,68,68,.6);  padding-left:6px; }
/* Viewport */
.ob4-vp {
    flex:1; overflow-y:auto; overflow-x:hidden; position:relative;
    scrollbar-width:thin; scrollbar-color:#21262d transparent;
}
.ob4-vp::-webkit-scrollbar { width:3px; }
.ob4-vp::-webkit-scrollbar-thumb { background:#30363d; border-radius:2px; }
.ob4-spacer { width:100%; pointer-events:none; }
.ob4-pool { position:absolute; top:0; left:0; right:0; will-change:transform; }
/* ── Rows ────────────────────────────────────────────────── */
.ob4-row {
    display:grid;
    grid-template-columns: 1fr 62px 56px 62px 1fr;
    align-items:stretch; height:var(--row-h,20px);
    min-height:var(--row-h,20px); position:relative; overflow:hidden;
    font-family:'JetBrains Mono',monospace; font-size:9.5px;
    border-bottom:1px solid rgba(33,38,45,.5);
    transition:background .08s;
}
/* ── Acum Bid (columna izquierda) — barra ecualizador + texto acum ─ */
.c-bid-acum {
    display:flex; align-items:center; justify-content:flex-end;
    position:relative; overflow:hidden; padding-right:5px;
}
.c-bid-acum .c-bar {
    position:absolute; right:0; top:0; bottom:0;
    background: linear-gradient(to left,
        rgba(34,197,94,.55) 0%,
        rgba(34,197,94,.28) 60%,
        rgba(34,197,94,.08) 100%);
    border-left: 1.5px solid rgba(34,197,94,.80);
    transition: width 0.06s cubic-bezier(0.25,0.46,0.45,0.94);
    pointer-events:none;
}
.c-bid-acum .c-acum-txt {
    position:relative; z-index:1;
    font-size:8.5px; color:rgba(34,197,94,.9); font-weight:600;
    white-space:nowrap;
}
.c-bid-acum .c-acum-txt.is-synth { opacity:0.45; font-weight:400; }
/* ── Acum Ask (columna derecha) — barra ecualizador + texto acum ─ */
.c-ask-acum {
    display:flex; align-items:center; justify-content:flex-start;
    position:relative; overflow:hidden; padding-left:5px;
}
.c-ask-acum .c-bar {
    position:absolute; left:0; top:0; bottom:0;
    background: linear-gradient(to right,
        rgba(239,68,68,.55) 0%,
        rgba(239,68,68,.24) 60%,
        rgba(239,68,68,.08) 100%);
    border-right: 1.5px solid rgba(239,68,68,.80);
    transition: width 0.06s cubic-bezier(0.25,0.46,0.45,0.94);
    pointer-events:none;
}
.c-ask-acum .c-acum-txt {
    position:relative; z-index:1;
    font-size:8.5px; color:rgba(239,68,68,.9); font-weight:600;
    white-space:nowrap;
}
.c-ask-acum .c-acum-txt.is-synth { opacity:0.45; font-weight:400; }
.ob4-row:hover { background:rgba(56,68,77,.35) !important; }
/* Best bid/ask highlight */
.ob4-row.is-best-row { background:rgba(245,158,11,.05); }
.ob4-row.is-best-row .c-bid-px { color:var(--green-l); font-weight:700; }
.ob4-row.is-best-row .c-ask-px { color:var(--red-l);   font-weight:700; }
/* Filas con datos reales de exchange (más énfasis) */
.ob4-row.bid-real { background:rgba(34,197,94,.04); border-left:2px solid rgba(34,197,94,.35); }
.ob4-row.ask-real { background:rgba(239,68,68,.04);  border-right:2px solid rgba(239,68,68,.35); }
.ob4-row.bid-real.ask-real { background:rgba(245,158,11,.04); }
/* Bid price column (center-left) */
.c-bid-px {
    display:flex; align-items:center; justify-content:flex-end;
    padding-right:5px; padding-left:2px;
    color:var(--green-l); font-size:9.5px; font-weight:500; letter-spacing:.2px;
    border-left:1px solid var(--border); flex-shrink:0;
    white-space:nowrap;
}
.c-bid-px.is-empty { color:#30363d; }
/* ── Monto (total negociado en el nivel) ─── columna central ─ */
.c-monto {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:0 2px; overflow:hidden; position:relative;
    border-left:1px solid rgba(245,158,11,.12);
    border-right:1px solid rgba(245,158,11,.12);
    background:rgba(245,158,11,.025);
}
.m-bid {
    font-size:7.5px; color:rgba(34,197,94,.75); font-weight:500;
    white-space:nowrap; line-height:1.25;
}
.m-ask {
    font-size:7.5px; color:rgba(239,68,68,.75);  font-weight:500;
    white-space:nowrap; line-height:1.25;
}
.m-bid.is-synth { opacity:.45; }
.m-ask.is-synth { opacity:.45; }
/* Ask price column (center-right) */
.c-ask-px {
    display:flex; align-items:center; justify-content:flex-start;
    padding-left:5px; padding-right:2px;
    color:var(--red-l); font-size:9.5px; font-weight:500; letter-spacing:.2px;
    border-right:1px solid var(--border); flex-shrink:0;
    white-space:nowrap;
}
.c-ask-px.is-empty { color:#30363d; }
/* Footer */
.ob4-footer {
    padding:3px 10px; border-top:1px solid var(--border); flex-shrink:0;
    font-size:8px; color:var(--muted); display:flex; justify-content:space-between;
    background:#161b22;
}
/* Tooltip */
.ob4-tip {
    position:fixed; z-index:200; background:rgba(13,17,23,.95);
    border:1px solid rgba(56,139,253,.3); border-radius:5px;
    padding:5px 9px; font-family:'JetBrains Mono',monospace;
    font-size:10px; color:#c9d1d9; pointer-events:none;
    display:none; backdrop-filter:blur(8px); white-space:nowrap;
    box-shadow:0 4px 16px rgba(0,0,0,.5);
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
        // Acumulador persistente de notional por precio (no se resetea entre snapshots)
        // Clave: precio snapeado  Valor: suma acumulada de precio×qty de todos los snapshots
        this._notionalAccum = new Map();
        // Qty vista en el snapshot anterior (para detectar cambios reales)
        this._prevQty = new Map();
        // Qty acumulada históricamente por precio (para la columna Acum — independiente por fila)
        this._qtyAccum = new Map();
    }

    /**
     * Paso dinámico = 0.04% del precio, redondeado al incremento "limpio" más cercano.
     * Ejemplos: $274 → raw=$0.110 → paso=$0.20  |  $50 → raw=$0.020 → paso=$0.02
     *           $100 → raw=$0.040 → paso=$0.05  |  $10k → raw=$4.00 → paso=$5.00
     */
    _computeStep(price) {
        if (!price || price <= 0) return 0.01;
        const raw = price * 0.0004;   // 0.04 % del precio
        // Incrementos "bonitos" ordenados de menor a mayor
        const NICE = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05,
            0.10, 0.20, 0.50, 1.00, 2.00, 5.00, 10.00, 20.00, 50.00];
        for (const s of NICE) { if (s >= raw) return s; }
        return 50.00;
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
        // Notar: el backend ahora envía niveles interpolados con 'interpolado:true'
        // Los de precio real tienen qty>0 y interpolado=false
        this.bidMap.clear();
        for (const l of (book.bids || [])) {
            if (!l || !l.precio || !l.tamano) continue;
            const p = this._snap(l.precio);
            // Preservar el flag: si ya hay un nivel real no sobreescribir con interpolado
            const prev = this.bidMap.get(p);
            const isReal = !l.interpolado;
            if (!prev || isReal) {
                this.bidMap.set(p, { qty: (prev && !isReal ? prev.qty : 0) + l.tamano, real: isReal || (prev && prev.real) });
            } else {
                // Nivel interpolado sobre uno ya existente: sumar qty pero mantener real=true
                this.bidMap.set(p, { qty: prev.qty + l.tamano, real: prev.real });
            }
        }

        this.askMap.clear();
        for (const l of (book.asks || [])) {
            if (!l || !l.precio || !l.tamano) continue;
            const p = this._snap(l.precio);
            const prev = this.askMap.get(p);
            const isReal = !l.interpolado;
            if (!prev || isReal) {
                this.askMap.set(p, { qty: (prev && !isReal ? prev.qty : 0) + l.tamano, real: isReal || (prev && prev.real) });
            } else {
                this.askMap.set(p, { qty: prev.qty + l.tamano, real: prev.real });
            }
        }

        this._rebuild();

        // ── Acumular notional por precio tras el rebuild ────────────────────────────
        // Solo acumulamos niveles REALES del exchange (no sintéticos/interpolados).
        // Detectamos el delta de qty (aumento vs snapshot anterior) para evitar
        // duplicar la misma orden que ya contábamos en frames anteriores.
        for (const [price, { qty, real }] of this.bidMap) {
            if (!real || qty <= 0) continue;
            const prev = this._prevQty.get(price) ?? 0;
            if (qty > prev) {
                const delta = qty - prev;
                // Acumular notional ($) por precio
                this._notionalAccum.set(price,
                    (this._notionalAccum.get(price) ?? 0) + delta * price);
                // Acumular qty por precio (independiente, sin sumar otras filas)
                this._qtyAccum.set(price,
                    (this._qtyAccum.get(price) ?? 0) + delta);
            }
            this._prevQty.set(price, qty);
        }
        for (const [price, { qty, real }] of this.askMap) {
            if (!real || qty <= 0) continue;
            const prev = this._prevQty.get(price) ?? 0;
            if (qty > prev) {
                const delta = qty - prev;
                this._notionalAccum.set(price,
                    (this._notionalAccum.get(price) ?? 0) + delta * price);
                this._qtyAccum.set(price,
                    (this._qtyAccum.get(price) ?? 0) + delta);
            }
            this._prevQty.set(price, qty);
        }
    }

    /** Notional total acumulado en ese nivel de precio */
    notionalAt(price) {
        return this._notionalAccum.get(price) ?? 0;
    }

    /** Qty total acumulada en ese nivel de precio (independiente por fila) */
    qtyAccumAt(price) {
        return this._qtyAccum.get(price) ?? 0;
    }

    reset() {
        this.bidMap.clear();
        this.askMap.clear();
        this.bidArray = [];
        this.askArray = [];
        this.midPrice = this.bestBid = this.bestAsk = this.spread = 0;
        this._maxLevels = this._BASE_LEVELS;
        this._step = 0.01;
        // Limpiar acumuladores al cambiar de activo
        this._notionalAccum.clear();
        this._prevQty.clear();
        this._qtyAccum.clear();
    }

    /**
     * Volumen sintético determinista para el nivel `i` beyond the data edge.
     * Usa función senoidal para variación cíclica sin aleatoriedad.
     */
    _synthVol(baseVol, i) {
        if (baseVol <= 0) return 0;
        const decay = Math.pow(0.92, i);
        const noise = 0.7 + 0.6 * Math.abs(Math.sin(i * 1.618) * Math.cos(i * 0.5));
        return Math.max(1, Math.round(baseVol * decay * noise));
    }

    _rebuild() {
        const n = this._maxLevels;
        const step = this._step;

        // Centro de referencia: bestBid/bestAsk, con midPrice como fallback
        const bidStart = this.bestBid > 0 ? this._snap(this.bestBid)
            : this.midPrice > 0 ? this._snap(this.midPrice) : 0;
        const askStart = this.bestAsk > 0 ? this._snap(this.bestAsk)
            : this.midPrice > 0 ? this._snap(this.midPrice + step) : 0;

        // BIDS: desde bidStart hacia abajo con vol sintético donde no hay datos
        if (bidStart <= 0) {
            this.bidArray = [];
        } else {
            this.bidArray = [];
            let cum = 0, cumReal = 0, cumM = 0;
            let lastVol = 0, synthIdx = 0;
            let p = bidStart;
            for (let i = 0; i < n; i++) {
                const entry = this.bidMap.get(p);
                let qty, real;
                if (entry && entry.qty > 0) {
                    qty = entry.qty;
                    real = entry.real;
                    lastVol = qty;
                    synthIdx = 0;
                } else {
                    synthIdx++;
                    qty = this._synthVol(lastVol, synthIdx);
                    real = false;
                }
                cum += qty;
                if (real) { cumReal += qty; cumM += qty * p; }
                this.bidArray.push({ price: p, qty, cumQty: cum, cumReal, monto: cumM, real });
                p = this._snap(p - step);
                if (p <= 0) break;
            }
        }

        // ASKS: desde askStart hacia arriba con vol sintético donde no hay datos
        if (askStart <= 0) {
            this.askArray = [];
        } else {
            this.askArray = [];
            let cum = 0, cumReal = 0, cumM = 0;
            let lastVol = 0, synthIdx = 0;
            let p = askStart;
            for (let i = 0; i < n; i++) {
                const entry = this.askMap.get(p);
                let qty, real;
                if (entry && entry.qty > 0) {
                    qty = entry.qty;
                    real = entry.real;
                    lastVol = qty;
                    synthIdx = 0;
                } else {
                    synthIdx++;
                    qty = this._synthVol(lastVol, synthIdx);
                    real = false;
                }
                cum += qty;
                if (real) { cumReal += qty; cumM += qty * p; }
                this.askArray.push({ price: p, qty, cumQty: cum, cumReal, monto: cumM, real });
                p = this._snap(p + step);
            }
        }
    }


    /**
     * Expande bajo demanda cuando el scroll se acerca al borde.
     * Para precios fuera del rango del backend (bidMap/askMap vacío),
     * genera volúmenes sintéticos con decaimiento exponencial determinista
     * (sin aleatoriedad — usa seno del índice para evitar parpadeo).
     */
    ensureLevels(n) {
        if (n > this._maxLevels) this._maxLevels = n;
        const step = this._step;


        // ── BIDS (hacia abajo) ───────────────────────────────────────────────
        if (this.bidArray.length > 0 && this.bidArray.length < n) {
            // Encontrar el último volumen real/sintético significativo como base
            let lastVol = 0;
            let synthIdx = 0;
            for (let i = this.bidArray.length - 1; i >= 0; i--) {
                if (this.bidArray[i].qty > 0) { lastVol = this.bidArray[i].qty; break; }
            }

            let last = this.bidArray[this.bidArray.length - 1];
            let cum = last.cumQty, cumReal = last.cumReal || 0, cumM = last.monto || 0;
            let p = this._snap(last.price - step);

            while (this.bidArray.length < n && p > 0) {
                const entry = this.bidMap.get(p);
                let qty, real;
                if (entry && entry.qty > 0) {
                    qty = entry.qty;
                    real = entry.real;
                    lastVol = qty;   // reiniciar base con dato real
                    synthIdx = 0;
                } else {
                    // Generar volumen sintético decreciente
                    synthIdx++;
                    qty = this._synthVol(lastVol, synthIdx);
                    real = false;
                }
                cum += qty;
                if (real) { cumReal += qty; cumM += qty * p; }
                this.bidArray.push({ price: p, qty, cumQty: cum, cumReal, monto: cumM, real });
                p = this._snap(p - step);
            }
        }

        // ── ASKS (hacia arriba) ──────────────────────────────────────────────
        if (this.askArray.length > 0 && this.askArray.length < n) {
            let lastVol = 0;
            let synthIdx = 0;
            for (let i = this.askArray.length - 1; i >= 0; i--) {
                if (this.askArray[i].qty > 0) { lastVol = this.askArray[i].qty; break; }
            }

            let last = this.askArray[this.askArray.length - 1];
            let cum = last.cumQty, cumReal = last.cumReal || 0, cumM = last.monto || 0;
            let p = this._snap(last.price + step);

            while (this.askArray.length < n) {
                const entry = this.askMap.get(p);
                let qty, real;
                if (entry && entry.qty > 0) {
                    qty = entry.qty;
                    real = entry.real;
                    lastVol = qty;
                    synthIdx = 0;
                } else {
                    synthIdx++;
                    qty = this._synthVol(lastVol, synthIdx);
                    real = false;
                }
                cum += qty;
                if (real) { cumReal += qty; cumM += qty * p; }
                this.askArray.push({ price: p, qty, cumQty: cum, cumReal, monto: cumM, real });
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
//  _OBRenderer — Price Ladder (Saxo FX) — tabla unificada con scroll infinito
//
//  layout de arriba hacia abajo:
//    fila 0 … N-1  → asks [N-1 … 0]  (ask más cara arriba, bestAsk abajo)
//    fila N        → fila spread (separador)
//    fila N+1 …    → bids [0 … ∞]   (bestBid primero, bajando infinitamente)
// ─────────────────────────────────────────────────────────────────────────────
class _OBRenderer {
    /** Nº de filas extra fuera del viewport (arriba + abajo) para suavizar scroll */
    static get BUFFER() { return 5; }

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
        this._rowH = 20;
        this._lastSH = 0;
        this._centered = false;
        this._lastInfo = null;
        this._vpH = 0;          // altura real del viewport (actualizada por ResizeObserver)
        this._poolReady = false; // true cuando el pool ya está pre-creado para el viewport

        // ── ResizeObserver: detectar cambios de tamaño del contenedor ─────────
        // contentRect.height puede ser 0 en elementos flex; usamos también
        // getBoundingClientRect como respaldo para garantizar un valor real.
        this._ro = new ResizeObserver(entries => {
            for (const e of entries) {
                // Preferir getBoundingClientRect (incluye el tamaño CSS real del flex child)
                const h = e.target.getBoundingClientRect().height ||
                    e.contentRect.height;
                if (h !== this._vpH) {
                    this._vpH = h;
                    this._poolReady = false;
                }
            }
        });
        this._ro.observe(this.vp);
    }

    setRowHeight(h) {
        this._rowH = Math.max(10, Math.min(60, h));
        this._lastSH = 0;       // fuerza re-calculo del spacer
        this._centered = false; // re-centrar con nueva altura
        this._poolReady = false; // recalcular pool para nueva altura de fila
    }

    /** Centra en top: fila 0 = best bid | best ask */
    centerOnMid() {
        if (!this.store.bidArray.length && !this.store.askArray.length) return;
        this.vp.scrollTop = 0;
        this._centered = true;
    }

    /**
     * Cada fila global index i = { bid: bidArray[i], ask: askArray[i] }
     * No hay inversión, no hay spread row — ambas columnas desde best hacia abajo.
     */
    render() {
        const s = this.store;
        if (!s.bestBid && !s.bestAsk && !s.midPrice) return null;

        const rowH = this._rowH;
        const step = s._step || 0.01;
        const dec = step < 0.01 ? 3 : 2;

        // ── Formatters ────────────────────────────────────────────────────
        const _fp = v => {
            if (!v) return '—';
            if (v >= 1000) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return v.toFixed(dec);
        };
        const _fmtFull = v => !v ? '$—' : '$' + _fp(v);
        const _fq = v => {
            if (!v || v <= 0) return '';
            if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
            if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
            return String(Math.round(v));
        };

        // ── Debug: primera vez que hay datos ─────────────────────────────
        if (!this._debugLogged && s.bidArray.length > 0) {
            this._debugLogged = true;
            console.groupCollapsed('[OB] 🔍 Debug de datos — primeras 5 filas');
            for (let i = 0; i < Math.min(5, s.bidArray.length); i++) {
                const b = s.bidArray[i], a = s.askArray[i];
                console.log(`fila ${i}: bid=${b?.price} qty=${b?.qty} real=${b?.real} | ask=${a?.price} qty=${a?.qty} real=${a?.real}`);
            }
            console.log('step:', s._step, '| bestBid:', s.bestBid, '| bestAsk:', s.bestAsk);
            console.log('Pool rows DOM:', this._rows.length, '| ch[1] sample:', this._rows[0]?.el?.children[1]?.className);
            console.groupEnd();
            // Exponer en window para inspección desde DevTools
            window.OBDebug = { store: s, renderer: this };
        }

        this._set(this.midEl, _fmtFull(s.midPrice));
        this._set(this.spdEl, '$' + (s.spread || 0).toFixed(dec + 1));
        this._set(this.bidEl, _fmtFull(s.bestBid));
        this._set(this.askEl, _fmtFull(s.bestAsk));

        const bidLen = s.bidArray.length;
        const askLen = s.askArray.length;
        const totalRows = Math.max(bidLen, askLen);
        if (totalRows === 0) return null;

        // ── Spacer ────────────────────────────────────────────────────────
        const spacerH = totalRows * rowH;
        if (spacerH !== this._lastSH) {
            this.spacer.style.height = spacerH + 'px';
            this._lastSH = spacerH;
        }

        // ── Auto-centrar (scroll al top en primer dato) ───────────────────
        if (!this._centered && totalRows > 0) this.centerOnMid();

        // ── Rango visible ─────────────────────────────────────────────────
        // Cascada de fallbacks para obtener la altura real del viewport:
        //   1) _vpH  → mantenida por ResizeObserver (más precisa)
        //   2) clientHeight → disponible una vez que el layout ha corrido
        //   3) getBoundingClientRect → garantía final, evita vpH=0
        const vpH = this._vpH ||
            this.vp.clientHeight ||
            this.vp.getBoundingClientRect().height;
        const scrollTop = this.vp.scrollTop;
        const startIdx = Math.max(0, Math.floor(scrollTop / rowH));
        const BUFFER = _OBRenderer.BUFFER;
        // visCount: mínimo 1 para que poolCount nunca colapse a sólo BUFFER*2
        const visCount = Math.max(1, Math.ceil(vpH / rowH));
        const poolCount = visCount + BUFFER * 2;
        const bufferedStart = Math.max(0, startIdx - BUFFER);
        const endIdx = Math.min(totalRows, bufferedStart + poolCount);
        const count = endIdx - bufferedStart;

        // ── Pre-crear pool al primer render con datos (o al resize) ───────
        // No depende de vpH>0 para evitar que frames tempranos omitan la creación.
        if (!this._poolReady) {
            this._growPool(poolCount);
            this._poolReady = true;
        }

        // ── Scroll infinito ── umbral proporcional al viewport ─────────────
        // Activar expansión cuando el usuario esté a 2× el nº de filas visibles
        // del borde del contenido generado.
        const maxSide = Math.max(bidLen, askLen);
        const triggerMargin = visCount * 2;   // umbral: 2× las filas visibles
        const expansion = Math.max(200, visCount * 4);  // expansión generosa
        if (endIdx + triggerMargin > maxSide && maxSide > 0) {
            // Guardar scrollTop antes de expandir para evitar saltos visuales
            // (el spacer crece hacia abajo por lo que no debería afectar,
            // pero lo preservamos explícitamente como garantía).
            const savedScroll = this.vp.scrollTop;
            s.ensureLevels(maxSide + expansion);
            if (this.vp.scrollTop !== savedScroll) this.vp.scrollTop = savedScroll;
        }

        this.wrapEl.style.setProperty('--row-h', rowH + 'px');
        this._growPool(count);

        // Desplazar el pool para mostrar las filas del rango con buffer
        this.pool.style.transform = `translateY(${bufferedStart * rowH}px)`;

        // ── maxVol del viewport (incluye buffer) para barras proporcionales ─
        // Las barras usan qty puntual de cada nivel (efecto ecualizador independiente por fila).
        let maxVol = 1;
        for (let i = 0; i < count; i++) {
            const gi = bufferedStart + i;
            const b = s.bidArray[gi], a = s.askArray[gi];
            if (b && b.qty > maxVol) maxVol = b.qty;
            if (a && a.qty > maxVol) maxVol = a.qty;
        }

        // ── Renderizar filas (usando bufferedStart como origen global) ──────
        // Layout 5 cols: [c-bid-acum][c-bid-px][c-monto][c-ask-px][c-ask-acum]
        //   ch[0]=bid-acum (.c-bar, .c-acum-txt)
        //   ch[1]=bid-px
        //   ch[2]=monto    (.m-bid, .m-ask)
        //   ch[3]=ask-px
        //   ch[4]=ask-acum (.c-bar, .c-acum-txt)
        for (let i = 0; i < count; i++) {
            const gi = bufferedStart + i;
            const r = this._rows[i];
            const ch = r.el.children;

            const bid = s.bidArray[gi];
            const ask = s.askArray[gi];

            const bidPx = bid ? bid.price : 0;
            const askPx = ask ? ask.price : 0;
            const bidQty = bid ? bid.qty : 0;
            const askQty = ask ? ask.qty : 0;
            const bidCum = bid ? bid.cumQty : 0;
            const askCum = ask ? ask.cumQty : 0;
            const bidReal = bid ? bid.real : false;
            const askReal = ask ? ask.real : false;
            const isBest = gi === 0;

            // clase de fila
            let cls = 'ob4-row';
            if (isBest) cls += ' is-best-row';
            if (bidReal) cls += ' bid-real';
            if (askReal) cls += ' ask-real';
            if (r.el.className !== cls) r.el.className = cls;

            // ── ch[1] Bid price ──────────────────────────────────────────
            const bidPxEl = ch[1];
            this._set(bidPxEl, bidPx ? _fp(bidPx) : '—');
            const bpCls = 'c-bid-px' + (!bidPx ? ' is-empty' : '');
            if (bidPxEl.className !== bpCls) bidPxEl.className = bpCls;

            // ── ch[3] Ask price ──────────────────────────────────────────
            const askPxEl = ch[3];
            this._set(askPxEl, askPx ? _fp(askPx) : '—');
            const apCls = 'c-ask-px' + (!askPx ? ' is-empty' : '');
            if (askPxEl.className !== apCls) askPxEl.className = apCls;

            // ── ch[0] Acum Bid — ecualizador independiente por fila ─────────
            // Barra: qty puntual de esta fila / max del viewport (sube y baja sin depender de otras)
            // Texto: qty acumulada históricamente en este precio (independiente por precio)
            const bidBar = ch[0].children[0];   // .c-bar
            const bidAcumEl = ch[0].children[1];   // .c-acum-txt
            if (bidQty > 0) {
                const pct = Math.min(100, (bidQty / maxVol) * 100).toFixed(1) + '%';
                if (bidBar.style.width !== pct) {
                    bidBar.style.width = pct;
                    bidBar.classList.remove('ob4-bar-bid-pulse');
                    void bidBar.offsetWidth;
                    bidBar.classList.add('ob4-bar-bid-pulse');
                }
                bidBar.style.opacity = bidReal ? '1' : '0.55';
                // Texto: si tiene historial acumulado lo muestra; si es sintético/nuevo, muestra qty actual
                const bidAccumQ = s.qtyAccumAt(bidPx);
                this._set(bidAcumEl, _fq(bidAccumQ || bidQty));
                const baCls = 'c-acum-txt' + (bidReal ? '' : ' is-synth');
                if (bidAcumEl.className !== baCls) bidAcumEl.className = baCls;
            } else {
                if (bidBar.style.width !== '0%') bidBar.style.width = '0%';
                this._set(bidAcumEl, '');
            }

            // ── ch[4] Acum Ask — ecualizador independiente por fila ─────────
            const askBar = ch[4].children[0];   // .c-bar
            const askAcumEl = ch[4].children[1];   // .c-acum-txt
            if (askQty > 0) {
                const pct = Math.min(100, (askQty / maxVol) * 100).toFixed(1) + '%';
                if (askBar.style.width !== pct) {
                    askBar.style.width = pct;
                    askBar.classList.remove('ob4-bar-ask-pulse');
                    void askBar.offsetWidth;
                    askBar.classList.add('ob4-bar-ask-pulse');
                }
                askBar.style.opacity = askReal ? '1' : '0.55';
                const askAccumQ = s.qtyAccumAt(askPx);
                this._set(askAcumEl, _fq(askAccumQ || askQty));
                const aaCls = 'c-acum-txt' + (askReal ? '' : ' is-synth');
                if (askAcumEl.className !== aaCls) askAcumEl.className = aaCls;
            } else {
                if (askBar.style.width !== '0%') askBar.style.width = '0%';
                this._set(askAcumEl, '');
            }

            // ── ch[2] Monto — notional ACUMULADO en este nivel de precio ─────
            // Usa s.notionalAt(p) = suma histórica de deltas (qty↑ × precio) por nivel.
            // Se incrementa automáticamente con cada snapshot de WS.
            const montoEl = ch[2];
            const mBidEl = montoEl.children[0];  // .m-bid
            const mAskEl = montoEl.children[1];  // .m-ask
            const _fm = v => {
                if (!v) return '';
                if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M$';
                if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K$';
                return '$' + v.toFixed(0);
            };
            const bMontoCls = 'm-bid' + (bidReal ? '' : ' is-synth');
            const aMontoCls = 'm-ask' + (askReal ? '' : ' is-synth');
            // Para niveles reales: most acum histórico. Sintéticos: siempre vacío.
            this._set(mBidEl, bidReal ? _fm(s.notionalAt(bidPx)) : '');
            this._set(mAskEl, askReal ? _fm(s.notionalAt(askPx)) : '');
            if (mBidEl.className !== bMontoCls) mBidEl.className = bMontoCls;
            if (mAskEl.className !== aMontoCls) mAskEl.className = aMontoCls;

            r.price = bidPx || askPx;
            r.bidQty = bidQty;
            r.askQty = askQty;
        }

        this._lastInfo = { startIdx: bufferedStart, count, rowH, vpH, scrollTop };
        return this._lastInfo;
    }

    _growPool(count) {
        while (this._rows.length < count) {
            const el = document.createElement('div');
            el.className = 'ob4-row';
            // 5 columnas: [bid-acum(bar+txt)][bid-px][monto(m-bid,m-ask)][ask-px][ask-acum(bar+txt)]
            el.innerHTML =
                '<div class="c-bid-acum"><span class="c-bar"></span><span class="c-acum-txt"></span></div>' +
                '<span class="c-bid-px"></span>' +
                '<div class="c-monto"><span class="m-bid"></span><span class="m-ask"></span></div>' +
                '<span class="c-ask-px"></span>' +
                '<div class="c-ask-acum"><span class="c-bar"></span><span class="c-acum-txt"></span></div>';
            this.pool.appendChild(el);
            this._rows.push({ el, price: 0, bidQty: 0, askQty: 0 });
        }
        for (let i = 0; i < this._rows.length; i++) {
            const show = i < count;
            if (this._rows[i].el.style.display !== (show ? '' : 'none'))
                this._rows[i].el.style.display = show ? '' : 'none';
        }
    }

    _set(el, txt) { if (el && el.textContent !== txt) el.textContent = txt; }

    destroy() {
        // Desconectar el ResizeObserver para evitar memory leaks
        if (this._ro) { this._ro.disconnect(); this._ro = null; }
        this._rows = [];
        this.pool.innerHTML = '';
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
        this._rowH = 18;   // altura de fila propia (zoom independiente del chart)

        // Motores internos (se crean en renderizar)
        /** @type {_OBStore|null}    */ this._store = null;
        /** @type {_OBRenderer|null} */ this._renderer = null;
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
                <span class="ob4-session-badge" data-el="sessionBadge" title="Sesión de mercado"></span>
                <div class="ob4-zoom">
                    <button data-el="zoomOut" title="Compactar filas">−</button>
                    <span class="ob4-zoom-lbl" data-el="zoomLbl">20px</span>
                    <button data-el="zoomIn" title="Ampliar filas">+</button>
                    <button data-el="zoomReset" title="Zoom original" style="font-size:9px;width:22px;">↺</button>
                </div>
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
                <div class="ob4-col-hdr">
                    <span class="h-bid-acum">Acum</span>
                    <span class="h-bid-px">Bid</span>
                    <span class="h-monto">$ Nivel</span>
                    <span class="h-ask-px">Ask</span>
                    <span class="h-ask-acum">Acum</span>
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

        // ── Controles de zoom propios ──────────────────────────────────────
        const ROW_MIN = 14, ROW_MAX = 40, ROW_DEF = 20, ROW_STEP = 2;
        const _updateZoom = () => {
            if (this._renderer) this._renderer.setRowHeight(this._rowH);
            if (this._els.zoomLbl) this._els.zoomLbl.textContent = this._rowH + 'px';
        };
        if (this._els.zoomIn) {
            this._els.zoomIn.addEventListener('click', () => {
                this._rowH = Math.min(ROW_MAX, this._rowH + ROW_STEP);
                _updateZoom();
            });
        }
        if (this._els.zoomOut) {
            this._els.zoomOut.addEventListener('click', () => {
                this._rowH = Math.max(ROW_MIN, this._rowH - ROW_STEP);
                _updateZoom();
            });
        }
        if (this._els.zoomReset) {
            this._els.zoomReset.addEventListener('click', () => {
                this._rowH = ROW_DEF;
                _updateZoom();
            });
        }

        // ── Tooltip de precio por fila ───────────────────────────────
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
            if (r.price) lines.push(`Precio: ${r.price}`);
            if (r.bidQty > 0) lines.push(`Bid: ${r.bidQty}`);
            if (r.askQty > 0) lines.push(`Ask: ${r.askQty}`);
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
        // NOTA: el Order Book NO escucha CAMBIO_PRECIO — su zoom es propio (botones − / ●  / +)
        this._escuchar(EVENTOS.CAMBIO_ACTIVO, datos => {
            const nuevo = datos.simbolo;
            if (!nuevo) return;

            const cambioReal = nuevo !== this._simbolo;
            this._simbolo = nuevo;
            this._primerDato = false;

            if (this._store) this._store.reset();

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

        // ── SESION_MERCADO → solo actualizar el badge de sesión ──────────────────
        // El OB sigue actualizando en TIEMPO REAL sin importar la sesión.
        // Polygon sigue enviando datos en AH / pre-market, y el OB los muestra siempre.
        this._escuchar(EVENTOS.SESION_MERCADO, ({ session, label }) => {
            const sesionRaw = (session || '').toLowerCase();

            // Actualizar badge de sesión en el header
            const badge = this._els.sessionBadge;
            if (badge) {
                const MAP = {
                    pre_market: { txt: 'PRE', cls: 'ob4-sess-pre' },
                    regular: { txt: 'OPEN', cls: 'ob4-sess-open' },
                    after_hours: { txt: 'AFTER', cls: 'ob4-sess-after' },
                    closed: { txt: 'CLOSED', cls: 'ob4-sess-closed' },
                };
                const cfg = MAP[sesionRaw] || { txt: label || session, cls: 'ob4-sess-closed' };
                badge.textContent = cfg.txt;
                badge.className = `ob4-session-badge ${cfg.cls}`;
                badge.title = `Sesión: ${label || session}`;
            }

            // OB siempre en vivo — solo log informativo
            console.log(`[WidgetLibroOrdenes] ▶ Sesión: ${label || session} — OB siempre activo (tiempo real)`);
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    //  LOOP DE RENDERIZADO
    // ══════════════════════════════════════════════════════════════════════

    _iniciarLoop() {
        const tick = () => {
            if (this._renderer) {
                this._renderer.render();
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