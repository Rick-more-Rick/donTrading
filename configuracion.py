#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║               CONFIGURACIÓN CENTRALIZADA — donTrading Beta                 ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Lee las variables de entorno desde el archivo .env                        ║
║  Así no necesitas poner la API key en cada archivo Python.                 ║
║                                                                            ║
║  Uso:                                                                      ║
║      from configuracion import CONFIG                                      ║
║      print(CONFIG.POLYGON_API_KEY)   # → "m3oCAFJ_qZZ..."                 ║
║      print(CONFIG.SIMBOLOS)          # → ["AAPL", "TSLA"]                 ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import os
from pathlib import Path

# ══════════════════════════════════════════════════════════════════════════════
#  CARGAR ARCHIVO .env MANUALMENTE (sin dependencias externas)
# ══════════════════════════════════════════════════════════════════════════════

def _cargar_env(ruta_env: str = None) -> dict:
    """Lee un archivo .env y retorna un diccionario con las variables.
    
    Funciona sin instalar ninguna librería extra (no necesita python-dotenv).
    Busca el archivo .env en la misma carpeta que este script.
    """
    if ruta_env is None:
        # Buscar .env en la misma carpeta que configuracion.py
        carpeta = Path(__file__).parent
        ruta_env = carpeta / ".env"
    
    ruta_env = Path(ruta_env)
    variables = {}
    
    if not ruta_env.exists():
        print(f"⚠️  [CONFIGURACIÓN] No se encontró el archivo .env en: {ruta_env}")
        print(f"   Copia .env.ejemplo como .env y llena tus datos.")
        return variables
    
    with open(ruta_env, "r", encoding="utf-8") as f:
        for linea in f:
            linea = linea.strip()
            # Ignorar líneas vacías y comentarios
            if not linea or linea.startswith("#"):
                continue
            # Separar por el primer "="
            if "=" in linea:
                clave, valor = linea.split("=", 1)
                clave = clave.strip()
                valor = valor.strip()
                # Quitar comillas si las tiene
                if (valor.startswith('"') and valor.endswith('"')) or \
                   (valor.startswith("'") and valor.endswith("'")):
                    valor = valor[1:-1]
                variables[clave] = valor
                # También ponerla como variable de entorno del sistema
                os.environ[clave] = valor
    
    return variables


# ══════════════════════════════════════════════════════════════════════════════
#  CLASE DE CONFIGURACIÓN — Acceso fácil a todas las variables
# ══════════════════════════════════════════════════════════════════════════════

class Configuracion:
    """Acceso centralizado a toda la configuración del proyecto.
    
    Ejemplo de uso:
        from configuracion import CONFIG
        
        api_key = CONFIG.POLYGON_API_KEY
        simbolos = CONFIG.SIMBOLOS          # Lista: ["AAPL", "TSLA"]
        puerto_chart = CONFIG.CHART_PORT    # Entero: 8765
    """
    
    def __init__(self):
        # Cargar variables del .env
        self._vars = _cargar_env()
        
        # ── API Key de Polygon.io ──
        self.POLYGON_API_KEY = self._vars.get(
            "POLYGON_API_KEY", 
            os.environ.get("POLYGON_API_KEY", "")
        )
        
        # ── Puertos de los servidores WebSocket ──
        self.CHART_PORT = int(self._vars.get(
            "CHART_PORT", 
            os.environ.get("CHART_PORT", "8765")
        ))
        self.ORDERBOOK_PORT = int(self._vars.get(
            "ORDERBOOK_PORT", 
            os.environ.get("ORDERBOOK_PORT", "8766")
        ))
        
        # ── Símbolos a monitorear ──
        simbolos_raw = self._vars.get(
            "SIMBOLOS", 
            os.environ.get("SIMBOLOS", "AAPL,TSLA")
        )
        self.SIMBOLOS = [s.strip().upper() for s in simbolos_raw.split(",") if s.strip()]
        
        # ── Validación básica ──
        if not self.POLYGON_API_KEY:
            print("❌ [CONFIGURACIÓN] ¡POLYGON_API_KEY está vacía!")
            print("   Revisa tu archivo .env")
        else:
            # Mostrar solo los primeros 8 caracteres por seguridad
            clave_parcial = self.POLYGON_API_KEY[:8] + "..."
            print(f"✅ [CONFIGURACIÓN] API Key cargada: {clave_parcial}")
            print(f"   Símbolos: {', '.join(self.SIMBOLOS)}")
            print(f"   Chart WS:     puerto {self.CHART_PORT}")
            print(f"   OrderBook WS:  puerto {self.ORDERBOOK_PORT}")

        # ── Separar símbolos por tipo (stocks vs crypto) ──
        try:
            from mapeador_simbolos import Mapeador
            self.SIMBOLOS_STOCKS, self.SIMBOLOS_CRYPTO = Mapeador.separar_por_tipo(self.SIMBOLOS)
            if self.SIMBOLOS_CRYPTO:
                print(f"   📈 Stocks: {', '.join(self.SIMBOLOS_STOCKS)}")
                print(f"   🪙 Crypto: {', '.join(self.SIMBOLOS_CRYPTO)}")
        except ImportError:
            self.SIMBOLOS_STOCKS = self.SIMBOLOS[:]
            self.SIMBOLOS_CRYPTO = []
    
    def resumen(self) -> str:
        """Retorna un resumen legible de la configuración activa."""
        return (
            f"API Key: {self.POLYGON_API_KEY[:8]}... | "
            f"Símbolos: {self.SIMBOLOS} | "
            f"Puertos: {self.CHART_PORT}/{self.ORDERBOOK_PORT}"
        )


# ══════════════════════════════════════════════════════════════════════════════
#  INSTANCIA GLOBAL — Importa esto desde cualquier archivo
# ══════════════════════════════════════════════════════════════════════════════

CONFIG = Configuracion()


# ── Si ejecutas este archivo directamente, muestra la configuración ──
if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  CONFIGURACIÓN ACTIVA — donTrading Beta")
    print("=" * 60)
    print(f"  API Key:       {CONFIG.POLYGON_API_KEY[:8]}...")
    print(f"  Símbolos:      {CONFIG.SIMBOLOS}")
    print(f"  Chart Puerto:  {CONFIG.CHART_PORT}")
    print(f"  OB Puerto:     {CONFIG.ORDERBOOK_PORT}")
    print("=" * 60 + "\n")
