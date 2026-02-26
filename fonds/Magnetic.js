/*!
 * magnetic-widget.js — Campo magnético interactivo
 * Partículas que fluyen siguiendo líneas de fuerza magnéticas
 *
 * USO:
 *   <script src="magnetic-widget.js"></script>
 *
 *   Opcional (antes de cargar el script):
 *   <script>
 *     window.MagneticWidgetOptions = {
 *       canvasId: 'magnetic-bg',     // ID del canvas (se crea si no existe)
 *       palette: 'gold',             // 'gold' | 'cyber' | 'emerald' | objeto custom
 *       particleDensity: 1200,       // área en px² por partícula (menor = más)
 *       maxParticles: 1200,          // límite máximo de partículas
 *       trailMin: 8,                 // longitud mínima del trail
 *       trailMax: 24,               // longitud máxima del trail
 *       speedMin: 0.5,              // velocidad mínima
 *       speedMax: 2.5,              // velocidad máxima
 *       headDotRadius: 2.2,         // radio del punto cabeza
 *       headGlowRadius: 6,          // radio del glow cabeza
 *       lineWidthBase: 1.2,         // grosor base del trail
 *       lineWidthExtra: 1.3,        // grosor extra en cabeza
 *       trailOpacity: 0.55,         // opacidad máxima del trail
 *       fadeSpeed: 0.15,            // velocidad del alpha de clear (0.05-0.3)
 *       poleCount: [4, 7],          // [min, max] polos de fondo
 *       poleChargeMin: 200,         // carga mínima de polos
 *       poleChargeMax: 600,         // carga máxima
 *       poleDrift: 0.3,             // velocidad de deriva de polos
 *       mouseCharge: 1200,          // carga del mouse (repulsión)
 *       mouseClickCharge: -1800,    // carga del mouse al hacer click (atracción)
 *       mouseCurlRadius: 350,       // radio del efecto de curl/vórtice
 *       mouseCurlStrength: 2,       // fuerza del vórtice
 *       mouseGlow: true,            // halo visual alrededor del mouse
 *       mouseGlowRadius: 140,       // radio del halo
 *       showPoles: true,            // mostrar indicadores de polos
 *       poleIndicatorRadius: 60,    // radio del indicador visual
 *       zIndex: 0,                  // z-index del canvas
 *     };
 *   </script>
 *
 *   Paleta personalizada:
 *   window.MagneticWidgetOptions = {
 *     palette: {
 *       primary: '#00e5ff',
 *       secondary: '#18ffff',
 *       accent: '#7c4dff',
 *       glow: 'rgba(0,229,255,',    // sin cerrar paréntesis
 *       bg: [4, 8, 16],             // RGB del fondo
 *     }
 *   };
 *
 *   API pública (después de cargar):
 *   MagneticWidget.setOptions({ palette: 'cyber' });
 *   MagneticWidget.rebuild();
 *   MagneticWidget.destroy();
 *   MagneticWidget.addPole(x, y, charge); // añadir polo dinámicamente
 */
