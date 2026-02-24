/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ClaseBaseWidget.js — Clase Base + Sistema de Eventos (Pub/Sub)        ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Ciclo de vida: inicializar → renderizar → actualizar → destruir       ║
 * ║  Comunicación desacoplada entre widgets via BusEventos global          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

// ══════════════════════════════════════════════════════════════════════════
//  BUS DE EVENTOS GLOBAL — Pub/Sub desacoplado entre widgets
// ══════════════════════════════════════════════════════════════════════════

class BusEventos {
    /**
     * Mediador de comunicación entre widgets.
     * Permite emitir y escuchar eventos sin acoplamiento directo.
     *
     * Eventos del sistema:
     *   CAMBIO_ACTIVO     → { simbolo, mercado, configuracion }
     *   CAMBIO_TIMEFRAME  → { timeframe_seg, etiqueta }
     *   DATOS_TICK         → { simbolo, time, value }
     *   DATOS_BOOK         → { simbolo, bids, asks, spread, mid_price }
     *   DATOS_INIT         → { simbolo, datos, timeframe }
     *   CAMBIO_ESCALA      → { pixelesPorNivel }
     *   SESION_MERCADO     → { session, label, is_open }
     *   CONEXION_ESTADO    → { tipo, conectado }
     */

    constructor() {
        /** @type {Map<string, Set<Function>>} */
        this._suscriptores = new Map();
        this._historial = new Map();  // Último valor emitido por evento
    }

    /**
     * Suscribe un callback a un evento.
     * @param {string} evento - Nombre del evento
     * @param {Function} callback - Función a ejecutar
     * @returns {Function} Función para desuscribirse
     */
    suscribir(evento, callback) {
        if (!this._suscriptores.has(evento)) {
            this._suscriptores.set(evento, new Set());
        }
        this._suscriptores.get(evento).add(callback);

        // Retornar función de limpieza (unsub)
        return () => {
            const conjunto = this._suscriptores.get(evento);
            if (conjunto) {
                conjunto.delete(callback);
                if (conjunto.size === 0) {
                    this._suscriptores.delete(evento);
                }
            }
        };
    }

    /**
     * Emite un evento a todos los suscriptores.
     * @param {string} evento - Nombre del evento
     * @param {*} datos - Datos a enviar
     */
    emitir(evento, datos) {
        this._historial.set(evento, datos);
        const conjunto = this._suscriptores.get(evento);
        if (!conjunto) return;

        for (const cb of conjunto) {
            try {
                cb(datos);
            } catch (error) {
                console.error(`[BusEventos] Error en suscriptor de '${evento}':`, error);
            }
        }
    }

    /**
     * Obtiene el último valor emitido para un evento (útil para widgets tardíos).
     * @param {string} evento
     * @returns {*|null}
     */
    obtenerUltimo(evento) {
        return this._historial.get(evento) ?? null;
    }

    /**
     * Elimina TODOS los suscriptores (usado al destruir la app).
     */
    limpiarTodo() {
        this._suscriptores.clear();
        this._historial.clear();
    }
}

// ── Instancia global compartida ──
const busEventos = new BusEventos();


// ══════════════════════════════════════════════════════════════════════════
//  NOMBRES DE EVENTOS — Constantes para evitar typos
// ══════════════════════════════════════════════════════════════════════════

const EVENTOS = Object.freeze({
    CAMBIO_ACTIVO: 'CAMBIO_ACTIVO',
    CAMBIO_TIMEFRAME: 'CAMBIO_TIMEFRAME',
    CAMBIO_PRECIO: 'CAMBIO_PRECIO',              // Emitido por WidgetGraficaVelas con precio + rango
    DATOS_TICK: 'DATOS_TICK',
    DATOS_BOOK: 'DATOS_BOOK',
    DATOS_INIT: 'DATOS_INIT',
    CAMBIO_ESCALA: 'CAMBIO_ESCALA',
    SESION_MERCADO: 'SESION_MERCADO',
    CONEXION_ESTADO: 'CONEXION_ESTADO',
    SIMBOLOS_DISPONIBLES: 'SIMBOLOS_DISPONIBLES',
    ESTADO_MERCADO_CERRADO: 'ESTADO_MERCADO_CERRADO',  // Gráfica detectó cierre/fin de semana
    ESTADO_MERCADO_ABIERTO: 'ESTADO_MERCADO_ABIERTO',  // Gráfica detectó apertura/lunes
    PRECIO_OB_SYNC: 'PRECIO_OB_SYNC',           // Order Book → Gráfica: mid_price del L2 en tiempo real
});



