/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  WidgetSelectorTiempo.js — Selector de Temporalidades                  ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Renderiza botones de timeframe (5s, 1m, 5m, 15m, 1H).                ║
 * ║  Al seleccionar, emite CAMBIO_TIMEFRAME al bus de eventos.             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

class WidgetSelectorTiempo extends ClaseBaseWidget {

    constructor(contenedor, configuracion = {}) {
        super(contenedor, configuracion);

        /** @type {number} Timeframe activo en segundos */
        this._timeframeActivo = configuracion.timeframeInicial || 60;

        /** @type {Map<number, HTMLElement>} Mapa de botones por segundos */
        this._botones = new Map();
    }

    // ── Ciclo de vida ──

    inicializar() {
        super.inicializar();
    }

    renderizar() {
        this.contenedor.innerHTML = '';
        this.contenedor.classList.add('v2-selector-tiempo');

        const timeframes = FabricaWidgets.obtenerTimeframes();

        for (const tf of timeframes) {
            const boton = document.createElement('button');
            boton.className = 'v2-btn-timeframe';
            boton.textContent = tf.etiqueta;
            boton.dataset.segundos = tf.segundos;

            if (tf.segundos === this._timeframeActivo) {
                boton.classList.add('activo');
            }

            boton.addEventListener('click', () => {
                this._seleccionarTimeframe(tf.segundos, tf.etiqueta);
            });

            this.contenedor.appendChild(boton);
            this._botones.set(tf.segundos, boton);
        }
    }

    destruir() {
        this._botones.clear();
        super.destruir();
    }

    // ── Lógica interna ──

    _seleccionarTimeframe(segundos, etiqueta) {
        if (segundos === this._timeframeActivo) return;

        this._timeframeActivo = segundos;

        // Actualizar clases activas
        for (const [seg, boton] of this._botones) {
            boton.classList.toggle('activo', seg === segundos);
        }

        // Emitir evento global
        this._emitir(EVENTOS.CAMBIO_TIMEFRAME, {
            timeframe_seg: segundos,
            etiqueta: etiqueta,
        });

        console.log(`[SelectorTiempo] Timeframe seleccionado: ${etiqueta} (${segundos}s)`);
    }
}