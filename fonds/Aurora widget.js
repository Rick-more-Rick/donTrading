/*!
 * aurora-widget.js — Aurora Boreal generativa interactiva
 * Cintas de luz orgánicas que fluyen con ruido Perlin y responden al mouse
 *
 * El mouse actúa como viento: empuja y curva las cintas.
 * Click genera ráfagas de energía que aceleran y fragmentan las auroras.
 * Las cintas respiran, pulsan y cambian de color fluidamente.
 *
 * USO:
 *   <script src="aurora-widget.js"></script>
 *
 *   Opcional (antes de cargar el script):
 *   <script>
 *     window.AuroraWidgetOptions = {
 *       canvasId: 'aurora-bg',
 *       palette: 'boreal',           // 'boreal' | 'solar' | 'deep' | objeto custom
 *       ribbonCount: 7,              // cantidad de cintas (3-15)
 *       ribbonSegments: 80,          // puntos por cinta
 *       ribbonAmplitude: 120,        // amplitud vertical de ondulación
 *       ribbonThickness: [30, 90],   // [min, max] grosor de cintas
 *       flowSpeed: 0.003,            // velocidad del flujo base
 *       noiseScale: 0.0015,          // escala del ruido (menor = más suave)
 *       noiseSpeed: 0.002,           // velocidad de cambio del ruido
 *       windRadius: 280,             // radio de influencia del mouse
 *       windStrength: 60,            // fuerza del viento del mouse
 *       burstForce: 150,             // fuerza de la ráfaga al click
 *       burstDecay: 0.94,            // decaimiento de la ráfaga
 *       glowIntensity: 0.4,          // intensidad del glow (0-1)
 *       starCount: 120,              // estrellas de fondo
 *       starTwinkleSpeed: 0.02,      // velocidad del parpadeo
 *       fadeTrail: 0.08,             // opacidad del fade por frame (0.01-0.3)
 *       verticalBias: 0.35,          // posición vertical central (0=arriba, 1=abajo)
 *       breatheSpeed: 0.001,         // velocidad de respiración global
 *       colorShiftSpeed: 0.0005,     // velocidad del cambio de color
 *       mouseGlow: true,             // halo alrededor del mouse
 *       zIndex: 0,
 *     };
 *   </script>
 *
 *   Paleta personalizada:
 *   window.AuroraWidgetOptions = {
 *     palette: {
 *       colors: ['#00ff87','#00e5ff','#7c4dff','#ff4081'],
 *       bg: [4, 6, 18],
 *       starColor: 'rgba(200,220,255,',
 *     }
 *   };
 *
 *   API pública:
 *   AuroraWidget.instance.setOptions({ palette: 'solar' });
 *   AuroraWidget.instance.burst(x, y, force);  // ráfaga manual
 *   AuroraWidget.instance.rebuild();
 *   AuroraWidget.instance.destroy();
 */
