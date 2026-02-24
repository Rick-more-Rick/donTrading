#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║         MAPEADOR DE SÍMBOLOS — Normalización de Tickers                    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Clasifica y normaliza símbolos para Polygon.io:                           ║
║    - Stocks: AAPL, TSLA → canal T/Q, endpoint /stocks                     ║
║    - Crypto: BTCUSD, ETHUSD → canal XT/XQ, endpoint /crypto               ║
║                                                                            ║
║  Uso:                                                                      ║
║      from mapeador_simbolos import Mapeador                                ║
║      Mapeador.es_crypto("BTCUSD")        → True                           ║
║      Mapeador.canal_trades("BTCUSD")     → "XT.X:BTCUSD"                  ║
║      Mapeador.canal_trades("AAPL")       → "T.AAPL"                       ║
║      Mapeador.ws_url("BTCUSD")           → "wss://socket.polygon.io/crypto"║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations


# ══════════════════════════════════════════════════════════════════════════════
#  CONSTANTES
# ══════════════════════════════════════════════════════════════════════════════

POLYGON_WS_STOCKS = "wss://socket.polygon.io/stocks"
POLYGON_WS_CRYPTO = "wss://socket.polygon.io/crypto"
POLYGON_WS_FOREX  = "wss://socket.polygon.io/forex"

# ── Cryptos conocidas del catálogo (base sin la moneda de cotización) ──
CRYPTO_BASES = {
    # Top caps
    "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX",
    "DOGE", "DOT", "MATIC",
    # DeFi / Infra
    "LINK", "LTC", "SHIB", "UNI", "ATOM", "XLM", "ETC",
    "ALGO", "VET", "ICP", "FIL", "AAVE", "SAND", "MANA",
    "AXS", "APT", "OP", "ARB", "SUI", "INJ",
}

# ── Monedas de cotización válidas ──
CRYPTO_QUOTES = {"USD", "USDT", "EUR", "GBP", "JPY"}

# ── Pares FOREX — Símbolos que van al endpoint C: de Polygon ──
# Formato: el símbolo tiene 6 letras (EURUSD, USDJPY) o es un par de metales (XAUUSD, XAGUSD)
FOREX_BASES = {
    "EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF", "JPY",
    "MXN", "BRL", "CLP", "COP", "ARS",
    "XAU", "XAG", "XPT",  # metales preciosos (spot forex)
}

FOREX_QUOTES = {"USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD",
                "MXN", "BRL", "CLP", "COP", "ARS"}


# ══════════════════════════════════════════════════════════════════════════════
#  CLASE PRINCIPAL — MAPEADOR DE SÍMBOLOS
# ══════════════════════════════════════════════════════════════════════════════

