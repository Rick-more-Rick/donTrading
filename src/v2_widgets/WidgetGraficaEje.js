/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  WidgetGraficaEje.js — Eje de Precio (columna derecha de la gráfica)      ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Motores internos (de motores_chart.js — sin dependencias externas):        ║
 * ║    PriceAxisRenderer  → etiquetas de precio, gridlines, tag del precio      ║
 * ║    SharedPriceState   → compartido con WidgetGraficaVelas (zoom vertical)   ║
 * ║    ✓ Zoom vertical: drag (↕ arrastrar) + scroll wheel                      ║
 * ║    ✓ Doble clic → resetear zoom vertical                                    ║
 * ║  Dependencias: motores_chart.js (cargar antes en Pruebav2.html)             ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

class WidgetGraficaEje extends ClaseBaseWidget {

    constructor(contenedor, configuracion = {}) {
        super(contenedor, configuracion);

        /** @type {SharedPriceState|null} — compartido con WidgetGraficaVelas */
        this.estadoPrecio = configuracion.estadoPrecio || null;

        /** @type {PriceAxisRenderer|null} */
        this._renderer = null;

        this._precioActual = 0;
        this._precioInicial = 0;

        // Zoom vertical por arrastre
        this._axisDrag = false;
        this._axisDragStartY = 0;
        this._hdAxisMove = null;
        this._hdAxisUp = null;

        // Dimensiones
        this._aw = 0;
        this._ah = 0;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  CICLO DE VIDA
    // ════════════════════════════════════════════════════════════════════════

    inicializar() {
        super.inicializar();

        // Escuchar el precio que emite WidgetGraficaVelas
        this._escuchar(EVENTOS.CAMBIO_PRECIO, (payload) => {
            this._precioActual = payload.precio || 0;
            if (!this._precioInicial && this._precioActual) {
                this._precioInicial = this._precioActual;
            }
            // SharedPriceState es la misma referencia → rango ya actualizado
        });

        // Al cambiar activo, limpiar precio
        this._escuchar(EVENTOS.CAMBIO_ACTIVO, () => {
            this._precioActual = 0;
            this._precioInicial = 0;
        });
    }

    renderizar() {
        this.contenedor.innerHTML = '';
        this.contenedor.classList.add('v2-grafica-eje-wrap');
        this.contenedor.title = 'Arrastra ↕ para zoom vertical · Doble clic para resetear';
        this.contenedor.style.cursor = 'ns-resize';

        // Canvas del eje de precio
        this._canvas = document.createElement('canvas');
        this._canvas.className = 'v2-canvas-eje';
        this.contenedor.appendChild(this._canvas);

        // Instanciar renderer si ya hay estadoPrecio
        if (this.estadoPrecio) {
            this._renderer = new PriceAxisRenderer(this._canvas, this.estadoPrecio);
        }

        // ResizeObserver
        this._resizeObserver = new ResizeObserver(() => this._resize());
        this._resizeObserver.observe(this.contenedor);
        this._resize();

        // Eventos de interacción
        this._bindEventos();

        // Bucle de renderizado
        this._iniciarLoop();
    }

    destruir() {
        if (this._rafId) cancelAnimationFrame(this._rafId);
        if (this._resizeObserver) this._resizeObserver.disconnect();
        if (this._hdAxisMove) window.removeEventListener('mousemove', this._hdAxisMove);
        if (this._hdAxisUp) window.removeEventListener('mouseup', this._hdAxisUp);
        super.destruir();
    }

    // ════════════════════════════════════════════════════════════════════════
    //  API PÚBLICA
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Actualiza la referencia al SharedPriceState compartido.
     * Llamado desde WidgetGraficaVelas.vincularEje().
     * @param {SharedPriceState} estado
     */
    actualizarEstadoPrecio(estado) {
        this.estadoPrecio = estado;
        if (this._canvas) {
            this._renderer = new PriceAxisRenderer(this._canvas, this.estadoPrecio);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  RESIZE
    // ════════════════════════════════════════════════════════════════════════

    _resize() {
        if (!this._canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const w = this.contenedor.clientWidth;
        const h = this.contenedor.clientHeight;
        if (!w || !h) return;

        this._canvas.width = Math.round(w * dpr);
        this._canvas.height = Math.round(h * dpr);
        this._canvas.style.width = w + 'px';
        this._canvas.style.height = h + 'px';
        this._canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
        this._aw = w;
        this._ah = h;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  BUCLE DE RENDERIZADO
    // ════════════════════════════════════════════════════════════════════════

    _iniciarLoop() {
        const loop = () => {
            this._rafId = requestAnimationFrame(loop);
            if (!this._renderer || !this._aw) return;
            this._renderer.render(this._aw, this._ah, this._precioActual, this._precioInicial);
        };
        requestAnimationFrame(loop);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  INTERACCIONES ZOOM VERTICAL
    // ════════════════════════════════════════════════════════════════════════

    _bindEventos() {
        const el = this.contenedor;

        // Scroll wheel → zoom vertical
        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (!this.estadoPrecio) return;
            const rect = el.getBoundingClientRect();
            const centerRatio = (e.clientY - rect.top) / rect.height;
            this.estadoPrecio.applyManualZoom(e.deltaY > 0 ? 6 : -6, centerRatio);
        }, { passive: false });

        // Drag ↕ → zoom vertical
        el.addEventListener('mousedown', (e) => {
            this._axisDrag = true;
            this._axisDragStartY = e.clientY;
            document.body.style.cursor = 'ns-resize';
            e.preventDefault();
        });

        this._hdAxisMove = (e) => {
            if (!this._axisDrag || !this.estadoPrecio) return;
            const dy = e.clientY - this._axisDragStartY;
            this._axisDragStartY = e.clientY;
            const rect = el.getBoundingClientRect();
            this.estadoPrecio.applyManualDrag(dy, rect.height);
        };

        this._hdAxisUp = () => {
            if (!this._axisDrag) return;
            this._axisDrag = false;
            document.body.style.cursor = '';
        };

        window.addEventListener('mousemove', this._hdAxisMove);
        window.addEventListener('mouseup', this._hdAxisUp);

        // Doble clic → resetear zoom vertical
        el.addEventListener('dblclick', () => {
            if (this.estadoPrecio) this.estadoPrecio.resetZoom();
        });
    }
}
