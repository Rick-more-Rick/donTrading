#!/usr/bin/env python3
"""
ÔòöÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòù
Ôòæ       ORDER BOOK ENGINE ÔÇö Level 2 Agregado por Exchange en Tiempo Real     Ôòæ
ÔòáÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòú
Ôòæ  QuoteNormalizado  : Estructura de datos para cotizaciones bid/ask.         Ôòæ
Ôòæ  OrderBookManager  : Construye Order Book L2 agregando quotes por exchange.Ôòæ
Ôòæ  PolygonQuotesWS   : Conexi├│n WebSocket a Polygon.io (canal de Quotes).    Ôòæ
ÔòáÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòú
Ôòæ  Protocolo   : WebSocket (wss://) ÔÇö Zero Polling                           Ôòæ
Ôòæ  Resiliencia : Auto-reconexi├│n con backoff exponencial + heartbeat         Ôòæ
ÔòÜÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòØ

Dependencias:
    pip install websockets

Uso r├ípido:
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

# ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
# Intentar importar websockets; si no est├í, dar instrucciones claras
# ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
try:
    import websockets
    from websockets.exceptions import (
        ConnectionClosed,
        ConnectionClosedError,
        ConnectionClosedOK,
    )
except ImportError:
    raise SystemExit(
        "\n[ERROR] La librer├¡a 'websockets' no est├í instalada.\n"
        "Ejecuta:  pip install websockets\n"
    )

# ÔöÇÔöÇ Fix para consola Windows (cp1252 no soporta caracteres Unicode) ÔöÇÔöÇ
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
# Configuraci├│n de logging con timestamps de alta resoluci├│n
# ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s.%(msecs)03d Ôöé %(levelname)-7s Ôöé %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("OrderBookEngine")


# ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
#  CONSTANTES DE CONEXI├ôN
# ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ

POLYGON_WS_URL = "wss://socket.polygon.io/stocks"
POLYGON_WS_CRYPTO_URL = "wss://socket.polygon.io/crypto"
CANAL_QUOTES = "Q"
CANAL_CRYPTO_QUOTES = "XQ"


# ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
#  MAPA DE EXCHANGES DE POLYGON.IO
# ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ

EXCHANGES = {
    1: "NYSE American",  2: "NASDAQ OMX BX",  3: "NYSE National",
    4: "FINRA",  5: "ISE",  6: "EDGA",  7: "EDGX",
    8: "NYSE Chicago",  9: "NYSE Arca",  10: "BATS",
    11: "IEX", 12: "NASDAQ", 15: "MIAX Pearl",
    16: "MEMX", 17: "LTSE", 19: "CBOE BYX",
    20: "CBOE BZX", 21: "EPRL", 22: "NYSE",
}


# ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
#  ESTRUCTURA DE DATOS ÔÇö QUOTE NORMALIZADO
# ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ

@dataclass
class QuoteNormalizado:
    """Representa una cotizaci├│n bid/ask normalizada.

    Campos originales de Polygon ÔåÆ Campos legibles:
        sym ÔåÆ simbolo       S├¡mbolo del activo
        bp  ÔåÆ bid_precio    Mejor precio de compra
        bs  ÔåÆ bid_tamano    Tama├▒o en el bid
        ap  ÔåÆ ask_precio    Mejor precio de venta
        as  ÔåÆ ask_tamano    Tama├▒o en el ask
        bx  ÔåÆ bid_exchange  ID del exchange del bid
        ax  ÔåÆ ask_exchange  ID del exchange del ask
        t   ÔåÆ timestamp_ms  Timestamp en milisegundos
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


# ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
#  ORDER BOOK LEVEL 2 ÔÇö AGREGADO POR EXCHANGE EN TIEMPO REAL
# ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ

class OrderBookManager:
    """Construye un Order Book Level 2 agregando quotes por exchange.

    Cada exchange reporta su mejor bid/ask. Al agregar todos los exchanges,
    se obtiene un book con m├║ltiples niveles de profundidad ordenados por precio.

    Atributos:
        books : dict[str, dict]  ÔåÆ Order book por s├¡mbolo
        max_levels : int         ÔåÆ Niveles m├íximos a mostrar (default: 10)
    """

    def __init__(self, max_levels: int = 0, stale_ms: int = 30000):
        self.max_levels = max_levels
        self.stale_ms = stale_ms
        self._books: defaultdict[str, dict] = defaultdict(
            lambda: {"bids": {}, "asks": {}}
        )
        self._update_count: defaultdict[str, int] = defaultdict(int)

    def procesar_quote(self, quote: QuoteNormalizado) -> dict | None:
        """Actualiza el book con un nuevo quote y retorna snapshot si cambi├│.

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
        Los gaps entre niveles reales se rellenan con niveles interpolados
        para dar profundidad visual al libro de órdenes.
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
        bids_reales = sorted(
            [{"precio": p, "tamano": t, "exchanges": bid_exchanges[p], "interpolado": False}
             for p, t in bid_agg.items()],
            key=lambda x: x["precio"], reverse=True
        )
        asks_reales = sorted(
            [{"precio": p, "tamano": t, "exchanges": ask_exchanges[p], "interpolado": False}
             for p, t in ask_agg.items()],
            key=lambda x: x["precio"]
        )

        # ── Interpolación de niveles entre exchanges reales ────────────────
        # Calcula el paso de precio adecuado según el precio del activo
        ref_precio = (bids_reales[0]["precio"] if bids_reales
                      else asks_reales[0]["precio"] if asks_reales else 100.0)
        # Paso = 0.04 % del precio, redondeado al incremento "limpio" más cercano
        # Igual que _computeStep() en el frontend — mantener sincronizados
        raw_paso = ref_precio * 0.0004
        _nice = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05,
                 0.10, 0.20, 0.50, 1.00, 2.00, 5.00, 10.00, 20.00, 50.00]
        paso = next((s for s in _nice if s >= raw_paso), 50.00)

        factor = round(1 / paso) if paso < 1 else 1

        def snap(p: float) -> float:
            return round(round(p * factor) / factor, 6)

        def interpolar(niveles_reales: list, descending: bool, max_interp: int = 60) -> list:
            """Inserta niveles sintéticos entre los niveles reales.
            El volumen sintético es proporcional al promedio de los vecinos.
            """
            if len(niveles_reales) < 2:
                return niveles_reales

            resultado = []
            for i, nivel in enumerate(niveles_reales):
                resultado.append(nivel)
                if i + 1 >= len(niveles_reales):
                    break

                p_actual = nivel["precio"]
                p_siguiente = niveles_reales[i + 1]["precio"]
                vol_promedio = (nivel["tamano"] + niveles_reales[i + 1]["tamano"]) // 2

                # Número de pasos entre los dos niveles reales
                diff = abs(p_actual - p_siguiente)
                n_pasos = min(int(round(diff / paso)) - 1, max_interp)
                if n_pasos <= 0:
                    continue

                for k in range(1, n_pasos + 1):
                    if descending:
                        p_interp = snap(p_actual - k * paso)
                    else:
                        p_interp = snap(p_actual + k * paso)
                    # Escalar el volumen sintético con algo de variación
                    # (los niveles del centro tienen menos volumen que los extremos)
                    factor_var = 0.3 + 0.7 * (1 - abs(k - n_pasos / 2) / max(1, n_pasos / 2))
                    vol_sintetico = max(1, int(vol_promedio * factor_var * 0.4))
                    resultado.append({
                        "precio": p_interp,
                        "tamano": vol_sintetico,
                        "exchanges": [],
                        "interpolado": True,
                    })

            return resultado

        def extrapolar(niveles_interpolados: list, descending: bool, max_extra: int = 60) -> list:
            """Genera niveles sintéticos MÁS ALLÁ del último nivel real.

            El volumen arranca en el promedio de los últimos 2 reales y decae
            un 15 % por nivel (exponencial), con variación ±20 %.
            Esto rellena visualmente toda la escalera de precios.
            """
            import random
            # Buscar los últimos 2 niveles reales para calcular el vol de arranque
            reales = [n for n in niveles_interpolados if not n.get("interpolado", False)]
            if len(reales) == 0:
                return niveles_interpolados

            # Volumen base: promedio de los últimos 2 reales (o el único)
            vol_base = reales[-1]["tamano"]
            if len(reales) >= 2:
                vol_base = (reales[-2]["tamano"] + reales[-1]["tamano"]) // 2

            # Precio inicial: más allá del último nivel existente
            ultimo = niveles_interpolados[-1]
            if descending:
                p_inicio = snap(ultimo["precio"] - paso)
            else:
                p_inicio = snap(ultimo["precio"] + paso)

            resultado = list(niveles_interpolados)
            vol = float(vol_base)
            p = p_inicio

            for k in range(max_extra):
                if p <= 0:
                    break
                # Decaimiento exponencial 15 % por nivel, ±20 % de ruido
                vol *= 0.85
                variacion = 1.0 + (random.random() - 0.5) * 0.40
                vol_sintetico = max(1, int(vol * variacion))
                resultado.append({
                    "precio": p,
                    "tamano": vol_sintetico,
                    "exchanges": [],
                    "interpolado": True,
                })
                if descending:
                    p = snap(p - paso)
                else:
                    p = snap(p + paso)

            return resultado

        bids = interpolar(bids_reales, descending=True)
        bids = extrapolar(bids, descending=True, max_extra=80)
        asks = interpolar(asks_reales, descending=False)
        asks = extrapolar(asks, descending=False, max_extra=80)

        # Aplicar max_levels si está configurado
        if self.max_levels > 0:
            bids = bids[:self.max_levels]
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

        best_bid = bids_reales[0]["precio"] if bids_reales else 0
        best_ask = asks_reales[0]["precio"] if asks_reales else 0
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


# ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
#  POLYGON WEBSOCKET MANAGER ÔÇö QUOTES
# ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ

class PolygonQuotesWS:
    """Gestor de conexi├│n WebSocket a Polygon.io para el canal de Quotes.

    Caracter├¡sticas:
        - Autenticaci├│n autom├ítica v├¡a API Key
        - Suscripci├│n din├ímica a m├║ltiples s├¡mbolos (solo Quotes)
        - Procesamiento as├¡ncrono sin bloqueo (asyncio)
        - Auto-reconexi├│n con backoff exponencial
        - Heartbeat para detecci├│n temprana de desconexiones
        - Construcci├│n de Order Book L2 en tiempo real
        - Normalizaci├│n de datos a estructuras limpias

    Par├ímetros:
        api_key          : str   ÔåÆ Clave de autenticaci├│n de Polygon.io
        simbolos         : list  ÔåÆ Lista de tickers (ej. ["AAPL", "TSLA"])
        on_quote_cb      : func  ÔåÆ Callback al recibir una cotizaci├│n normalizada
        on_book_cb       : func  ÔåÆ Callback al actualizarse el Order Book L2
        max_reconexiones : int   ÔåÆ Intentos m├íximos de reconexi├│n (default: 50)
        heartbeat_seg    : int   ÔåÆ Intervalo de heartbeat en segundos (default: 30)
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

        # M├®tricas
        self._quotes_recibidos = 0
        self._ultimo_mensaje_ts = 0.0
        self._connect_ts = 0.0  # Timestamp de ├║ltima conexi├│n exitosa

    # ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
    #  CICLO DE VIDA: CONEXI├ôN, AUTENTICACI├ôN, SUSCRIPCI├ôN
    # ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

    async def iniciar(self) -> None:
        """Punto de entrada principal. Inicia la conexi├│n con auto-reconexi├│n."""
        logger.info("=" * 60)
        logger.info("  ORDER BOOK ENGINE ÔÇö Quotes + L2 en Tiempo Real")
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
        """Establece conexi├│n WebSocket, autentica, suscribe y escucha."""
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
            self._connect_ts = time.time()  # Marcar inicio de la conexi├│n
            # No resetear _reconexiones aqu├¡ ÔÇö solo tras conexi├│n estable
            logger.info("Conexion WebSocket establecida")

            bienvenida = await ws.recv()
            logger.debug("[BIENVENIDA] %s", bienvenida[:500])

            await self._autenticar()
            await self._suscribir()

            logger.info("Escuchando flujo de quotes en tiempo real...")
            async for mensaje_crudo in ws:
                self._ultimo_mensaje_ts = time.time()
                # Si recibimos datos reales y la conexi├│n lleva >10s, resetear reconexiones
                if self._reconexiones > 0 and (time.time() - self._connect_ts) > 10:
                    logger.info("Conexi├│n estable >10s ÔÇö reseteando contador de reconexiones")
                    self._reconexiones = 0
                await self._on_message(mensaje_crudo)

    async def _autenticar(self) -> None:
        """Env├¡a el mensaje de autenticaci├│n a Polygon."""
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
        """Suscribe al canal de Quotes para todos los s├¡mbolos."""
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

    # ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
    #  SUSCRIPCI├ôN DIN├üMICA
    # ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

    async def suscribir_simbolo(self, simbolo: str) -> None:
        """A├▒ade un nuevo s├¡mbolo a la suscripci├│n en caliente."""
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
        """Elimina un s├¡mbolo de la suscripci├│n en caliente."""
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

    # ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
    #  PROCESAMIENTO DE MENSAJES
    # ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

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
        """Normaliza una cotizaci├│n cruda de Polygon y la despacha.

        Mapeo de campos crudos:
            sym ÔåÆ simbolo, bp ÔåÆ bid_precio, bs ÔåÆ bid_tamano,
            ap ÔåÆ ask_precio, as ÔåÆ ask_tamano, bx ÔåÆ bid_exchange,
            ax ÔåÆ ask_exchange, t ÔåÆ timestamp_ms
        """
        # Normalizar s├¡mbolo (quitar prefijo X: de crypto)
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

    # ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
    #  M├ëTRICAS
    # ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

    def obtener_metricas(self) -> dict:
        """Retorna m├®tricas de rendimiento del motor de quotes."""
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


# ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
#  PUNTO DE ENTRADA ÔÇö ORDER BOOK EN CONSOLA
# ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ

def main():
    """Script de inicio r├ípido para Order Book L2.

    Imprime en consola el spread bid/ask y muestra el Order Book L2
    completo cada 500 actualizaciones por s├¡mbolo.
    """

    # ÔòöÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòù
    # Ôòæ  CONFIGURACI├ôN ÔÇö EDITAR AQU├ì                        Ôòæ
    # ÔòÜÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòØ
    API_KEY = "m3oCAFJ_qZZ7wIaYHZSvxTiBUbiFIt77"
    SIMBOLOS = ["AAPL", "TSLA"]

    # ÔöÇÔöÇ Callback: Se ejecuta por cada quote recibido ÔöÇÔöÇ
    def al_recibir_quote(quote: QuoteNormalizado) -> None:
        print(
            f"  QUOTE {quote.simbolo:<6s} | "
            f"Bid: ${quote.bid_precio:.4f} x{quote.bid_tamano:>6,d} | "
            f"Ask: ${quote.ask_precio:.4f} x{quote.ask_tamano:>6,d} | "
            f"Spread: ${quote.spread:.4f} | "
            f"Mid: ${quote.mid_price:.4f}"
        )

    # ÔöÇÔöÇ Callback: Se ejecuta cuando el Order Book L2 cambia ÔöÇÔöÇ
    book_print_counter: dict[str, int] = defaultdict(int)

    def al_actualizar_book(snapshot: dict) -> None:
        simbolo = snapshot["simbolo"]
        book_print_counter[simbolo] += 1
        # Imprimir cada 500 updates para no saturar consola
        if book_print_counter[simbolo] % 500 != 0:
            return

        bids = snapshot["bids"]
        asks = snapshot["asks"]

        print(f"\n  {'ÔöÇ' * 76}")
        print(f"  ORDER BOOK L2 -- {simbolo}  |  "
              f"Spread: ${snapshot['spread']:.4f}  |  "
              f"Mid: ${snapshot['mid_price']:.4f}  |  "
              f"Updates: {snapshot['updates']:,d}")
        print(f"  {'ÔöÇ' * 76}")
        print(f"  {'BIDS (Compra)':^37s} | {'ASKS (Venta)':^37s}")
        print(f"  {'Acum':>6s}  {'Vol':>6s}  {'Precio':>10s}  {'Exch':>6s}"
              f" | {'Precio':>10s}  {'Vol':>6s}  {'Acum':>6s}  {'Exch':>6s}")
        print(f"  {'ÔöÇ' * 37} | {'ÔöÇ' * 37}")

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

        print(f"  {'ÔöÇ' * 76}")
        print(f"  Exchanges activos -- Bid: {snapshot['num_exchanges_bid']}  |  Ask: {snapshot['num_exchanges_ask']}")
        print()

    # ÔöÇÔöÇ Crear instancia del motor ÔöÇÔöÇ
    motor = PolygonQuotesWS(
        api_key=API_KEY,
        simbolos=SIMBOLOS,
        on_quote_cb=al_recibir_quote,
        on_book_cb=al_actualizar_book,
        max_reconexiones=50,
        heartbeat_seg=30,
    )

    # ÔöÇÔöÇ Manejo limpio de CTRL+C ÔöÇÔöÇ
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
    print("  ORDER BOOK ENGINE ÔÇö Quotes + L2 en Tiempo Real")
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

    # ÔöÇÔöÇ M├®tricas finales ÔöÇÔöÇ
    metricas = motor.obtener_metricas()
    print("\n" + "-" * 50)
    print("  METRICAS FINALES ÔÇö ORDER BOOK ENGINE")
    print(f"  Quotes recibidos : {metricas['quotes_recibidos']:,d}")
    print(f"  Reconexiones     : {metricas['reconexiones']}")
    print("-" * 50)


if __name__ == "__main__":
    main()
