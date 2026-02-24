/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  WidgetSelectorActivos.js — Selector de Mercados y Activos             ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Características:                                                        ║
 * ║    - Botones de mercado (DOW, NASDAQ, SP500, FOREX, CRYPTO)             ║
 * ║    - Dropdown con scroll para listas largas (100+ activos)              ║
 * ║    - Buscador integrado en cada dropdown                                ║
 * ║    - Emite CAMBIO_ACTIVO al bus de eventos                              ║
 * ║    - Preparado para vincular al futuro WidgetGrafica                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

class WidgetSelectorActivos extends ClaseBaseWidget {

    constructor(contenedor, configuracion = {}) {
        super(contenedor, configuracion);

        /** @type {string|null} Mercado actualmente expandido */
        this._mercadoExpandido = null;

        /** @type {string} Símbolo actualmente seleccionado */
        this._simboloActivo = configuracion.simboloInicial || 'AAPL';

        /** @type {HTMLElement|null} Dropdown actualmente abierto */
        this._dropdownAbierto = null;

        /** @type {Function|null} Handler global para cerrar al clic fuera */
        this._cerrarDropdownHandler = null;

        /**
         * Referencia opcional al WidgetGrafica.
         * Se puede inyectar desde fuera con:
         *   selectorActivos.vincularGrafica(instanciaWidgetGrafica)
         * @type {object|null}
         */
        this._widgetGrafica = null;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  CICLO DE VIDA
    // ══════════════════════════════════════════════════════════════════════

    inicializar() {
        super.inicializar();

        // Cerrar dropdown al hacer clic fuera de él
        this._cerrarDropdownHandler = (e) => {
            if (this._dropdownAbierto && !this.contenedor.contains(e.target)) {
                this._cerrarDropdown();
            }
        };
        document.addEventListener('click', this._cerrarDropdownHandler);
    }

    renderizar() {
        this.contenedor.innerHTML = '';
        this.contenedor.classList.add('v2-selector-activos');

        const catalogo = FabricaWidgets.obtenerCatalogo();

        // ── Fila de botones de mercado ──
        const filaMercados = this._crearElemento('div', 'v2-fila-mercados');

        for (const [mercadoId, mercado] of Object.entries(catalogo)) {
            const contenedorBoton = this._crearElemento('div', 'v2-mercado-contenedor', filaMercados);

            // Botón del mercado
            const boton = document.createElement('button');
            boton.className = 'v2-btn-mercado';
            boton.textContent = mercado.etiqueta;
            boton.dataset.mercado = mercadoId;
            boton.title = mercado.nombre;
            boton.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleDropdown(mercadoId, contenedorBoton, mercado);
            });
            contenedorBoton.appendChild(boton);

            // Dropdown (oculto por defecto, se construye al abrir)
            const dropdown = document.createElement('div');
            dropdown.className = 'v2-dropdown-activos';
            dropdown.dataset.mercado = mercadoId;
            dropdown.style.display = 'none';
            contenedorBoton.appendChild(dropdown);
        }