(function (global) {
    'use strict';

    /* ── Paletas ── */
    const PALETTES = {
        gold: {
            primary: '#f59e0b',
            secondary: '#fbbf24',
            accent: '#22c55e',
            glow: 'rgba(245,158,11,',
            bg: [6, 8, 13],
        },
        cyber: {
            primary: '#00e5ff',
            secondary: '#18ffff',
            accent: '#7c4dff',
            glow: 'rgba(0,229,255,',
            bg: [4, 8, 16],
        },
        emerald: {
            primary: '#10b981',
            secondary: '#34d399',
            accent: '#f59e0b',
            glow: 'rgba(16,185,129,',
            bg: [5, 10, 8],
        },
    };

    const DEFAULTS = {
        canvasId: 'magnetic-bg',
        palette: 'gold',
        particleDensity: 1200,
        maxParticles: 1200,
        trailMin: 8,
        trailMax: 24,
        speedMin: 0.5,
        speedMax: 2.5,
        headDotRadius: 2.2,
        headGlowRadius: 6,
        lineWidthBase: 1.2,
        lineWidthExtra: 1.3,
        trailOpacity: 0.55,
        fadeSpeed: 0.15,
        poleCount: [4, 7],
        poleChargeMin: 200,
        poleChargeMax: 600,
        poleDrift: 0.3,
        mouseCharge: 1200,
        mouseClickCharge: -1800,
        mouseCurlRadius: 350,
        mouseCurlStrength: 2,
        mouseGlow: true,
        mouseGlowRadius: 140,
        showPoles: true,
        poleIndicatorRadius: 60,
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
    function rand(a, b) { return a + Math.random() * (b - a); }

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
        let particles = [], poles = [];
        let time = 0;
        const mouse = { x: -9999, y: -9999, pressed: false };
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

        /* Build */
        function build() {
            // Particles
            const count = Math.min(opts.maxParticles, Math.floor((W * H) / opts.particleDensity));
            particles = [];
            for (let i = 0; i < count; i++) {
                particles.push(makeParticle());
            }

            // Poles
            poles = [];
            const pMin = opts.poleCount[0];
            const pMax = opts.poleCount[1];
            const poleCt = pMin + Math.floor(Math.random() * (pMax - pMin + 1));
            for (let i = 0; i < poleCt; i++) {
                poles.push({
                    x: W * 0.15 + Math.random() * W * 0.7,
                    y: H * 0.15 + Math.random() * H * 0.7,
                    charge: (Math.random() < 0.5 ? 1 : -1) * rand(opts.poleChargeMin, opts.poleChargeMax),
                    vx: (Math.random() - 0.5) * opts.poleDrift,
                    vy: (Math.random() - 0.5) * opts.poleDrift,
                });
            }
        }

        function makeParticle() {
            return {
                x: Math.random() * W,
                y: Math.random() * H,
                vx: 0,
                vy: 0,
                life: Math.random(),
                maxLife: 0.6 + Math.random() * 0.4,
                speed: rand(opts.speedMin, opts.speedMax),
                trail: [],
                trailMax: opts.trailMin + Math.floor(Math.random() * (opts.trailMax - opts.trailMin)),
                hue: Math.random(),
            };
        }

        /* Events */
        function onMove(e) { mouse.x = e.clientX; mouse.y = e.clientY; }
        function onTouch(e) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }
        function onLeave() { mouse.x = -9999; mouse.y = -9999; }
        function onDown() { mouse.pressed = true; }
        function onUp() { mouse.pressed = false; }

        window.addEventListener('resize', () => { resize(); build(); });
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onTouch, { passive: true });
        window.addEventListener('mouseleave', onLeave);
        window.addEventListener('mousedown', onDown);
        window.addEventListener('mouseup', onUp);

        /* Update */
        function update() {
            time += 0.008;

            // Drift poles
            for (const p of poles) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 50 || p.x > W - 50) p.vx *= -1;
                if (p.y < 50 || p.y > H - 50) p.vy *= -1;
            }

            const mCharge = mouse.pressed ? opts.mouseClickCharge : opts.mouseCharge;

            for (const fl of particles) {
                let fx = 0, fy = 0;

                // Pole forces
                for (const p of poles) {
                    const dx = fl.x - p.x;
                    const dy = fl.y - p.y;
                    const d2 = dx * dx + dy * dy + 500;
                    const d = Math.sqrt(d2);
                    fx += (p.charge * dx) / (d2 * d) * 800;
                    fy += (p.charge * dy) / (d2 * d) * 800;
                }

                // Mouse force
                if (mouse.x > -999) {
                    const dx = fl.x - mouse.x;
                    const dy = fl.y - mouse.y;
                    const d2 = dx * dx + dy * dy + 200;
                    const d = Math.sqrt(d2);
                    fx += (mCharge * dx) / (d2 * d) * 1200;
                    fy += (mCharge * dy) / (d2 * d) * 1200;

                    // Curl / vortex
                    const td = Math.sqrt(d2);
                    if (td < opts.mouseCurlRadius) {
                        const curl = ((opts.mouseCurlRadius - td) / opts.mouseCurlRadius) * opts.mouseCurlStrength;
                        fx += (-dy / td) * curl;
                        fy += (dx / td) * curl;
                    }
                }

                // Normalize & apply speed
                const mag = Math.sqrt(fx * fx + fy * fy) + 0.001;
                fl.vx = (fx / mag) * fl.speed;
                fl.vy = (fy / mag) * fl.speed;
                fl.x += fl.vx;
                fl.y += fl.vy;

                // Trail
                fl.trail.unshift({ x: fl.x, y: fl.y });
                if (fl.trail.length > fl.trailMax) fl.trail.pop();

                // Lifecycle
                fl.life += 0.004;
                if (fl.life > fl.maxLife || fl.x < -30 || fl.x > W + 30 || fl.y < -30 || fl.y > H + 30) {
                    Object.assign(fl, makeParticle());
                    fl.life = 0;
                    fl.trail = [];
                }
            }
        }

        /* Draw */
        function draw() {
            const bg = pal.bg;
            ctx.fillStyle = `rgba(${bg[0]},${bg[1]},${bg[2]},${opts.fadeSpeed})`;
            ctx.fillRect(0, 0, W, H);

            const rgb = hexRgb(pal.primary);
            const rgbS = hexRgb(pal.secondary);
            const rgbA = hexRgb(pal.accent);

            // Trails
            for (const fl of particles) {
                if (fl.trail.length < 2) continue;

                const lifeA = fl.life < 0.1
                    ? fl.life / 0.1
                    : fl.life > fl.maxLife - 0.15
                        ? (fl.maxLife - fl.life) / 0.15
                        : 1;

                // Color blend
                let cr, cg, cb;
                if (fl.hue < 0.5) {
                    const t = fl.hue * 2;
                    cr = Math.round(lerp(rgb.r, rgbS.r, t));
                    cg = Math.round(lerp(rgb.g, rgbS.g, t));
                    cb = Math.round(lerp(rgb.b, rgbS.b, t));
                } else {
                    const t = (fl.hue - 0.5) * 2;
                    cr = Math.round(lerp(rgbS.r, rgbA.r, t));
                    cg = Math.round(lerp(rgbS.g, rgbA.g, t));
                    cb = Math.round(lerp(rgbS.b, rgbA.b, t));
                }

                for (let i = 0; i < fl.trail.length - 1; i++) {
                    const t0 = fl.trail[i];
                    const t1 = fl.trail[i + 1];
                    const segA = (1 - i / fl.trail.length) * lifeA;

                    ctx.beginPath();
                    ctx.moveTo(t0.x, t0.y);
                    ctx.lineTo(t1.x, t1.y);
                    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${segA * opts.trailOpacity})`;
                    ctx.lineWidth = opts.lineWidthBase + (1 - i / fl.trail.length) * opts.lineWidthExtra;
                    ctx.lineCap = 'round';
                    ctx.stroke();
                }

                // Head dot + glow
                const head = fl.trail[0];
                if (head && lifeA > 0.3) {
                    ctx.beginPath();
                    ctx.arc(head.x, head.y, opts.headDotRadius, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${cr},${cg},${cb},${lifeA * 0.7})`;
                    ctx.fill();

                    ctx.beginPath();
                    ctx.arc(head.x, head.y, opts.headGlowRadius, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${cr},${cg},${cb},${lifeA * 0.1})`;
                    ctx.fill();
                }
            }

            // Pole indicators
            if (opts.showPoles) {
                for (const p of poles) {
                    const pr = opts.poleIndicatorRadius;
                    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pr);
                    grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.06)`);
                    grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.15)`;
                    ctx.lineWidth = 1;
                    const sz = 5;
                    ctx.beginPath();
                    ctx.moveTo(p.x - sz, p.y); ctx.lineTo(p.x + sz, p.y);
                    if (p.charge > 0) { ctx.moveTo(p.x, p.y - sz); ctx.lineTo(p.x, p.y + sz); }
                    ctx.stroke();
                }
            }

            // Mouse glow
            if (opts.mouseGlow && mouse.x > -999) {
                const mR = mouse.pressed ? opts.mouseGlowRadius * 0.7 : opts.mouseGlowRadius;
                const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, mR);
                grad.addColorStop(0, pal.glow + '0.1)');
                grad.addColorStop(0.4, pal.glow + '0.03)');
                grad.addColorStop(1, pal.glow + '0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(mouse.x, mouse.y, mR, 0, Math.PI * 2);
                ctx.fill();

                // Rotating ring
                ctx.save();
                ctx.translate(mouse.x, mouse.y);
                ctx.rotate(time * 2);
                ctx.strokeStyle = pal.glow + '0.12)';
                ctx.lineWidth = 1;
                ctx.setLineDash([8, 12]);
                ctx.beginPath();
                ctx.arc(0, 0, 28 + Math.sin(time * 3) * 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
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
            addPole(x, y, charge) {
                poles.push({
                    x, y,
                    charge: charge || rand(opts.poleChargeMin, opts.poleChargeMax),
                    vx: (Math.random() - 0.5) * opts.poleDrift,
                    vy: (Math.random() - 0.5) * opts.poleDrift,
                });
            },
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
        const instance = init(global.MagneticWidgetOptions || {});
        global.MagneticWidget = { init, instance };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else { autoInit(); }

})(window);