/*!
 * icons-widget.js — Fondo de partículas monetarias interactivas
 * DONTRADING © 2026
 *
 * USO:
 *   1. Incluir en el <head> o antes de </body>:
 *      <script src="icons-widget.js"></script>
 *
 *   2. (Opcional) Configurar antes de incluir el script:
 *      <script>
 *        window.IconsWidgetOptions = {
 *          count: 90,          // número de partículas
 *          repelRadius: 134,   // radio de repulsión del mouse
 *          connectDist: 150,   // distancia máxima de conexión
 *          symbols: ['$','₿'], // símbolos personalizados
 *          colors: ['#f59e0b'] // colores personalizados
 *        };
 *      </script>
 *      <script src="icons-widget.js"></script>
 */
(function (global) {
    'use strict';

    /* ── Defaults ── */
    const DEFAULTS = {
        canvasId: 'icons-bg',
        countMin: 55,
        countMax: 130,
        countDensity: 11000,   // px² por partícula (pantalla / este valor = n)
        repelRadius: 134,
        connectDist: 150,
        lineOpacity: 0.09,
        lineColor: '#f59e0b',
        symbols: ['$', '$', '$', '$', '₿', '€', '¥', '£', '$', '$', '%', '$'],
        colors: ['#f59e0b', '#fbbf24', '#d97706', '#22c55e', '#3b82f6', '#7c3aed'],
        glowProb: 0.28,     // probabilidad inicial de que una partícula brille
        glowActivateProb: 0.0007,
    };

    /* ── Bootstrap ── */
    function init(userOpts) {
        const opts = Object.assign({}, DEFAULTS, userOpts || {});

        /* Crear / reutilizar canvas */
        let canvas = document.getElementById(opts.canvasId);
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = opts.canvasId;
            canvas.style.cssText = [
                'position:fixed', 'inset:0', 'z-index:0',
                'pointer-events:none', 'width:100%', 'height:100%'
            ].join(';');
            document.body.insertBefore(canvas, document.body.firstChild);
        }

        const ctx = canvas.getContext('2d');
        const mouse = { x: -9999, y: -9999 };
        let W = 0, H = 0, particles = [];

        /* Resize */
        function resize() {
            W = canvas.width = window.innerWidth;
            H = canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', () => { resize(); buildParticles(); });

        /* Mouse / Touch tracking */
        window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
        window.addEventListener('touchmove', e => {
            mouse.x = e.touches[0].clientX;
            mouse.y = e.touches[0].clientY;
        }, { passive: true });
        window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

        /* ── Clase Partícula ── */
        class Particle {
            constructor() { this.reset(); }

            reset() {
                this.x = Math.random() * W;
                this.y = Math.random() * H;
                this.vx = (Math.random() - 0.5) * 0.7;
                this.vy = (Math.random() - 0.5) * 0.7;
                this.size = Math.random() * 20 + 8;
                this.baseAlpha = Math.random() * 0.20 + 0.05;
                this.alpha = this.baseAlpha;
                this.sym = opts.symbols[Math.floor(Math.random() * opts.symbols.length)];
                this.color = opts.colors[Math.floor(Math.random() * opts.colors.length)];
                this.rot = (Math.random() - 0.5) * 0.015;
                this.angle = Math.random() * Math.PI * 2;
                // glow
                this.glowPhase = Math.random() * Math.PI * 2;
                this.glowSpeed = 0.007 + Math.random() * 0.020;
                this.glowVal = 0;
                this.glowing = Math.random() < opts.glowProb;
            }

            update() {
                /* Repulsión del mouse */
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const d2 = dx * dx + dy * dy;
                const R = opts.repelRadius;
                if (d2 < R * R && d2 > 0) {
                    const d = Math.sqrt(d2);
                    const force = (R - d) / R;
                    this.vx += (dx / d) * force * force * 1.2;
                    this.vy += (dy / d) * force * force * 1.2;
                }

                /* Límite de velocidad */
                const spd = Math.hypot(this.vx, this.vy);
                if (spd > 3.5) { this.vx = this.vx / spd * 3.5; this.vy = this.vy / spd * 3.5; }

                this.vx *= 0.984;
                this.vy *= 0.984;
                this.x += this.vx;
                this.y += this.vy;
                this.angle += this.rot;

                /* Glow aleatorio */
                this.glowPhase += this.glowSpeed;
                if (!this.glowing && Math.random() < opts.glowActivateProb) this.glowing = true;
                if (this.glowing) {
                    const raw = (Math.sin(this.glowPhase) + 1) / 2;
                    this.glowVal = raw * raw;
                    if (this.glowPhase > Math.PI * 6 && Math.random() < 0.015) {
                        this.glowing = false;
                        this.glowVal = 0;
                        this.glowPhase = 0;
                    }
                } else {
                    this.glowVal = 0;
                }

                this.alpha = this.baseAlpha + this.glowVal * 0.5;

                /* Wrap edges */
                if (this.x < -30) this.x = W + 30;
                if (this.x > W + 30) this.x = -30;
                if (this.y < -30) this.y = H + 30;
                if (this.y > H + 30) this.y = -30;
            }

            draw() {
                const gi = this.glowVal;
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.angle);

                /* Halo exterior difuso */
                if (gi > 0.02) {
                    ctx.globalAlpha = gi * 0.12;
                    ctx.fillStyle = this.color;
                    ctx.font = `700 ${this.size * 2}px "JetBrains Mono",monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(this.sym, 0, 0);
                }

                /* Símbolo principal + glow */
                ctx.globalAlpha = Math.min(1, this.alpha);
                ctx.shadowBlur = gi * 32;
                ctx.shadowColor = this.color;
                ctx.fillStyle = this.color;
                ctx.font = `600 ${this.size}px "JetBrains Mono",monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(this.sym, 0, 0);

                /* Núcleo blanco en pico máximo */
                if (gi > 0.70) {
                    ctx.globalAlpha = (gi - 0.70) * 0.80;
                    ctx.shadowBlur = 4;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(this.sym, 0, 0);
                }

                ctx.restore();
            }
        }

        /* Conexiones entre partículas cercanas */
        function drawConnections() {
            const MAX = opts.connectDist;
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const d = Math.hypot(dx, dy);
                    if (d < MAX) {
                        ctx.save();
                        ctx.globalAlpha = (1 - d / MAX) * opts.lineOpacity;
                        ctx.strokeStyle = opts.lineColor;
                        ctx.lineWidth = 0.7;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            }
        }

        /* Construir array de partículas */
        function buildParticles() {
            const n = Math.max(
                opts.countMin,
                Math.min(opts.countMax, Math.floor((W * H) / opts.countDensity))
            );
            particles = Array.from({ length: n }, () => new Particle());
        }
        buildParticles();

        /* Loop de animación */
        function loop() {
            ctx.clearRect(0, 0, W, H);
            drawConnections();
            for (const p of particles) { p.update(); p.draw(); }
            requestAnimationFrame(loop);
        }
        loop();

        /* API pública */
        return {
            setOptions: (newOpts) => Object.assign(opts, newOpts),
            rebuild: buildParticles,
            pause: () => { /* futuro */ },
        };
    }

    /* Auto-inicializar al cargar el DOM */
    function autoInit() {
        const instance = init(global.IconsWidgetOptions || {});
        global.IconsWidget = { init, instance };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }

})(window);
