/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  WidgetLibroOrdenes.js — Widget del Libro de Órdenes v3                ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Arquitectura (DEFINITIVA):                                             ║
 * ║    · GestorWidgets gestiona el WebSocket :8766 y emite DATOS_BOOK      ║
 * ║    · Este widget SOLO escucha el bus:                                   ║
 * ║        - DATOS_BOOK  → engine.feedBook()                               ║
 * ║        - CAMBIO_ACTIVO → limpiar book + esperar nuevos datos           ║
 * ║        - CAMBIO_PRECIO → engine.syncScale()                            ║
 * ║    · Sin WebSocket propio — evita la doble conexión al mismo server    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

class WidgetLibroOrdenes extends ClaseBaseWidget {

    /**
     * @param {HTMLElement} contenedor
     * @param {Object} [config]
     * @param {string}  [config.simbolo='AAPL'] Símbolo inicial
     */
    constructor(contenedor, config = {}) {
        super(contenedor, config);

        this._simbolo = config.simbolo || '';
        /** @type {OrderbookEngine|null} */
        this._engine = null;
        this._primerDato = false;
        this._timerNoData = null;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  CICLO DE VIDA
    // ════════════════════════════════════════════════════════════════════════

    renderizar() {
        // Asegura que el contenedor sea un flex-column que llena el panel
        this.contenedor.style.cssText =
            'display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;';

        // Montar OrderbookEngine en el contenedor directamente
        this._montarEngine();

        // Conectar al bus de eventos
        this._suscribirBus();

        console.log(`[WidgetLibroOrdenes] 🟢 renderizar() | símbolo: ${this._simbolo || '(ninguno)'}`);
    }

    destruir() {
        clearTimeout(this._timerNoData);
        if (this._engine) {
            this._engine.destroy();
            this._engine = null;
        }
        super.destruir();  // limpia _desuscripciones del bus
    }

    // ════════════════════════════════════════════════════════════════════════
    //  ENGINE (MotorOrderBook.js — window.OrderbookEngine)
    // ════════════════════════════════════════════════════════════════════════

    _montarEngine() {
        if (typeof OrderbookEngine === 'undefined') {
            console.error('[WidgetLibroOrdenes] ❌ OrderbookEngine no cargado. Verifica que MotorOrderBook.js esté en el HTML antes que WidgetLibroOrdenes.js.');
            this.contenedor.innerHTML =
                '<div style="color:#ef4444;padding:16px;font-size:11px;">⚠ Motor no disponible</div>';
            return;
        }
        try {
            this._engine = new OrderbookEngine(this.contenedor);
            this._engine.setStatus('Esperando datos…', false);
            console.log('[WidgetLibroOrdenes] ✅ OrderbookEngine montado');
        } catch (err) {
            console.error('[WidgetLibroOrdenes] Error montando engine:', err);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  BUS DE EVENTOS
    // ════════════════════════════════════════════════════════════════════════

    _suscribirBus() {

        // ── Datos del book (emitidos por GestorWidgets desde :8766) ─────────
        this._escuchar(EVENTOS.DATOS_BOOK, (datos) => {
            if (!this._engine) return;

            // ── IMPORTANTE: normalizar campos del servidor ──
            // El servidor envía: precio, tamano, acumulado (español)
            // El engine espera: bids/asks como arrays de {precio, tamano, acumulado}
            const rawBids = datos.bids || [];
            const rawAsks = datos.asks || [];

            // Verificar que hay datos reales (bids o asks no vacíos)
            if (rawBids.length === 0 && rawAsks.length === 0) {
                // Snapshot vacío → solo limpiar, no mostrar error
                this._engine.feedBook({
                    bids: [], asks: [],
                    best_bid: 0, best_ask: 0,
                    spread: 0, mid_price: 0, updates: 0,
                });
                return;
            }

            // Primer dato tras carga → quitar loading
            if (!this._primerDato) {
                this._primerDato = true;
                clearTimeout(this._timerNoData);
                this._engine.setStatus('', true);
                console.log(`[WidgetLibroOrdenes] 📖 Primer snapshot → ${this._simbolo} | bids: ${rawBids.length} | asks: ${rawAsks.length}`);
            }

            this._engine.feedBook({
                bids: rawBids,
                asks: rawAsks,
                best_bid: datos.best_bid ?? 0,
                best_ask: datos.best_ask ?? 0,
                spread: datos.spread ?? 0,
                mid_price: datos.mid_price ?? 0,
                updates: datos.updates ?? 0,
            });
        });

        // ── Cambio de activo → limpiar book anterior ─────────────────────────
        this._escuchar(EVENTOS.CAMBIO_ACTIVO, (datos) => {
            const nuevo = datos.simbolo;
            if (!nuevo) return;

            const cambio = nuevo !== this._simbolo;
            this._simbolo = nuevo;
            this._primerDato = false;

            if (this._engine) {
                // Borrar contenido del engine (bids/asks vacíos)
                this._engine.feedBook({
                    bids: [], asks: [],
                    best_bid: 0, best_ask: 0,
                    spread: 0, mid_price: 0, updates: 0,
                });
                this._engine.resetScale();
                this._engine.setStatus(`${nuevo}…`, false);
            }

            // Si en 8 segundos no llegan datos, mostrar mensaje de error
            clearTimeout(this._timerNoData);
            this._timerNoData = setTimeout(() => {
                if (!this._primerDato && this._engine) {
                    this._engine.setStatus(`Sin datos: ${nuevo}`, false);
                    console.warn(`[WidgetLibroOrdenes] ⚠ Sin datos en 8s para ${nuevo}`);
                }
            }, 8000);

            if (cambio) {
                console.log(`[WidgetLibroOrdenes] 🔄 CAMBIO_ACTIVO → ${nuevo}`);
            }
        });

        // ── Sincronización de escala con el zoom de la gráfica ───────────────
        this._escuchar(EVENTOS.CAMBIO_PRECIO, (datos) => {
            if (!this._engine) return;
            const min = datos.precioMin ?? datos.min_price;
            const max = datos.precioMax ?? datos.max_price;
            if (typeof min === 'number' && typeof max === 'number' && max > min) {
                this._engine.syncScale(min, max);
            }
        });

        // ── Estado de conexión del WS (publicado por GestorWidgets) ─────────
        this._escuchar(EVENTOS.CONEXION_ESTADO, (datos) => {
            if (!this._engine || datos.tipo !== 'book') return;
            if (!datos.conectado) {
                this._engine.setStatus('Desconectado…', false);
            } else if (!this._primerDato) {
                this._engine.setStatus(`${this._simbolo || ''}…`, false);
            }
        });
    }
}