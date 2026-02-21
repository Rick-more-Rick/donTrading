// ═══════════════════════════════════════════════════════════════
//  MotorVelas.js — Dibuja velas (candlesticks) en canvas 2D
//  Maneja el renderizado, pan (arrastrar) y zoom horizontal.
//  Dependencias: EstadoPrecio.js (recibe instancia en constructor)
// ═══════════════════════════════════════════════════════════════
window.MD = window.MD || {};

const RATIO_CUERPO_VELA = 0.7; // proporción del ancho de la vela que ocupa el cuerpo (70%)

MD.CandleEngine = class CandleEngine {
    constructor(canvas, estadoPrecio) {
        this.canvas = canvas;                          // elemento canvas HTML donde se dibujan las velas
        this.ctx = canvas.getContext('2d');          // contexto de dibujo 2D del canvas
        this.estadoPrecio = estadoPrecio;                    // instancia de SharedPriceState (rango de precios visible)
        this.velasVisibles = 80;                              // cantidad de velas que caben en pantalla
        this._desplazamiento = 0;                               // cuántas velas atrás desde la última (entero, ≥0)
        this._pixelesAcumulados = 0;                               // píxeles acumulados de arrastre parcial (sub-vela)
        this._fraccionDesplazamiento = 0;                          // offset fraccional de vela para desplazamiento suave
    }

    /**
     * _limitarDesplazamiento — Asegura que el desplazamiento no se salga de los límites.
     * maxRetroceso = máximo de velas que podemos retroceder, dejando al menos 1 visible.
     * @param {number} totalVelas — cantidad total de velas disponibles
     */
    _limitarDesplazamiento(totalVelas) {
        const maxRetroceso = Math.max(0, totalVelas - 1);
        if (this._desplazamiento > maxRetroceso) this._desplazamiento = maxRetroceso;
        if (this._desplazamiento < 0) this._desplazamiento = 0;
    }

    /**
     * visible (velasEnPantalla) — Obtiene el segmento de velas que se ven en pantalla.
     * Se usa para calcular el auto-rango de precios.
     * @param {Array} todas — todas las velas disponibles
     * @returns {Array} — subarray de velas visibles
     */
    visible(todas) {
        if (!todas.length) return [];
        this._limitarDesplazamiento(todas.length);

        const fin = todas.length - this._desplazamiento;       // índice final (exclusivo)
        const inicio = Math.max(0, fin - this.velasVisibles);     // índice inicial
        return todas.slice(inicio, fin);
    }

    /**
     * computeAutoRange (calcularAutoRango) — Calcula el rango mín/máx de precios
     * a partir de las velas visibles y lo aplica al estado de precios.
     * @param {Array} todas — todas las velas
     */
    computeAutoRange(todas) {
        const velasEnPantalla = this.visible(todas);
        if (!velasEnPantalla.length) return;
        let minimo = Infinity, maximo = -Infinity;
        velasEnPantalla.forEach(vela => {
            if (vela.low < minimo) minimo = vela.low;
            if (vela.high > maximo) maximo = vela.high;
        });
        this.estadoPrecio.setAutoRange(minimo, maximo);
    }

    /**
     * render (dibujar) — Dibuja todas las velas visibles en el canvas.
     * @param {number} ancho — ancho del canvas en píxeles CSS
     * @param {number} alto  — alto del canvas en píxeles CSS
     * @param {Array}  todas — todas las velas disponibles
     */
    render(ancho, alto, todas) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, ancho, alto); // limpiar canvas completo
        if (!todas.length) return;

        this._limitarDesplazamiento(todas.length);

        // ── Calcular ventana visible ──
        const fin = todas.length - this._desplazamiento;
        if (fin <= 0) return;

        // ¿Cuántas velas PODEMOS mostrar realmente?
        // Usar min(velasVisibles, total disponible) para que las velas no se encojan demasiado
        const cantidadEfectiva = Math.min(this.velasVisibles, todas.length);
        const inicioIdeal = fin - cantidadEfectiva;
        const inicioReal = Math.max(0, inicioIdeal - 1);         // 1 extra para suavidad en bordes
        const finReal = Math.min(todas.length, fin + 1);      // 1 extra al final
        const velasADibujar = todas.slice(inicioReal, finReal);
        if (!velasADibujar.length) return;

        // Espacio entre velas basado en cantidadEfectiva
        const espacioEntreVelas = ancho / cantidadEfectiva;
        const anchoCuerpo = Math.max(1, espacioEntreVelas * RATIO_CUERPO_VELA); // ancho mínimo 1px
        const precioAPixelY = (precio) => this.estadoPrecio.priceToY(precio, alto); // convertir precio → coordenada Y

        // Desplazamiento fraccional en píxeles para pan suave sub-vela
        const desplazamientoFraccionalPx = this._fraccionDesplazamiento * espacioEntreVelas;

        // Alineación de ranuras: alinear velas a la derecha del gráfico
        // velasADibujar[0] en índice `inicioReal` mapea a ranura (inicioReal - inicioIdeal)
        const offsetRanura = inicioReal - inicioIdeal;

        velasADibujar.forEach((vela, indice) => {
            const ranura = indice + offsetRanura;
            const centroX = ranura * espacioEntreVelas + espacioEntreVelas / 2 + desplazamientoFraccionalPx;

            // Descartar velas completamente fuera de pantalla
            if (centroX < -espacioEntreVelas || centroX > ancho + espacioEntreVelas) return;

            const esAlcista = vela.close >= vela.open;                          // true = vela verde (subió)
            const topeCuerpo = precioAPixelY(Math.max(vela.open, vela.close));   // Y del borde superior del cuerpo
            const baseCuerpo = precioAPixelY(Math.min(vela.open, vela.close));   // Y del borde inferior del cuerpo
            const alturaCuerpo = Math.max(1, baseCuerpo - topeCuerpo);             // altura mínima 1px
            const colorVela = esAlcista ? '#22c55e' : '#ef4444';                // verde alcista, rojo bajista

            // Mecha (línea vertical de máximo a mínimo)
            ctx.strokeStyle = colorVela;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(centroX, precioAPixelY(vela.high));  // punta superior: precio máximo
            ctx.lineTo(centroX, precioAPixelY(vela.low));   // punta inferior: precio mínimo
            ctx.stroke();

            // Cuerpo (rectángulo de apertura a cierre)
            ctx.fillStyle = esAlcista ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)';
            ctx.fillRect(centroX - anchoCuerpo / 2, topeCuerpo, anchoCuerpo, alturaCuerpo);
            ctx.strokeStyle = colorVela;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(centroX - anchoCuerpo / 2, topeCuerpo, anchoCuerpo, alturaCuerpo);
        });

        // Línea punteada del precio actual (solo cuando se ven las velas más recientes)
        if (this._desplazamiento === 0) {
            const ultimaVela = todas[todas.length - 1];
            if (ultimaVela) {
                const posY = precioAPixelY(ultimaVela.close);
                const esUltimaAlcista = ultimaVela.close >= ultimaVela.open;
                ctx.setLineDash([4, 4]); // patrón de línea punteada: 4px línea, 4px espacio
                ctx.strokeStyle = esUltimaAlcista ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, posY);
                ctx.lineTo(ancho, posY);
                ctx.stroke();
                ctx.setLineDash([]); // restaurar línea sólida
            }
        }
    }

    /**
     * zoom (aplicarZoom) — Cambia la cantidad de velas visibles.
     * Factor > 1 = alejar (ver más velas), factor < 1 = acercar (ver menos velas).
     * Límites: mínimo 15 velas, máximo 300 velas.
     * @param {number} factor — multiplicador de zoom
     */
    zoom(factor) {
        this.velasVisibles = Math.max(15, Math.min(300, Math.round(this.velasVisibles * factor)));
    }

    /**
     * pan (desplazar) — Desplaza el gráfico horizontalmente por deltaPx píxeles.
     * Convierte píxeles de arrastre en movimiento de velas enteras + fracción suave.
     * Devuelve true si se cruzó al menos una vela completa.
     * NO toca autoRange — el controlador decide cuándo recalcular.
     * @param {number} deltaPx      — píxeles de movimiento horizontal del ratón
     * @param {number} anchoGrafico — ancho total del gráfico en píxeles
     * @returns {boolean} — true si se movió al menos una vela entera
     */
    pan(deltaPx, anchoGrafico) {
        const anchoVela = anchoGrafico / this.velasVisibles;  // ancho de una vela en píxeles
        this._pixelesAcumulados += deltaPx;
        let seMovio = false;

        // Parte entera: mover velas completas
        const velasMovidas = Math.trunc(this._pixelesAcumulados / anchoVela);
        if (velasMovidas !== 0) {
            this._pixelesAcumulados -= velasMovidas * anchoVela;
            this._desplazamiento += velasMovidas;
            if (this._desplazamiento < 0) this._desplazamiento = 0;
            // Nota: el límite superior se aplica en render() via _limitarDesplazamiento
            seMovio = true;
        }

        // Parte fraccional: desplazamiento suave sub-vela
        this._fraccionDesplazamiento = this._pixelesAcumulados / anchoVela;
        return seMovio;
    }

    /**
     * resetPan (resetearDesplazamiento) — Reinicia todo el estado de pan al origen.
     * Vuelve a mostrar las velas más recientes.
     */
    resetPan() {
        this._desplazamiento = 0;
        this._pixelesAcumulados = 0;
        this._fraccionDesplazamiento = 0;
    }
};