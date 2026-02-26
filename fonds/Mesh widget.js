/*!
 * mesh-widget.js — Malla deformable interactiva
 * Fondo de cuadrícula elástica que responde al mouse
 *
 * USO:
 *   <script src="mesh-widget.js"></script>
 *
 *   Opcional (antes de cargar el script):
 *   <script>
 *     window.MeshWidgetOptions = {
 *       canvasId: 'mesh-bg',         // ID del canvas (se crea si no existe)
 *       palette: 'gold',             // 'gold' | 'cyber' | 'emerald' | objeto custom
 *       spacing: 0,                  // 0 = auto (recomendado) | número fijo en px
 *       repelRadius: 180,            // radio de repulsión del mouse
 *       repelStrength: 55,           // fuerza de repulsión
 *       attractOnClick: true,        // click atrae nodos en vez de repeler
 *       attractStrength: 0.4,        // multiplicador de atracción (0-1)
 *       springForce: 0.045,          // fuerza del resorte para volver al origen
 *       damping: 0.88,              // fricción (0-1, mayor = menos fricción)
 *       clickWaveForce: 30,          // impulso al hacer click
 *       dotMinWave: 0.02,           // umbral mínimo para mostrar puntos
 *       dotMaxRadius: 3,            // radio máximo de puntos desplazados
 *       glowThreshold: 0.4,         // umbral de wave para activar glow
 *       lineWidth: 0.5,             // grosor de las líneas de la malla
 *       lineOpacity: 0.07,          // opacidad base de las líneas
 *       mouseGlow: true,            // halo de luz alrededor del mouse
 *       mouseGlowRadius: 180,       // radio del halo
 *       mouseGlowIntensity: 0.06,   // intensidad del halo
 *       zIndex: 0,                  // z-index del canvas
 *     };
 *   </script>
 *
 *   Paleta personalizada:
 *   window.MeshWidgetOptions = {
 *     palette: {
 *       primary: '#f59e0b',
 *       accent: '#22c55e',
 *       glow: 'rgba(245,158,11,',   // sin cerrar paréntesis
 *       bg: [6, 8, 13],             // RGB del fondo para clear
 *     }
 *   };
 *
 *   API pública (después de cargar):
 *   MeshWidget.setOptions({ palette: 'cyber', repelRadius: 200 });
 *   MeshWidget.rebuild();
 *   MeshWidget.destroy();
 */
