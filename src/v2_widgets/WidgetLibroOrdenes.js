/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  WidgetLibroOrdenes.js — Order Book L2 Optimizado con Canvas           ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Reescritura completa del Order Book:                                   ║
 * ║    - Renderizado con Canvas + requestAnimationFrame                     ║
 * ║    - Autónomo: recibe paso_precio y precision desde configuración      ║
 * ║    - Responde a CAMBIO_ESCALA para ajustar altura de filas             ║
 * ║    - Limpieza automática al cambiar de activo                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

class WidgetLibroOrdenes extends ClaseBaseWidget {

    constructor(contenedor, configuracion = {}) {
        super(contenedor, configuracion);

        // ── Configuración (se actualiza con CAMBIO_ACTIVO) ──
        this._paso_precio = configuracion.paso_precio || 0.01;
        this._precision = configuracion.precision || 2;
        this._simbolo = configuracion.simbolo || '';

        // ── Estado del book ──
        this._bids = [];
        this._asks = [];
        this._spread = 0;
        this._mid_price = 0;
        this._best_bid = 0;
        this._best_ask = 0;
        this._updates = 0;
        this._num_exchanges_bid = 0;
        this._num_exchanges_ask = 0;

        // ── Renderizado ──
        /** @type {HTMLCanvasElement|null} */
        this._canvas = null;
        /** @type {CanvasRenderingContext2D|null} */
        this._ctx = null;
        this._alturaFila = configuracion.alturaFila || 18;
        this._filasTotales = 0;
        this._animFrameId = null;
        this._datosActualizados = false;

        // ── Colores ──
        this._colores = {
            fondo: '#111827',
            fondoFila: '#0f172a',
            texto: '#e2e8f0',
            textoSecundario: '#94a3b8',
            textoMuted: '#475569',
            borde: '#1e293b',
            verde: '#22c55e',
            rojo: '#ef4444',
            verdeBarFondo: 'rgba(34, 197, 94, 0.12)',
            rojoBarFondo: 'rgba(239, 68, 68, 0.12)',
            verdeBarra: 'rgba(34, 197, 94, 0.35)',
            rojoBarra: 'rgba(239, 68, 68, 0.35)',
            spreadFondo: '#1a2332',
            spreadTexto: '#f59e0b',
        };
    }

    // ══════════════════════════════════════════════════════════════════════
    //  CICLO DE VIDA
    // ══════════════════════════════════════════════════════════════════════

    inicializar() {
        super.inicializar();

        // Escuchar datos del Order Book
        this._escuchar(EVENTOS.DATOS_BOOK, (datos) => {
            this._alRecibirBook(datos);
        });

        // Escuchar cambio de activo para resetear
        this._escuchar(EVENTOS.CAMBIO_ACTIVO, (datos) => {
            this._alCambiarActivo(datos);
        });

        // Escuchar cambio de escala desde la gráfica
        this._escuchar(EVENTOS.CAMBIO_ESCALA, (datos) => {
            if (datos.pixelesPorNivel) {
                this._alturaFila = Math.max(14, Math.min(30, datos.pixelesPorNivel));
                this._datosActualizados = true;
            }
        });
    }

    renderizar() {
        this.contenedor.innerHTML = '';
        this.contenedor.classList.add('v2-libro-ordenes');

        // ── Cabecera ──
        this._cabecera = this._crearElemento('div', 'v2-ob-cabecera');
        this._cabecera.innerHTML = `
            <span class="v2-ob-titulo">📊 Libro de Órdenes</span>
            <span class="v2-ob-simbolo" id="ob-simbolo-label">${this._simbolo || '—'}</span>
        `;

        // ── Canvas principal ──
        this._canvas = document.createElement('canvas');
        this._canvas.className = 'v2-ob-canvas';
        this.contenedor.appendChild(this._canvas);
        this._ctx = this._canvas.getContext('2d');

        // ── Pie ──
        this._pie = this._crearElemento('div', 'v2-ob-pie');
        this._pie.innerHTML = `
            <span id="ob-updates">Actualizaciones: 0</span>
            <span id="ob-exchanges">Exchanges: 0/0</span>
        `;

        // Ajustar tamaño del canvas
        this._ajustarTamanoCanvas();

        // Iniciar loop de renderizado
        this._iniciarLoopRenderizado();

        // Observar redimensionamiento
        this._resizeObserver = new ResizeObserver(() => {
            this._ajustarTamanoCanvas();
            this._datosActualizados = true;
        });
        this._resizeObserver.observe(this.contenedor);
    }