class Mapeador:
    """Clasifica y normaliza símbolos entre stocks y crypto.
    
    Todo es estático — no necesita instanciar.
    El patrón de detección: si el símbolo contiene "X:" al inicio
    o si su base está en CRYPTO_BASES, es crypto.
    
    Ejemplos:
        Mapeador.es_crypto("BTCUSD")       → True
        Mapeador.es_crypto("AAPL")          → False
        Mapeador.es_crypto("X:BTCUSD")      → True
        Mapeador.normalizar("X:BTCUSD")     → "BTCUSD"
        Mapeador.a_polygon_ticker("BTCUSD") → "X:BTCUSD"
        Mapeador.a_polygon_ticker("AAPL")   → "AAPL"
    """

    @staticmethod
    def es_crypto(simbolo: str) -> bool:
        """Detecta si un símbolo es criptomoned.
        
        Soporta múltiples formatos:
            "X:BTCUSD"  → True (formato Polygon)
            "BTCUSD"    → True (formato limpio)
            "BTC-USD"   → True (formato con guión)
            "AAPL"      → False (acción)
        """
        simbolo = simbolo.upper().strip()
        
        # Formato explícito de Polygon: "X:BTCUSD"
        if simbolo.startswith("X:"):
            return True
        
        # Quitar guiones: "BTC-USD" → "BTCUSD"
        limpio = simbolo.replace("-", "")
        
        # Verificar si la base es una crypto conocida
        for base in CRYPTO_BASES:
            for quote in CRYPTO_QUOTES:
                if limpio == f"{base}{quote}":
                    return True
        
        return False

    @staticmethod
    def es_forex(simbolo: str) -> bool:
        """Detecta si un símbolo es un par del mercado de divisas o metal precioso spot.

        "EURUSD" → True  |  "XAUUSD" → True  |  "AAPL" → False
        """
        simbolo = simbolo.upper().strip()
        
        # Formato explícito de Polygon: "C:EURUSD"
        if simbolo.startswith("C:"):
            return True
        
        # Si ya es crypto, no es forex
        if Mapeador.es_crypto(simbolo):
            return False
        
        limpio = simbolo.replace("-", "")
        
        # Verificar si base 3 letras + quote 3 letras y ambos son divisas/metales conocidos
        if len(limpio) == 6:
            base  = limpio[:3]
            quote = limpio[3:]
            if base in FOREX_BASES and quote in FOREX_QUOTES:
                # Excluir parámetros que no existan (ej. "USDMXN" tiene base en FOREX_BASES)
                return True
        
        return False


    @staticmethod
    def normalizar(simbolo: str) -> str:
        """Convierte cualquier formato a símbolo limpio interno.
        
        "X:BTCUSD"  → "BTCUSD"
        "X:BTC-USD" → "BTCUSD"
        "BTC-USD"   → "BTCUSD"
        "BTCUSD"    → "BTCUSD"
        "AAPL"      → "AAPL"
        """
        simbolo = simbolo.upper().strip()
        # Quitar prefijo "X:"
        if simbolo.startswith("X:"):
            simbolo = simbolo[2:]
        # Quitar guiones
        simbolo = simbolo.replace("-", "")
        return simbolo

    @staticmethod
    def a_polygon_ticker(simbolo: str) -> str:
        """Convierte un símbolo limpio al formato que espera Polygon REST/WS.
        
        "BTCUSD" → "X:BTCUSD"   (crypto)
        "EURUSD" → "C:EURUSD"   (forex)
        "AAPL"   → "AAPL"       (stock)
        """
        limpio = Mapeador.normalizar(simbolo)
        if Mapeador.es_crypto(limpio):
            return f"X:{limpio}"
        if Mapeador.es_forex(limpio):
            return f"C:{limpio}"
        return limpio

    @staticmethod
    def canal_trades(simbolo: str) -> str:
        """Canal de suscripción de trades para un símbolo.
        
        "BTCUSD" → "XT.X:BTCUSD"
        "AAPL"   → "T.AAPL"
        """
        limpio = Mapeador.normalizar(simbolo)
        if Mapeador.es_crypto(limpio):
            return f"XT.X:{limpio}"
        return f"T.{limpio}"

    @staticmethod
    def canal_quotes(simbolo: str) -> str:
        """Canal de suscripción de quotes para un símbolo.
        
        "BTCUSD" → "XQ.X:BTCUSD"
        "AAPL"   → "Q.AAPL"
        """
        limpio = Mapeador.normalizar(simbolo)
        if Mapeador.es_crypto(limpio):
            return f"XQ.X:{limpio}"
        return f"Q.{limpio}"

    @staticmethod
    def ws_url(simbolo: str) -> str:
        """URL del WebSocket adecuada según el tipo de activo.
        
        "BTCUSD" → wss://socket.polygon.io/crypto
        "EURUSD" → wss://socket.polygon.io/forex
        "AAPL"   → wss://socket.polygon.io/stocks
        """
        if Mapeador.es_crypto(simbolo):
            return POLYGON_WS_CRYPTO
        if Mapeador.es_forex(simbolo):
            return POLYGON_WS_FOREX
        return POLYGON_WS_STOCKS

    @staticmethod
    def label_legible(simbolo: str) -> str:
        """Formato legible para mostrar en el frontend.
        
        "BTCUSD"  → "BTC/USD"
        "ETHUSD"  → "ETH/USD"
        "AAPL"    → "AAPL"
        """
        limpio = Mapeador.normalizar(simbolo)
        if Mapeador.es_crypto(limpio):
            # Buscar la base crypto más larga que matchee
            for base in sorted(CRYPTO_BASES, key=len, reverse=True):
                if limpio.startswith(base):
                    quote_part = limpio[len(base):]
                    if quote_part:
                        return f"{base}/{quote_part}"
                    return base
        return limpio

    @staticmethod
    def separar_por_tipo(simbolos: list[str]) -> tuple[list[str], list[str]]:
        """Separa una lista de símbolos en (stocks, cryptos).
        
        ["AAPL", "TSLA", "BTCUSD"] → (["AAPL", "TSLA"], ["BTCUSD"])
        """
        stocks = []
        cryptos = []
        for s in simbolos:
            limpio = Mapeador.normalizar(s)
            if Mapeador.es_crypto(limpio):
                cryptos.append(limpio)
            else:
                stocks.append(limpio)
        return stocks, cryptos


# ══════════════════════════════════════════════════════════════════════════════
#  TEST RÁPIDO — Si ejecutas este archivo directamente
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  MAPEADOR DE SÍMBOLOS — Test Rápido")
    print("=" * 60)
    
    test_simbolos = ["AAPL", "TSLA", "BTCUSD", "X:BTCUSD", "BTC-USD", "ETHUSD", "SOLUSD"]
    
    for s in test_simbolos:
        es = "🪙 CRYPTO" if Mapeador.es_crypto(s) else "📈 STOCK "
        print(f"\n  {s:12s} → {es}")
        print(f"    Normalizado:    {Mapeador.normalizar(s)}")
        print(f"    Polygon ticker: {Mapeador.a_polygon_ticker(s)}")
        print(f"    Canal trades:   {Mapeador.canal_trades(s)}")
        print(f"    Canal quotes:   {Mapeador.canal_quotes(s)}")
        print(f"    WS URL:         {Mapeador.ws_url(s)}")
        print(f"    Label:          {Mapeador.label_legible(s)}")
    
    stocks, cryptos = Mapeador.separar_por_tipo(["AAPL", "TSLA", "BTCUSD", "ETHUSD"])
    print(f"\n  Separados: stocks={stocks}, cryptos={cryptos}")
    print("=" * 60 + "\n")