        // ── Indicador del activo seleccionado (extremo derecho) ──
        this._indicador = this._crearElemento('div', 'v2-activo-indicador');
        this._actualizarIndicador();
    }

    destruir() {
        if (this._cerrarDropdownHandler) {
            document.removeEventListener('click', this._cerrarDropdownHandler);
        }
        super.destruir();
    }

    // ══════════════════════════════════════════════════════════════════════
    //  API PÚBLICA — Vinculación con WidgetGrafica
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Vincula el selector con una instancia del WidgetGrafica.
     * Cuando el usuario seleccione un activo, se notificará al widget.
     * @param {object} widgetGrafica - Instancia de WidgetGrafica
     */
    vincularGrafica(widgetGrafica) {
        this._widgetGrafica = widgetGrafica;
        console.log('[SelectorActivos] WidgetGrafica vinculado correctamente.');
    }

    // ══════════════════════════════════════════════════════════════════════
    //  DROPDOWN — Apertura, scroll y buscador
    // ══════════════════════════════════════════════════════════════════════

    _toggleDropdown(mercadoId, contenedorBoton, mercado) {
        if (this._mercadoExpandido === mercadoId) {
            this._cerrarDropdown();
            return;
        }

        this._cerrarDropdown();

        const dropdown = contenedorBoton.querySelector('.v2-dropdown-activos');
        if (!dropdown) return;

        // Construir contenido del dropdown si aún está vacío
        if (!dropdown._construido) {
            this._construirDropdown(dropdown, mercadoId, mercado);
            dropdown._construido = true;
        }

        dropdown.style.display = 'flex';
        this._dropdownAbierto = dropdown;
        this._mercadoExpandido = mercadoId;

        const boton = contenedorBoton.querySelector('.v2-btn-mercado');
        if (boton) boton.classList.add('expandido');

        // Enfocar el buscador automáticamente
        const buscador = dropdown.querySelector('.v2-buscador-input');
        if (buscador) setTimeout(() => buscador.focus(), 50);
    }

    _construirDropdown(dropdown, mercadoId, mercado) {
        dropdown.innerHTML = '';

        // ── Buscador ──
        const wrapBuscador = document.createElement('div');
        wrapBuscador.className = 'v2-buscador-wrap';

        const buscador = document.createElement('input');
        buscador.type = 'text';
        buscador.className = 'v2-buscador-input';
        buscador.placeholder = `Buscar en ${mercado.etiqueta}...`;
        buscador.autocomplete = 'off';
        buscador.spellcheck = false;
        wrapBuscador.appendChild(buscador);
        dropdown.appendChild(wrapBuscador);

        // ── Lista de activos ──
        const lista = document.createElement('div');
        lista.className = 'v2-dropdown-lista';
        const activos = Object.entries(mercado.activos);

        const renderLista = (filtro = '') => {
            lista.innerHTML = '';
            const q = filtro.toUpperCase();
            const filtrados = q
                ? activos.filter(([s, cfg]) => s.includes(q) || cfg.nombre.toUpperCase().includes(q))
                : activos;

            if (filtrados.length === 0) {
                const vacio = document.createElement('div');
                vacio.className = 'v2-dropdown-vacio';
                vacio.textContent = 'Sin resultados';
                lista.appendChild(vacio);
                return;
            }

            for (const [simbolo, cfg] of filtrados) {
                const item = document.createElement('div');
                item.className = 'v2-dropdown-item';
                if (simbolo === this._simboloActivo) {
                    item.classList.add('activo');
                }
                item.innerHTML = `
                    <span class="v2-item-simbolo">${simbolo}</span>
                    <span class="v2-item-nombre">${cfg.nombre}</span>
                `;
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._seleccionarActivo(simbolo, mercadoId);
                });
                lista.appendChild(item);
            }
        };

        renderLista();
        dropdown.appendChild(lista);

        // Filtrar al escribir en el buscador
        buscador.addEventListener('input', (e) => {
            e.stopPropagation();
            renderLista(buscador.value);
        });

        buscador.addEventListener('click', (e) => e.stopPropagation());

        // Número de activos en el badge del botón
        const badge = dropdown.parentElement?.querySelector('.v2-btn-mercado');
        if (badge) {
            badge.title = `${mercado.nombre} (${activos.length} activos)`;
        }
    }

    _cerrarDropdown() {
        if (this._dropdownAbierto) {
            this._dropdownAbierto.style.display = 'none';
            this._dropdownAbierto = null;
        }
        const botones = this.contenedor.querySelectorAll('.v2-btn-mercado.expandido');
        botones.forEach(b => b.classList.remove('expandido'));
        this._mercadoExpandido = null;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  SELECCIÓN DE ACTIVO — Emite evento global
    // ══════════════════════════════════════════════════════════════════════

    _seleccionarActivo(simbolo, mercadoId) {
        this._simboloActivo = simbolo;
        this._cerrarDropdown();
        this._actualizarIndicador();

        // Obtener configuración completa del activo desde el catálogo
        const configuracion = FabricaWidgets.obtenerConfiguracion(simbolo);

        const payload = {
            simbolo,
            mercado: mercadoId,
            configuracion,
        };

        // Notificar al WidgetGrafica directamente (si está vinculado)
        if (this._widgetGrafica && typeof this._widgetGrafica.cargarActivo === 'function') {
            this._widgetGrafica.cargarActivo(payload);
        }

        // Emitir al bus de eventos global para todos los demás widgets
        this._emitir(EVENTOS.CAMBIO_ACTIVO, payload);

        console.log(`[SelectorActivos] Activo: ${simbolo} | Mercado: ${mercadoId} | Paso: ${configuracion.paso_precio}`);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  INDICADOR DE ACTIVO ACTUAL (extremo derecho de cabecera)
    // ══════════════════════════════════════════════════════════════════════

    _actualizarIndicador() {
        if (!this._indicador) return;
        const cfg = FabricaWidgets.obtenerConfiguracion(this._simboloActivo);
        this._indicador.innerHTML = `
            <span class="v2-indicador-simbolo">${this._simboloActivo}</span>
            <span class="v2-indicador-nombre">${cfg.nombre}</span>
            <span class="v2-indicador-mercado">${cfg.mercado_nombre}</span>
        `;
    }
}