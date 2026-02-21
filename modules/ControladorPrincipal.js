// ═══════════════════════════════════════════════════════════════
//  ControladorPrincipal.js — Controlador principal de la app
//  Conecta todos los módulos: velas, cursor, eje de precios,
//  orderbook, y WebSockets de datos en tiempo real.
//
//  Dependencias (cargar ANTES de este archivo):
//    - EstadoPrecio.js        → MD.SharedPriceState
//    - AgrupadorVelas.js      → MD.OHLCAggregator
//    - MotorVelas.js          → MD.CandleEngine
//    - CursorGrafica.js       → MD.Crosshair
//    - EjePrecio.js           → MD.PriceAxisRenderer
//    - MotorOrderBook.js      → OrderbookEngine
// ═══════════════════════════════════════════════════════════════
(() => {
    'use strict';

    const WS_CHART = 'ws://localhost:8765';
    const WS_ORDERBOOK = 'ws://localhost:8766';
    const RECONNECT_MS = 3000;

    // ══════════════════════════════════════════════════
    //  CONTROLADOR PRINCIPAL
    // ══════════════════════════════════════════════════
    class MarketDepthCore {
        constructor() {
            this.ps = new MD.SharedPriceState();

            // Referencias al DOM
            this.chartWrap = document.getElementById('chart-wrap');
            this.candleCanvas = document.getElementById('candle-canvas');
            this.crosshairCanvas = document.getElementById('crosshair-canvas');
            this.priceAxisEl = document.getElementById('price-axis');
            this.priceAxisCanvas = document.getElementById('price-axis-canvas');

            // Motores (cada uno viene de su propio archivo JS)
            this.aggregator = new MD.OHLCAggregator(60);
            this.candleEngine = new MD.CandleEngine(this.candleCanvas, this.ps);
            this.crosshair = new MD.Crosshair(this.crosshairCanvas);
            this.priceAxisRenderer = new MD.PriceAxisRenderer(this.priceAxisCanvas, this.ps);

            // OrderBook Engine — módulo independiente
            this.obEngine = new OrderbookEngine(document.getElementById('ob-engine-mount'));
            window.obEngine = this.obEngine;

            // Estado de la sesión
            this.isPaused = false;
            this.isMarketClosed = false;  // ── NUEVO: pausa automática cuando mercado está cerrado ──
            this.activeTimeframe = 60;    // ── NUEVO: timeframe activo en segundos (default: 1m) ──
            this.currentSymbol = '';
            this.currentPrice = 0;
            this.firstPrice = 0;
            this.sessionHigh = -Infinity;
            this.sessionLow = Infinity;
            this.totalVolume = 0;
            this.totalTicks = 0;
            this.totalMessages = 0;
            this.rawTicks = [];

            // FPS / TPS
            this.frameCount = 0;
            this.lastFpsTime = Date.now();
            this.fps = 60;
            this.ticksPerSecond = 0;
            this.tickCountWindow = 0;
            this.lastTpsTime = Date.now();

            // Estados de arrastre
            this._axisDrag = false;
            this._axisDragStartY = 0;
            this._chartDrag = false;
            this._chartDragStartX = 0;

            // WebSockets
            this.wsChart = null;
            this.wsOB = null;

            // Throttle del eje de tiempo
            this._lastTimeAxisUpdate = 0;

            this._resize();
            this._bindEvents();
            this._startLoop();
            this._connectChart();
            this._connectOB();

            console.log('%c[SYSTEM] 🚀 MarketDepthCore inicializado', 'color:#06b6d4;font-weight:bold');
        }

        // ─── REDIMENSIONAR CANVASES ─────────────────────────────
        _resize() {
            const dpr = window.devicePixelRatio || 1;

            const sizeCanvas = (canvas, w, h) => {
                const pw = Math.round(w * dpr);
                const ph = Math.round(h * dpr);
                canvas.width = pw; canvas.height = ph;
                canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
                canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
            };

            const cw = this.chartWrap.clientWidth;
            const ch = this.chartWrap.clientHeight;
            [this.candleCanvas, this.crosshairCanvas].forEach(c => sizeCanvas(c, cw, ch));
            this.chartW = cw;
            this.chartH = ch;

            const paw = this.priceAxisEl.clientWidth;
            const pah = this.priceAxisEl.clientHeight;
            sizeCanvas(this.priceAxisCanvas, paw, pah);
            this.paW = paw;
            this.paH = pah;

            console.log(`%c[RESIZE] 📐 Chart: ${cw}x${ch} | DPR: ${dpr}`, 'color:#94a3b8');
        }

        // ─── EVENTOS DE USUARIO ─────────────────────────────
        _bindEvents() {
            window.addEventListener('resize', () => this._resize());

            // Crosshair sobre el chart
            this.crosshairCanvas.addEventListener('mousemove', (e) => {
                if (this._chartDrag) return;
                const r = this.crosshairCanvas.getBoundingClientRect();
                this.crosshair.mx = e.clientX - r.left;
                this.crosshair.my = e.clientY - r.top;
                this.crosshair.on = true;
                this._updateTooltip();
            });
            this.crosshairCanvas.addEventListener('mouseleave', () => {
                this.crosshair.on = false;
                document.getElementById('crosshair-info').style.display = 'none';
            });

            // ─── PAN DEL CHART: click+arrastrar → navegar historial de velas ───
            this.crosshairCanvas.addEventListener('mousedown', (e) => {
                this._chartDrag = true;
                this._chartDragStartX = e.clientX;
                // NO resetear _panAccumPx aquí — conservar la acumulación fraccional
                this.crosshair.on = false; // Apagar crosshair durante drag
                this.crosshairCanvas.style.cursor = 'grabbing';
                e.preventDefault();
            });

            // Zoom horizontal (scroll sobre el área del chart)
            this.crosshairCanvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (e.shiftKey) {
                    const rect = this.crosshairCanvas.getBoundingClientRect();
                    const centerRatio = (e.clientY - rect.top) / rect.height;
                    this.ps.applyManualZoom(e.deltaY > 0 ? 5 : -5, centerRatio);
                } else {
                    this.candleEngine.zoom(e.deltaY > 0 ? 1.08 : 0.92);
                }
            }, { passive: false });

            // Eje de precio: wheel → zoom vertical
            this.priceAxisEl.addEventListener('wheel', (e) => {
                e.preventDefault();
                const rect = this.priceAxisEl.getBoundingClientRect();
                const centerRatio = (e.clientY - rect.top) / rect.height;
                this.ps.applyManualZoom(e.deltaY > 0 ? 6 : -6, centerRatio);
            }, { passive: false });

            // Eje de precio: arrastrar → zoom vertical
            this.priceAxisEl.addEventListener('mousedown', (e) => {
                this._axisDrag = true;
                this._axisDragStartY = e.clientY;
                this.priceAxisEl.style.cursor = 'ns-resize';
                document.body.style.cursor = 'ns-resize';
                e.preventDefault();
            });

            // ─── HANDLERS GLOBALES DE MOUSE (pan + arrastre del eje) ───
            window.addEventListener('mousemove', (e) => {
                if (this._axisDrag) {
                    const dy = e.clientY - this._axisDragStartY;
                    this._axisDragStartY = e.clientY;
                    const rect = this.priceAxisEl.getBoundingClientRect();
                    this.ps.applyManualDrag(dy, rect.height);
                }
                if (this._chartDrag) {
                    const dx = e.clientX - this._chartDragStartX;
                    this._chartDragStartX = e.clientX;
                    if (dx !== 0) {
                        const movedCandle = this.candleEngine.pan(-dx, this.chartW);
                        // Solo recalcular rango cuando se cruza una vela entera
                        if (movedCandle) {
                            this.ps.autoRange = true;
                        }
                    }
                }
            });

            window.addEventListener('mouseup', () => {
                if (this._axisDrag) {
                    this._axisDrag = false;
                    this.priceAxisEl.style.cursor = 'ns-resize';
                    document.body.style.cursor = '';
                }
                if (this._chartDrag) {
                    this._chartDrag = false;
                    this.crosshairCanvas.style.cursor = 'crosshair';
                    // Re-encender el crosshair tras soltar
                    this.crosshair.on = true;
                    // Limpiar fraccional al soltar — snap a vela entera
                    this.candleEngine._panFractional = 0;
                    this.candleEngine._panAccumPx = 0;
                    // Forzar auto-rango final para ajustarse a la posición actual
                    this.ps.autoRange = true;
                }
            });

            // Doble click: eje de precio → resetear zoom, chart → resetear pan
            this.priceAxisEl.addEventListener('dblclick', () => {
                this.ps.resetZoom();
            });

            this.crosshairCanvas.addEventListener('dblclick', () => {
                this.candleEngine.resetPan();
                this.ps.autoRange = true;
            });

            // Botones de la barra de herramientas
            document.getElementById('btn-pause').addEventListener('click', (e) => {
                this.isPaused = !this.isPaused;
                e.target.textContent = this.isPaused ? '▶ Reanudar' : '⏸ Pausar';
                this._setStatus(this.isPaused ? 'connecting' : 'live', this.isPaused ? 'PAUSED' : 'LIVE');
            });

            document.getElementById('btn-reset').addEventListener('click', () => location.reload());

            // Botones de timeframe (5s, 1m, 5m, 15m, 1H)
            document.querySelectorAll('[data-tf]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('[data-tf]').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    const sec = parseInt(e.target.dataset.tf);
                    this.activeTimeframe = sec;
                    this.aggregator.changeInterval(sec, this.rawTicks);
                    this.ps.resetZoom();
                    this.candleEngine.resetPan();
                    // Recalibrar el OrderBook al nuevo rango de precios
                    this.obEngine.resetScale();
                    // Ajustar cantidad de velas visibles según timeframe
                    if (sec >= 900) this.candleEngine.visibleCount = 40;       // 15m+
                    else if (sec >= 300) this.candleEngine.visibleCount = 60;  // 5m
                    else this.candleEngine.visibleCount = 80;                  // 1m, 5s

                    // ── NUEVO: Solicitar 500 velas del timeframe al backend ──
                    if (this.wsChart?.readyState === WebSocket.OPEN) {
                        this.wsChart.send(JSON.stringify({
                            action: 'set_timeframe',
                            timeframe: sec
                        }));
                        console.log(`%c[TIMEFRAME] ⏱ Solicitando 500 velas de ${sec}s al servidor`, 'color:#a78bfa;font-weight:bold');
                    }
                });
            });

            // Cambio de símbolo
            document.getElementById('symbol-select').addEventListener('change', (e) => {
                const sym = e.target.value;
                this.currentSymbol = sym;
                const msg = JSON.stringify({ action: 'subscribe', symbol: sym });
                if (this.wsChart?.readyState === WebSocket.OPEN) this.wsChart.send(msg);
                if (this.wsOB?.readyState === WebSocket.OPEN) this.wsOB.send(msg);
                this.ps.resetZoom();
                this.candleEngine.resetPan();
                // Recalibrar OrderBook para el nuevo activo
                this.obEngine.resetScale();
                console.log('%c[SYMBOL] 🔄 Cambio a ' + sym, 'color:#a78bfa;font-weight:bold');
            });
        }

        // ─── WEBSOCKET DEL CHART (puerto 8765) ────────────────────
        _connectChart() {
            const t0 = performance.now();
            this._setStatus('connecting', 'CONECTANDO...');
            console.log('%c[CONNECTION] 🔌 Conectando a Chart WS: ' + WS_CHART, 'color:#f59e0b;font-weight:bold');
            this.wsChart = new WebSocket(WS_CHART);

            this.wsChart.onopen = () => {
                const elapsed = (performance.now() - t0).toFixed(0);
                this._setStatus('live', 'LIVE');
                console.log(`%c[CONNECTION] ✅ Chart WS CONECTADO | Tiempo: ${elapsed}ms`, 'color:#22c55e;font-weight:bold;font-size:13px');
            };

            this.wsChart.onmessage = (e) => {
                const msgT0 = performance.now();
                this.totalMessages++;
                let m;
                try { m = JSON.parse(e.data); } catch { return; }

                if (m.type === 'symbols') this._onSymbols(m.symbols);
                if (m.type === 'init') {
                    this._onInit(m);
                    const elapsed = (performance.now() - msgT0).toFixed(1);
                    console.log(`%c[CONNECTION] 📊 Datos iniciales | ${elapsed}ms | ${(m.data || []).length} ticks | Fuente: ${m.source || 'desconocida'}`, 'color:#06b6d4;font-weight:bold');
                }
                if (m.type === 'tick') this._onTick(m);
                if (m.type === 'session') this._onSession(m);

                // ── NUEVO: Verificación de datos reales de Polygon ──
                if (m.type === 'data_info') {
                    console.log(
                        '%c[DATOS] ✅ VERIFICACIÓN DE DATOS REALES',
                        'color:#22c55e;font-weight:bold;font-size:14px'
                    );
                    console.log(`%c   Fuente:    ${m.source}`, 'color:#22c55e');
                    console.log(`%c   Plan:      ${m.plan}`, 'color:#22c55e');
                    console.log(`%c   API Key:   ${m.api_key_preview}`, 'color:#22c55e');
                    console.log(`%c   Tipo:      ${m.data_type}`, 'color:#22c55e');
                    console.log(`%c   Mercado:   ${m.market_status}`, 'color:#22c55e');
                    console.log(`%c   ${m.message}`, 'color:#22c55e;font-weight:bold');
                }
            };

            this.wsChart.onclose = () => {
                this._setStatus('disconnected', 'DESCONECTADO');
                console.log('%c[CONNECTION] ❌ Chart WS desconectado — reconectando...', 'color:#ef4444;font-weight:bold');
                setTimeout(() => this._connectChart(), RECONNECT_MS);
            };
            this.wsChart.onerror = () => this.wsChart.close();
        }

        // ─── WEBSOCKET DEL ORDERBOOK (puerto 8766) ────────────────
        _connectOB() {
            const t0 = performance.now();
            this.obEngine.setStatus('Conectando...', false);
            console.log('%c[CONNECTION] 🔌 Conectando a OrderBook WS: ' + WS_ORDERBOOK, 'color:#f59e0b');
            this.wsOB = new WebSocket(WS_ORDERBOOK);

            this.wsOB.onopen = () => {
                const elapsed = (performance.now() - t0).toFixed(0);
                this.obEngine.setStatus('LIVE', true);
                console.log(`%c[CONNECTION] ✅ OrderBook WS CONECTADO | Tiempo: ${elapsed}ms`, 'color:#22c55e;font-weight:bold');
            };

            this.wsOB.onmessage = (e) => {
                let m; try { m = JSON.parse(e.data); } catch { return; }
                if (!this._obFirstMsg) {
                    this._obFirstMsg = true;
                    console.log('%c[ORDERBOOK] 📨 Primer mensaje WS recibido:', 'color:#06b6d4;font-weight:bold', {
                        type: m.type, symbol: m.symbol,
                        bids: m.bids?.length, asks: m.asks?.length,
                        mid_price: m.mid_price, best_bid: m.best_bid, best_ask: m.best_ask
                    });
                }
                if (m.type === 'book' && (!this.currentSymbol || m.symbol === this.currentSymbol)) {
                    this.obEngine.feedBook(m);
                    if (m.spread !== undefined) {
                        document.getElementById('m-spread').textContent = '$' + m.spread.toFixed(4);
                    }
                }
            };

            this.wsOB.onclose = () => {
                this.obEngine.setStatus('Desconectado', false);
                console.log('%c[CONNECTION] ❌ OrderBook WS desconectado — reconectando...', 'color:#ef4444');
                setTimeout(() => this._connectOB(), RECONNECT_MS);
            };
            this.wsOB.onerror = () => this.wsOB.close();
        }

        _setStatus(state, text) {
            document.getElementById('status-dot').className = 'status-dot ' + state;
            document.getElementById('status-text').textContent = text;
        }

        _onSymbols(symbols) {
            const sel = document.getElementById('symbol-select');
            sel.innerHTML = '';
            symbols.forEach(s => {
                const o = document.createElement('option');
                o.value = s; o.textContent = s;
                sel.appendChild(o);
            });
            if (symbols.length) { this.currentSymbol = symbols[0]; sel.value = symbols[0]; }
            console.log(`%c[CONNECTION] 📋 Símbolos: ${symbols.join(', ')}`, 'color:#94a3b8');
        }

        _onInit(msg) {
            this.currentSymbol = msg.symbol;
            this.rawTicks = msg.data || [];
            this.sessionHigh = -Infinity;
            this.sessionLow = Infinity;
            this.totalVolume = 0;
            this.totalTicks = 0;
            this.firstPrice = 0;
            this.aggregator.fromHistory(this.rawTicks);
            this.ps.resetZoom();

            if (this.rawTicks.length) {
                this.firstPrice = this.rawTicks[0].value;
                this.rawTicks.forEach(t => {
                    if (t.value > this.sessionHigh) this.sessionHigh = t.value;
                    if (t.value < this.sessionLow) this.sessionLow = t.value;
                    this.currentPrice = t.value;
                    this.totalTicks++;
                });
                this.totalVolume = this.rawTicks.length;
            }

            // ── Loguear info de la carga con fuente de datos ──
            const src = msg.source || 'desconocida';
            const loaded = msg.candles_loaded || this.rawTicks.length;
            console.log(
                `%c[DATA] 📈 ${msg.symbol}: ${loaded} velas | Fuente: ${src} | ` +
                `$${this.sessionLow > 0 ? this.sessionLow.toFixed(2) : '—'} – ` +
                `$${this.sessionHigh > -Infinity ? this.sessionHigh.toFixed(2) : '—'}`,
                'color:#a78bfa;font-weight:bold'
            );
        }

        _onSession(msg) {
            const badge = document.getElementById('session-badge');
            const SESSION_SHORT = {
                'PRE_MARKET': 'PRE-MARKET',
                'REGULAR': 'REGULAR',
                'AFTER_HOURS': 'AFTER HOURS',
                'CLOSED': 'CERRADO'
            };
            badge.textContent = SESSION_SHORT[msg.session] || msg.session;
            badge.className = 'session-badge ' + msg.session;

            // ── NUEVO: Detectar mercado cerrado y mostrar/ocultar overlay ──
            const overlay = document.getElementById('market-closed-overlay');
            const wasClosed = this.isMarketClosed;
            this.isMarketClosed = (msg.session === 'CLOSED');

            if (this.isMarketClosed) {
                // Mostrar overlay de mercado cerrado
                if (overlay) {
                    overlay.style.display = 'flex';
                    // Actualizar subtexto con info de fin de semana
                    const sub = document.getElementById('market-closed-sub');
                    if (sub) {
                        sub.textContent = msg.is_weekend
                            ? 'Fin de semana — Reanuda Lunes 4:00 AM ET'
                            : 'Reanuda próxima sesión';
                    }
                }
                this._setStatus('disconnected', 'CERRADO');
                console.log(`%c[SESIÓN] 🔴 MERCADO CERRADO ${msg.is_weekend ? '(Fin de Semana)' : ''} | ${msg.time_et}`, 'color:#ef4444;font-weight:bold;font-size:13px');
            } else {
                // Mercado abierto — ocultar overlay si estaba visible
                if (overlay) overlay.style.display = 'none';
                if (wasClosed) {
                    // Transición de CERRADO → ACTIVO: refrescar status
                    this._setStatus('live', 'LIVE');
                    console.log(`%c[SESIÓN] 🟢 MERCADO ABIERTO — Reanudando datos en tiempo real`, 'color:#22c55e;font-weight:bold;font-size:13px');
                }
                console.log(`%c[SESIÓN] ${msg.label} | ${msg.time_et}`, 'color:#f59e0b;font-weight:bold');
            }
        }

        _onTick(msg) {
            // ── Ignorar ticks si está pausado manualmente O si el mercado está cerrado ──
            if (this.isPaused || this.isMarketClosed) return;
            const { value: p, time: t } = msg;
            this.rawTicks.push({ time: t, value: p });
            if (this.rawTicks.length > 50000) this.rawTicks = this.rawTicks.slice(-30000);

            this.currentPrice = p;
            if (!this.firstPrice) this.firstPrice = p;
            if (p > this.sessionHigh) this.sessionHigh = p;
            if (p < this.sessionLow) this.sessionLow = p;
            this.totalVolume++;
            this.totalTicks++;
            this.tickCountWindow++;

            this.aggregator.tick(t, p);
            document.getElementById('m-last').textContent = '$' + p.toFixed(2);
            document.getElementById('m-ticks').textContent = this.totalTicks.toLocaleString();
            document.getElementById('m-candles').textContent = this.aggregator.all().length;
        }

        _updateTooltip() {
            const all = this.aggregator.all();
            const vis = this.candleEngine.visible(all);
            const space = this.chartW / this.candleEngine.visibleCount;
            const idx = Math.floor(this.crosshair.mx / space);
            if (idx >= 0 && idx < vis.length) {
                const c = vis[idx];
                const info = document.getElementById('crosshair-info');
                info.style.display = 'block';
                const up = c.close >= c.open;
                const cls = up ? 'positive' : 'negative';
                document.getElementById('ci-open').textContent = '$' + c.open.toFixed(2);
                document.getElementById('ci-high').textContent = '$' + c.high.toFixed(2);
                document.getElementById('ci-low').textContent = '$' + c.low.toFixed(2);
                document.getElementById('ci-close').textContent = '$' + c.close.toFixed(2);
                document.getElementById('ci-vol').textContent = c.volume.toLocaleString();
                ['ci-open', 'ci-high', 'ci-low', 'ci-close'].forEach(id => {
                    document.getElementById(id).className = 'val ' + cls;
                });
            }
        }

        // ─── BUCLE DE RENDERIZADO (60fps) ────────────────────────
        _startLoop() {
            const loop = () => {
                this.frameCount++;
                const now = Date.now();
                if (now - this.lastFpsTime >= 1000) {
                    this.fps = this.frameCount; this.frameCount = 0; this.lastFpsTime = now;
                    document.getElementById('stat-fps').textContent = this.fps;
                }
                if (now - this.lastTpsTime >= 1000) {
                    this.ticksPerSecond = this.tickCountWindow; this.tickCountWindow = 0; this.lastTpsTime = now;
                    document.getElementById('stat-tps').textContent = this.ticksPerSecond;
                }

                const all = this.aggregator.all();

                // Auto-rango según velas visibles
                this.candleEngine.computeAutoRange(all);

                // ── AUTO-RECUPERACIÓN: NaN=instantáneo, fuera de pantalla=2 segundos ──
                // DESACTIVAR durante arrastre activo para evitar resets mientras el usuario navega
                if (!this.ps.autoRange && !this._chartDrag) {
                    if (!this.ps.hasValidRange()) {
                        console.warn('[SAFETY] Rango de precio inválido — auto-recuperando');
                        this.ps.resetZoom();
                        this.candleEngine.computeAutoRange(all);
                        this.ps._offScreenSince = 0;
                    } else {
                        const vis = this.candleEngine.visible(all);
                        if (vis.length > 0) {
                            let lo = Infinity, hi = -Infinity;
                            vis.forEach(c => { if (c.low < lo) lo = c.low; if (c.high > hi) hi = c.high; });
                            if (hi < this.ps.priceMin || lo > this.ps.priceMax) {
                                if (!this.ps._offScreenSince) {
                                    this.ps._offScreenSince = now;
                                } else if (now - this.ps._offScreenSince > 2000) {
                                    console.warn('[SAFETY] Velas fuera de pantalla por 2s — auto-recuperando');
                                    this.ps.resetZoom();
                                    this.candleEngine.computeAutoRange(all);
                                    this.ps._offScreenSince = 0;
                                }
                            } else {
                                this.ps._offScreenSince = 0;
                            }
                        }
                    }
                } else {
                    this.ps._offScreenSince = 0;
                }

                // Renderizar todo
                this.candleEngine.render(this.chartW, this.chartH, all);
                this.crosshair.render(this.chartW, this.chartH);
                this.priceAxisRenderer.render(this.paW, this.paH, this.currentPrice, this.firstPrice);
                this.obEngine.syncScale(this.ps.priceMin, this.ps.priceMax);

                if (now - this._lastTimeAxisUpdate > 500) {
                    this._lastTimeAxisUpdate = now;
                    this._updateTimeAxis(all);
                }

                this._updateUI();
                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        }

        _updateUI() {
            const p = this.currentPrice;
            if (!p) return;
            const chg = p - this.firstPrice;
            const pct = this.firstPrice ? (chg / this.firstPrice * 100) : 0;
            const up = chg >= 0;

            document.getElementById('live-price').textContent = '$' + p.toFixed(2);
            document.getElementById('live-price').className = 'ticker-price ' + (up ? 'positive' : 'negative');
            document.getElementById('live-change').textContent = `${up ? '+' : ''}${chg.toFixed(2)} (${pct.toFixed(2)}%)`;
            document.getElementById('live-change').className = 'ticker-change ' + (up ? 'bg-positive' : 'bg-negative');
            document.getElementById('stat-vol').textContent = this.totalVolume > 1000 ? (this.totalVolume / 1000).toFixed(0) + 'K' : this.totalVolume;
            document.getElementById('stat-high').textContent = this.sessionHigh > -Infinity ? '$' + this.sessionHigh.toFixed(2) : '$—';
            document.getElementById('stat-low').textContent = this.sessionLow < Infinity ? '$' + this.sessionLow.toFixed(2) : '$—';
        }

        _updateTimeAxis(all) {
            const el = document.getElementById('time-axis');
            el.innerHTML = '';
            const vis = this.candleEngine.visible(all);
            if (!vis.length) return;
            const space = this.chartW / this.candleEngine.visibleCount;
            const step = Math.max(1, Math.floor(this.candleEngine.visibleCount / 8));
            vis.forEach((c, i) => {
                if (i % step === 0) {
                    const x = i * space + space / 2;
                    const d = new Date(c.time * 1000);
                    const lbl = document.createElement('div');
                    lbl.className = 'time-label';
                    lbl.style.left = x + 'px';
                    lbl.textContent = d.getHours().toString().padStart(2, '0') + ':' +
                        d.getMinutes().toString().padStart(2, '0') + ':' +
                        d.getSeconds().toString().padStart(2, '0');
                    el.appendChild(lbl);
                }
            });
        }
    }

    // ─── ARRANQUE ────────────────────────────
    window.addEventListener('DOMContentLoaded', () => {
        console.log('%c╔═══════════════════════════════════════════════════════╗', 'color:#06b6d4');
        console.log('%c║ MarketDepth Core — CHART + DOM DEPTH                 ║', 'color:#06b6d4;font-weight:bold;font-size:13px');
        console.log('%c╚═══════════════════════════════════════════════════════╝', 'color:#06b6d4');
        console.log('%c[CONNECTION] ⏱ Iniciando conexiones WebSocket...', 'color:#f59e0b');
        window.app = new MarketDepthCore();
    });
})();
