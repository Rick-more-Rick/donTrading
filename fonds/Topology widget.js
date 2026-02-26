/*!
 * topology-widget.js — Red topológica corporativa interactiva
 * Nodos conectados con flujo de datos animado, estética enterprise
 *
 * Diseño profesional: nodos hexagonales, conexiones con pulsos de datos,
 * clusters jerárquicos y efecto de profundidad. Mouse revela conexiones
 * ocultas y activa flujo de datos en nodos cercanos.
 *
 * USO:
 *   <script src="topology-widget.js"></script>
 *
 *   Opcional:
 *   <script>
 *     window.TopologyWidgetOptions = {
 *       canvasId: 'topology-bg',
 *       palette: 'corporate',        // 'corporate' | 'midnight' | 'slate' | custom
 *       nodeCount: [35, 70],         // [min, max] nodos
 *       nodeDensity: 22000,          // área px² por nodo
 *       nodeRadiusRange: [3, 8],     // [min, max] radio
 *       hubCount: [3, 6],            // nodos hub grandes
 *       hubRadius: [10, 16],         // radio de hubs
 *       connectDist: 180,            // distancia de conexión
 *       hubConnectDist: 280,         // distancia de conexión entre hubs
 *       lineWidth: 0.4,              // grosor líneas
 *       pulseSpeed: 1.2,             // velocidad de pulsos de datos
 *       pulseFrequency: 0.012,       // probabilidad de nuevo pulso por frame
 *       mouseRadius: 200,            // radio de influencia del mouse
 *       mouseRevealDist: 250,        // radio para revelar conexiones ocultas
 *       driftSpeed: 0.15,            // velocidad de deriva de nodos
 *       breatheSpeed: 0.002,         // velocidad de respiración
 *       labelOpacity: 0.12,          // opacidad de etiquetas decorativas
 *       gridOverlay: true,           // mostrar cuadrícula sutil de fondo
 *       gridSpacing: 60,             // espaciado de la cuadrícula
 *       gridOpacity: 0.025,          // opacidad de la cuadrícula
 *       scanLine: true,              // línea de escaneo horizontal
 *       scanSpeed: 0.3,              // velocidad de escaneo
 *       zIndex: 0,
 *     };
 *   </script>
 *
 *   API:
 *   TopologyWidget.instance.setOptions({ palette: 'midnight' });
 *   TopologyWidget.instance.rebuild();
 *   TopologyWidget.instance.destroy();
 */
