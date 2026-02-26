/*!
 * datawaves-widget.js — Ondas de datos corporativas
 * Ondas sinusoidales estratificadas con estética de análisis de frecuencia
 *
 * Múltiples capas de ondas con diferentes frecuencias que reaccionan
 * al mouse (distorsión local) y simulan flujo de datos en tiempo real.
 * Estilo: terminal financiera / dashboard enterprise.
 *
 * USO:
 *   <script src="datawaves-widget.js"></script>
 *
 *   Opcional:
 *   <script>
 *     window.DataWavesWidgetOptions = {
 *       canvasId: 'waves-bg',
 *       palette: 'corporate',        // 'corporate' | 'terminal' | 'frost' | custom
 *       waveCount: 6,                // capas de ondas (3-12)
 *       resolution: 3,               // px entre puntos (menor = más suave)
 *       baseAmplitude: 40,           // amplitud base
 *       frequency: 0.008,            // frecuencia base
 *       speed: 0.02,                 // velocidad de flujo
 *       phaseSpread: 0.4,            // separación de fase entre capas
 *       amplitudeDecay: 0.8,         // decay de amplitud por capa
 *       verticalSpread: 0.6,         // dispersión vertical (0-1)
 *       verticalCenter: 0.5,         // centro vertical (0-1)
 *       fillOpacity: 0.03,           // opacidad del relleno bajo las ondas
 *       strokeOpacity: 0.2,          // opacidad del trazo
 *       strokeWidth: 1,              // grosor del trazo
 *       mouseRadius: 200,            // radio de distorsión del mouse
 *       mouseStrength: 80,           // fuerza de distorsión
 *       mouseSmooth: 0.08,           // suavizado de la distorsión
 *       peakMarkers: true,           // marcadores en picos
 *       peakThreshold: 0.85,         // umbral para marcar pico
 *       horizontalRuler: true,       // regla con marcas horizontales
 *       rulerOpacity: 0.04,          // opacidad de la regla
 *       dataPoints: true,            // puntos de datos animados
 *       dataPointCount: 15,          // cantidad de puntos
 *       noiseAmount: 0.3,            // cantidad de ruido (jitter)
 *       glowOnMouse: true,           // glow bajo el mouse
 *       zIndex: 0,
 *     };
 *   </script>
 *
 *   API:
 *   DataWavesWidget.instance.setOptions({ palette: 'terminal' });
 *   DataWavesWidget.instance.rebuild();
 *   DataWavesWidget.instance.destroy();
 */