    destruir() {
        // Cancelar animación
        if (this._animFrameId) {
            cancelAnimationFrame(this._animFrameId);
            this._animFrameId = null;
        }

        // Desconectar observer
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }

        super.destruir();
    }

    // ══════════════════════════════════════════════════════════════════════
    //  RECEPCIÓN DE DATOS
    // ══════════════════════════════════════════════════════════════════════

    _alRecibirBook(datos) {
        // Solo procesar datos del símbolo activo
        if (datos.simbolo !== this._simbolo) return;

        this._bids = datos.bids || [];
        this._asks = datos.asks || [];
        this._spread = datos.spread || 0;
        this._mid_price = datos.mid_price || 0;
        this._best_bid = datos.best_bid || 0;
        this._best_ask = datos.best_ask || 0;
        this._updates = datos.updates || 0;
        this._num_exchanges_bid = datos.num_exchanges_bid || 0;
        this._num_exchanges_ask = datos.num_exchanges_ask || 0;

        this._datosActualizados = true;
    }

    _alCambiarActivo(datos) {
        const cfg = datos.configuracion;
        this._simbolo = cfg.simbolo;
        this._paso_precio = cfg.paso_precio;
        this._precision = cfg.precision;

        // Resetear estado
        this._bids = [];
        this._asks = [];
        this._spread = 0;
        this._mid_price = 0;
        this._best_bid = 0;
        this._best_ask = 0;
        this._updates = 0;

        // Actualizar etiqueta
        const label = this.contenedor.querySelector('#ob-simbolo-label');
        if (label) label.textContent = this._simbolo;

        this._datosActualizados = true;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  RENDERIZADO CON CANVAS + requestAnimationFrame
    // ══════════════════════════════════════════════════════════════════════

    _ajustarTamanoCanvas() {
        if (!this._canvas) return;
        const rect = this._canvas.parentElement.getBoundingClientRect();
        // El canvas ocupa todo excepto cabecera (32px) y pie (24px)
        const alturaDisponible = this.contenedor.offsetHeight - 56;
        const anchoDisponible = this.contenedor.offsetWidth;

        const dpr = window.devicePixelRatio || 1;
        this._canvas.width = anchoDisponible * dpr;
        this._canvas.height = Math.max(100, alturaDisponible) * dpr;
        this._canvas.style.width = anchoDisponible + 'px';
        this._canvas.style.height = Math.max(100, alturaDisponible) + 'px';
        this._ctx.scale(dpr, dpr);

        this._anchoLogico = anchoDisponible;
        this._altoLogico = Math.max(100, alturaDisponible);
        this._filasTotales = Math.floor(this._altoLogico / this._alturaFila);
    }

    _iniciarLoopRenderizado() {
        const loop = () => {
            if (this._destruido) return;

            if (this._datosActualizados) {
                this._dibujar();
                this._datosActualizados = false;
            }

            this._animFrameId = requestAnimationFrame(loop);
        };
        this._animFrameId = requestAnimationFrame(loop);
    }

    _dibujar() {
        const ctx = this._ctx;
        if (!ctx) return;

        const W = this._anchoLogico;
        const H = this._altoLogico;
        const hFila = this._alturaFila;

        // Limpiar
        ctx.fillStyle = this._colores.fondo;
        ctx.fillRect(0, 0, W, H);

        // ── Si no hay datos, mostrar placeholder ──
        if (this._bids.length === 0 && this._asks.length === 0) {
            ctx.fillStyle = this._colores.textoMuted;
            ctx.font = '12px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Esperando datos del Order Book...', W / 2, H / 2);
            return;
        }

        // ── Calcular filas disponibles para cada lado ──
        const filasSpread = 1;
        const filasDisponibles = this._filasTotales - filasSpread;
        const filasAsk = Math.floor(filasDisponibles / 2);
        const filasBid = filasDisponibles - filasAsk;

        const asksVisibles = this._asks.slice(0, filasAsk).reverse(); // Asks arriba (precio desc)
        const bidsVisibles = this._bids.slice(0, filasBid);          // Bids abajo (precio desc)

        // ── Calcular volumen máximo para barras proporcionales ──
        const maxVolumen = Math.max(
            ...asksVisibles.map(a => a.acumulado || a.tamano),
            ...bidsVisibles.map(b => b.acumulado || b.tamano),
            1
        );

        let y = 0;

        // ── Columnas ──
        const colPrecio = W * 0.42;
        const colVol = W * 0.72;
        const colAcum = W * 0.95;
        const paddingIzq = 8;

        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textBaseline = 'middle';

        // ── ASKS (arriba, rojas) ──
        for (let i = 0; i < asksVisibles.length; i++) {
            const ask = asksVisibles[i];
            const yFila = y;
            const yTexto = yFila + hFila / 2;

            // Barra de profundidad (de derecha a izquierda)
            const ratioAcum = (ask.acumulado || ask.tamano) / maxVolumen;
            const anchoBarra = W * ratioAcum;
            ctx.fillStyle = this._colores.rojoBarFondo;
            ctx.fillRect(W - anchoBarra, yFila, anchoBarra, hFila - 1);

            // Precio
            ctx.fillStyle = this._colores.rojo;
            ctx.textAlign = 'right';
            ctx.fillText('$' + ask.precio.toFixed(this._precision), colPrecio, yTexto);

            // Volumen
            ctx.fillStyle = this._colores.texto;
            ctx.textAlign = 'right';
            ctx.fillText(this._formatearVolumen(ask.tamano), colVol, yTexto);

            // Acumulado
            ctx.fillStyle = this._colores.textoSecundario;
            ctx.textAlign = 'right';
            ctx.fillText(this._formatearVolumen(ask.acumulado || ask.tamano), colAcum, yTexto);

            y += hFila;
        }

        // ── SPREAD (fila central) ──
        const ySpread = y;
        ctx.fillStyle = this._colores.spreadFondo;
        ctx.fillRect(0, ySpread, W, hFila);

        ctx.fillStyle = this._colores.spreadTexto;
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const textoSpread = `Spread: $${this._spread.toFixed(this._precision)}  |  Mid: $${this._mid_price.toFixed(this._precision)}`;
        ctx.fillText(textoSpread, W / 2, ySpread + hFila / 2);

        ctx.font = '11px "JetBrains Mono", monospace';
        y = ySpread + hFila;

        // ── BIDS (abajo, verdes) ──
        for (let i = 0; i < bidsVisibles.length; i++) {
            const bid = bidsVisibles[i];
            const yFila = y;
            const yTexto = yFila + hFila / 2;

            // Barra de profundidad
            const ratioAcum = (bid.acumulado || bid.tamano) / maxVolumen;
            const anchoBarra = W * ratioAcum;
            ctx.fillStyle = this._colores.verdeBarFondo;
            ctx.fillRect(W - anchoBarra, yFila, anchoBarra, hFila - 1);

            // Precio
            ctx.fillStyle = this._colores.verde;
            ctx.textAlign = 'right';
            ctx.fillText('$' + bid.precio.toFixed(this._precision), colPrecio, yTexto);

            // Volumen
            ctx.fillStyle = this._colores.texto;
            ctx.textAlign = 'right';
            ctx.fillText(this._formatearVolumen(bid.tamano), colVol, yTexto);

            // Acumulado
            ctx.fillStyle = this._colores.textoSecundario;
            ctx.textAlign = 'right';
            ctx.fillText(this._formatearVolumen(bid.acumulado || bid.tamano), colAcum, yTexto);

            y += hFila;
        }

        // ── Cabecera de columnas (superpuesta arriba) ──
        ctx.fillStyle = 'rgba(17, 24, 39, 0.85)';
        ctx.fillRect(0, 0, W, 16);
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = this._colores.textoMuted;
        ctx.textAlign = 'right';
        ctx.fillText('PRECIO', colPrecio, 10);
        ctx.fillText('VOL', colVol, 10);
        ctx.fillText('ACUM', colAcum, 10);

        // ── Actualizar pie ──
        const elUpdates = this.contenedor.querySelector('#ob-updates');
        const elExchanges = this.contenedor.querySelector('#ob-exchanges');
        if (elUpdates) elUpdates.textContent = `Updates: ${this._updates.toLocaleString()}`;
        if (elExchanges) elExchanges.textContent = `Exch: ${this._num_exchanges_bid}/${this._num_exchanges_ask}`;
    }

    // ── Helpers ──

    _formatearVolumen(vol) {
        if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + 'M';
        if (vol >= 1_000) return (vol / 1_000).toFixed(1) + 'K';
        return vol.toLocaleString();
    }
}