(function (global) {
    'use strict';

    /* ═══════════════════════════════════════
     *  SIMPLEX NOISE (compact 2D/3D)
     * ═══════════════════════════════════════ */
    const SimplexNoise = (function () {
        const F2 = 0.5 * (Math.sqrt(3) - 1);
        const G2 = (3 - Math.sqrt(3)) / 6;
        const F3 = 1 / 3;
        const G3 = 1 / 6;

        const grad3 = [
            [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
            [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
            [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
        ];

        function Simplex(seed) {
            const p = new Uint8Array(256);
            // Simple seed-based shuffle
            let s = seed || Math.random() * 65536;
            for (let i = 0; i < 256; i++) p[i] = i;
            for (let i = 255; i > 0; i--) {
                s = (s * 16807 + 0) % 2147483647;
                const j = s % (i + 1);
                [p[i], p[j]] = [p[j], p[i]];
            }
            this.perm = new Uint8Array(512);
            this.permMod12 = new Uint8Array(512);
            for (let i = 0; i < 512; i++) {
                this.perm[i] = p[i & 255];
                this.permMod12[i] = this.perm[i] % 12;
            }
        }

        Simplex.prototype.noise2D = function (xin, yin) {
            const perm = this.perm, pm12 = this.permMod12;
            const s = (xin + yin) * F2;
            const i = Math.floor(xin + s), j = Math.floor(yin + s);
            const t = (i + j) * G2;
            const x0 = xin - (i - t), y0 = yin - (j - t);
            const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
            const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
            const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
            const ii = i & 255, jj = j & 255;
            let n0 = 0, n1 = 0, n2 = 0;

            let t0 = 0.5 - x0 * x0 - y0 * y0;
            if (t0 >= 0) { t0 *= t0; const g = grad3[pm12[ii + perm[jj]]]; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
            let t1 = 0.5 - x1 * x1 - y1 * y1;
            if (t1 >= 0) { t1 *= t1; const g = grad3[pm12[ii + i1 + perm[jj + j1]]]; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
            let t2 = 0.5 - x2 * x2 - y2 * y2;
            if (t2 >= 0) { t2 *= t2; const g = grad3[pm12[ii + 1 + perm[jj + 1]]]; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }

            return 70 * (n0 + n1 + n2);
        };

        Simplex.prototype.noise3D = function (xin, yin, zin) {
            const perm = this.perm, pm12 = this.permMod12;
            const s = (xin + yin + zin) * F3;
            const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
            const t = (i + j + k) * G3;
            const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);

            let i1, j1, k1, i2, j2, k2;
            if (x0 >= y0) {
                if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
                else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
                else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
            } else {
                if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
                else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
                else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
            }

            const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
            const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
            const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
            const ii = i & 255, jj = j & 255, kk = k & 255;
            let n0 = 0, n1 = 0, n2 = 0, n3 = 0;

            let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
            if (t0 >= 0) { t0 *= t0; const g = grad3[pm12[ii + perm[jj + perm[kk]]]]; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0 + g[2] * z0); }
            let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
            if (t1 >= 0) { t1 *= t1; const g = grad3[pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]]; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1 + g[2] * z1); }
            let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
            if (t2 >= 0) { t2 *= t2; const g = grad3[pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]]; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2 + g[2] * z2); }
            let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
            if (t3 >= 0) { t3 *= t3; const g = grad3[pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]]; n3 = t3 * t3 * (g[0] * x3 + g[1] * y3 + g[2] * z3); }

            return 32 * (n0 + n1 + n2 + n3);
        };

        return Simplex;
    })();

    /* ── Paletas ── */
    const PALETTES = {
        boreal: {
            colors: ['#00ff87', '#00e5ff', '#7c4dff', '#18ffff', '#69f0ae'],
            bg: [3, 5, 16],
            starColor: 'rgba(180,210,255,',
        },
        solar: {
            colors: ['#ff6d00', '#ff9100', '#ffd600', '#ff3d00', '#ffab00'],
            bg: [12, 4, 4],
            starColor: 'rgba(255,220,180,',
        },
        deep: {
            colors: ['#e040fb', '#7c4dff', '#536dfe', '#ff4081', '#b388ff'],
            bg: [6, 2, 14],
            starColor: 'rgba(210,190,255,',
        },
    };

    const DEFAULTS = {
        canvasId: 'aurora-bg',
        palette: 'boreal',
        ribbonCount: 7,
        ribbonSegments: 80,
        ribbonAmplitude: 120,
        ribbonThickness: [30, 90],
        flowSpeed: 0.003,
        noiseScale: 0.0015,
        noiseSpeed: 0.002,
        windRadius: 280,
        windStrength: 60,
        burstForce: 150,
        burstDecay: 0.94,
        glowIntensity: 0.4,
        starCount: 120,
        starTwinkleSpeed: 0.02,
        fadeTrail: 0.08,
        verticalBias: 0.35,
        breatheSpeed: 0.001,
        colorShiftSpeed: 0.0005,
        mouseGlow: true,
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
    function lerpColor(c1, c2, t) {
        return {
            r: Math.round(lerp(c1.r, c2.r, t)),
            g: Math.round(lerp(c1.g, c2.g, t)),
            b: Math.round(lerp(c1.b, c2.b, t)),
        };
    }
    function rand(a, b) { return a + Math.random() * (b - a); }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    /* ═══════════════════════════════════════
     *  INIT
     * ═══════════════════════════════════════ */
    function init(userOpts) {
        const opts = Object.assign({}, DEFAULTS, userOpts || {});
        // Deep copy array defaults
        if (userOpts && userOpts.ribbonThickness) opts.ribbonThickness = userOpts.ribbonThickness.slice();
        else opts.ribbonThickness = DEFAULTS.ribbonThickness.slice();

        let pal = typeof opts.palette === 'string'
            ? (PALETTES[opts.palette] || PALETTES.boreal)
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
        const simplex = new SimplexNoise(Math.random() * 65536);

        let W, H, dpr;
        let ribbons = [], stars = [], bursts = [];
        let time = 0;
        const mouse = { x: -9999, y: -9999, pressed: false, vx: 0, vy: 0, prevX: -9999, prevY: -9999 };
        let rafId = null;
        let destroyed = false;

        /* ── Resize ── */
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

        /* ── Stars ── */
        function buildStars() {
            stars = [];
            for (let i = 0; i < opts.starCount; i++) {
                stars.push({
                    x: Math.random() * W,
                    y: Math.random() * H * 0.75, // mostly upper sky
                    size: Math.random() * 1.8 + 0.3,
                    phase: Math.random() * Math.PI * 2,
                    speed: rand(0.005, opts.starTwinkleSpeed),
                    brightness: rand(0.3, 1),
                });
            }
        }

        function drawStars() {
            for (const st of stars) {
                st.phase += st.speed;
                const twinkle = (Math.sin(st.phase) + 1) / 2;
                const alpha = st.brightness * (0.2 + twinkle * 0.8);

                ctx.beginPath();
                ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2);
                ctx.fillStyle = pal.starColor + alpha + ')';
                ctx.fill();

                // Tiny cross flare on bright stars
                if (st.size > 1.2 && twinkle > 0.7) {
                    const fl = st.size * 2.5 * twinkle;
                    ctx.strokeStyle = pal.starColor + (alpha * 0.3) + ')';
                    ctx.lineWidth = 0.4;
                    ctx.beginPath();
                    ctx.moveTo(st.x - fl, st.y); ctx.lineTo(st.x + fl, st.y);
                    ctx.moveTo(st.x, st.y - fl); ctx.lineTo(st.x, st.y + fl);
                    ctx.stroke();
                }
            }
        }

        /* ── Ribbons ── */
        function buildRibbons() {
            ribbons = [];
            const palColors = pal.colors.map(hexRgb);

            for (let i = 0; i < opts.ribbonCount; i++) {
                const t = i / (opts.ribbonCount - 1 || 1);
                const baseY = H * (opts.verticalBias - 0.15 + t * 0.3);
                const thickness = rand(opts.ribbonThickness[0], opts.ribbonThickness[1]);
                const colorIdx = i % palColors.length;
                const colorIdx2 = (i + 1) % palColors.length;

                ribbons.push({
                    baseY,
                    thickness,
                    noiseOffsetX: rand(0, 1000),
                    noiseOffsetY: rand(0, 1000),
                    speedMult: rand(0.7, 1.4),
                    amplitudeMult: rand(0.6, 1.5),
                    colorA: palColors[colorIdx],
                    colorB: palColors[colorIdx2],
                    colorPhase: rand(0, Math.PI * 2),
                    segments: [], // computed each frame
                    windOffset: new Float32Array(opts.ribbonSegments), // per-segment wind displacement
                });
            }
        }

        function updateRibbons() {
            const segs = opts.ribbonSegments;
            const breathe = Math.sin(time * opts.breatheSpeed * 1000) * 0.3 + 1;

            for (const rb of ribbons) {
                rb.segments = [];
                rb.colorPhase += opts.colorShiftSpeed;

                for (let i = 0; i < segs; i++) {
                    const t = i / (segs - 1);
                    const x = t * (W + 100) - 50;

                    // Multi-octave noise for organic movement
                    const nx = x * opts.noiseScale + rb.noiseOffsetX;
                    const nt = time * rb.speedMult;

                    const n1 = simplex.noise3D(nx, nt * 0.7, rb.noiseOffsetY) * opts.ribbonAmplitude * rb.amplitudeMult;
                    const n2 = simplex.noise3D(nx * 2.2, nt * 1.1, rb.noiseOffsetY + 100) * opts.ribbonAmplitude * 0.35;
                    const n3 = simplex.noise3D(nx * 4.5, nt * 1.6, rb.noiseOffsetY + 200) * opts.ribbonAmplitude * 0.12;

                    // Wind displacement (decays over time)
                    rb.windOffset[i] *= 0.97;

                    const y = rb.baseY + (n1 + n2 + n3) * breathe + rb.windOffset[i];

                    // Thickness variation
                    const thickNoise = simplex.noise3D(nx * 1.5, nt * 0.5, rb.noiseOffsetY + 500);
                    const thick = rb.thickness * (0.4 + (thickNoise + 1) / 2 * 0.8) * breathe;

                    // Alpha variation — edges fade, middle pulses
                    const edgeFade = Math.sin(t * Math.PI); // 0 at edges, 1 in middle
                    const alphaPulse = (simplex.noise3D(nx * 0.8, nt * 0.3, rb.noiseOffsetY + 300) + 1) / 2;
                    const alpha = edgeFade * (0.15 + alphaPulse * 0.45);

                    // Color cycling along ribbon
                    const colorT = (Math.sin(rb.colorPhase + t * Math.PI * 2) + 1) / 2;

                    rb.segments.push({ x, y, thick, alpha, colorT });
                }
            }
        }

        function drawRibbons() {
            for (const rb of ribbons) {
                if (rb.segments.length < 2) continue;

                // Draw ribbon as gradient-filled path
                const segs = rb.segments;

                for (let i = 0; i < segs.length - 1; i++) {
                    const s0 = segs[i];
                    const s1 = segs[i + 1];
                    const avgAlpha = (s0.alpha + s1.alpha) / 2;
                    if (avgAlpha < 0.01) continue;

                    const avgThick = (s0.thick + s1.thick) / 2;
                    const avgColorT = (s0.colorT + s1.colorT) / 2;
                    const c = lerpColor(rb.colorA, rb.colorB, avgColorT);

                    // Vertical gradient for each segment strip
                    const grad = ctx.createLinearGradient(s0.x, s0.y - avgThick / 2, s0.x, s0.y + avgThick / 2);
                    grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0)`);
                    grad.addColorStop(0.3, `rgba(${c.r},${c.g},${c.b},${avgAlpha * 0.7})`);
                    grad.addColorStop(0.5, `rgba(${c.r},${c.g},${c.b},${avgAlpha})`);
                    grad.addColorStop(0.7, `rgba(${c.r},${c.g},${c.b},${avgAlpha * 0.7})`);
                    grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);

                    ctx.beginPath();
                    ctx.moveTo(s0.x, s0.y - s0.thick / 2);
                    ctx.lineTo(s1.x, s1.y - s1.thick / 2);
                    ctx.lineTo(s1.x, s1.y + s1.thick / 2);
                    ctx.lineTo(s0.x, s0.y + s0.thick / 2);
                    ctx.closePath();
                    ctx.fillStyle = grad;
                    ctx.fill();
                }

                // Central bright core line
                ctx.beginPath();
                for (let i = 0; i < segs.length; i++) {
                    const s = segs[i];
                    if (i === 0) ctx.moveTo(s.x, s.y);
                    else {
                        const prev = segs[i - 1];
                        const cpx = (prev.x + s.x) / 2;
                        const cpy = (prev.y + s.y) / 2;
                        ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
                    }
                }
                ctx.strokeStyle = `rgba(255,255,255,0.04)`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Global glow layer
            if (opts.glowIntensity > 0) {
                for (const rb of ribbons) {
                    const midIdx = Math.floor(rb.segments.length / 2);
                    const mid = rb.segments[midIdx];
                    if (!mid) continue;

                    const c = lerpColor(rb.colorA, rb.colorB, mid.colorT);
                    const gR = rb.thickness * 2.5;
                    const grad = ctx.createRadialGradient(W / 2, mid.y, 0, W / 2, mid.y, gR);
                    grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${opts.glowIntensity * mid.alpha * 0.15})`);
                    grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, mid.y - gR, W, gR * 2);
                }
            }
        }

        /* ── Wind interaction ── */
        function applyWind() {
            if (mouse.x < -999) return;

            const R = opts.windRadius;
            const STR = opts.windStrength;

            for (const rb of ribbons) {
                for (let i = 0; i < rb.segments.length; i++) {
                    const seg = rb.segments[i];
                    if (!seg) continue;

                    const dx = seg.x - mouse.x;
                    const dy = seg.y - mouse.y;
                    const d = Math.sqrt(dx * dx + dy * dy);

                    if (d < R && d > 1) {
                        const f = ((R - d) / R);
                        const ff = f * f * f; // cubic falloff for softness

                        // Push with mouse velocity + radial push
                        const pushY = mouse.vy * ff * STR * 0.3 + (dy / d) * ff * STR * 0.5;
                        rb.windOffset[i] += pushY;

                        // Clamp wind displacement
                        rb.windOffset[i] = clamp(rb.windOffset[i], -200, 200);
                    }
                }
            }
        }

        /* ── Bursts ── */
        function addBurst(bx, by, force) {
            bursts.push({
                x: bx, y: by,
                force: force || opts.burstForce,
                radius: 0,
                alpha: 1,
            });
        }

        function updateBursts() {
            for (let b = bursts.length - 1; b >= 0; b--) {
                const burst = bursts[b];
                burst.radius += burst.force * 0.15;
                burst.force *= opts.burstDecay;
                burst.alpha *= 0.96;

                // Apply burst to ribbons
                for (const rb of ribbons) {
                    for (let i = 0; i < rb.segments.length; i++) {
                        const seg = rb.segments[i];
                        if (!seg) continue;
                        const dx = seg.x - burst.x;
                        const dy = seg.y - burst.y;
                        const d = Math.sqrt(dx * dx + dy * dy);
                        const bR = burst.radius;
                        if (d < bR && d > 1) {
                            const f = ((bR - d) / bR) * burst.force * 0.05;
                            rb.windOffset[i] += (dy / d) * f;
                        }
                    }
                }

                if (burst.alpha < 0.01) bursts.splice(b, 1);
            }
        }

        function drawBursts() {
            for (const burst of bursts) {
                const palColors = pal.colors.map(hexRgb);
                const c = palColors[0];
                const grad = ctx.createRadialGradient(burst.x, burst.y, 0, burst.x, burst.y, burst.radius);
                grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${burst.alpha * 0.15})`);
                grad.addColorStop(0.6, `rgba(${c.r},${c.g},${c.b},${burst.alpha * 0.04})`);
                grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(burst.x, burst.y, burst.radius, 0, Math.PI * 2);
                ctx.fill();

                // Ring
                ctx.strokeStyle = `rgba(255,255,255,${burst.alpha * 0.08})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(burst.x, burst.y, burst.radius * 0.8, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        /* ── Mouse glow ── */
        function drawMouseGlow() {
            if (!opts.mouseGlow || mouse.x < -999) return;

            const speed = Math.hypot(mouse.vx, mouse.vy);
            const intensity = clamp(speed / 20, 0.02, 0.12);
            const palColors = pal.colors.map(hexRgb);
            const c = palColors[0];

            const mR = 100 + speed * 2;
            const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, mR);
            grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${intensity})`);
            grad.addColorStop(0.5, `rgba(${c.r},${c.g},${c.b},${intensity * 0.3})`);
            grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(mouse.x, mouse.y, mR, 0, Math.PI * 2);
            ctx.fill();
        }

        /* ── Horizon glow ── */
        function drawHorizonGlow() {
            const palColors = pal.colors.map(hexRgb);
            const midY = H * opts.verticalBias;
            const breathe = (Math.sin(time * 0.4) + 1) / 2;

            for (let i = 0; i < Math.min(3, palColors.length); i++) {
                const c = palColors[i];
                const gH = H * (0.3 + breathe * 0.1);
                const grad = ctx.createRadialGradient(
                    W * (0.2 + i * 0.3), midY, 0,
                    W * (0.2 + i * 0.3), midY, gH
                );
                grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${0.025 + breathe * 0.015})`);
                grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, W, H);
            }
        }

        /* ── Events ── */
        function onMove(e) {
            mouse.prevX = mouse.x;
            mouse.prevY = mouse.y;
            mouse.x = e.clientX;
            mouse.y = e.clientY;
            mouse.vx = mouse.x - mouse.prevX;
            mouse.vy = mouse.y - mouse.prevY;
        }
        function onTouch(e) {
            mouse.prevX = mouse.x;
            mouse.prevY = mouse.y;
            mouse.x = e.touches[0].clientX;
            mouse.y = e.touches[0].clientY;
            mouse.vx = mouse.x - mouse.prevX;
            mouse.vy = mouse.y - mouse.prevY;
        }
        function onLeave() {
            mouse.x = -9999; mouse.y = -9999;
            mouse.vx = 0; mouse.vy = 0;
        }
        function onDown(e) {
            mouse.pressed = true;
            addBurst(e.clientX || mouse.x, e.clientY || mouse.y, opts.burstForce);
        }
        function onUp() { mouse.pressed = false; }

        window.addEventListener('resize', () => { resize(); build(); });
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onTouch, { passive: true });
        window.addEventListener('mouseleave', onLeave);
        window.addEventListener('mousedown', onDown);
        window.addEventListener('mouseup', onUp);

        /* ── Build ── */
        function build() {
            buildStars();
            buildRibbons();
            bursts = [];
        }

        /* ── Main loop ── */
        function loop() {
            if (destroyed) return;

            time += opts.flowSpeed;

            // Fade clear
            const bg = pal.bg;
            ctx.fillStyle = `rgba(${bg[0]},${bg[1]},${bg[2]},${opts.fadeTrail})`;
            ctx.fillRect(0, 0, W, H);

            // Occasional full clear to prevent ghosting buildup
            if (Math.random() < 0.002) {
                ctx.fillStyle = `rgba(${bg[0]},${bg[1]},${bg[2]},0.4)`;
                ctx.fillRect(0, 0, W, H);
            }

            drawStars();
            drawHorizonGlow();

            updateRibbons();
            applyWind();
            updateBursts();

            drawRibbons();
            drawBursts();
            drawMouseGlow();

            // Mouse velocity decay
            mouse.vx *= 0.85;
            mouse.vy *= 0.85;

            rafId = requestAnimationFrame(loop);
        }

        resize();
        build();

        // Initial full clear
        const bg = pal.bg;
        ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
        ctx.fillRect(0, 0, W, H);

        loop();

        /* ── Public API ── */
        return {
            setOptions(newOpts) {
                Object.assign(opts, newOpts);
                if (newOpts.palette) {
                    pal = typeof newOpts.palette === 'string'
                        ? (PALETTES[newOpts.palette] || PALETTES.boreal)
                        : newOpts.palette;
                    build();
                }
            },
            burst(x, y, force) { addBurst(x, y, force); },
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

    /* ── Auto-init ── */
    function autoInit() {
        const instance = init(global.AuroraWidgetOptions || {});
        global.AuroraWidget = { init, instance };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else { autoInit(); }

})(window);