(function (global) {
    'use strict';

    const PALETTES = {
        corporate: {
            bg: [6, 10, 20],
            waves: [
                'rgba(59,130,246,',   // blue
                'rgba(99,102,241,',   // indigo
                'rgba(34,197,94,',    // green
                'rgba(14,165,233,',   // sky
                'rgba(168,85,247,',   // purple
                'rgba(236,72,153,',   // pink
            ],
            accent: 'rgba(96,165,250,',
            marker: 'rgba(34,197,94,',
            text: 'rgba(148,163,184,',
            ruler: 'rgba(59,130,246,',
        },
        terminal: {
            bg: [2, 6, 4],
            waves: [
                'rgba(34,197,94,',
                'rgba(22,163,74,',
                'rgba(74,222,128,',
                'rgba(16,185,129,',
                'rgba(52,211,153,',
                'rgba(5,150,105,',
            ],
            accent: 'rgba(34,197,94,',
            marker: 'rgba(250,204,21,',
            text: 'rgba(34,197,94,',
            ruler: 'rgba(34,197,94,',
        },
        frost: {
            bg: [10, 14, 24],
            waves: [
                'rgba(148,163,184,',
                'rgba(203,213,225,',
                'rgba(100,116,139,',
                'rgba(71,85,105,',
                'rgba(226,232,240,',
                'rgba(51,65,85,',
            ],
            accent: 'rgba(203,213,225,',
            marker: 'rgba(245,158,11,',
            text: 'rgba(148,163,184,',
            ruler: 'rgba(148,163,184,',
        },
    };

    const DEFAULTS = {
        canvasId: 'waves-bg',
        palette: 'corporate',
        waveCount: 6,
        resolution: 3,
        baseAmplitude: 40,
        frequency: 0.008,
        speed: 0.02,
        phaseSpread: 0.4,
        amplitudeDecay: 0.8,
        verticalSpread: 0.6,
        verticalCenter: 0.5,
        fillOpacity: 0.03,
        strokeOpacity: 0.2,
        strokeWidth: 1,
        mouseRadius: 200,
        mouseStrength: 80,
        mouseSmooth: 0.08,
        peakMarkers: true,
        peakThreshold: 0.85,
        horizontalRuler: true,
        rulerOpacity: 0.04,
        dataPoints: true,
        dataPointCount: 15,
        noiseAmount: 0.3,
        glowOnMouse: true,
        zIndex: 0,
    };

    function rand(a, b) { return a + Math.random() * (b - a); }

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
        let waves = [], dataPoints = [];
        let time = 0;
        const mouse = { x: -9999, y: -9999, influence: [] }; // per-x influence
        let rafId = null, destroyed = false;

        function resize() {
            dpr = window.devicePixelRatio || 1;
            W = window.innerWidth; H = window.innerHeight;
            canvas.width = W * dpr; canvas.height = H * dpr;
            canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            mouse.influence = new Float32Array(Math.ceil(W / opts.resolution) + 2);
        }

        function build() {
            waves = [];
            for (let i = 0; i < opts.waveCount; i++) {
                const t = i / (opts.waveCount - 1 || 1);
                waves.push({
                    amplitude: opts.baseAmplitude * Math.pow(opts.amplitudeDecay, i) * rand(0.7, 1.3),
                    frequency: opts.frequency * (1 + i * 0.3) * rand(0.8, 1.2),
                    phaseOffset: i * opts.phaseSpread + rand(-0.2, 0.2),
                    speedMult: 1 + i * 0.15,
                    yBase: H * (opts.verticalCenter - opts.verticalSpread / 2 + t * opts.verticalSpread),
                    colorIdx: i % pal.waves.length,
                    noiseSeeds: Array.from({ length: 8 }, () => rand(0, 1000)),
                });
            }

            // Data points
            dataPoints = [];
            if (opts.dataPoints) {
                for (let i = 0; i < opts.dataPointCount; i++) {
                    dataPoints.push({
                        waveIdx: Math.floor(Math.random() * opts.waveCount),
                        t: Math.random(), // 0-1 position along wave
                        phase: rand(0, Math.PI * 2),
                        speed: rand(0.001, 0.004),
                        size: rand(2, 4.5),
                        pulseSpeed: rand(0.02, 0.05),
                    });
                }
            }
        }

        /* ── Mouse influence buffer ── */
        function updateMouseInfluence() {
            const res = opts.resolution;
            const count = mouse.influence.length;
            const R = opts.mouseRadius;
            const STR = opts.mouseStrength;

            for (let i = 0; i < count; i++) {
                const x = i * res;
                const dx = x - mouse.x;
                const dy = 0; // horizontal distance only for target
                const d = Math.abs(dx);

                let target = 0;
                if (d < R && mouse.x > -999) {
                    const f = (R - d) / R;
                    // Compute vertical distance to nearest wave center
                    let closestDy = H;
                    for (const w of waves) {
                        closestDy = Math.min(closestDy, Math.abs(mouse.y - w.yBase));
                    }
                    const vFade = Math.max(0, 1 - closestDy / (H * 0.4));
                    target = f * f * STR * vFade * (mouse.y < waves[0].yBase ? -1 : 1);
                }

                mouse.influence[i] += (target - mouse.influence[i]) * opts.mouseSmooth;
            }
        }

        /* ── Wave computation ── */
        function getWaveY(wave, x, t) {
            const base = wave.yBase;
            const mainWave = Math.sin(x * wave.frequency + t * wave.speedMult + wave.phaseOffset) * wave.amplitude;

            // Harmonics
            const h2 = Math.sin(x * wave.frequency * 2.3 + t * wave.speedMult * 1.5 + wave.noiseSeeds[0]) * wave.amplitude * 0.25;
            const h3 = Math.sin(x * wave.frequency * 3.7 + t * wave.speedMult * 0.7 + wave.noiseSeeds[1]) * wave.amplitude * 0.1;

            // Noise jitter
            const noise = (Math.sin(x * 0.05 + t * 3 + wave.noiseSeeds[2]) * Math.sin(x * 0.13 + wave.noiseSeeds[3])) * wave.amplitude * opts.noiseAmount;

            return base + mainWave + h2 + h3 + noise;
        }

        /* ── Draw ── */
        function drawRuler() {
            if (!opts.horizontalRuler) return;

            // Horizontal reference lines at wave centers
            for (const w of waves) {
                ctx.strokeStyle = pal.ruler + opts.rulerOpacity + ')';
                ctx.lineWidth = 0.5;
                ctx.setLineDash([2, 6]);
                ctx.beginPath();
                ctx.moveTo(0, w.yBase);
                ctx.lineTo(W, w.yBase);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Vertical tick marks every 100px
            ctx.strokeStyle = pal.ruler + (opts.rulerOpacity * 0.6) + ')';
            ctx.lineWidth = 0.5;
            for (let x = 100; x < W; x += 100) {
                ctx.beginPath();
                ctx.moveTo(x, 0); ctx.lineTo(x, H);
                ctx.strokeStyle = pal.ruler + (opts.rulerOpacity * 0.3) + ')';
                ctx.stroke();

                // Small tick
                ctx.beginPath();
                ctx.moveTo(x, H - 20); ctx.lineTo(x, H - 12);
                ctx.strokeStyle = pal.text + '0.08)';
                ctx.stroke();
            }
        }

        function drawWaves() {
            const res = opts.resolution;
            const pts = Math.ceil(W / res) + 1;

            for (let wi = waves.length - 1; wi >= 0; wi--) {
                const wave = waves[wi];
                const color = pal.waves[wave.colorIdx];

                // Compute points
                const points = [];
                let maxY = -Infinity, minY = Infinity;
                for (let i = 0; i < pts; i++) {
                    const x = i * res;
                    let y = getWaveY(wave, x, time);
                    // Add mouse influence
                    y += mouse.influence[i] || 0;
                    points.push({ x, y });
                    if (y > maxY) maxY = y;
                    if (y < minY) minY = y;
                }

                // Fill under wave
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.lineTo(W, H);
                ctx.lineTo(0, H);
                ctx.closePath();
                ctx.fillStyle = color + opts.fillOpacity + ')';
                ctx.fill();

                // Stroke
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    // Smooth curve
                    const prev = points[i - 1];
                    const curr = points[i];
                    const cpx = (prev.x + curr.x) / 2;
                    ctx.quadraticCurveTo(prev.x, prev.y, cpx, (prev.y + curr.y) / 2);
                }
                const last = points[points.length - 1];
                ctx.lineTo(last.x, last.y);
                ctx.strokeStyle = color + opts.strokeOpacity + ')';
                ctx.lineWidth = opts.strokeWidth;
                ctx.stroke();

                // Peak markers
                if (opts.peakMarkers) {
                    const amplitude = wave.amplitude;
                    for (let i = 2; i < points.length - 2; i++) {
                        const p = points[i];
                        const displacement = Math.abs(p.y - wave.yBase) / amplitude;
                        if (displacement > opts.peakThreshold &&
                            points[i - 1].y > p.y && points[i + 1].y > p.y) {
                            // Local maximum (peak up)
                            ctx.beginPath();
                            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                            ctx.fillStyle = pal.marker + '0.5)';
                            ctx.fill();

                            // Small vertical line
                            ctx.beginPath();
                            ctx.moveTo(p.x, p.y - 6);
                            ctx.lineTo(p.x, p.y - 2);
                            ctx.strokeStyle = pal.marker + '0.3)';
                            ctx.lineWidth = 0.5;
                            ctx.stroke();
                        }
                    }
                }
            }
        }

        function drawDataPoints() {
            if (!opts.dataPoints) return;

            for (const dp of dataPoints) {
                dp.t += dp.speed;
                if (dp.t > 1) dp.t -= 1;
                dp.phase += dp.pulseSpeed;

                const x = dp.t * W;
                const wave = waves[dp.waveIdx];
                if (!wave) continue;

                const y = getWaveY(wave, x, time) + (mouse.influence[Math.floor(x / opts.resolution)] || 0);
                const pulse = (Math.sin(dp.phase) + 1) / 2;
                const color = pal.waves[wave.colorIdx];

                // Glow
                const gR = dp.size * 3 + pulse * 4;
                const grad = ctx.createRadialGradient(x, y, 0, x, y, gR);
                grad.addColorStop(0, color + (0.2 + pulse * 0.15) + ')');
                grad.addColorStop(1, color + '0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(x, y, gR, 0, Math.PI * 2);
                ctx.fill();

                // Dot
                ctx.beginPath();
                ctx.arc(x, y, dp.size * (0.8 + pulse * 0.3), 0, Math.PI * 2);
                ctx.fillStyle = color + (0.6 + pulse * 0.4) + ')';
                ctx.fill();

                // Ring
                ctx.beginPath();
                ctx.arc(x, y, dp.size * 2 + pulse * 3, 0, Math.PI * 2);
                ctx.strokeStyle = color + (0.1 + pulse * 0.1) + ')';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }

        function drawMouseGlow() {
            if (!opts.glowOnMouse || mouse.x < -999) return;

            const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, opts.mouseRadius);
            grad.addColorStop(0, pal.accent + '0.04)');
            grad.addColorStop(0.5, pal.accent + '0.015)');
            grad.addColorStop(1, pal.accent + '0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(mouse.x, mouse.y, opts.mouseRadius, 0, Math.PI * 2);
            ctx.fill();

            // Horizontal scan at mouse Y
            ctx.strokeStyle = pal.accent + '0.06)';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([3, 6]);
            ctx.beginPath();
            ctx.moveTo(0, mouse.y);
            ctx.lineTo(W, mouse.y);
            ctx.stroke();
            ctx.setLineDash([]);
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
            time += opts.speed;

            const bg = pal.bg;
            ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
            ctx.fillRect(0, 0, W, H);

            updateMouseInfluence();
            drawRuler();
            drawWaves();
            drawDataPoints();
            drawMouseGlow();

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
        const instance = init(global.DataWavesWidgetOptions || {});
        global.DataWavesWidget = { init, instance };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else { autoInit(); }

})(window);