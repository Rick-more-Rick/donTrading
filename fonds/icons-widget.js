/*!
 * icons-widget.js — Fondo de íconos financieros interactivos
 * DONTRADING © 2026
 *
 * Íconos SVG dibujados en canvas: gráficas de barras, flechas de tendencia,
 * escudos, targets, rayos, billeteras, lingotes, etc.
 * Sin texto — todo es path vectorial.
 *
 * USO:
 *   <script src="icons-widget.js"></script>
 *
 *   Opcional:
 *   <script>
 *     window.IconsWidgetOptions = {
 *       repelRadius: 140,
 *       connectDist: 155,
 *       palette: 'gold' // 'gold' | 'cyber' | 'mint'
 *     };
 *   </script>
 */
(function (global) {
    'use strict';

    /* ── Paletas ── */
    const PALETTES = {
        gold: {
            primary: ['#f59e0b', '#fbbf24', '#d97706'],
            secondary: ['#22c55e', '#4ade80', '#16a34a'],
            tertiary: ['#3b82f6', '#60a5fa', '#2563eb'],
            accent: ['#a78bfa', '#c084fc'],
            neutral: ['#94a3b8', '#cbd5e1', '#e2e8f0'],
            line: '#f59e0b',
        },
        cyber: {
            primary: ['#00e5ff', '#18ffff', '#0097a7'],
            secondary: ['#00ff87', '#69f0ae', '#00c853'],
            tertiary: ['#7c4dff', '#b388ff', '#651fff'],
            accent: ['#ff4081', '#ff80ab'],
            neutral: ['#90a4ae', '#b0bec5', '#eceff1'],
            line: '#00e5ff',
        },
        mint: {
            primary: ['#10b981', '#34d399', '#059669'],
            secondary: ['#f59e0b', '#fbbf24', '#d97706'],
            tertiary: ['#6366f1', '#818cf8', '#4f46e5'],
            accent: ['#f43f5e', '#fb7185'],
            neutral: ['#9ca3af', '#d1d5db', '#f3f4f6'],
            line: '#14b8a6',
        },
    };

    const DEFAULTS = {
        canvasId: 'icons-bg',
        countMin: 45,
        countMax: 100,
        countDensity: 14000,
        repelRadius: 145,
        connectDist: 155,
        lineOpacity: 0.055,
        palette: 'gold',
        glowProb: 0.22,
        glowActivateProb: 0.0008,
    };

    /* ════════════════════════════════════════════════════
     *  ICON DRAWERS — cada función dibuja un ícono centrado
     *  en (0,0) con tamaño `s` y color `c`, glow `g` (0-1)
     * ════════════════════════════════════════════════════ */

    function drawIconBarChart(ctx, s, c, g) {
        const rgb = hexRgb(c);
        const bw = s * 0.18;
        const gap = s * 0.06;
        const heights = [0.45, 0.75, 0.55, 1.0, 0.65];
        const totalW = heights.length * bw + (heights.length - 1) * gap;
        const startX = -totalW / 2;

        // Glow
        if (g > 0.03) {
            ctx.shadowBlur = g * 22;
            ctx.shadowColor = c;
        }

        for (let i = 0; i < heights.length; i++) {
            const bh = s * heights[i];
            const x = startX + i * (bw + gap);
            const y = s * 0.5 - bh;

            const grad = ctx.createLinearGradient(x, y, x, s * 0.5);
            grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.9 + g * 0.1})`);
            grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0.4)`);
            ctx.fillStyle = grad;

            // Rounded top
            const rr = bw * 0.3;
            ctx.beginPath();
            ctx.moveTo(x + rr, y);
            ctx.lineTo(x + bw - rr, y);
            ctx.quadraticCurveTo(x + bw, y, x + bw, y + rr);
            ctx.lineTo(x + bw, s * 0.5);
            ctx.lineTo(x, s * 0.5);
            ctx.lineTo(x, y + rr);
            ctx.quadraticCurveTo(x, y, x + rr, y);
            ctx.closePath();
            ctx.fill();

            // Shine strip
            ctx.fillStyle = `rgba(255,255,255,${0.12 + g * 0.15})`;
            ctx.fillRect(x + 1, y + rr, bw * 0.3, bh - rr - 1);
        }

        // Base line
        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.3)`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-totalW / 2 - s * 0.08, s * 0.5);
        ctx.lineTo(totalW / 2 + s * 0.08, s * 0.5);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function drawIconTrendUp(ctx, s, c, g) {
        const rgb = hexRgb(c);
        if (g > 0.03) { ctx.shadowBlur = g * 20; ctx.shadowColor = c; }

        // Arrow path going up-right
        ctx.beginPath();
        ctx.moveTo(-s * 0.45, s * 0.35);
        ctx.quadraticCurveTo(-s * 0.1, s * 0.1, s * 0.1, -s * 0.15);
        ctx.lineTo(s * 0.4, -s * 0.4);
        ctx.strokeStyle = c;
        ctx.lineWidth = s * 0.08;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Arrowhead
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(s * 0.45, -s * 0.45);
        ctx.lineTo(s * 0.18, -s * 0.38);
        ctx.lineTo(s * 0.32, -s * 0.18);
        ctx.closePath();
        ctx.fill();

        // Small line below (support)
        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.25)`;
        ctx.lineWidth = 0.6;
        ctx.setLineDash([s * 0.06, s * 0.04]);
        ctx.beginPath();
        ctx.moveTo(-s * 0.45, s * 0.45);
        ctx.lineTo(s * 0.45, s * 0.45);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
    }

    function drawIconTrendDown(ctx, s, c, g) {
        const rgb = hexRgb(c);
        if (g > 0.03) { ctx.shadowBlur = g * 20; ctx.shadowColor = c; }

        ctx.beginPath();
        ctx.moveTo(-s * 0.45, -s * 0.35);
        ctx.quadraticCurveTo(-s * 0.1, -s * 0.1, s * 0.1, s * 0.15);
        ctx.lineTo(s * 0.4, s * 0.4);
        ctx.strokeStyle = c;
        ctx.lineWidth = s * 0.08;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(s * 0.45, s * 0.45);
        ctx.lineTo(s * 0.18, s * 0.38);
        ctx.lineTo(s * 0.32, s * 0.18);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function drawIconShield(ctx, s, c, g) {
        const rgb = hexRgb(c);
        if (g > 0.03) { ctx.shadowBlur = g * 22; ctx.shadowColor = c; }

        // Shield shape
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.48);
        ctx.quadraticCurveTo(s * 0.48, -s * 0.38, s * 0.44, -s * 0.05);
        ctx.quadraticCurveTo(s * 0.38, s * 0.28, 0, s * 0.50);
        ctx.quadraticCurveTo(-s * 0.38, s * 0.28, -s * 0.44, -s * 0.05);
        ctx.quadraticCurveTo(-s * 0.48, -s * 0.38, 0, -s * 0.48);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, -s * 0.5, 0, s * 0.5);
        grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.35 + g * 0.3})`);
        grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0.08)`);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.5 + g * 0.4})`;
        ctx.lineWidth = s * 0.04;
        ctx.stroke();

        // Checkmark inside
        ctx.beginPath();
        ctx.moveTo(-s * 0.15, s * 0.02);
        ctx.lineTo(-s * 0.03, s * 0.15);
        ctx.lineTo(s * 0.18, -s * 0.12);
        ctx.strokeStyle = `rgba(255,255,255,${0.5 + g * 0.4})`;
        ctx.lineWidth = s * 0.06;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function drawIconTarget(ctx, s, c, g) {
        const rgb = hexRgb(c);
        if (g > 0.03) { ctx.shadowBlur = g * 18; ctx.shadowColor = c; }

        const rings = [0.45, 0.30, 0.15];
        for (let i = 0; i < rings.length; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, s * rings[i], 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.3 + i * 0.2 + g * 0.3})`;
            ctx.lineWidth = s * 0.03;
            ctx.stroke();
        }

        // Center dot
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.05, 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.fill();

        // Crosshair lines
        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.48); ctx.lineTo(0, s * 0.48);
        ctx.moveTo(-s * 0.48, 0); ctx.lineTo(s * 0.48, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function drawIconLightning(ctx, s, c, g) {
        const rgb = hexRgb(c);
        if (g > 0.03) { ctx.shadowBlur = g * 25; ctx.shadowColor = c; }

        ctx.beginPath();
        ctx.moveTo(s * 0.05, -s * 0.5);
        ctx.lineTo(-s * 0.22, -s * 0.02);
        ctx.lineTo(s * 0.0, -s * 0.02);
        ctx.lineTo(-s * 0.08, s * 0.5);
        ctx.lineTo(s * 0.25, s * 0.0);
        ctx.lineTo(s * 0.02, s * 0.0);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, -s * 0.5, 0, s * 0.5);
        grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.85 + g * 0.15})`);
        grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0.4)`);
        ctx.fillStyle = grad;
        ctx.fill();

        // Edge glow
        ctx.strokeStyle = `rgba(255,255,255,${0.15 + g * 0.3})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function drawIconPieChart(ctx, s, c, g) {
        const rgb = hexRgb(c);
        if (g > 0.03) { ctx.shadowBlur = g * 18; ctx.shadowColor = c; }

        const r = s * 0.4;
        const slices = [
            { start: 0, end: Math.PI * 0.7, alpha: 0.8 },
            { start: Math.PI * 0.7, end: Math.PI * 1.4, alpha: 0.5 },
            { start: Math.PI * 1.4, end: Math.PI * 2, alpha: 0.3 },
        ];

        for (const sl of slices) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, r, sl.start - Math.PI / 2, sl.end - Math.PI / 2);
            ctx.closePath();
            ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${sl.alpha + g * 0.2})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(0,0,0,0.3)`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }

        // Inner circle cutout effect
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6,8,13,${0.7 + g * 0.1})`;
        ctx.fill();

        // Shine
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        const shine = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
        shine.addColorStop(0, `rgba(255,255,255,${0.08 + g * 0.1})`);
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = shine;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function drawIconGoldBar(ctx, s, c, g) {
        const rgb = hexRgb(c);
        if (g > 0.03) { ctx.shadowBlur = g * 20; ctx.shadowColor = c; }

        // 3D trapezoid gold bar
        const tw = s * 0.3;  // top width
        const bw = s * 0.48; // bottom width
        const h = s * 0.28;
        const depth = s * 0.12;

        // Top face
        ctx.beginPath();
        ctx.moveTo(-tw, -h / 2 - depth);
        ctx.lineTo(tw, -h / 2 - depth);
        ctx.lineTo(bw, -h / 2);
        ctx.lineTo(-bw, -h / 2);
        ctx.closePath();
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.9 + g * 0.1})`;
        ctx.fill();

        // Front face
        const fGrad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
        fGrad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.8 + g * 0.1})`);
        fGrad.addColorStop(1, `rgba(${Math.max(0, rgb.r - 40)},${Math.max(0, rgb.g - 40)},${Math.max(0, rgb.b - 20)},0.7)`);
        ctx.beginPath();
        ctx.moveTo(-bw, -h / 2);
        ctx.lineTo(bw, -h / 2);
        ctx.lineTo(bw, h / 2);
        ctx.lineTo(-bw, h / 2);
        ctx.closePath();
        ctx.fillStyle = fGrad;
        ctx.fill();

        // Right side face
        ctx.beginPath();
        ctx.moveTo(bw, -h / 2);
        ctx.lineTo(tw, -h / 2 - depth);
        ctx.lineTo(tw, -h / 2 - depth + h);
        ctx.lineTo(bw, h / 2);
        ctx.closePath();
        ctx.fillStyle = `rgba(${Math.max(0, rgb.r - 50)},${Math.max(0, rgb.g - 50)},${Math.max(0, rgb.b - 30)},0.6)`;
        ctx.fill();

        // Edges
        ctx.strokeStyle = `rgba(255,255,255,${0.1 + g * 0.2})`;
        ctx.lineWidth = 0.4;
        ctx.strokeRect(-bw, -h / 2, bw * 2, h);

        // Top shine
        ctx.fillStyle = `rgba(255,255,255,${0.08 + g * 0.12})`;
        ctx.beginPath();
        ctx.moveTo(-tw, -h / 2 - depth);
        ctx.lineTo(tw * 0.3, -h / 2 - depth);
        ctx.lineTo(bw * 0.3, -h / 2);
        ctx.lineTo(-bw, -h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function drawIconWallet(ctx, s, c, g) {
        const rgb = hexRgb(c);
        if (g > 0.03) { ctx.shadowBlur = g * 18; ctx.shadowColor = c; }

        const w = s * 0.45;
        const h = s * 0.35;
        const rr = s * 0.06;

        // Body
        ctx.beginPath();
        ctx.moveTo(-w + rr, -h);
        ctx.lineTo(w - rr, -h);
        ctx.quadraticCurveTo(w, -h, w, -h + rr);
        ctx.lineTo(w, h - rr);
        ctx.quadraticCurveTo(w, h, w - rr, h);
        ctx.lineTo(-w + rr, h);
        ctx.quadraticCurveTo(-w, h, -w, h - rr);
        ctx.lineTo(-w, -h + rr);
        ctx.quadraticCurveTo(-w, -h, -w + rr, -h);
        ctx.closePath();

        const wGrad = ctx.createLinearGradient(-w, -h, w, h);
        wGrad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.4 + g * 0.3})`);
        wGrad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0.15)`);
        ctx.fillStyle = wGrad;
        ctx.fill();
        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.5 + g * 0.4})`;
        ctx.lineWidth = s * 0.03;
        ctx.stroke();

        // Flap
        ctx.beginPath();
        ctx.moveTo(-w, -h * 0.3);
        ctx.lineTo(-w - s * 0.06, -h * 0.5);
        ctx.lineTo(w * 0.3, -h * 0.5);
        ctx.lineTo(w * 0.3, -h * 0.3);
        ctx.closePath();
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.3 + g * 0.2})`;
        ctx.fill();

        // Clasp circle
        ctx.beginPath();
        ctx.arc(w * 0.65, 0, s * 0.07, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.35 + g * 0.4})`;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function drawIconCandlestick(ctx, s, c, g) {
        const rgb = hexRgb(c);
        if (g > 0.03) { ctx.shadowBlur = g * 20; ctx.shadowColor = c; }

        // Three mini candles side by side
        const candles = [
            { x: -s * 0.22, h: 0.5, wick: 0.25, bull: false },
            { x: 0, h: 0.7, wick: 0.2, bull: true },
            { x: s * 0.22, h: 0.4, wick: 0.3, bull: true },
        ];
        const bw = s * 0.12;

        for (const cd of candles) {
            const bh = s * cd.h;
            const wh = s * cd.wick;
            const topY = cd.bull ? -bh / 2 : -bh / 2 + bh * 0.1;

            // Wick
            ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.4)`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(cd.x, topY - wh);
            ctx.lineTo(cd.x, topY + bh + wh * 0.6);
            ctx.stroke();

            // Body
            const bGrad = ctx.createLinearGradient(cd.x, topY, cd.x, topY + bh);
            if (cd.bull) {
                bGrad.addColorStop(0, `rgba(34,197,94,${0.7 + g * 0.3})`);
                bGrad.addColorStop(1, `rgba(22,163,74,0.4)`);
            } else {
                bGrad.addColorStop(0, `rgba(239,68,68,${0.7 + g * 0.3})`);
                bGrad.addColorStop(1, `rgba(220,38,38,0.4)`);
            }
            ctx.fillStyle = bGrad;
            ctx.fillRect(cd.x - bw / 2, topY, bw, bh);

            // Shine
            ctx.fillStyle = `rgba(255,255,255,${0.08 + g * 0.1})`;
            ctx.fillRect(cd.x - bw / 2, topY, bw * 0.3, bh);
        }
        ctx.shadowBlur = 0;
    }

    function drawIconLineChart(ctx, s, c, g) {
        const rgb = hexRgb(c);
        if (g > 0.03) { ctx.shadowBlur = g * 18; ctx.shadowColor = c; }

        // Axes
        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.25)`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(-s * 0.42, -s * 0.4);
        ctx.lineTo(-s * 0.42, s * 0.4);
        ctx.lineTo(s * 0.45, s * 0.4);
        ctx.stroke();

        // Line
        const pts = [
            [-0.35, 0.15], [-0.18, -0.05], [-0.02, 0.1],
            [0.12, -0.2], [0.25, -0.1], [0.38, -0.35]
        ];
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
            const px = pts[i][0] * s;
            const py = pts[i][1] * s;
            if (i === 0) ctx.moveTo(px, py);
            else {
                const prev = pts[i - 1];
                const cpx = ((prev[0] + pts[i][0]) / 2) * s;
                ctx.quadraticCurveTo(cpx, prev[1] * s, px, py);
            }
        }
        ctx.strokeStyle = c;
        ctx.lineWidth = s * 0.05;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Area fill
        ctx.lineTo(pts[pts.length - 1][0] * s, s * 0.4);
        ctx.lineTo(pts[0][0] * s, s * 0.4);
        ctx.closePath();
        const aGrad = ctx.createLinearGradient(0, -s * 0.35, 0, s * 0.4);
        aGrad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.12 + g * 0.15})`);
        aGrad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
        ctx.fillStyle = aGrad;
        ctx.fill();

        // End dot
        const last = pts[pts.length - 1];
        ctx.beginPath();
        ctx.arc(last[0] * s, last[1] * s, s * 0.04, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.7 + g * 0.3})`;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    /* ── Registro de íconos ── */
    const ICON_TYPES = [
        { name: 'barChart', draw: drawIconBarChart, colorGroup: 'primary' },
        { name: 'trendUp', draw: drawIconTrendUp, colorGroup: 'secondary' },
        { name: 'trendDown', draw: drawIconTrendDown, colorGroup: 'accent' },
        { name: 'shield', draw: drawIconShield, colorGroup: 'secondary' },
        { name: 'target', draw: drawIconTarget, colorGroup: 'tertiary' },
        { name: 'lightning', draw: drawIconLightning, colorGroup: 'primary' },
        { name: 'pieChart', draw: drawIconPieChart, colorGroup: 'tertiary' },
        { name: 'goldBar', draw: drawIconGoldBar, colorGroup: 'primary' },
        { name: 'wallet', draw: drawIconWallet, colorGroup: 'primary' },
        { name: 'candlestick', draw: drawIconCandlestick, colorGroup: 'primary' },
        { name: 'lineChart', draw: drawIconLineChart, colorGroup: 'secondary' },
    ];

    /* ── Helpers ── */
    function hexRgb(hex) {
        return {
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16),
        };
    }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    /* ════════════════════════════════════
     *  INIT
     * ════════════════════════════════════ */
    function init(userOpts) {
        const opts = Object.assign({}, DEFAULTS, userOpts || {});
        let pal = PALETTES[opts.palette] || PALETTES.gold;

        let canvas = document.getElementById(opts.canvasId);
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = opts.canvasId;
            canvas.style.cssText =
                'position:fixed;inset:0;z-index:0;pointer-events:none;width:100%;height:100%';
            document.body.insertBefore(canvas, document.body.firstChild);
        }
        const ctx = canvas.getContext('2d');
        const mouse = { x: -9999, y: -9999 };
        let W = 0, H = 0, particles = [];

        function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
        resize();
        window.addEventListener('resize', () => { resize(); buildParticles(); });
        window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
        window.addEventListener('touchmove', e => {
            mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY;
        }, { passive: true });
        window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

        /* ── Partícula ── */
        class Particle {
            constructor() { this.reset(); }
            reset() {
                this.x = Math.random() * W;
                this.y = Math.random() * H;
                this.vx = (Math.random() - 0.5) * 0.5;
                this.vy = (Math.random() - 0.5) * 0.5;
                this.angle = Math.random() * Math.PI * 2;
                this.rotSpeed = (Math.random() - 0.5) * 0.006;

                // Tamaño con distribución
                const r = Math.random();
                if (r < 0.5) this.size = Math.random() * 12 + 8;
                else if (r < 0.82) this.size = Math.random() * 16 + 14;
                else this.size = Math.random() * 12 + 22;

                this.baseAlpha = Math.random() * 0.28 + 0.05;
                this.alpha = this.baseAlpha;
                this.pulsePhase = Math.random() * Math.PI * 2;
                this.pulseSpeed = 0.003 + Math.random() * 0.010;
                this.glowPhase = Math.random() * Math.PI * 2;
                this.glowSpeed = 0.005 + Math.random() * 0.016;
                this.glowVal = 0;
                this.glowing = Math.random() < opts.glowProb;

                // Asignar ícono
                const iconDef = pick(ICON_TYPES);
                this.iconDraw = iconDef.draw;
                this.color = pick(pal[iconDef.colorGroup] || pal.primary);
            }
            update() {
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const d2 = dx * dx + dy * dy;
                const R = opts.repelRadius;
                if (d2 < R * R && d2 > 0) {
                    const d = Math.sqrt(d2);
                    const f = (R - d) / R;
                    this.vx += (dx / d) * f * f * 1.3;
                    this.vy += (dy / d) * f * f * 1.3;
                }
                const spd = Math.hypot(this.vx, this.vy);
                if (spd > 3.5) { this.vx = this.vx / spd * 3.5; this.vy = this.vy / spd * 3.5; }
                this.vx *= 0.985; this.vy *= 0.985;
                this.x += this.vx; this.y += this.vy;
                this.angle += this.rotSpeed;
                this.pulsePhase += this.pulseSpeed;
                this.glowPhase += this.glowSpeed;
                if (!this.glowing && Math.random() < opts.glowActivateProb) this.glowing = true;
                if (this.glowing) {
                    const raw = (Math.sin(this.glowPhase) + 1) / 2;
                    this.glowVal = raw * raw;
                    if (this.glowPhase > Math.PI * 6 && Math.random() < 0.015) {
                        this.glowing = false; this.glowVal = 0; this.glowPhase = 0;
                    }
                } else { this.glowVal *= 0.95; }
                this.alpha = this.baseAlpha + this.glowVal * 0.50;
                const pad = this.size + 20;
                if (this.x < -pad) this.x = W + pad;
                if (this.x > W + pad) this.x = -pad;
                if (this.y < -pad) this.y = H + pad;
                if (this.y > H + pad) this.y = -pad;
            }
            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(Math.sin(this.angle) * 0.12); // gentle wobble
                ctx.globalAlpha = Math.min(1, this.alpha);
                this.iconDraw(ctx, this.size, this.color, this.glowVal);
                ctx.restore();
            }
        }

        /* ── Conexiones ── */
        function drawConnections() {
            const MAX = opts.connectDist, MAX2 = MAX * MAX;
            for (let i = 0; i < particles.length; i++) {
                const pi = particles[i];
                for (let j = i + 1; j < particles.length; j++) {
                    const pj = particles[j];
                    const dx = pi.x - pj.x, dy = pi.y - pj.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < MAX2) {
                        const d = Math.sqrt(d2);
                        const glow = Math.max(pi.glowVal, pj.glowVal);
                        ctx.save();
                        ctx.globalAlpha = (1 - d / MAX) * opts.lineOpacity + glow * 0.03;
                        ctx.strokeStyle = pal.line;
                        ctx.lineWidth = 0.3 + glow * 0.5;
                        ctx.beginPath();
                        ctx.moveTo(pi.x, pi.y); ctx.lineTo(pj.x, pj.y);
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            }
        }

        function buildParticles() {
            const n = Math.max(opts.countMin, Math.min(opts.countMax, Math.floor((W * H) / opts.countDensity)));
            particles = Array.from({ length: n }, () => new Particle());
        }
        buildParticles();

        function loop() {
            ctx.clearRect(0, 0, W, H);
            drawConnections();
            // Sort by size for depth
            particles.sort((a, b) => a.size - b.size);
            for (const p of particles) { p.update(); p.draw(); }
            requestAnimationFrame(loop);
        }
        loop();

        return {
            setOptions: (newOpts) => {
                Object.assign(opts, newOpts);
                if (newOpts.palette) {
                    pal = PALETTES[newOpts.palette] || PALETTES.gold;
                    buildParticles();
                }
            },
            rebuild: buildParticles,
        };
    }

    function autoInit() {
        const instance = init(global.IconsWidgetOptions || {});
        global.IconsWidget = { init, instance };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else { autoInit(); }
})(window);