(function (global) {
    'use strict';

    /* ── Paletas ── */
    const PALETTES = {
        corporate: {
            bg: [8, 12, 22],
            node: 'rgba(59,130,246,',         // blue
            hub: 'rgba(99,102,241,',          // indigo
            line: 'rgba(59,130,246,',
            pulse: 'rgba(96,165,250,',        // light blue
            accent: 'rgba(34,197,94,',        // green accents
            grid: 'rgba(59,130,246,',
            text: 'rgba(148,163,184,',        // slate
            scan: 'rgba(59,130,246,',
        },
        midnight: {
            bg: [4, 6, 14],
            node: 'rgba(100,116,139,',
            hub: 'rgba(148,163,184,',
            line: 'rgba(100,116,139,',
            pulse: 'rgba(203,213,225,',
            accent: 'rgba(245,158,11,',
            grid: 'rgba(100,116,139,',
            text: 'rgba(100,116,139,',
            scan: 'rgba(148,163,184,',
        },
        slate: {
            bg: [15, 18, 25],
            node: 'rgba(120,130,150,',
            hub: 'rgba(180,190,210,',
            line: 'rgba(100,110,130,',
            pulse: 'rgba(200,210,230,',
            accent: 'rgba(56,189,248,',
            grid: 'rgba(100,110,130,',
            text: 'rgba(120,130,150,',
            scan: 'rgba(120,130,150,',
        },
    };

    const DEFAULTS = {
        canvasId: 'topology-bg',
        palette: 'corporate',
        nodeCount: [35, 70],
        nodeDensity: 22000,
        nodeRadiusRange: [3, 8],
        hubCount: [3, 6],
        hubRadius: [10, 16],
        connectDist: 180,
        hubConnectDist: 280,
        lineWidth: 0.4,
        pulseSpeed: 1.2,
        pulseFrequency: 0.012,
        mouseRadius: 200,
        mouseRevealDist: 250,
        driftSpeed: 0.15,
        breatheSpeed: 0.002,
        labelOpacity: 0.12,
        gridOverlay: true,
        gridSpacing: 60,
        gridOpacity: 0.025,
        scanLine: true,
        scanSpeed: 0.3,
        zIndex: 0,
    };

    /* ── Helpers ── */
    function rand(a, b) { return a + Math.random() * (b - a); }
    function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

    function init(userOpts) {
        const opts = Object.assign({}, DEFAULTS, userOpts || {});
        let pal = typeof opts.palette === 'string'
            ? (PALETTES[opts.palette] || PALETTES.corporate)
            : opts.palette;

        let canvas = document.getElementById(opts.canvasId);
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = opts.canvasId;
            canvas.style.cssText =
                'position:fixed;inset:0;pointer-events:none;width:100%;height:100%;z-index:' + opts.zIndex;
            document.body.insertBefore(canvas, document.body.firstChild);
        }
        const ctx = canvas.getContext('2d');

        let W, H, dpr;
        let nodes = [], connections = [], pulses = [];
        let time = 0, scanY = 0;
        const mouse = { x: -9999, y: -9999 };
        let rafId = null, destroyed = false;

        function resize() {
            dpr = window.devicePixelRatio || 1;
            W = window.innerWidth; H = window.innerHeight;
            canvas.width = W * dpr; canvas.height = H * dpr;
            canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        /* ── Hexagon path ── */
        function hexPath(ctx, x, y, r) {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i - Math.PI / 6;
                const px = x + r * Math.cos(a);
                const py = y + r * Math.sin(a);
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
        }

        /* ── Diamond path (for small nodes) ── */
        function diamondPath(ctx, x, y, r) {
            ctx.beginPath();
            ctx.moveTo(x, y - r);
            ctx.lineTo(x + r * 0.7, y);
            ctx.lineTo(x, y + r);
            ctx.lineTo(x - r * 0.7, y);
            ctx.closePath();
        }

        /* ── Build ── */
        function build() {
            const area = W * H;
            const count = Math.max(opts.nodeCount[0],
                Math.min(opts.nodeCount[1], Math.floor(area / opts.nodeDensity)));
            const hubCt = Math.floor(rand(opts.hubCount[0], opts.hubCount[1] + 1));

            nodes = [];

            // Hubs first — spread evenly with margin
            for (let i = 0; i < hubCt; i++) {
                nodes.push({
                    x: W * (0.15 + (i / (hubCt - 1 || 1)) * 0.7) + rand(-80, 80),
                    y: H * rand(0.2, 0.8),
                    ox: 0, oy: 0,
                    vx: rand(-1, 1) * opts.driftSpeed * 0.3,
                    vy: rand(-1, 1) * opts.driftSpeed * 0.3,
                    r: rand(opts.hubRadius[0], opts.hubRadius[1]),
                    isHub: true,
                    phase: rand(0, Math.PI * 2),
                    pulsePhase: rand(0, Math.PI * 2),
                    activity: 0,
                    shape: 'hex',
                });
            }

            // Regular nodes
            for (let i = 0; i < count - hubCt; i++) {
                const r = rand(opts.nodeRadiusRange[0], opts.nodeRadiusRange[1]);
                nodes.push({
                    x: rand(40, W - 40),
                    y: rand(40, H - 40),
                    ox: 0, oy: 0,
                    vx: rand(-1, 1) * opts.driftSpeed,
                    vy: rand(-1, 1) * opts.driftSpeed,
                    r,
                    isHub: false,
                    phase: rand(0, Math.PI * 2),
                    pulsePhase: rand(0, Math.PI * 2),
                    activity: 0,
                    shape: r > 5.5 ? 'hex' : (Math.random() < 0.5 ? 'diamond' : 'circle'),
                });
            }

            // Store origins
            for (const n of nodes) { n.ox = n.x; n.oy = n.y; }

            // Build connections
            buildConnections();
            pulses = [];
        }

        function buildConnections() {
            connections = [];
            for (let i = 0; i < nodes.length; i++) {
                const ni = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const nj = nodes[j];
                    const d = dist(ni.x, nj.x, ni.y, nj.y);
                    const maxD = (ni.isHub || nj.isHub) ? opts.hubConnectDist : opts.connectDist;
                    if (d < maxD) {
                        connections.push({
                            a: i, b: j, dist: d, maxDist: maxD,
                            visible: d < maxD * 0.7, // some hidden until mouse reveals
                        });
                    }
                }
            }
        }

        /* ── Update ── */
        function update() {
            time += opts.breatheSpeed;
            if (opts.scanLine) {
                scanY += opts.scanSpeed;
                if (scanY > H + 60) scanY = -60;
            }

            for (const n of nodes) {
                // Slow drift
                n.x += n.vx;
                n.y += n.vy;

                // Bounce softly
                const pad = n.r + 20;
                if (n.x < pad || n.x > W - pad) n.vx *= -1;
                if (n.y < pad || n.y > H - pad) n.vy *= -1;
                n.x = Math.max(pad, Math.min(W - pad, n.x));
                n.y = Math.max(pad, Math.min(H - pad, n.y));

                // Phase
                n.phase += opts.breatheSpeed * (n.isHub ? 0.8 : 1.2);
                n.pulsePhase += 0.015;

                // Mouse proximity → activity
                const md = dist(n.x, mouse.x, n.y, mouse.y);
                const targetAct = md < opts.mouseRadius ? ((opts.mouseRadius - md) / opts.mouseRadius) : 0;
                n.activity += (targetAct - n.activity) * 0.06;
            }

            // Reveal hidden connections near mouse
            for (const conn of connections) {
                const ni = nodes[conn.a], nj = nodes[conn.b];
                const mx = (ni.x + nj.x) / 2, my = (ni.y + nj.y) / 2;
                const md = dist(mx, mouse.x, my, mouse.y);
                if (md < opts.mouseRevealDist) conn.visible = true;
                // Slowly hide again
                else if (!conn.visible) { } // already hidden
                else if (md > opts.mouseRevealDist * 1.5 && Math.random() < 0.001) conn.visible = false;
            }

            // Spawn pulses
            if (Math.random() < opts.pulseFrequency && connections.length > 0) {
                const ci = Math.floor(Math.random() * connections.length);
                const conn = connections[ci];
                if (conn.visible) {
                    const forward = Math.random() < 0.5;
                    pulses.push({
                        connIdx: ci,
                        t: 0, // 0→1 progress
                        speed: opts.pulseSpeed * rand(0.6, 1.4) / Math.max(30, conn.dist),
                        forward,
                        size: rand(2, 4),
                    });
                }
            }

            // Update pulses
            for (let i = pulses.length - 1; i >= 0; i--) {
                pulses[i].t += pulses[i].speed;
                if (pulses[i].t > 1) {
                    // Activate destination node
                    const conn = connections[pulses[i].connIdx];
                    const destIdx = pulses[i].forward ? conn.b : conn.a;
                    nodes[destIdx].activity = Math.min(1, nodes[destIdx].activity + 0.3);
                    pulses.splice(i, 1);
                }
            }
        }

        /* ── Draw ── */
        function drawGrid() {
            if (!opts.gridOverlay) return;
            const sp = opts.gridSpacing;
            ctx.strokeStyle = pal.grid + opts.gridOpacity + ')';
            ctx.lineWidth = 0.5;

            ctx.beginPath();
            for (let x = sp; x < W; x += sp) {
                ctx.moveTo(x, 0); ctx.lineTo(x, H);
            }
            for (let y = sp; y < H; y += sp) {
                ctx.moveTo(0, y); ctx.lineTo(W, y);
            }
            ctx.stroke();

            // Corner markers at intersections near mouse
            if (mouse.x > -999) {
                const mR = 150;
                const startCol = Math.max(0, Math.floor((mouse.x - mR) / sp));
                const endCol = Math.min(Math.floor(W / sp), Math.ceil((mouse.x + mR) / sp));
                const startRow = Math.max(0, Math.floor((mouse.y - mR) / sp));
                const endRow = Math.min(Math.floor(H / sp), Math.ceil((mouse.y + mR) / sp));

                for (let c = startCol; c <= endCol; c++) {
                    for (let r = startRow; r <= endRow; r++) {
                        const gx = c * sp, gy = r * sp;
                        const d = dist(gx, mouse.x, gy, mouse.y);
                        if (d < mR) {
                            const alpha = ((mR - d) / mR) * 0.12;
                            ctx.strokeStyle = pal.accent + alpha + ')';
                            ctx.lineWidth = 0.6;
                            const mk = 4;
                            ctx.beginPath();
                            ctx.moveTo(gx - mk, gy); ctx.lineTo(gx + mk, gy);
                            ctx.moveTo(gx, gy - mk); ctx.lineTo(gx, gy + mk);
                            ctx.stroke();
                        }
                    }
                }
            }
        }

        function drawConnections() {
            for (const conn of connections) {
                if (!conn.visible) continue;
                const ni = nodes[conn.a], nj = nodes[conn.b];
                const d = dist(ni.x, nj.x, ni.y, nj.y);
                const fade = 1 - (d / conn.maxDist);
                const activity = Math.max(ni.activity, nj.activity);
                const alpha = fade * (0.06 + activity * 0.12);

                ctx.strokeStyle = pal.line + alpha + ')';
                ctx.lineWidth = opts.lineWidth + activity * 0.6;
                ctx.beginPath();
                ctx.moveTo(ni.x, ni.y);
                ctx.lineTo(nj.x, nj.y);
                ctx.stroke();

                // Dashed pattern for hub connections
                if (ni.isHub || nj.isHub) {
                    ctx.setLineDash([6, 8]);
                    ctx.strokeStyle = pal.line + (alpha * 0.4) + ')';
                    ctx.lineWidth = 0.3;
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }
        }

        function drawPulses() {
            for (const p of pulses) {
                const conn = connections[p.connIdx];
                const ni = nodes[conn.a], nj = nodes[conn.b];
                const ax = p.forward ? ni.x : nj.x;
                const ay = p.forward ? ni.y : nj.y;
                const bx = p.forward ? nj.x : ni.x;
                const by = p.forward ? nj.y : ni.y;

                const px = ax + (bx - ax) * p.t;
                const py = ay + (by - ay) * p.t;

                // Glow
                const grad = ctx.createRadialGradient(px, py, 0, px, py, p.size * 4);
                grad.addColorStop(0, pal.pulse + '0.4)');
                grad.addColorStop(1, pal.pulse + '0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(px, py, p.size * 4, 0, Math.PI * 2);
                ctx.fill();

                // Core dot
                ctx.beginPath();
                ctx.arc(px, py, p.size, 0, Math.PI * 2);
                ctx.fillStyle = pal.pulse + '0.9)';
                ctx.fill();
            }
        }

        function drawNodes() {
            // Sort: small behind, hubs in front
            const sorted = nodes.slice().sort((a, b) => a.r - b.r);

            for (const n of sorted) {
                const breathe = Math.sin(n.phase) * 0.15 + 1;
                const pulse = (Math.sin(n.pulsePhase) + 1) / 2;
                const r = n.r * breathe;
                const act = n.activity;

                const baseAlpha = n.isHub ? 0.25 : 0.12;
                const alpha = baseAlpha + act * 0.5 + pulse * 0.05;
                const strokeAlpha = (n.isHub ? 0.4 : 0.2) + act * 0.5;

                const nodeColor = n.isHub ? pal.hub : pal.node;

                // Shape
                if (n.shape === 'hex') hexPath(ctx, n.x, n.y, r);
                else if (n.shape === 'diamond') diamondPath(ctx, n.x, n.y, r);
                else { ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); }

                // Fill
                ctx.fillStyle = nodeColor + alpha + ')';
                ctx.fill();

                // Stroke
                ctx.strokeStyle = nodeColor + strokeAlpha + ')';
                ctx.lineWidth = n.isHub ? 1.2 : 0.7;
                ctx.stroke();

                // Inner dot
                if (n.isHub) {
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = nodeColor + (0.6 + act * 0.4) + ')';
                    ctx.fill();
                }

                // Activity ring
                if (act > 0.1) {
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, r + 6 + act * 4, 0, Math.PI * 2);
                    ctx.strokeStyle = pal.accent + (act * 0.15) + ')';
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }

                // Hub outer glow
                if (n.isHub && act > 0.05) {
                    const gR = r * 3;
                    const grad = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, gR);
                    grad.addColorStop(0, nodeColor + (act * 0.08) + ')');
                    grad.addColorStop(1, nodeColor + '0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, gR, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        function drawScanLine() {
            if (!opts.scanLine) return;
            const grad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
            grad.addColorStop(0, pal.scan + '0)');
            grad.addColorStop(0.5, pal.scan + '0.03)');
            grad.addColorStop(1, pal.scan + '0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, scanY - 30, W, 60);

            // Activate nodes near scan line
            for (const n of nodes) {
                if (Math.abs(n.y - scanY) < 40) {
                    n.activity = Math.min(1, n.activity + 0.005);
                }
            }
        }

        function drawMouseIndicator() {
            if (mouse.x < -999) return;
            // Subtle crosshair
            ctx.strokeStyle = pal.accent + '0.08)';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([4, 8]);
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y - 40);
            ctx.lineTo(mouse.x, mouse.y + 40);
            ctx.moveTo(mouse.x - 40, mouse.y);
            ctx.lineTo(mouse.x + 40, mouse.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Radius ring
            ctx.beginPath();
            ctx.arc(mouse.x, mouse.y, opts.mouseRadius, 0, Math.PI * 2);
            ctx.strokeStyle = pal.accent + '0.04)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        /* ── Events ── */
        function onMove(e) { mouse.x = e.clientX; mouse.y = e.clientY; }
        function onTouch(e) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }
        function onLeave() { mouse.x = -9999; mouse.y = -9999; }
        function onResize() { resize(); build(); }

        window.addEventListener('resize', onResize);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onTouch, { passive: true });
        window.addEventListener('mouseleave', onLeave);

        /* ── Loop ── */
        function loop() {
            if (destroyed) return;
            const bg = pal.bg;
            ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
            ctx.fillRect(0, 0, W, H);

            drawGrid();
            drawScanLine();
            update();
            drawConnections();
            drawPulses();
            drawNodes();
            drawMouseIndicator();

            rafId = requestAnimationFrame(loop);
        }

        resize();
        build();
        loop();

        return {
            setOptions(newOpts) {
                Object.assign(opts, newOpts);
                if (newOpts.palette) {
                    pal = typeof newOpts.palette === 'string'
                        ? (PALETTES[newOpts.palette] || PALETTES.corporate)
                        : newOpts.palette;
                    build();
                }
            },
            rebuild() { resize(); build(); },
            destroy() {
                destroyed = true;
                if (rafId) cancelAnimationFrame(rafId);
                window.removeEventListener('resize', onResize);
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('touchmove', onTouch);
                window.removeEventListener('mouseleave', onLeave);
                if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            },
        };
    }

    function autoInit() {
        const instance = init(global.TopologyWidgetOptions || {});
        global.TopologyWidget = { init, instance };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else { autoInit(); }

})(window);