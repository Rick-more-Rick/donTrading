#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║       ORDER BOOK ENGINE — Level 2 Agregado por Exchange en Tiempo Real     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  QuoteNormalizado  : Estructura de datos para cotizaciones bid/ask.         ║
║  OrderBookManager  : Construye Order Book L2 agregando quotes por exchange.║
║  PolygonQuotesWS   : Conexión WebSocket a Polygon.io (canal de Quotes).    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Protocolo   : WebSocket (wss://) — Zero Polling                           ║
║  Resiliencia : Auto-reconexión con backoff exponencial + heartbeat         ║
╚══════════════════════════════════════════════════════════════════════════════╝

Dependencias:
    pip install websockets

Uso rápido:
    python orderbook.py
"""

from __future__ import annotations

import asyncio
import json
import logging
import signal
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Optional

from mapeador_simbolos import Mapeador

# ──────────────────────────────────────────────────────────────────────────────
# Intentar importar websockets; si no está, dar instrucciones claras
# ──────────────────────────────────────────────────────────────────────────────
try:
    import websockets
    from websockets.exceptions import (
        ConnectionClosed,
        ConnectionClosedError,
        ConnectionClosedOK,
    )
except ImportError:
    raise SystemExit(
        "\n[ERROR] La librería 'websockets' no está instalada.\n"
        "Ejecuta:  pip install websockets\n"
    )

# ── Fix para consola Windows (cp1252 no soporta caracteres Unicode) ──
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ──────────────────────────────────────────────────────────────────────────────
# Configuración de logging con timestamps de alta resolución
# ──────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s.%(msecs)03d │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("OrderBookEngine")


# ══════════════════════════════════════════════════════════════════════════════
#  CONSTANTES DE CONEXIÓN
# ══════════════════════════════════════════════════════════════════════════════

POLYGON_WS_URL = "wss://socket.polygon.io/stocks"
POLYGON_WS_CRYPTO_URL = "wss://socket.polygon.io/crypto"
CANAL_QUOTES = "Q"
CANAL_CRYPTO_QUOTES = "XQ"


# ══════════════════════════════════════════════════════════════════════════════
#  MAPA DE EXCHANGES DE POLYGON.IO
# ══════════════════════════════════════════════════════════════════════════════

EXCHANGES = {
    1: "NYSE American",  2: "NASDAQ OMX BX",  3: "NYSE National",
    4: "FINRA",  5: "ISE",  6: "EDGA",  7: "EDGX",
    8: "NYSE Chicago",  9: "NYSE Arca",  10: "BATS",
    11: "IEX", 12: "NASDAQ", 15: "MIAX Pearl",
    16: "MEMX", 17: "LTSE", 19: "CBOE BYX",
    20: "CBOE BZX", 21: "EPRL", 22: "NYSE",
}


# ══════════════════════════════════════════════════════════════════════════════
#  ESTRUCTURA DE DATOS — QUOTE NORMALIZADO
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class QuoteNormalizado:
    """Representa una cotización bid/ask normalizada.

    Campos originales de Polygon → Campos legibles:
        sym → simbolo       Símbolo del activo
        bp  → bid_precio    Mejor precio de compra
        bs  → bid_tamano    Tamaño en el bid
        ap  → ask_precio    Mejor precio de venta
        as  → ask_tamano    Tamaño en el ask
        bx  → bid_exchange  ID del exchange del bid
        ax  → ask_exchange  ID del exchange del ask
        t   → timestamp_ms  Timestamp en milisegundos
    """
    simbolo: str
    bid_precio: float
    bid_tamano: int
    ask_precio: float
    ask_tamano: int
    timestamp_ms: int
    bid_exchange: int = 0
    ask_exchange: int = 0

    @property
    def spread(self) -> float:
        """Calcula el spread bid-ask."""
        return round(self.ask_precio - self.bid_precio, 6)

    @property
    def mid_price(self) -> float:
        """Precio medio entre bid y ask."""
        return round((self.bid_precio + self.ask_precio) / 2, 6)

    def to_dict(self) -> dict:
        return {
            "simbolo": self.simbolo,
            "bid_precio": self.bid_precio,
            "bid_tamano": self.bid_tamano,
            "ask_precio": self.ask_precio,
            "ask_tamano": self.ask_tamano,
            "spread": self.spread,
            "mid_price": self.mid_price,
            "timestamp_ms": self.timestamp_ms,
        }


# ══════════════════════════════════════════════════════════════════════════════
#  ORDER BOOK LEVEL 2 — AGREGADO POR EXCHANGE EN TIEMPO REAL
# ══════════════════════════════════════════════════════════════════════════════

class OrderBookManager:
    """Construye un Order Book Level 2 agregando quotes por exchange.

    Cada exchange reporta su mejor bid/ask. Al agregar todos los exchanges,
    se obtiene un book con múltiples niveles de profundidad ordenados por precio.

    Atributos:
        books : dict[str, dict]  → Order book por símbolo
        max_levels : int         → Niveles máximos a mostrar (default: 10)
    """

    def __init__(self, max_levels: int = 0, stale_ms: int = 30000):
        self.max_levels = max_levels
        self.stale_ms = stale_ms
        self._books: defaultdict[str, dict] = defaultdict(
            lambda: {"bids": {}, "asks": {}}
        )
        self._update_count: defaultdict[str, int] = defaultdict(int)

    def procesar_quote(self, quote: QuoteNormalizado) -> dict | None:
        """Actualiza el book con un nuevo quote y retorna snapshot si cambió.

        Args:
            quote: Quote normalizado con exchange IDs.

        Returns:
            dict con el snapshot del book si hubo cambio, None si no.
        """
        simbolo = quote.simbolo
        book = self._books[simbolo]
        changed = False

        # Actualizar bid de este exchange
        if quote.bid_precio > 0 and quote.bid_exchange > 0:
            prev = book["bids"].get(quote.bid_exchange)
            if prev is None or prev[0] != quote.bid_precio or prev[1] != quote.bid_tamano:
                book["bids"][quote.bid_exchange] = (
                    quote.bid_precio, quote.bid_tamano, quote.timestamp_ms
                )
                changed = True

        # Actualizar ask de este exchange
        if quote.ask_precio > 0 and quote.ask_exchange > 0:
            prev = book["asks"].get(quote.ask_exchange)
            if prev is None or prev[0] != quote.ask_precio or prev[1] != quote.ask_tamano:
                book["asks"][quote.ask_exchange] = (
                    quote.ask_precio, quote.ask_tamano, quote.timestamp_ms
                )
                changed = True

        if changed:
            self._update_count[simbolo] += 1
            return self.obtener_snapshot(simbolo)
        return None

    def obtener_snapshot(self, simbolo: str) -> dict:
        """Retorna un snapshot del order book para un símbolo.

        Los bids se ordenan de mayor a menor precio (mejor bid primero).
        Los asks se ordenan de menor a mayor precio (mejor ask primero).
        Se agregan niveles con el mismo precio sumando sus tamaños.
        """
        book = self._books[simbolo]
        now_ms = int(time.time() * 1000)
        cutoff = now_ms - self.stale_ms

        # Agregar bids por precio (solo quotes frescos)
        bid_agg: defaultdict[float, int] = defaultdict(int)
        bid_exchanges: defaultdict[float, list] = defaultdict(list)
        for ex_id, (precio, tamano, ts) in book["bids"].items():
            if ts >= cutoff:
                bid_agg[precio] += tamano
                bid_exchanges[precio].append(ex_id)

        # Agregar asks por precio (solo quotes frescos)
        ask_agg: defaultdict[float, int] = defaultdict(int)
        ask_exchanges: defaultdict[float, list] = defaultdict(list)
        for ex_id, (precio, tamano, ts) in book["asks"].items():
            if ts >= cutoff:
                ask_agg[precio] += tamano
                ask_exchanges[precio].append(ex_id)

        # Ordenar: bids desc, asks asc
        bids = sorted(
            [{"precio": p, "tamano": t, "exchanges": bid_exchanges[p]}
             for p, t in bid_agg.items()],
            key=lambda x: x["precio"], reverse=True
        )
        if self.max_levels > 0:
            bids = bids[:self.max_levels]

        asks = sorted(
            [{"precio": p, "tamano": t, "exchanges": ask_exchanges[p]}
             for p, t in ask_agg.items()],
            key=lambda x: x["precio"]
        )
        if self.max_levels > 0:
            asks = asks[:self.max_levels]

        # Calcular totales acumulados
        cum_bid = 0
        for b in bids:
            cum_bid += b["tamano"]
            b["acumulado"] = cum_bid

        cum_ask = 0
        for a in asks:
            cum_ask += a["tamano"]
            a["acumulado"] = cum_ask

        best_bid = bids[0]["precio"] if bids else 0
        best_ask = asks[0]["precio"] if asks else 0
        spread = round(best_ask - best_bid, 6) if (best_bid > 0 and best_ask > 0) else 0

        return {
            "simbolo": simbolo,
            "bids": bids,
            "asks": asks,
            "best_bid": best_bid,
            "best_ask": best_ask,
            "spread": spread,
            "mid_price": round((best_bid + best_ask) / 2, 6) if (best_bid > 0 and best_ask > 0) else 0,
            "updates": self._update_count[simbolo],
            "num_exchanges_bid": len(book["bids"]),
            "num_exchanges_ask": len(book["asks"]),
        }


# ══════════════════════════════════════════════════════════════════════════════
#  POLYGON WEBSOCKET MANAGER — QUOTES
# ══════════════════════════════════════════════════════════════════════════════

class PolygonQuotesWS:
    """Gestor de conexión WebSocket a Polygon.io para el canal de Quotes.

    Características:
        - Autenticación automática vía API Key
        - Suscripción dinámica a múltiples símbolos (solo Quotes)
        - Procesamiento asíncrono sin bloqueo (asyncio)
        - Auto-reconexión con backoff exponencial
        - Heartbeat para detección temprana de desconexiones
        - Construcción de Order Book L2 en tiempo real
        - Normalización de datos a estructuras limpias

    Parámetros:
        api_key          : str   → Clave de autenticación de Polygon.io
        simbolos         : list  → Lista de tickers (ej. ["AAPL", "TSLA"])
        on_quote_cb      : func  → Callback al recibir una cotización normalizada
        on_book_cb       : func  → Callback al actualizarse el Order Book L2
        max_reconexiones : int   → Intentos máximos de reconexión (default: 50)
        heartbeat_seg    : int   → Intervalo de heartbeat en segundos (default: 30)
    """

    def __init__(
        self,
        api_key: str,
        simbolos: list[str],
        on_quote_cb: Callable[[QuoteNormalizado], None] | None = None,
        on_book_cb: Callable[[dict], None] | None = None,
        max_reconexiones: int = 50,
        heartbeat_seg: int = 30,
        ws_url: str = POLYGON_WS_URL,
        canal: str = CANAL_QUOTES,
    ):
        self.api_key = api_key
        self.simbolos = [s.upper() for s in simbolos]
        self.ws_url = ws_url
        self._canal = canal

        self._on_quote = on_quote_cb
        self._on_book = on_book_cb

        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._conectado = False
        self._detener = False
        self._reconexiones = 0
        self._max_reconexiones = max_reconexiones
        self._heartbeat_seg = heartbeat_seg

        # Motor de Order Book Level 2
        self.order_book = OrderBookManager(max_levels=0)

        # Métricas
        self._quotes_recibidos = 0
        self._ultimo_mensaje_ts = 0.0
        self._connect_ts = 0.0  # Timestamp de última conexión exitosa

    # ──────────────────────────────────────────────────────────────────────────
    #  CICLO DE VIDA: CONEXIÓN, AUTENTICACIÓN, SUSCRIPCIÓN
    # ──────────────────────────────────────────────────────────────────────────

    async def iniciar(self) -> None:
        """Punto de entrada principal. Inicia la conexión con auto-reconexión."""
        logger.info("=" * 60)
        logger.info("  ORDER BOOK ENGINE — Quotes + L2 en Tiempo Real")
        logger.info("  Simbolos : %s", ", ".join(self.simbolos))
        logger.info("  Canal    : %s (Quotes)", CANAL_QUOTES)
        logger.info("=" * 60)

        while not self._detener:
            try:
                await self._conectar_y_escuchar()
            except (ConnectionClosed, ConnectionClosedError, ConnectionClosedOK) as e:
                logger.warning("Conexion cerrada: %s", e)
            except (OSError, asyncio.TimeoutError) as e:
                logger.error("Error de red: %s", e)
            except Exception as e:
                logger.error("Error inesperado: %s [%s]", e, type(e).__name__)

            if self._detener:
                break

            self._reconexiones += 1
            if self._reconexiones > self._max_reconexiones:
                logger.critical(
                    "Maximo de reconexiones alcanzado (%d). Abortando.",
                    self._max_reconexiones,
                )
                break

            espera = min(2 ** self._reconexiones, 60)
            logger.info(
                "Reconectando en %ds (intento %d/%d)...",
                espera, self._reconexiones, self._max_reconexiones,
            )
            await asyncio.sleep(espera)

        logger.info("Order book engine detenido.")

    async def detener(self) -> None:
        """Detiene el motor de forma limpia."""
        logger.info("Deteniendo order book engine...")
        self._detener = True
        if self._ws:
            await self._ws.close()

    async def _conectar_y_escuchar(self) -> None:
        """Establece conexión WebSocket, autentica, suscribe y escucha."""
        logger.info("Conectando a %s ...", self.ws_url)

        async with websockets.connect(
            self.ws_url,
            ping_interval=self._heartbeat_seg,
            ping_timeout=10,
            close_timeout=5,
            max_size=2 ** 22,
        ) as ws:
            self._ws = ws
            self._conectado = True
            self._connect_ts = time.time()  # Marcar inicio de la conexión
            # No resetear _reconexiones aquí — solo tras conexión estable
            logger.info("Conexion WebSocket establecida")

            bienvenida = await ws.recv()
            logger.debug("[BIENVENIDA] %s", bienvenida[:500])

            await self._autenticar()
            await self._suscribir()

            logger.info("Escuchando flujo de quotes en tiempo real...")
            async for mensaje_crudo in ws:
                self._ultimo_mensaje_ts = time.time()
                # Si recibimos datos reales y la conexión lleva >10s, resetear reconexiones
                if self._reconexiones > 0 and (time.time() - self._connect_ts) > 10:
                    logger.info("Conexión estable >10s — reseteando contador de reconexiones")
                    self._reconexiones = 0
                await self._on_message(mensaje_crudo)

    async def _autenticar(self) -> None:
        """Envía el mensaje de autenticación a Polygon."""
        payload = json.dumps({"action": "auth", "params": self.api_key})
        await self._ws.send(payload)

        respuesta = await self._ws.recv()
        logger.debug("[AUTH] %s", respuesta[:500])

        datos = json.loads(respuesta)
        if isinstance(datos, list):
            for msg in datos:
                if msg.get("status") == "auth_success":
                    logger.info("Autenticacion exitosa")
                    return
                elif msg.get("status") == "auth_failed":
                    raise PermissionError(
                        f"Autenticacion fallida: {msg.get('message', 'API Key invalida')}"
                    )

    async def _suscribir(self) -> None:
        """Suscribe al canal de Quotes para todos los símbolos."""
        suscripciones = []
        for s in self.simbolos:
            if self._canal == CANAL_CRYPTO_QUOTES:
                suscripciones.append(f"{self._canal}.X:{s}")
            else:
                suscripciones.append(f"{self._canal}.{s}")
        params = ",".join(suscripciones)
        payload = json.dumps({"action": "subscribe", "params": params})
        await self._ws.send(payload)
        logger.info("Suscrito a: %s", params)

    # ──────────────────────────────────────────────────────────────────────────
    #  SUSCRIPCIÓN DINÁMICA
    # ──────────────────────────────────────────────────────────────────────────

    async def suscribir_simbolo(self, simbolo: str) -> None:
        """Añade un nuevo símbolo a la suscripción en caliente."""
        simbolo = simbolo.upper()
        if simbolo in self.simbolos:
            logger.warning("'%s' ya esta suscrito.", simbolo)
            return

        self.simbolos.append(simbolo)
        if self._ws and self._conectado:
            params = f"{CANAL_QUOTES}.{simbolo}"
            payload = json.dumps({"action": "subscribe", "params": params})
            await self._ws.send(payload)
            logger.info("Suscripcion dinamica anadida: %s", params)

    async def desuscribir_simbolo(self, simbolo: str) -> None:
        """Elimina un símbolo de la suscripción en caliente."""
        simbolo = simbolo.upper()
        if simbolo not in self.simbolos:
            logger.warning("'%s' no estaba suscrito.", simbolo)
            return

        self.simbolos.remove(simbolo)
        if self._ws and self._conectado:
            params = f"{CANAL_QUOTES}.{simbolo}"
            payload = json.dumps({"action": "unsubscribe", "params": params})
            await self._ws.send(payload)
            logger.info("Desuscrito de: %s", params)

    # ──────────────────────────────────────────────────────────────────────────
    #  PROCESAMIENTO DE MENSAJES
    # ──────────────────────────────────────────────────────────────────────────

    async def _on_message(self, mensaje_crudo: str) -> None:
        """Procesa cada mensaje del WebSocket (solo quotes)."""
        try:
            mensajes = json.loads(mensaje_crudo)
        except json.JSONDecodeError:
            logger.error("JSON invalido recibido: %s", mensaje_crudo[:200])
            return

        if not isinstance(mensajes, list):
            mensajes = [mensajes]

        for msg in mensajes:
            tipo_evento = msg.get("ev")

            if tipo_evento in ("Q", "XQ"):
                await self._procesar_quote(msg)
            elif tipo_evento == "status":
                logger.debug("Status: %s", msg.get("message", ""))

    async def _procesar_quote(self, raw: dict) -> None:
        """Normaliza una cotización cruda de Polygon y la despacha.

        Mapeo de campos crudos:
            sym → simbolo, bp → bid_precio, bs → bid_tamano,
            ap → ask_precio, as → ask_tamano, bx → bid_exchange,
            ax → ask_exchange, t → timestamp_ms
        """
        # Normalizar símbolo (quitar prefijo X: de crypto)
        sym_raw = raw.get("sym", "???")
        sym_limpio = Mapeador.normalizar(sym_raw)

        quote = QuoteNormalizado(
            simbolo=sym_limpio,
            bid_precio=raw.get("bp", 0.0),
            bid_tamano=raw.get("bs", 0),
            ask_precio=raw.get("ap", 0.0),
            ask_tamano=raw.get("as", 0),
            timestamp_ms=raw.get("t", 0),
            bid_exchange=raw.get("bx", 0),
            ask_exchange=raw.get("ax", 0),
        )

        self._quotes_recibidos += 1

        # Alimentar el Order Book L2
        book_snapshot = self.order_book.procesar_quote(quote)
        if book_snapshot and self._on_book:
            self._on_book(book_snapshot)

        # Despachar al callback del usuario
        if self._on_quote:
            self._on_quote(quote)

    # ──────────────────────────────────────────────────────────────────────────
    #  MÉTRICAS
    # ──────────────────────────────────────────────────────────────────────────

    def obtener_metricas(self) -> dict:
        """Retorna métricas de rendimiento del motor de quotes."""
        return {
            "quotes_recibidos": self._quotes_recibidos,
            "reconexiones": self._reconexiones,
            "conectado": self._conectado,
            "ultimo_mensaje_hace_seg": (
                round(time.time() - self._ultimo_mensaje_ts, 2)
                if self._ultimo_mensaje_ts > 0
                else None
            ),
        }


# ══════════════════════════════════════════════════════════════════════════════
#  PUNTO DE ENTRADA — ORDER BOOK EN CONSOLA
# ══════════════════════════════════════════════════════════════════════════════

def main():
    """Script de inicio rápido para Order Book L2.

    Imprime en consola el spread bid/ask y muestra el Order Book L2
    completo cada 500 actualizaciones por símbolo.
    """

    # ╔══════════════════════════════════════════════════════╗
    # ║  CONFIGURACIÓN — EDITAR AQUÍ                        ║
    # ╚══════════════════════════════════════════════════════╝
    API_KEY = "m3oCAFJ_qZZ7wIaYHZSvxTiBUbiFIt77"
    SIMBOLOS = ["AAPL", "TSLA"]

    # ── Callback: Se ejecuta por cada quote recibido ──
    def al_recibir_quote(quote: QuoteNormalizado) -> None:
        print(
            f"  QUOTE {quote.simbolo:<6s} | "
            f"Bid: ${quote.bid_precio:.4f} x{quote.bid_tamano:>6,d} | "
            f"Ask: ${quote.ask_precio:.4f} x{quote.ask_tamano:>6,d} | "
            f"Spread: ${quote.spread:.4f} | "
            f"Mid: ${quote.mid_price:.4f}"
        )

    # ── Callback: Se ejecuta cuando el Order Book L2 cambia ──
    book_print_counter: dict[str, int] = defaultdict(int)

    def al_actualizar_book(snapshot: dict) -> None:
        simbolo = snapshot["simbolo"]
        book_print_counter[simbolo] += 1
        # Imprimir cada 500 updates para no saturar consola
        if book_print_counter[simbolo] % 500 != 0:
            return

        bids = snapshot["bids"]
        asks = snapshot["asks"]

        print(f"\n  {'─' * 76}")
        print(f"  ORDER BOOK L2 -- {simbolo}  |  "
              f"Spread: ${snapshot['spread']:.4f}  |  "
              f"Mid: ${snapshot['mid_price']:.4f}  |  "
              f"Updates: {snapshot['updates']:,d}")
        print(f"  {'─' * 76}")
        print(f"  {'BIDS (Compra)':^37s} | {'ASKS (Venta)':^37s}")
        print(f"  {'Acum':>6s}  {'Vol':>6s}  {'Precio':>10s}  {'Exch':>6s}"
              f" | {'Precio':>10s}  {'Vol':>6s}  {'Acum':>6s}  {'Exch':>6s}")
        print(f"  {'─' * 37} | {'─' * 37}")

        max_rows = max(len(bids), len(asks))
        for i in range(min(max_rows, 10)):
            # Bid side
            if i < len(bids):
                b = bids[i]
                bex = ",".join(EXCHANGES.get(e, str(e))[:4] for e in b["exchanges"][:2])
                bid_str = f"  {b['acumulado']:>6,d}  {b['tamano']:>6,d}  ${b['precio']:>9.4f}  {bex:>6s}"
            else:
                bid_str = f"  {'':>6s}  {'':>6s}  {'':>10s}  {'':>6s}"

            # Ask side
            if i < len(asks):
                a = asks[i]
                aex = ",".join(EXCHANGES.get(e, str(e))[:4] for e in a["exchanges"][:2])
                ask_str = f"${a['precio']:>9.4f}  {a['tamano']:>6,d}  {a['acumulado']:>6,d}  {aex:>6s}"
            else:
                ask_str = f"{'':>10s}  {'':>6s}  {'':>6s}  {'':>6s}"

            print(f"{bid_str} | {ask_str}")

        print(f"  {'─' * 76}")
        print(f"  Exchanges activos -- Bid: {snapshot['num_exchanges_bid']}  |  Ask: {snapshot['num_exchanges_ask']}")
        print()

    # ── Crear instancia del motor ──
    motor = PolygonQuotesWS(
        api_key=API_KEY,
        simbolos=SIMBOLOS,
        on_quote_cb=al_recibir_quote,
        on_book_cb=al_actualizar_book,
        max_reconexiones=50,
        heartbeat_seg=30,
    )

    # ── Manejo limpio de CTRL+C ──
    loop = asyncio.new_event_loop()

    def manejar_signal():
        logger.info("Senal de interrupcion recibida (CTRL+C)")
        loop.create_task(motor.detener())

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, manejar_signal)
        except NotImplementedError:
            pass

    print("\n" + "=" * 70)
    print("  ORDER BOOK ENGINE — Quotes + L2 en Tiempo Real")
    print(f"  Simbolos: {', '.join(SIMBOLOS)}")
    print(f"  Canal:    Quotes ({CANAL_QUOTES})")
    print("  Presiona CTRL+C para detener")
    print("=" * 70 + "\n")

    try:
        loop.run_until_complete(motor.iniciar())
    except KeyboardInterrupt:
        logger.info("Interrupcion por teclado. Cerrando...")
        loop.run_until_complete(motor.detener())
    finally:
        loop.close()

    # ── Métricas finales ──
    metricas = motor.obtener_metricas()
    print("\n" + "-" * 50)
    print("  METRICAS FINALES — ORDER BOOK ENGINE")
    print(f"  Quotes recibidos : {metricas['quotes_recibidos']:,d}")
    print(f"  Reconexiones     : {metricas['reconexiones']}")
    print("-" * 50)


if __name__ == "__main__":
    main()