// ══════════════════════════════════════════════════════════════════════════
//  CLASE BASE WIDGET — Ciclo de vida estandarizado
// ══════════════════════════════════════════════════════════════════════════

class ClaseBaseWidget {
    /**
     * Clase abstracta que define el ciclo de vida de todo widget.
     *
     * @param {HTMLElement} contenedor - Elemento DOM donde se monta el widget
     * @param {Object} configuracion - Config específica del widget
     */
    constructor(contenedor, configuracion = {}) {
        if (new.target === ClaseBaseWidget) {
            throw new Error('ClaseBaseWidget es abstracta — no instanciar directamente.');
        }

        /** @type {HTMLElement} */
        this.contenedor = contenedor;

        /** @type {Object} */
        this.config = { ...configuracion };

        /** @type {boolean} */
        this._inicializado = false;

        /** @type {boolean} */
        this._destruido = false;

        /** @type {Function[]} - Funciones de limpieza de suscripciones */
        this._desuscripciones = [];
    }

    // ── Ciclo de vida ──

    /**
     * Fase 1: Preparar estado interno, crear elementos DOM, suscribirse a eventos.
     * Las subclases DEBEN llamar super.inicializar() al inicio.
     */
    inicializar() {
        if (this._inicializado) return;
        this._inicializado = true;
    }

    /**
     * Fase 2: Dibujar la interfaz inicial del widget.
     * Se llama después de inicializar().
     */
    renderizar() {
        // Implementar en subclases
    }

    /**
     * Fase 3: Actualizar con nuevos datos (llamado repetidamente).
     * @param {*} datos - Datos nuevos específicos del widget
     */
    actualizar(_datos) {
        // Implementar en subclases
    }

    /**
     * Fase 4: Limpiar todo — desuscribir eventos, eliminar DOM, liberar memoria.
     * Las subclases DEBEN llamar super.destruir() al final.
     */
    destruir() {
        // Desuscribir todos los eventos
        for (const desuscribir of this._desuscripciones) {
            desuscribir();
        }
        this._desuscripciones = [];

        // Limpiar DOM
        if (this.contenedor) {
            this.contenedor.innerHTML = '';
        }

        this._destruido = true;
        this._inicializado = false;
    }

    // ── Helpers protegidos ──

    /**
     * Suscribe al bus de eventos y guarda la referencia para limpieza automática.
     * @param {string} evento
     * @param {Function} callback
     */
    _escuchar(evento, callback) {
        const desuscribir = busEventos.suscribir(evento, callback);
        this._desuscripciones.push(desuscribir);
        return desuscribir;
    }

    /**
     * Emite un evento al bus global.
     * @param {string} evento
     * @param {*} datos
     */
    _emitir(evento, datos) {
        busEventos.emitir(evento, datos);
    }

    /**
     * Crea un elemento DOM con clases y lo añade a un padre.
     * @param {string} etiqueta - Tag HTML
     * @param {string} clases - Clases CSS separadas por espacio
     * @param {HTMLElement} [padre] - Padre donde insertar (default: this.contenedor)
     * @returns {HTMLElement}
     */
    _crearElemento(etiqueta, clases = '', padre = null) {
        const el = document.createElement(etiqueta);
        if (clases) el.className = clases;
        (padre || this.contenedor).appendChild(el);
        return el;
    }
}