(function (global) {
    'use strict';

    /* ── Paletas ── */
    const PALETTES = {
        gold: {
            primary: '#f59e0b',
            accent: '#22c55e',
            glow: 'rgba(245,158,11,',
            bg: [6, 8, 13],
        },
        cyber: {
            primary: '#00e5ff',
            accent: '#7c4dff',
            glow: 'rgba(0,229,255,',
            bg: [4, 8, 16],
        },
        emerald: {
            primary: '#10b981',
            accent: '#f59e0b',
            glow: 'rgba(16,185,129,',
            bg: [5, 10, 8],
        },
    };

    const DEFAULTS = {
        canvasId: 'mesh-bg',
        palette: 'gold',
        spacing: 0,
        repelRadius: 180,
        repelStrength: 55,
        attractOnClick: true,
        attractStrength: 0.4,
        springForce: 0.045,
        damping: 0.88,
        clickWaveForce: 30,
        dotMinWave: 0.02,
        dotMaxRadius: 3,
        glowThreshold: 0.4,
        lineWidth: 0.5,
        lineOpacity: 0.07,
        mouseGlow: true,
        mouseGlowRadius: 180,
        mouseGlowIntensity: 0.06,
        zIndex: 0,
    };

    /* ── Helpers ── */
    function hexRgb(hex) {
        return {
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16),
        };
    }
    function lerp(a, b, t) { return a + (b - a) * t; }

    /* ── Init ── */
    function init(userOpts) {
        const opts = Object.assign({}, DEFAULTS, userOpts || {});
        let pal = typeof opts.palette === 'string'
            ? (PALETTES[opts.palette] || PALETTES.gold)
            : opts.palette;

        /* Canvas */
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
        let nodes = [], cols = 0, rows = 0;
        const mouse = { x: -9999, y: -9999, pressed: false, clickWave: 0 };
        let rafId = null;
        let destroyed = false;

        /* Resize */
        function resize() {
            dpr = window.devicePixelRatio || 1;
            W = window.innerWidth;
            H = window.innerHeight;
            canvas.width = W * dpr;
            canvas.height = H * dpr;
            canvas.style.width = W + 'px';
            canvas.style.height = H + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        /* Build grid */
        function build() {
            const sp = opts.spacing > 0 ? opts.spacing : Math.max(28, Math.min(45, W / 38));
            cols = Math.ceil(W / sp) + 4;
            rows = Math.ceil(H / sp) + 4;
            nodes = [];
            const offX = -(cols * sp - W) / 2;
            const offY = -(rows * sp - H) / 2;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const ox = offX + c * sp;
                    const oy = offY + r * sp;
                    nodes.push({ ox, oy, x: ox, y: oy, vx: 0, vy: 0, wave: 0, row: r, col: c });
                }
            }
        }

        /* Events */
        function onMove(e) { mouse.x = e.clientX; mouse.y = e.clientY; }
        function onTouch(e) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }
        function onLeave() { mouse.x = -9999; mouse.y = -9999; }
        function onDown() { mouse.pressed = true; mouse.clickWave = 1; }
        function onUp() { mouse.pressed = false; }

        window.addEventListener('resize', () => { resize(); build(); });
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onTouch, { passive: true });
        window.addEventListener('mouseleave', onLeave);
        window.addEventListener('mousedown', onDown);
        window.addEventListener('mouseup', onUp);

        /* Update */
        function update() {
            if (mouse.clickWave > 0) mouse.clickWave *= 0.965;
            if (mouse.clickWave < 0.01) mouse.clickWave = 0;

            const R = opts.repelRadius;
            const STR = opts.repelStrength;
            const SP = opts.springForce;
            const DMP = opts.damping;

            for (const n of nodes) {
                const dx = n.x - mouse.x;
                const dy = n.y - mouse.y;
                const d = Math.sqrt(dx * dx + dy * dy);

                if (d < R && d > 0.1) {
                    const f = ((R - d) / R);
                    const ff = f * f;
                    if (mouse.pressed && opts.attractOnClick) {
                        n.vx -= (dx / d) * ff * STR * opts.attractStrength;
                        n.vy -= (dy / d) * ff * STR * opts.attractStrength;
                    } else {
                        n.vx += (dx / d) * ff * STR;
                        n.vy += (dy / d) * ff * STR;
                    }
                    if (mouse.clickWave > 0.1) {
                        const wf = mouse.clickWave * ff * opts.clickWaveForce;
                        n.vx += (dx / d) * wf;
                        n.vy += (dy / d) * wf;
                    }
                }

                n.vx += (n.ox - n.x) * SP;
                n.vy += (n.oy - n.y) * SP;
                n.vx *= DMP;
                n.vy *= DMP;
                n.x += n.vx;
                n.y += n.vy;
                n.wave = Math.min(1, Math.hypot(n.x - n.ox, n.y - n.oy) / 40);
            }
        }

        /* Draw */
        function draw() {
            const bg = pal.bg;
            ctx.fillStyle = `rgba(${bg[0]},${bg[1]},${bg[2]},1)`;
            ctx.fillRect(0, 0, W, H);

            const rgb = hexRgb(pal.primary);
            const rgbA = hexRgb(pal.accent);

            // Horizontal lines
            for (let r = 0; r < rows; r++) {
                ctx.beginPath();
                for (let c = 0; c < cols; c++) {
                    const n = nodes[r * cols + c];
                    if (c === 0) ctx.moveTo(n.x, n.y); else ctx.lineTo(n.x, n.y);
                }
                ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${opts.lineOpacity})`;
                ctx.lineWidth = opts.lineWidth;
                ctx.stroke();
            }

            // Vertical lines
            for (let c = 0; c < cols; c++) {
                ctx.beginPath();
                for (let r = 0; r < rows; r++) {
                    const n = nodes[r * cols + c];
                    if (r === 0) ctx.moveTo(n.x, n.y); else ctx.lineTo(n.x, n.y);
                }
                ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${opts.lineOpacity})`;
                ctx.lineWidth = opts.lineWidth;
                ctx.stroke();
            }

            // Displaced dots
            for (const n of nodes) {
                if (n.wave < opts.dotMinWave) continue;
                const rad = 1 + n.wave * opts.dotMaxRadius;
                const alpha = 0.15 + n.wave * 0.8;
                const cr = Math.round(lerp(rgb.r, rgbA.r, n.wave));
                const cg = Math.round(lerp(rgb.g, rgbA.g, n.wave));
                const cb = Math.round(lerp(rgb.b, rgbA.b, n.wave));

                ctx.beginPath();
                ctx.arc(n.x, n.y, rad, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
                ctx.fill();

                if (n.wave > opts.glowThreshold) {
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, rad + 4, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${cr},${cg},${cb},${(n.wave - opts.glowThreshold) * 0.2})`;
                    ctx.fill();
                }
            }

            // Mouse glow
            if (opts.mouseGlow && mouse.x > -999) {
                const mR = opts.mouseGlowRadius;
                const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, mR);
                grad.addColorStop(0, pal.glow + opts.mouseGlowIntensity + ')');
                grad.addColorStop(0.5, pal.glow + (opts.mouseGlowIntensity * 0.33) + ')');
                grad.addColorStop(1, pal.glow + '0)');
                ctx.fillStyle = grad;
                ctx.fillRect(mouse.x - mR, mouse.y - mR, mR * 2, mR * 2);
            }
        }

        /* Loop */
        function loop() {
            if (destroyed) return;
            update();
            draw();
            rafId = requestAnimationFrame(loop);
        }

        resize();
        build();
        loop();

        /* API */
        return {
            setOptions(newOpts) {
                Object.assign(opts, newOpts);
                if (newOpts.palette) {
                    pal = typeof newOpts.palette === 'string'
                        ? (PALETTES[newOpts.palette] || PALETTES.gold)
                        : newOpts.palette;
                }
            },
            rebuild() { resize(); build(); },
            destroy() {
                destroyed = true;
                if (rafId) cancelAnimationFrame(rafId);
                window.removeEventListener('resize', resize);
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('touchmove', onTouch);
                window.removeEventListener('mouseleave', onLeave);
                window.removeEventListener('mousedown', onDown);
                window.removeEventListener('mouseup', onUp);
                if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            },
        };
    }

    /* Auto-init */
    function autoInit() {
        const instance = init(global.MeshWidgetOptions || {});
        global.MeshWidget = { init, instance };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else { autoInit(); }

})(window);