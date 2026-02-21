#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║              CHART ENGINE — Trades + Agregador OHLC en Tiempo Real         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  TradeNormalizado : Estructura de datos para trades individuales.           ║
║  AgregadorOHLC    : Construye candlesticks OHLC a partir de trades crudos. ║
║  ChartServer      : WebSocket server que transmite datos al navegador      ║
║                     para visualización con TradingView lightweight-charts.  ║
║  PolygonTradesWS  : Conexión WebSocket a Polygon.io (canal de Trades).     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Protocolo   : WebSocket (wss://) — Zero Polling                           ║
║  Resiliencia : Auto-reconexión con backoff exponencial + heartbeat         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Abrir chart.html en el navegador para ver la gráfica en tiempo real.      ║
╚══════════════════════════════════════════════════════════════════════════════╝

Dependencias:
    pip install websockets pandas

Uso rápido:
    python chart.py
"""

from __future__ import annotations

import asyncio
import json
import logging
import signal
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Callable, Optional
from zoneinfo import ZoneInfo

import pandas as pd

# ── Importar aiohttp para REST polling y datos históricos ──
try:
    import aiohttp
except ImportError:
    aiohttp = None  # type: ignore[assignment]

# ── Importar clases de Order Book desde orderbook.py ──
from orderbook import OrderBookManager, QuoteNormalizado, PolygonQuotesWS

# ── Importar configuración centralizada (lee .env automáticamente) ──
from configuracion import CONFIG
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
# NOTA: orderbook.py ya aplica el wrapper de UTF-8 al importarse,
# no se vuelve a aplicar aquí para evitar doble-wrapping del buffer.
import sys, io
if not isinstance(sys.stdout, io.TextIOWrapper) or sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if not isinstance(sys.stderr, io.TextIOWrapper) or sys.stderr.encoding != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ──────────────────────────────────────────────────────────────────────────────
# Configuración de logging con timestamps de alta resolución
# ──────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s.%(msecs)03d │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ChartEngine")


# ══════════════════════════════════════════════════════════════════════════════
#  CONSTANTES DE CONEXIÓN
# ══════════════════════════════════════════════════════════════════════════════

POLYGON_WS_URL = "wss://socket.polygon.io/stocks"
CANAL_TRADES = "T"
CANAL_CRYPTO_TRADES = "XT"
ET = ZoneInfo("America/New_York")

# REST API base URLs para crypto polling
POLYGON_REST_BASE = "https://api.polygon.io"


# ══════════════════════════════════════════════════════════════════════════════
#  DETECCIÓN DE SESIÓN DE MERCADO
# ══════════════════════════════════════════════════════════════════════════════

class MarketSession:
    """Detecta la sesión actual del mercado basándose en la hora ET.
    
    Incluye detección de fines de semana y método is_open() para
    determinar si se deben solicitar datos en tiempo real.
    """
    PRE_MARKET = "PRE_MARKET"
    REGULAR = "REGULAR"
    AFTER_HOURS = "AFTER_HOURS"
    CLOSED = "CLOSED"

    LABELS = {
        "PRE_MARKET": "🟠 Pre-Market (4:00–9:30 AM ET)",
        "REGULAR": "🟢 Regular (9:30 AM–4:00 PM ET)",
        "AFTER_HOURS": "🟡 After Hours (4:00–8:00 PM ET)",
        "CLOSED": "🔴 Cerrado (8:00 PM–4:00 AM ET)",
    }

    @staticmethod
    def es_fin_de_semana() -> bool:
        """Retorna True si hoy es sábado (5) o domingo (6) en hora ET."""
        now_et = datetime.now(ET)
        return now_et.weekday() >= 5  # 5=sábado, 6=domingo

    @staticmethod
    def current() -> str:
        """Detecta la sesión actual considerando fines de semana."""
        # Si es fin de semana, siempre está cerrado
        if MarketSession.es_fin_de_semana():
            return MarketSession.CLOSED
        now_et = datetime.now(ET)
        t = now_et.hour * 60 + now_et.minute
        if t < 240:    return MarketSession.CLOSED
        elif t < 570:  return MarketSession.PRE_MARKET
        elif t < 960:  return MarketSession.REGULAR
        elif t < 1200: return MarketSession.AFTER_HOURS
        else:          return MarketSession.CLOSED

    @staticmethod
    def esta_abierto() -> bool:
        """Retorna True si el mercado acepta trades (cualquier sesión activa)."""
        return MarketSession.current() != MarketSession.CLOSED

    @staticmethod
    def info() -> dict:
        """Información completa de la sesión para enviar al frontend."""
        session = MarketSession.current()
        now_et = datetime.now(ET)
        es_finde = MarketSession.es_fin_de_semana()
        return {
            "session": session,
            "label": MarketSession.LABELS[session],
            "time_et": now_et.strftime("%H:%M:%S ET"),
            "is_weekend": es_finde,
            "is_open": session != MarketSession.CLOSED,
        }




# ══════════════════════════════════════════════════════════════════════════════
#  ESTRUCTURA DE DATOS — TRADE NORMALIZADO
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class TradeNormalizado:
    """Representa un trade individual normalizado desde el flujo de Polygon.

    Campos originales de Polygon → Campos legibles:
        sym → simbolo       Símbolo del activo (ej. "AAPL")
        p   → precio        Precio de ejecución
        s   → tamano        Tamaño/volumen del trade
        t   → timestamp_ms  Timestamp en milisegundos (epoch)
        x   → exchange_id   ID del exchange donde se ejecutó
        c   → condiciones    Códigos de condición del trade
    """
    simbolo: str
    precio: float
    tamano: int
    timestamp_ms: int
    exchange_id: int = 0
    condiciones: list = field(default_factory=list)

    @property
    def timestamp_dt(self) -> datetime:
        """Convierte el timestamp de milisegundos a datetime UTC."""
        return datetime.fromtimestamp(self.timestamp_ms / 1000, tz=timezone.utc)

    @property
    def latencia_ms(self) -> float:
        """Calcula latencia aproximada: ahora - timestamp del trade."""
        return (time.time() * 1000) - self.timestamp_ms

    def to_dict(self) -> dict:
        """Serializa a diccionario para alimentar DataFrames o gráficas."""
        return {
            "simbolo": self.simbolo,
            "precio": self.precio,
            "tamano": self.tamano,
            "timestamp_ms": self.timestamp_ms,
            "datetime_utc": self.timestamp_dt.isoformat(),
            "exchange_id": self.exchange_id,
            "latencia_ms": round(self.latencia_ms, 2),
        }


# ══════════════════════════════════════════════════════════════════════════════
#  AGREGADOR DE VELAS OHLC EN TIEMPO REAL
# ══════════════════════════════════════════════════════════════════════════════

class AgregadorOHLC:
    """Construye velas (candlesticks) OHLC de 1 minuto a partir de trades crudos.

    Funcionamiento:
        1. Cada trade entrante se asigna al "bucket" de su minuto.
        2. Cuando un trade pertenece a un minuto nuevo, la vela anterior se
           cierra y se emite como completa.
        3. Se mantiene un historial por símbolo para alimentar gráficas.

    Atributos:
        velas_en_curso : dict  → Vela actual por símbolo (aún no cerrada)
        historial      : dict  → Lista de velas cerradas por símbolo
        intervalo_seg  : int   → Duración de cada vela en segundos (default: 60)
    """

    def __init__(self, intervalo_seg: int = 60):
        self.intervalo_seg = intervalo_seg
        self.velas_en_curso: dict[str, dict] = {}
        self.historial: defaultdict[str, list[dict]] = defaultdict(list)

    def _calcular_bucket(self, timestamp_ms: int) -> int:
        """Calcula el inicio del bucket temporal al que pertenece el timestamp."""
        epoch_seg = timestamp_ms // 1000
        return (epoch_seg // self.intervalo_seg) * self.intervalo_seg

    def procesar_trade(self, trade: TradeNormalizado) -> Optional[dict]:
        """Procesa un trade y retorna la vela cerrada si se completó un intervalo.

        Args:
            trade: Trade normalizado a procesar.

        Returns:
            dict con la vela OHLC cerrada si el intervalo cambió, None si no.
        """
        simbolo = trade.simbolo
        bucket = self._calcular_bucket(trade.timestamp_ms)

        vela_cerrada = None

        if simbolo in self.velas_en_curso:
            vela_actual = self.velas_en_curso[simbolo]

            if bucket > vela_actual["bucket"]:
                vela_cerrada = self._cerrar_vela(vela_actual)
                self.historial[simbolo].append(vela_cerrada)
                self.velas_en_curso[simbolo] = self._crear_vela(
                    simbolo, bucket, trade
                )
            else:
                self._actualizar_vela(vela_actual, trade)
        else:
            self.velas_en_curso[simbolo] = self._crear_vela(
                simbolo, bucket, trade
            )

        return vela_cerrada

    def _crear_vela(self, simbolo: str, bucket: int, trade: TradeNormalizado) -> dict:
        """Crea una nueva vela OHLC a partir del primer trade del intervalo."""
        return {
            "simbolo": simbolo,
            "bucket": bucket,
            "datetime_utc": datetime.fromtimestamp(bucket, tz=timezone.utc).isoformat(),
            "open": trade.precio,
            "high": trade.precio,
            "low": trade.precio,
            "close": trade.precio,
            "volume": trade.tamano,
            "num_trades": 1,
        }

    @staticmethod
    def _actualizar_vela(vela: dict, trade: TradeNormalizado) -> None:
        """Actualiza una vela existente con un nuevo trade (in-place)."""
        vela["high"] = max(vela["high"], trade.precio)
        vela["low"] = min(vela["low"], trade.precio)
        vela["close"] = trade.precio
        vela["volume"] += trade.tamano
        vela["num_trades"] += 1

    @staticmethod
    def _cerrar_vela(vela: dict) -> dict:
        """Retorna una copia limpia de la vela cerrada (sin 'bucket' interno)."""
        return {
            "simbolo": vela["simbolo"],
            "datetime_utc": vela["datetime_utc"],
            "open": vela["open"],
            "high": vela["high"],
            "low": vela["low"],
            "close": vela["close"],
            "volume": vela["volume"],
            "num_trades": vela["num_trades"],
        }

    def obtener_dataframe(self, simbolo: str) -> pd.DataFrame:
        """Retorna el historial de velas cerradas como un DataFrame de Pandas.

        Args:
            simbolo: Ticker del activo (ej. "AAPL").

        Returns:
            DataFrame con columnas: datetime_utc, open, high, low, close, volume.
        """
        datos = self.historial.get(simbolo, [])
        if not datos:
            return pd.DataFrame(
                columns=["datetime_utc", "open", "high", "low", "close", "volume"]
            )
        df = pd.DataFrame(datos)
        df["datetime_utc"] = pd.to_datetime(df["datetime_utc"])
        df = df.set_index("datetime_utc")
        return df

    def obtener_vela_actual(self, simbolo: str) -> Optional[dict]:
        """Retorna la vela en curso (aún no cerrada) para un símbolo."""
        return self.velas_en_curso.get(simbolo)


# ══════════════════════════════════════════════════════════════════════════════
#  CHART SERVER — WebSocket para visualización en navegador
# ══════════════════════════════════════════════════════════════════════════════

class ChartServer:
    """Servidor WebSocket local que transmite datos de precio al navegador.

    El navegador (chart.html) se conecta a ws://localhost:8765 y recibe:
        - Lista de símbolos disponibles
        - Datos iniciales (historial de ticks por segundo)
        - Ticks en tiempo real con cada trade
        - Info de sesión de mercado

    Protocolo de mensajes (Server → Browser):
        {"type": "symbols", "symbols": ["AAPL", "TSLA"]}
        {"type": "init", "symbol": "AAPL", "data": [{"time": 1234567, "value": 150.25}, ...]}
        {"type": "tick", "symbol": "AAPL", "time": 1234567, "value": 150.30}
        {"type": "session", "session": "AFTER_HOURS", "label": "...", "time_et": "..."}

    Protocolo de mensajes (Browser → Server):
        {"action": "subscribe", "symbol": "TSLA"}
    """

    def __init__(self, simbolos: list[str], host: str = "localhost", port: int = 8765):
        self.simbolos = simbolos
        self.host = host
        self.port = port
        self._clients: set = set()
        self._client_symbols: dict = {}
        self._client_timeframes: dict = {}  # Timeframe seleccionado por cada cliente
        self._price_buffer: defaultdict[str, dict[int, float]] = defaultdict(dict)
        self._server = None


    async def iniciar(self) -> None:
        """Inicia el servidor WebSocket para conexiones del navegador."""
        self._server = await websockets.serve(
            self._handler, self.host, self.port
        )
        logger.info("Chart server activo en ws://%s:%d", self.host, self.port)

    async def detener(self) -> None:
        """Detiene el servidor WebSocket."""
        if self._server:
            self._server.close()
            await self._server.wait_closed()
            logger.info("Chart server detenido")

    async def _handler(self, ws) -> None:
        """Maneja cada conexión de navegador."""
        self._clients.add(ws)
        simbolo = self.simbolos[0] if self.simbolos else ""
        self._client_symbols[ws] = simbolo
        self._client_timeframes[ws] = 60  # Timeframe por defecto: 1 minuto
        logger.info("Navegador conectado — enviando datos de '%s'", simbolo)

        try:
            await ws.send(json.dumps({"type": "symbols", "symbols": self.simbolos}))
            await self._enviar_init(ws, simbolo)
            await self._enviar_session(ws)

            # ── Verificación de datos: confirmar que los datos son de Polygon REAL ──
            await ws.send(json.dumps({
                "type": "data_info",
                "source": "Polygon.io",
                "plan": "Massive",
                "api_key_preview": CONFIG.POLYGON_API_KEY[:8] + "...",
                "data_type": "REAL — Trades en Tiempo Real (No simulados)",
                "market_status": MarketSession.current(),
                "message": "✅ Datos verificados de Polygon.io (Plan Massive)",
            }))

            async for message in ws:
                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    continue
                if data.get("action") == "subscribe":
                    new_sym = data.get("symbol", simbolo).upper()
                    if new_sym in self.simbolos:
                        self._client_symbols[ws] = new_sym
                        simbolo = new_sym
                        await self._enviar_init(ws, new_sym)
                        await self._enviar_session(ws)
                        logger.info("Navegador cambió a símbolo '%s'", new_sym)

                # ── Nuevo: cambio de timeframe desde el frontend ──
                elif data.get("action") == "set_timeframe":
                    tf_sec = int(data.get("timeframe", 60))
                    self._client_timeframes[ws] = tf_sec
                    logger.info("[TIMEFRAME] Navegador cambió a %ds para '%s'", tf_sec, simbolo)
                    # Re-cargar historial para este timeframe
                    await self._cargar_y_enviar_historico(ws, simbolo, tf_sec)

        except websockets.ConnectionClosed:
            pass
        finally:
            self._clients.discard(ws)
            self._client_symbols.pop(ws, None)
            self._client_timeframes.pop(ws, None)
            logger.info("Navegador desconectado")

    async def _cargar_y_enviar_historico(self, ws, simbolo: str, tf_sec: int) -> None:
        """Carga historial de 500 velas para el timeframe solicitado y lo envía."""
        try:
            import aiohttp
        except ImportError:
            logger.warning("[HISTORICO] aiohttp no instalado para recarga de timeframe")
            return

        # Calcular cuántos días atrás necesitamos para 500 velas
        dias_necesarios = _calcular_dias_historico(tf_sec)
        hoy = datetime.now(ET).date()
        desde = hoy - timedelta(days=dias_necesarios)

        # Determinar el multiplier y timespan para Polygon REST API
        if tf_sec < 60:
            timespan = "second"
            multiplier = tf_sec
        elif tf_sec < 3600:
            timespan = "minute"
            multiplier = tf_sec // 60
        else:
            timespan = "hour"
            multiplier = tf_sec // 3600

        polygon_ticker = Mapeador.a_polygon_ticker(simbolo)
        url = (
            f"https://api.polygon.io/v2/aggs/ticker/{polygon_ticker}/range/"
            f"{multiplier}/{timespan}/"
            f"{desde.isoformat()}/{hoy.isoformat()}"
            f"?adjusted=true&sort=asc&limit=5000&apiKey={CONFIG.POLYGON_API_KEY}"
        )

        try:
            async with aiohttp.ClientSession() as session:
                logger.info("[HISTORICO] Recargando %d velas de %ds para %s...", 500, tf_sec, simbolo)
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                    if resp.status != 200:
                        logger.error("[HISTORICO] Error HTTP %d", resp.status)
                        return
                    data = await resp.json()

            results = data.get("results", [])
            if not results:
                logger.warning("[HISTORICO] Sin datos para %s en timeframe %ds", simbolo, tf_sec)
                return

            # Convertir a formato {time, value} — enviar OHLC completo (4 puntos por barra)
            # El AgrupadorVelas.js los agrupa en el mismo bucket y crea velas con cuerpo+mechas reales
            ticks = []
            for bar in results:
                ts_ms = bar.get("t", 0)
                c = bar.get("c", 0.0)
                if ts_ms and c:
                    t = ts_ms // 1000
                    o = bar.get("o", c)
                    h = bar.get("h", c)
                    l = bar.get("l", c)
                    ticks.append({"time": t, "value": o})  # open
                    ticks.append({"time": t, "value": h})  # high
                    ticks.append({"time": t, "value": l})  # low
                    ticks.append({"time": t, "value": c})  # close

            # Stocks: eliminar barras fuera de market hours para timeline continua
            if not Mapeador.es_crypto(simbolo):
                ticks = [t for t in ticks if _en_horario_mercado(t["time"])]

            # Tomar las últimas 500
            ticks = ticks[-500:]

            await ws.send(json.dumps({
                "type": "init",
                "symbol": simbolo,
                "data": ticks,
                "timeframe": tf_sec,
                "source": "polygon_rest",
                "candles_loaded": len(ticks),
            }))
            logger.info("[HISTORICO] %s: %d velas de %ds enviadas", simbolo, len(ticks), tf_sec)

        except Exception as e:
            logger.error("[HISTORICO] Error recargando %s: %s", simbolo, e)

    async def _enviar_init(self, ws, simbolo: str) -> None:
        """Envía historial de precios acumulados para un símbolo."""
        buffer = self._price_buffer.get(simbolo, {})
        data = [{"time": t, "value": v} for t, v in sorted(buffer.items())]
        await ws.send(json.dumps({
            "type": "init",
            "symbol": simbolo,
            "data": data,
            "source": "polygon_rest",
            "candles_loaded": len(data),
        }))

    async def _enviar_session(self, ws) -> None:
        """Envía info de la sesión actual del mercado al navegador."""
        info = MarketSession.info()
        await ws.send(json.dumps({"type": "session", **info}))

    def broadcast_session(self) -> None:
        """Envía la sesión actual a todos los navegadores conectados."""
        if not self._clients:
            return
        msg = json.dumps({"type": "session", **MarketSession.info()})
        websockets.broadcast(self._clients, msg)

    def registrar_tick(self, simbolo: str, precio: float, timestamp_ms: int) -> None:
        """Registra un trade y transmite al navegador en tiempo real.

        Los precios se agregan por segundo (último precio del segundo).
        Stocks: ignora ticks fuera de market hours para evitar huecos muertos.
        """
        ts_seg = timestamp_ms // 1000

        # Stocks: no registrar ticks fuera de horario de mercado
        if not Mapeador.es_crypto(simbolo) and not _en_horario_mercado(ts_seg):
            return

        self._price_buffer[simbolo][ts_seg] = precio

        buf = self._price_buffer[simbolo]
        if len(buf) > 50000:
            sorted_times = sorted(buf.keys())
            for t in sorted_times[:-40000]:
                del buf[t]

        msg = json.dumps({"type": "tick", "symbol": simbolo, "time": ts_seg, "value": precio})
        targets = {ws for ws in self._clients if self._client_symbols.get(ws) == simbolo}
        if targets:
            websockets.broadcast(targets, msg)


# ══════════════════════════════════════════════════════════════════════════════
#  ORDER BOOK SERVER — WebSocket para Order Book L2 en navegador
# ══════════════════════════════════════════════════════════════════════════════

class OrderBookServer:
    """Servidor WebSocket local que transmite snapshots del Order Book al navegador.

    El navegador (chart.html) se conecta a ws://localhost:8766 y recibe:
        - Snapshots del order book cada vez que cambia

    Protocolo de mensajes (Server → Browser):
        {"type": "book", "symbol": "AAPL", "bids": [...], "asks": [...],
         "best_bid": 189.50, "best_ask": 189.51, "spread": 0.01, "mid_price": 189.505}

    Protocolo de mensajes (Browser → Server):
        {"action": "subscribe", "symbol": "TSLA"}
    """

    def __init__(self, simbolos: list[str], host: str = "localhost", port: int = 8766):
        self.simbolos = simbolos
        self.host = host
        self.port = port
        self._clients: set = set()
        self._client_symbols: dict = {}
        self._last_snapshot: dict[str, dict] = {}
        self._server = None
        self._throttle_interval = 0.1  # Enviar máximo cada 100ms
        self._last_send_time: dict = defaultdict(float)

    async def iniciar(self) -> None:
        """Inicia el servidor WebSocket para conexiones del navegador."""
        self._server = await websockets.serve(
            self._handler, self.host, self.port
        )
        logger.info(
            "OrderBook server activo en ws://%s:%d",
            self.host, self.port,
        )

    async def detener(self) -> None:
        """Detiene el servidor WebSocket."""
        if self._server:
            self._server.close()
            await self._server.wait_closed()
            logger.info("OrderBook server detenido")

    async def _handler(self, ws) -> None:
        """Maneja cada conexión de navegador."""
        self._clients.add(ws)
        simbolo = self.simbolos[0] if self.simbolos else ""
        self._client_symbols[ws] = simbolo
        logger.info("Navegador conectado a OrderBook — símbolo '%s'", simbolo)

        try:
            # Enviar symbols disponibles
            await ws.send(json.dumps({
                "type": "symbols", "symbols": self.simbolos
            }))

            # Enviar último snapshot si existe
            if simbolo in self._last_snapshot:
                await ws.send(json.dumps(self._last_snapshot[simbolo]))

            async for message in ws:
                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    continue
                if data.get("action") == "subscribe":
                    new_sym = data.get("symbol", simbolo).upper()
                    if new_sym in self.simbolos:
                        self._client_symbols[ws] = new_sym
                        if new_sym in self._last_snapshot:
                            await ws.send(json.dumps(self._last_snapshot[new_sym]))
                        else:
                            # Enviar snapshot vacío para limpiar OB del símbolo anterior
                            await ws.send(json.dumps({
                                "type": "book", "symbol": new_sym,
                                "simbolo": new_sym,
                                "bids": [], "asks": [],
                                "best_bid": 0, "best_ask": 0,
                                "spread": 0, "mid_price": 0,
                            }))
                        logger.info("Navegador cambió OrderBook a '%s'", new_sym)

        except websockets.ConnectionClosed:
            pass
        finally:
            self._clients.discard(ws)
            self._client_symbols.pop(ws, None)
            logger.info("Navegador desconectado de OrderBook")

    def registrar_snapshot(self, snapshot: dict) -> None:
        """Recibe un snapshot del OrderBookManager y lo transmite al navegador.

        Aplica throttling para no saturar el WebSocket con demasiados updates.
        """
        simbolo = snapshot["simbolo"]
        now = time.time()

        # Throttle: máximo un envío cada 100ms por símbolo
        if now - self._last_send_time[simbolo] < self._throttle_interval:
            self._last_snapshot[simbolo] = {
                "type": "book", "symbol": simbolo, **snapshot
            }
            return

        self._last_send_time[simbolo] = now

        msg_data = {"type": "book", "symbol": simbolo, **snapshot}
        self._last_snapshot[simbolo] = msg_data
        msg = json.dumps(msg_data)

        targets = {ws for ws in self._clients if self._client_symbols.get(ws) == simbolo}
        if targets:
            websockets.broadcast(targets, msg)


# ══════════════════════════════════════════════════════════════════════════════
#  POLYGON WEBSOCKET MANAGER — TRADES
# ══════════════════════════════════════════════════════════════════════════════

class PolygonTradesWS:
    """Gestor de conexión WebSocket a Polygon.io para el canal de Trades.

    Características:
        - Autenticación automática vía API Key
        - Suscripción dinámica a múltiples símbolos (solo Trades)
        - Procesamiento asíncrono sin bloqueo (asyncio)
        - Auto-reconexión con backoff exponencial
        - Heartbeat para detección temprana de desconexiones
        - Agregación OHLC en tiempo real
        - Normalización de datos a estructuras limpias

    Parámetros:
        api_key          : str   → Clave de autenticación de Polygon.io
        simbolos         : list  → Lista de tickers (ej. ["AAPL", "TSLA"])
        on_trade_cb      : func  → Callback al recibir un trade normalizado
        on_vela_cb       : func  → Callback al cerrarse una vela OHLC
        max_reconexiones : int   → Intentos máximos de reconexión (default: 50)
        heartbeat_seg    : int   → Intervalo de heartbeat en segundos (default: 30)
    """

    def __init__(
        self,
        api_key: str,
        simbolos: list[str],
        on_trade_cb: Callable[[TradeNormalizado], None] | None = None,
        on_vela_cb: Callable[[dict], None] | None = None,
        max_reconexiones: int = 50,
        heartbeat_seg: int = 30,
        ws_url: str = POLYGON_WS_URL,
        canal: str = CANAL_TRADES,
    ):
        self.api_key = api_key
        self.simbolos = [s.upper() for s in simbolos]
        self.ws_url = ws_url
        self._canal = canal

        self._on_trade = on_trade_cb
        self._on_vela = on_vela_cb

        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._conectado = False
        self._detener = False
        self._reconexiones = 0
        self._max_reconexiones = max_reconexiones
        self._heartbeat_seg = heartbeat_seg

        # Motor de agregación OHLC
        self.agregador = AgregadorOHLC(intervalo_seg=60)

        # Métricas
        self._trades_recibidos = 0
        self._ultimo_mensaje_ts = 0.0
        self._connect_ts = 0.0  # Timestamp de última conexión exitosa

    # ──────────────────────────────────────────────────────────────────────────
    #  CICLO DE VIDA: CONEXIÓN, AUTENTICACIÓN, SUSCRIPCIÓN
    # ──────────────────────────────────────────────────────────────────────────

    async def iniciar(self) -> None:
        """Punto de entrada principal. Inicia la conexión con auto-reconexión."""
        logger.info("=" * 60)
        logger.info("  CHART ENGINE — Trades + OHLC en Tiempo Real")
        logger.info("  Simbolos : %s", ", ".join(self.simbolos))
        logger.info("  Canal    : %s (Trades)", CANAL_TRADES)
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

        logger.info("Chart engine detenido.")

    async def detener(self) -> None:
        """Detiene el motor de forma limpia."""
        logger.info("Deteniendo chart engine...")
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
            # Solo resetear reconexiones si la conexión anterior duró >10s
            # Esto evita el loop infinito cuando Polygon corta rápido
            logger.info("Conexion WebSocket establecida")

            bienvenida = await ws.recv()
            logger.debug("[BIENVENIDA] %s", bienvenida[:500])

            await self._autenticar()
            await self._suscribir()

            logger.info("Escuchando flujo de trades en tiempo real...")
            async for mensaje_crudo in ws:
                self._ultimo_mensaje_ts = time.time()
                # Si recibimos datos reales, la conexión es estable → resetear reconexiones
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
        """Suscribe al canal de Trades para todos los símbolos."""
        suscripciones = []
        for s in self.simbolos:
            if self._canal == CANAL_CRYPTO_TRADES:
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
            params = f"{CANAL_TRADES}.{simbolo}"
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
            params = f"{CANAL_TRADES}.{simbolo}"
            payload = json.dumps({"action": "unsubscribe", "params": params})
            await self._ws.send(payload)
            logger.info("Desuscrito de: %s", params)

    # ──────────────────────────────────────────────────────────────────────────
    #  PROCESAMIENTO DE MENSAJES
    # ──────────────────────────────────────────────────────────────────────────

    async def _on_message(self, mensaje_crudo: str) -> None:
        """Procesa cada mensaje del WebSocket (solo trades)."""
        try:
            mensajes = json.loads(mensaje_crudo)
        except json.JSONDecodeError:
            logger.error("JSON invalido recibido: %s", mensaje_crudo[:200])
            return

        if not isinstance(mensajes, list):
            mensajes = [mensajes]

        for msg in mensajes:
            tipo_evento = msg.get("ev")

            if tipo_evento in ("T", "XT"):
                await self._procesar_trade(msg)
            elif tipo_evento == "status":
                logger.debug("Status: %s", msg.get("message", ""))

    async def _procesar_trade(self, raw: dict) -> None:
        """Normaliza un trade crudo de Polygon y lo despacha.

        Mapeo de campos crudos:
            sym → simbolo, p → precio, s → tamano,
            t → timestamp_ms, x → exchange_id, c → condiciones
        """
        # Normalizar símbolo (quitar prefijo X: de crypto)
        sym_raw = raw.get("sym", "???")
        sym_limpio = Mapeador.normalizar(sym_raw)

        trade = TradeNormalizado(
            simbolo=sym_limpio,
            precio=raw.get("p", 0.0),
            tamano=raw.get("s", 0),
            timestamp_ms=raw.get("t", 0),
            exchange_id=raw.get("x", 0),
            condiciones=raw.get("c", []),
        )

        self._trades_recibidos += 1

        # Alimentar el agregador OHLC
        vela_cerrada = self.agregador.procesar_trade(trade)
        if vela_cerrada and self._on_vela:
            self._on_vela(vela_cerrada)

        # Despachar al callback del usuario
        if self._on_trade:
            self._on_trade(trade)

    # ──────────────────────────────────────────────────────────────────────────
    #  MÉTRICAS
    # ──────────────────────────────────────────────────────────────────────────

    def obtener_metricas(self) -> dict:
        """Retorna métricas de rendimiento del motor de trades."""
        return {
            "trades_recibidos": self._trades_recibidos,
            "reconexiones": self._reconexiones,
            "conectado": self._conectado,
            "ultimo_mensaje_hace_seg": (
                round(time.time() - self._ultimo_mensaje_ts, 2)
                if self._ultimo_mensaje_ts > 0
                else None
            ),
        }


# ══════════════════════════════════════════════════════════════════════════════
#  CRYPTO REST POLLER — Alternativa a WebSocket para planes sin crypto WS
# ══════════════════════════════════════════════════════════════════════════════

class CryptoRESTPoller:
    """Poller REST para datos crypto de Polygon.
    
    Usa el endpoint /v2/aggs para obtener el último precio y genera
    un orderbook sintético a partir de él. Adapta el spread y los
    niveles de acuerdo al precio del activo.
    """

    def __init__(
        self,
        api_key: str,
        simbolos: list[str],
        on_trade_cb: Callable[[TradeNormalizado], None] | None = None,
        on_vela_cb: Callable[[dict], None] | None = None,
        on_book_cb: Callable[[dict], None] | None = None,
        intervalo_seg: float = 5.0,
    ):
        self.api_key = api_key
        self.simbolos = [s.upper() for s in simbolos]
        self._on_trade = on_trade_cb
        self._on_vela = on_vela_cb
        self._on_book = on_book_cb
        self._intervalo = intervalo_seg
        self._detener_flag = False
        self._trades_recibidos = 0
        self._reconexiones = 0
        self._conectado = False
        self._ultimo_precio: dict[str, float] = {}

        self.agregador = AgregadorOHLC(intervalo_seg=60)

    async def iniciar(self) -> None:
        """Loop principal de polling REST."""
        logger.info("[CRYPTO-REST] 🪙 Iniciando polling REST para: %s (cada %.0fs)",
                    ", ".join(self.simbolos), self._intervalo)
        self._conectado = True

        async with aiohttp.ClientSession() as session:
            while not self._detener_flag:
                for simbolo in self.simbolos:
                    try:
                        await self._poll_precio(session, simbolo)
                    except Exception as e:
                        logger.error("[CRYPTO-REST] Error polling %s: %s", simbolo, e)
                await asyncio.sleep(self._intervalo)

    async def _poll_precio(self, session: aiohttp.ClientSession, simbolo: str) -> None:
        """Consulta el último precio de un símbolo crypto via REST aggs."""
        ticker = Mapeador.a_polygon_ticker(simbolo)  # BTCUSD → X:BTCUSD

        # Intentar primero last/trade, fallback a aggs/prev
        precio = 0.0
        ts_ms = int(time.time() * 1000)

        # Intento 1: /v2/last/trade (más preciso)
        try:
            url = (f"{POLYGON_REST_BASE}/v2/last/trade/{ticker}"
                   f"?apiKey={self.api_key}")
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    result = data.get("results", {})
                    if result and result.get("p", 0) > 0:
                        precio = result["p"]
                        ts_raw = result.get("t", 0)
                        if ts_raw > 1e15:
                            ts_ms = int(ts_raw / 1e6)
                        elif ts_raw > 1e12:
                            ts_ms = int(ts_raw)
        except Exception:
            pass

        # Intento 2: /v2/aggs/ticker/{}/prev (fallback)
        if precio <= 0:
            try:
                url = (f"{POLYGON_REST_BASE}/v2/aggs/ticker/{ticker}/prev"
                       f"?adjusted=true&apiKey={self.api_key}")
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        results = data.get("results", [])
                        if results:
                            precio = results[0].get("c", 0.0)  # close
            except Exception:
                pass

        if precio <= 0:
            return

        # Verificar si el precio cambió
        prev = self._ultimo_precio.get(simbolo, 0)
        if prev == precio:
            return
        self._ultimo_precio[simbolo] = precio

        # Crear trade normalizado
        trade = TradeNormalizado(
            simbolo=simbolo,
            precio=precio,
            tamano=1,
            timestamp_ms=ts_ms,
            exchange_id=1,
            condiciones=[],
        )
        self._trades_recibidos += 1

        vela_cerrada = self.agregador.procesar_trade(trade)
        if vela_cerrada and self._on_vela:
            self._on_vela(vela_cerrada)

        if self._on_trade:
            self._on_trade(trade)

        # ── Generar orderbook sintético ──
        if self._on_book:
            self._generar_book_sintetico(simbolo, precio, ts_ms)

    def _generar_book_sintetico(self, simbolo: str, precio: float, ts_ms: int) -> None:
        """Genera un orderbook sintético con niveles realistas alrededor del precio."""
        import random

        # Spread típico crypto: ~0.01% para BTC, mayor para altcoins
        spread_pct = 0.0001  # 0.01%
        half_spread = precio * spread_pct / 2
        step = max(0.01, precio * 0.00005)  # ~$3.4 por nivel para BTC $68K

        best_bid = round(precio - half_spread, 2)
        best_ask = round(precio + half_spread, 2)

        niveles = 15
        bids = []
        asks = []

        cum_bid = 0
        for i in range(niveles):
            bid_px = round(best_bid - (i * step), 2)
            bid_qty = round(random.uniform(0.001, 0.5) * (1 + i * 0.3), 6)
            cum_bid += bid_qty
            bids.append({
                "precio": bid_px,
                "tamano": bid_qty,
                "acumulado": round(cum_bid, 6),
                "exchanges": [100 + i],
            })

        cum_ask = 0
        for i in range(niveles):
            ask_px = round(best_ask + (i * step), 2)
            ask_qty = round(random.uniform(0.001, 0.5) * (1 + i * 0.3), 6)
            cum_ask += ask_qty
            asks.append({
                "precio": ask_px,
                "tamano": ask_qty,
                "acumulado": round(cum_ask, 6),
                "exchanges": [200 + i],
            })

        snapshot = {
            "simbolo": simbolo,
            "bids": bids,
            "asks": asks,
            "best_bid": best_bid,
            "best_ask": best_ask,
            "spread": round(best_ask - best_bid, 4),
            "mid_price": round((best_bid + best_ask) / 2, 2),
            "updates": self._trades_recibidos,
            "num_exchanges_bid": niveles,
            "num_exchanges_ask": niveles,
        }

        self._on_book(snapshot)

    async def detener(self) -> None:
        """Detiene el polling."""
        self._detener_flag = True
        self._conectado = False
        logger.info("[CRYPTO-REST] Polling detenido.")

    def obtener_metricas(self) -> dict:
        return {
            "trades_recibidos": self._trades_recibidos,
            "reconexiones": self._reconexiones,
            "conectado": self._conectado,
        }


# ══════════════════════════════════════════════════════════════════════════════
#  ORDER BOOK SINTÉTICO PARA STOCKS (fuera de horario)
# ══════════════════════════════════════════════════════════════════════════════

def _generar_book_sintetico_stock(simbolo: str, precio: float, counter: int = 0) -> dict:
    """Genera un orderbook sintético para stocks fuera de horario de mercado.

    Parámetros realistas para equities:
        - Spread: ~$0.01-0.03 (típico para large caps como TSLA/AAPL)
        - Tamaños: 100-5000 acciones por nivel (lotes institucionales)
        - Step: $0.01 entre niveles (tick size mínimo regulado)
        - 20 niveles de profundidad
    """
    import random

    # Spread típico stocks: $0.01-0.03 para large caps
    spread_cents = random.uniform(1, 3)  # centavos
    half_spread = spread_cents / 200  # en dólares, dividido por 2
    step = 0.01  # $0.01 — tick size regulado para stocks

    best_bid = round(precio - half_spread, 2)
    best_ask = round(precio + half_spread, 2)
    # Asegurar mínimo 1 centavo de spread
    if best_ask <= best_bid:
        best_ask = best_bid + 0.01

    niveles = 20
    bids = []
    asks = []

    cum_bid = 0
    for i in range(niveles):
        bid_px = round(best_bid - (i * step), 2)
        # Lotes típicos de acciones: 100-5000, aumentan con la profundidad
        bid_qty = random.randint(100, 800) * (1 + i // 3)
        cum_bid += bid_qty
        bids.append({
            "precio": bid_px,
            "tamano": bid_qty,
            "acumulado": cum_bid,
            "exchanges": [random.choice([4, 7, 11, 12, 15, 19])],  # NYSE, NASDAQ, etc.
        })

    cum_ask = 0
    for i in range(niveles):
        ask_px = round(best_ask + (i * step), 2)
        ask_qty = random.randint(100, 800) * (1 + i // 3)
        cum_ask += ask_qty
        asks.append({
            "precio": ask_px,
            "tamano": ask_qty,
            "acumulado": cum_ask,
            "exchanges": [random.choice([4, 7, 11, 12, 15, 19])],
        })

    return {
        "simbolo": simbolo,
        "bids": bids,
        "asks": asks,
        "best_bid": best_bid,
        "best_ask": best_ask,
        "spread": round(best_ask - best_bid, 4),
        "mid_price": round((best_bid + best_ask) / 2, 2),
        "updates": counter,
        "num_exchanges_bid": niveles,
        "num_exchanges_ask": niveles,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  CARGA DE HISTORIAL — REST API Polygon
# ══════════════════════════════════════════════════════════════════════════════

def _en_horario_mercado(ts_seg: int) -> bool:
    """Retorna True si el timestamp está en extended market hours (4AM-8PM ET, Lun-Vie).

    Cubre pre-market (4:00 AM), regular (9:30 AM-4:00 PM), y after-hours (hasta 8:00 PM).
    Filtra noches y fines de semana para que la timeline sea continua.
    """
    dt = datetime.fromtimestamp(ts_seg, tz=ET)
    # Lunes=0 ... Viernes=4, Sábado=5, Domingo=6
    if dt.weekday() >= 5:
        return False
    return 4 <= dt.hour < 20  # 4:00 AM - 8:00 PM ET


def _calcular_dias_historico(tf_sec: int) -> int:
    """Calcula cuántos días de datos necesitamos para obtener ~500 velas.
    
    Lógica:
        - 5s  (tf=5):     500 × 5s    = 2500s ≈ 42 min → 2 días (cobertura)
        - 1m  (tf=60):    500 × 60s   = 30000s ≈ 8.3h → 3 días
        - 5m  (tf=300):   500 × 300s  = 150000s ≈ 41h → 7 días
        - 15m (tf=900):   500 × 900s  = 450000s ≈ 125h → 12 días
        - 1H  (tf=3600):  500 × 3600s = 1800000s ≈ 500h → 30 días
    
    Se agregan días extra para cubrir fines de semana y feriados.
    """
    horas_necesarias = (500 * tf_sec) / 3600
    # Con 6.5 horas de mercado por día hábil:
    dias_habiles = max(1, int(horas_necesarias / 6.5))
    # Agregar ~40% extra para fines de semana + feriados
    dias_calendario = int(dias_habiles * 1.5) + 3
    # Mínimo 3 días, máximo 60
    return max(3, min(60, dias_calendario))


async def cargar_historico_rest(api_key: str, simbolos: list[str], chart_server) -> None:
    """Carga 500 velas de 1-minuto vía REST API de Polygon y pre-popula el price buffer.

    Para el timeframe por defecto (1m), carga suficientes datos para tener
    ~500 velas disponibles al hacer scroll hacia atrás.
    
    Cuando el usuario cambia de timeframe, el ChartServer recargará
    automáticamente vía _cargar_y_enviar_historico().
    """
    try:
        import aiohttp
    except ImportError:
        logger.warning(
            "[HISTORICO] aiohttp no instalado — ejecuta: pip install aiohttp\n"
            "             Continuando sin datos historicos."
        )
        return

    # Para carga inicial, usar 1 minuto como base
    tf_inicial = 60  # 1 minuto
    dias = _calcular_dias_historico(tf_inicial)
    hoy = datetime.now(ET).date()
    desde = hoy - timedelta(days=dias)
    url_base = "https://api.polygon.io/v2/aggs/ticker"

    logger.info("[HISTORICO] ═══ Cargando historial inicial de Polygon.io ═══")
    logger.info("[HISTORICO] Plan: Massive | Fuente: REST API v2/aggs")
    logger.info("[HISTORICO] Rango: %s → %s (%d días)", desde, hoy, dias)

    async with aiohttp.ClientSession() as session:
        for simbolo in simbolos:
            # Usar ticker de Polygon (con X: para crypto)
            polygon_ticker = Mapeador.a_polygon_ticker(simbolo)
            url = (
                f"{url_base}/{polygon_ticker}/range/1/minute/"
                f"{desde.isoformat()}/{hoy.isoformat()}"
                f"?adjusted=true&sort=asc&limit=50000&apiKey={api_key}"
            )
            try:
                logger.info("[HISTORICO] 📊 Solicitando velas 1-min para %s ...", simbolo)
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    if resp.status != 200:
                        logger.error(
                            "[HISTORICO] ❌ Error HTTP %d para %s", resp.status, simbolo
                        )
                        continue
                    data = await resp.json()

                results = data.get("results", [])
                if not results:
                    logger.warning("[HISTORICO] ⚠️ Sin datos para %s", simbolo)
                    continue

                # Pre-popular el price buffer del ChartServer con el close de cada vela
                count = 0
                es_crypto = Mapeador.es_crypto(simbolo)
                for bar in results:
                    ts_ms = bar.get("t", 0)    # timestamp en ms
                    close = bar.get("c", 0.0)  # close price
                    if ts_ms and close:
                        ts_seg = ts_ms // 1000
                        # Stocks: filtrar barras fuera de market hours
                        if not es_crypto and not _en_horario_mercado(ts_seg):
                            continue
                        chart_server._price_buffer[simbolo][ts_seg] = close
                        count += 1

                # ── Verificación de datos reales ──
                primer_precio = results[0].get("c", 0.0)
                ultimo_precio = results[-1].get("c", 0.0)
                primer_ts = datetime.fromtimestamp(results[0].get("t", 0) / 1000, tz=ET)
                ultimo_ts = datetime.fromtimestamp(results[-1].get("t", 0) / 1000, tz=ET)
                
                logger.info(
                    "[HISTORICO] ✅ %s: %d velas REALES cargadas de Polygon.io",
                    simbolo, count,
                )
                logger.info(
                    "[HISTORICO]    Primer vela: %s → $%.2f",
                    primer_ts.strftime("%Y-%m-%d %H:%M"), primer_precio,
                )
                logger.info(
                    "[HISTORICO]    Última vela: %s → $%.2f",
                    ultimo_ts.strftime("%Y-%m-%d %H:%M"), ultimo_precio,
                )

            except Exception as e:
                logger.error("[HISTORICO] ❌ Error cargando %s: %s", simbolo, e)


# ══════════════════════════════════════════════════════════════════════════════
#  PUNTO DE ENTRADA — CONSOLA + CHART SERVER
# ══════════════════════════════════════════════════════════════════════════════

def main():
    """Script de inicio rápido para Trades + OHLC + Order Book.

    Carga historial del día, detecta sesión de mercado, imprime latencia
    en consola, y levanta ChartServer + OrderBookServer para visualización.
    """

    # ════════════════════════════════════════════════════════════
    # CONFIGURACIÓN — Ahora se lee desde .env via configuracion.py
    # Ya NO hay API keys hardcodeadas aquí.
    # ════════════════════════════════════════════════════════════
    API_KEY = CONFIG.POLYGON_API_KEY
    SIMBOLOS = CONFIG.SIMBOLOS
    SIMBOLOS_STOCKS = CONFIG.SIMBOLOS_STOCKS
    SIMBOLOS_CRYPTO = CONFIG.SIMBOLOS_CRYPTO
    CHART_PORT = CONFIG.CHART_PORT
    ORDERBOOK_PORT = CONFIG.ORDERBOOK_PORT

    # ── Detectar sesión de mercado ──
    session = MarketSession.current()
    session_label = MarketSession.LABELS[session]
    now_et = datetime.now(ET).strftime("%H:%M:%S ET")
    es_finde = MarketSession.es_fin_de_semana()

    print("\n" + "=" * 70)
    print("  CHART ENGINE — Trades + OHLC + Order Book en Tiempo Real")
    print(f"  Fuente:      Polygon.io (Plan Massive)")
    print(f"  API Key:     {API_KEY[:8]}... (desde .env)")
    print(f"  Simbolos:    {', '.join(SIMBOLOS)}")
    print(f"  Trades:      ws://localhost:{CHART_PORT}")
    print(f"  Order Book:  ws://localhost:{ORDERBOOK_PORT}")
    print(f"  Sesion:      {session_label}")
    print(f"  Hora ET:     {now_et}")
    if es_finde:
        print(f"  ⚠️  FIN DE SEMANA — Mercado cerrado hasta Lunes")
    print("  Presiona CTRL+C para detener")
    print("=" * 70 + "\n")

    logger.info("[SESION] %s | Hora: %s", session_label, now_et)

    # ── Almacén en memoria ──
    ultimo_precio: dict[str, float] = {}
    trade_count_window = [0]
    last_stats_time = [time.time()]

    # ── Chart Server ──
    chart_server = ChartServer(simbolos=SIMBOLOS, port=CHART_PORT)

    # ── OrderBook Server ──
    ob_server = OrderBookServer(simbolos=SIMBOLOS, port=ORDERBOOK_PORT)

    # ── Callback: Se ejecuta por cada trade recibido ──
    def al_recibir_trade(trade: TradeNormalizado) -> None:
        ultimo_precio[trade.simbolo] = trade.precio
        trade_count_window[0] += 1
        lat = trade.latencia_ms
        print(f"  [{trade.simbolo}] ${trade.precio:.2f} | Latencia: {lat:>8.1f}ms")
        chart_server.registrar_tick(trade.simbolo, trade.precio, trade.timestamp_ms)

    # ── Callback: Se ejecuta al cerrarse una vela OHLC ──
    def al_cerrar_vela(vela: dict) -> None:
        logger.info(
            "[VELA] %s cerrada | O:%.2f H:%.2f L:%.2f C:%.2f Vol:%d",
            vela.get("simbolo", "?"), vela["open"], vela["high"],
            vela["low"], vela["close"], vela["volume"]
        )

    # ── Callback: Se ejecuta cuando el Order Book L2 cambia ──
    def al_actualizar_book(snapshot: dict) -> None:
        ob_server.registrar_snapshot(snapshot)

    # ── Motor de Trades (Stocks) ──
    motor_trades = PolygonTradesWS(
        api_key=API_KEY, simbolos=SIMBOLOS_STOCKS,
        on_trade_cb=al_recibir_trade, on_vela_cb=al_cerrar_vela,
        max_reconexiones=50, heartbeat_seg=30,
        ws_url=POLYGON_WS_URL, canal=CANAL_TRADES,
    ) if SIMBOLOS_STOCKS else None

    # ── Motor de Trades (Crypto) → REST Polling (WS no disponible en este plan) ──
    motor_crypto = CryptoRESTPoller(
        api_key=API_KEY, simbolos=SIMBOLOS_CRYPTO,
        on_trade_cb=al_recibir_trade, on_vela_cb=al_cerrar_vela,
        on_book_cb=al_actualizar_book,
        intervalo_seg=5.0,
    ) if SIMBOLOS_CRYPTO else None

    # ── Motor de Quotes — Order Book (Stocks) ──
    motor_quotes = PolygonQuotesWS(
        api_key=API_KEY, simbolos=SIMBOLOS_STOCKS,
        on_book_cb=al_actualizar_book,
        max_reconexiones=50, heartbeat_seg=30,
    ) if SIMBOLOS_STOCKS else None

    # No hay motor de quotes crypto (REST no soporta orderbook L2 en tiempo real)
    motor_quotes_crypto = None

    # ── Manejo limpio de CTRL+C ──
    loop = asyncio.new_event_loop()

    def manejar_signal():
        logger.info("Senal de interrupcion recibida (CTRL+C)")
        if motor_trades: loop.create_task(motor_trades.detener())
        if motor_crypto: loop.create_task(motor_crypto.detener())
        if motor_quotes: loop.create_task(motor_quotes.detener())
        if motor_quotes_crypto: loop.create_task(motor_quotes_crypto.detener())
        loop.create_task(chart_server.detener())
        loop.create_task(ob_server.detener())

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, manejar_signal)
        except NotImplementedError:
            pass

    # ── Tarea periódica: estadísticas + sesión ──
    async def stats_periodico():
        prev_session = MarketSession.current()
        while True:
            await asyncio.sleep(30)
            now = time.time()
            elapsed = now - last_stats_time[0]
            tps = trade_count_window[0] / elapsed if elapsed > 0 else 0
            trade_count_window[0] = 0
            last_stats_time[0] = now
            cur_session = MarketSession.current()
            mt = motor_trades.obtener_metricas() if motor_trades else {"trades_recibidos": 0}
            mc = motor_crypto.obtener_metricas() if motor_crypto else {"trades_recibidos": 0}
            mq = motor_quotes.obtener_metricas() if motor_quotes else {"quotes_recibidos": 0}
            total_trades = mt.get("trades_recibidos", 0) + mc.get("trades_recibidos", 0)
            total_quotes = mq.get("quotes_recibidos", 0)
            logger.info(
                "[STATS] Trades: %d (crypto: %d) | Quotes: %d | Trades/s: %.1f | %s",
                total_trades, mc.get("trades_recibidos", 0), total_quotes, tps,
                MarketSession.LABELS[cur_session],
            )
            if cur_session != prev_session:
                logger.info("[SESION] Cambio: %s", MarketSession.LABELS[cur_session])
                prev_session = cur_session
            chart_server.broadcast_session()

    # ── Tarea periódica: OB sintético para stocks fuera de horario ──
    async def stock_book_sintetico_loop():
        """Genera OB sintético para stocks cuando el mercado está cerrado.
        
        Usa el último precio histórico conocido para crear snapshots realistas.
        Se detiene automáticamente cuando el mercado abre (PolygonQuotesWS toma el relevo).
        """
        counter = 0
        while True:
            await asyncio.sleep(5)
            # Solo generar cuando el mercado está CERRADO
            if MarketSession.esta_abierto():
                continue
            if not SIMBOLOS_STOCKS:
                continue
            for simbolo in SIMBOLOS_STOCKS:
                precio = ultimo_precio.get(simbolo, 0)
                if precio <= 0:
                    continue
                counter += 1
                snapshot = _generar_book_sintetico_stock(simbolo, precio, counter)
                al_actualizar_book(snapshot)

    # ── Ejecutar todo ──
    async def ejecutar():
        await chart_server.iniciar()
        await ob_server.iniciar()
        # Cargar historial de velas antes de conectar WebSocket en tiempo real
        await cargar_historico_rest(API_KEY, SIMBOLOS, chart_server)
        # Poblar ultimo_precio con el último close del historial para OB sintético
        for simbolo in SIMBOLOS:
            buf = chart_server._price_buffer.get(simbolo, {})
            if buf:
                max_ts = max(buf.keys())
                ultimo_precio[simbolo] = buf[max_ts]
                logger.info("[HISTORICO] 💰 %s: último precio conocido = $%.2f", simbolo, buf[max_ts])
        logger.info("[POLYGON] Conectando a Polygon.io en tiempo real...")
        if SIMBOLOS_CRYPTO:
            logger.info("[POLYGON] 🪙 Crypto activos via REST polling: %s (cada 5s, 24/7)", ", ".join(SIMBOLOS_CRYPTO))
        if SIMBOLOS_STOCKS and not MarketSession.esta_abierto():
            logger.info("[OB SYNTH] 📊 OB sintético activo para stocks off-hours: %s", ", ".join(SIMBOLOS_STOCKS))
        tareas = [stats_periodico(), stock_book_sintetico_loop()]
        if motor_trades:  tareas.append(motor_trades.iniciar())
        if motor_crypto:  tareas.append(motor_crypto.iniciar())
        if motor_quotes:  tareas.append(motor_quotes.iniciar())
        if motor_quotes_crypto: tareas.append(motor_quotes_crypto.iniciar())
        await asyncio.gather(*tareas)

    try:
        loop.run_until_complete(ejecutar())
    except KeyboardInterrupt:
        logger.info("Interrupcion por teclado. Cerrando...")
        if motor_trades: loop.run_until_complete(motor_trades.detener())
        if motor_crypto: loop.run_until_complete(motor_crypto.detener())
        if motor_quotes: loop.run_until_complete(motor_quotes.detener())
        if motor_quotes_crypto: loop.run_until_complete(motor_quotes_crypto.detener())
        loop.run_until_complete(chart_server.detener())
        loop.run_until_complete(ob_server.detener())
    finally:
        loop.close()

    # ── Métricas finales ──
    metricas_trades = motor_trades.obtener_metricas() if motor_trades else {"trades_recibidos": 0, "reconexiones": 0}
    metricas_crypto = motor_crypto.obtener_metricas() if motor_crypto else {"trades_recibidos": 0, "reconexiones": 0}
    metricas_quotes = motor_quotes.obtener_metricas() if motor_quotes else {"quotes_recibidos": 0, "reconexiones": 0}
    print("\n" + "-" * 50)
    print("  METRICAS FINALES")
    print(f"  Trades stocks    : {metricas_trades['trades_recibidos']:,d}")
    print(f"  Trades crypto    : {metricas_crypto['trades_recibidos']:,d}")
    print(f"  Quotes recibidos : {metricas_quotes['quotes_recibidos']:,d}")
    print(f"  Reconexiones T   : {metricas_trades['reconexiones']}")
    print(f"  Reconexiones C   : {metricas_crypto['reconexiones']}")
    print(f"  Reconexiones Q   : {metricas_quotes['reconexiones']}")
    print("-" * 50)

    for simbolo in SIMBOLOS:
        df = motor_trades.agregador.obtener_dataframe(simbolo)
        if not df.empty:
            print(f"\n  Velas OHLC cerradas para {simbolo}:")
            print(df.to_string(max_rows=10))
        else:
            print(f"\n  No se cerraron velas completas para {simbolo}.")


if __name__ == "__main__":
    main()
