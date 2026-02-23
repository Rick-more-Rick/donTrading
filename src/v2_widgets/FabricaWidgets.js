/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  FabricaWidgets.js — Patrón Factory para instanciar widgets            ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Catálogo completo de mercados:                                         ║
 * ║    DOW   → 30 componentes del Dow Jones Industrial Average              ║
 * ║    NASDAQ → 100 activos del NASDAQ-100                                  ║
 * ║    SP500  → ETFs y sectores del S&P 500                                 ║
 * ║    FOREX  → Pares principales, menores y exóticos                      ║
 * ║    CRYPTO → Top 30 criptomonedas por capitalización                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

// ══════════════════════════════════════════════════════════════════════════
//  CATÁLOGO DE MERCADOS — Configuración centralizada y completa
// ══════════════════════════════════════════════════════════════════════════

const CATALOGO_MERCADOS = Object.freeze({

    // ── DOW JONES INDUSTRIAL AVERAGE (30 componentes) ──
    DOW: {
        etiqueta: 'DOW 30',
        nombre: 'Dow Jones Industrial Average',
        activos: {
            AAPL: { paso_precio: 0.01, precision: 2, nombre: 'Apple Inc.' },
            AMGN: { paso_precio: 0.01, precision: 2, nombre: 'Amgen Inc.' },
            AXP: { paso_precio: 0.01, precision: 2, nombre: 'American Express' },
            BA: { paso_precio: 0.01, precision: 2, nombre: 'Boeing Co.' },
            CAT: { paso_precio: 0.01, precision: 2, nombre: 'Caterpillar Inc.' },
            CRM: { paso_precio: 0.01, precision: 2, nombre: 'Salesforce Inc.' },
            CSCO: { paso_precio: 0.01, precision: 2, nombre: 'Cisco Systems' },
            CVX: { paso_precio: 0.01, precision: 2, nombre: 'Chevron Corp.' },
            DIS: { paso_precio: 0.01, precision: 2, nombre: 'Walt Disney Co.' },
            DOW: { paso_precio: 0.01, precision: 2, nombre: 'Dow Inc.' },
            GS: { paso_precio: 0.01, precision: 2, nombre: 'Goldman Sachs' },
            HD: { paso_precio: 0.01, precision: 2, nombre: 'Home Depot Inc.' },
            HON: { paso_precio: 0.01, precision: 2, nombre: 'Honeywell Intl.' },
            IBM: { paso_precio: 0.01, precision: 2, nombre: 'IBM Corp.' },
            INTC: { paso_precio: 0.01, precision: 2, nombre: 'Intel Corp.' },
            JNJ: { paso_precio: 0.01, precision: 2, nombre: 'Johnson & Johnson' },
            JPM: { paso_precio: 0.01, precision: 2, nombre: 'JPMorgan Chase' },
            KO: { paso_precio: 0.01, precision: 2, nombre: 'Coca-Cola Co.' },
            MCD: { paso_precio: 0.01, precision: 2, nombre: "McDonald's Corp." },
            MMM: { paso_precio: 0.01, precision: 2, nombre: '3M Co.' },
            MRK: { paso_precio: 0.01, precision: 2, nombre: 'Merck & Co.' },
            MSFT: { paso_precio: 0.01, precision: 2, nombre: 'Microsoft Corp.' },
            NKE: { paso_precio: 0.01, precision: 2, nombre: 'Nike Inc.' },
            PG: { paso_precio: 0.01, precision: 2, nombre: 'Procter & Gamble' },
            SHW: { paso_precio: 0.01, precision: 2, nombre: 'Sherwin-Williams' },
            TRV: { paso_precio: 0.01, precision: 2, nombre: 'Travelers Cos.' },
            UNH: { paso_precio: 0.01, precision: 2, nombre: 'UnitedHealth Group' },
            V: { paso_precio: 0.01, precision: 2, nombre: 'Visa Inc.' },
            VZ: { paso_precio: 0.01, precision: 2, nombre: 'Verizon Comms.' },
            WMT: { paso_precio: 0.01, precision: 2, nombre: 'Walmart Inc.' },
        },
    },

    // ── NASDAQ-100 (100 componentes principales) ──
    NASDAQ: {
        etiqueta: 'NASDAQ',
        nombre: 'NASDAQ-100',
        activos: {
            // Tecnología
            AAPL: { paso_precio: 0.01, precision: 2, nombre: 'Apple Inc.' },
            MSFT: { paso_precio: 0.01, precision: 2, nombre: 'Microsoft Corp.' },
            NVDA: { paso_precio: 0.01, precision: 2, nombre: 'NVIDIA Corp.' },
            AMZN: { paso_precio: 0.01, precision: 2, nombre: 'Amazon.com Inc.' },
            META: { paso_precio: 0.01, precision: 2, nombre: 'Meta Platforms' },
            TSLA: { paso_precio: 0.01, precision: 2, nombre: 'Tesla Inc.' },
            GOOG: { paso_precio: 0.01, precision: 2, nombre: 'Alphabet (C)' },
            GOOGL: { paso_precio: 0.01, precision: 2, nombre: 'Alphabet (A)' },
            AVGO: { paso_precio: 0.01, precision: 2, nombre: 'Broadcom Inc.' },
            COST: { paso_precio: 0.01, precision: 2, nombre: 'Costco Wholesale' },
            NFLX: { paso_precio: 0.01, precision: 2, nombre: 'Netflix Inc.' },
            AMD: { paso_precio: 0.01, precision: 2, nombre: 'AMD Inc.' },
            ASML: { paso_precio: 0.01, precision: 2, nombre: 'ASML Holding' },
            ADBE: { paso_precio: 0.01, precision: 2, nombre: 'Adobe Inc.' },
            CSCO: { paso_precio: 0.01, precision: 2, nombre: 'Cisco Systems' },
            PEP: { paso_precio: 0.01, precision: 2, nombre: 'PepsiCo Inc.' },
            QCOM: { paso_precio: 0.01, precision: 2, nombre: 'Qualcomm Inc.' },
            INTC: { paso_precio: 0.01, precision: 2, nombre: 'Intel Corp.' },
            INTU: { paso_precio: 0.01, precision: 2, nombre: 'Intuit Inc.' },
            AMAT: { paso_precio: 0.01, precision: 2, nombre: 'Applied Materials' },
            LRCX: { paso_precio: 0.01, precision: 2, nombre: 'Lam Research' },
            MRVL: { paso_precio: 0.01, precision: 2, nombre: 'Marvell Technology' },
            MU: { paso_precio: 0.01, precision: 2, nombre: 'Micron Technology' },
            PANW: { paso_precio: 0.01, precision: 2, nombre: 'Palo Alto Networks' },
            KLAC: { paso_precio: 0.01, precision: 2, nombre: 'KLA Corp.' },
            SNPS: { paso_precio: 0.01, precision: 2, nombre: 'Synopsys Inc.' },
            CDNS: { paso_precio: 0.01, precision: 2, nombre: 'Cadence Design' },
            PYPL: { paso_precio: 0.01, precision: 2, nombre: 'PayPal Holdings' },
            CRWD: { paso_precio: 0.01, precision: 2, nombre: 'CrowdStrike' },
            ORCL: { paso_precio: 0.01, precision: 2, nombre: 'Oracle Corp.' },
            // Comunicaciones
            CMCSA: { paso_precio: 0.01, precision: 2, nombre: 'Comcast Corp.' },
            TMUS: { paso_precio: 0.01, precision: 2, nombre: 'T-Mobile US' },
            // Consumo
            SBUX: { paso_precio: 0.01, precision: 2, nombre: 'Starbucks Corp.' },
            ABNB: { paso_precio: 0.01, precision: 2, nombre: 'Airbnb Inc.' },
            BKNG: { paso_precio: 0.01, precision: 2, nombre: 'Booking Holdings' },
            LULU: { paso_precio: 0.01, precision: 2, nombre: 'lululemon athletica' },
            MELI: { paso_precio: 0.01, precision: 2, nombre: 'MercadoLibre' },
            // Salud
            AMGN: { paso_precio: 0.01, precision: 2, nombre: 'Amgen Inc.' },
            ISRG: { paso_precio: 0.01, precision: 2, nombre: 'Intuitive Surgical' },
            REGN: { paso_precio: 0.01, precision: 2, nombre: 'Regeneron Pharma.' },
            VRTX: { paso_precio: 0.01, precision: 2, nombre: 'Vertex Pharma.' },
            MRNA: { paso_precio: 0.01, precision: 2, nombre: 'Moderna Inc.' },
            GILD: { paso_precio: 0.01, precision: 2, nombre: 'Gilead Sciences' },
            BIIB: { paso_precio: 0.01, precision: 2, nombre: 'Biogen Inc.' },
            ILMN: { paso_precio: 0.01, precision: 2, nombre: 'Illumina Inc.' },
            // Finanzas / Servicios
            ADP: { paso_precio: 0.01, precision: 2, nombre: 'ADP Inc.' },
            ADSK: { paso_precio: 0.01, precision: 2, nombre: 'Autodesk Inc.' },
            DXCM: { paso_precio: 0.01, precision: 2, nombre: 'DexCom Inc.' },
            EXC: { paso_precio: 0.01, precision: 2, nombre: 'Exelon Corp.' },
            FAST: { paso_precio: 0.01, precision: 2, nombre: 'Fastenal Co.' },
            FTNT: { paso_precio: 0.01, precision: 2, nombre: 'Fortinet Inc.' },
            GFS: { paso_precio: 0.01, precision: 2, nombre: 'GlobalFoundries' },
            HON: { paso_precio: 0.01, precision: 2, nombre: 'Honeywell Intl.' },
            IDXX: { paso_precio: 0.01, precision: 2, nombre: 'IDEXX Laboratories' },
            KDP: { paso_precio: 0.01, precision: 2, nombre: 'Keurig Dr Pepper' },
            MDLZ: { paso_precio: 0.01, precision: 2, nombre: 'Mondelez Intl.' },
            MNST: { paso_precio: 0.01, precision: 2, nombre: 'Monster Beverage' },
            ODFL: { paso_precio: 0.01, precision: 2, nombre: 'Old Dominion Freight' },
            ON: { paso_precio: 0.01, precision: 2, nombre: 'ON Semiconductor' },
            PCAR: { paso_precio: 0.01, precision: 2, nombre: 'PACCAR Inc.' },
            ROST: { paso_precio: 0.01, precision: 2, nombre: 'Ross Stores Inc.' },
            SIRI: { paso_precio: 0.01, precision: 4, nombre: 'SiriusXM Holdings' },
            TTWO: { paso_precio: 0.01, precision: 2, nombre: 'Take-Two Interactive' },
            TXN: { paso_precio: 0.01, precision: 2, nombre: 'Texas Instruments' },
            VRSK: { paso_precio: 0.01, precision: 2, nombre: 'Verisk Analytics' },
            WBA: { paso_precio: 0.01, precision: 2, nombre: 'Walgreens Boots' },
            WBD: { paso_precio: 0.01, precision: 2, nombre: 'Warner Bros. Discovery' },
            XEL: { paso_precio: 0.01, precision: 2, nombre: 'Xcel Energy' },
            ZS: { paso_precio: 0.01, precision: 2, nombre: 'Zscaler Inc.' },
        },
    },

    // ── S&P 500 — ETFs sectoriales y de índice ──
    SP500: {
        etiqueta: 'S&P 500',
        nombre: 'S&P 500 — ETFs & Índices',
        activos: {
            // ETFs principales del índice
            SPY: { paso_precio: 0.01, precision: 2, nombre: 'SPDR S&P 500 ETF' },
            VOO: { paso_precio: 0.01, precision: 2, nombre: 'Vanguard S&P 500 ETF' },
            IVV: { paso_precio: 0.01, precision: 2, nombre: 'iShares Core S&P 500' },
            QQQ: { paso_precio: 0.01, precision: 2, nombre: 'Invesco NASDAQ-100' },
            DIA: { paso_precio: 0.01, precision: 2, nombre: 'SPDR Dow Jones ETF' },
            IWM: { paso_precio: 0.01, precision: 2, nombre: 'iShares Russell 2000' },
            VTI: { paso_precio: 0.01, precision: 2, nombre: 'Vanguard Total Market' },
            // ETFs sectoriales (SPDR)
            XLK: { paso_precio: 0.01, precision: 2, nombre: 'Tech Select SPDR' },
            XLF: { paso_precio: 0.01, precision: 2, nombre: 'Financial Select SPDR' },
            XLE: { paso_precio: 0.01, precision: 2, nombre: 'Energy Select SPDR' },
            XLV: { paso_precio: 0.01, precision: 2, nombre: 'Health Care SPDR' },
            XLI: { paso_precio: 0.01, precision: 2, nombre: 'Industrial SPDR' },
            XLC: { paso_precio: 0.01, precision: 2, nombre: 'Comm. Services SPDR' },
            XLY: { paso_precio: 0.01, precision: 2, nombre: 'Consumer Discr. SPDR' },
            XLP: { paso_precio: 0.01, precision: 2, nombre: 'Consumer Staples SPDR' },
            XLRE: { paso_precio: 0.01, precision: 2, nombre: 'Real Estate SPDR' },
            XLB: { paso_precio: 0.01, precision: 2, nombre: 'Materials SPDR' },
            XLU: { paso_precio: 0.01, precision: 2, nombre: 'Utilities SPDR' },
            // ETFs de volatilidad e inversos
            VXX: { paso_precio: 0.01, precision: 2, nombre: 'iPath S&P 500 VIX' },
            SQQQ: { paso_precio: 0.01, precision: 2, nombre: 'ProShares UltraPro Short QQQ' },
            TQQQ: { paso_precio: 0.01, precision: 2, nombre: 'ProShares UltraPro QQQ' },
            SPXU: { paso_precio: 0.01, precision: 2, nombre: 'ProShares UltraPro Short S&P' },
            // Grandes caps del S&P
            BRK_B: { paso_precio: 0.01, precision: 2, nombre: 'Berkshire Hathaway B' },
            JPM: { paso_precio: 0.01, precision: 2, nombre: 'JPMorgan Chase' },
            XOM: { paso_precio: 0.01, precision: 2, nombre: 'ExxonMobil Corp.' },
            UNH: { paso_precio: 0.01, precision: 2, nombre: 'UnitedHealth Group' },
            V: { paso_precio: 0.01, precision: 2, nombre: 'Visa Inc.' },
            LLY: { paso_precio: 0.01, precision: 2, nombre: 'Eli Lilly & Co.' },
            MA: { paso_precio: 0.01, precision: 2, nombre: 'Mastercard Inc.' },
            PG: { paso_precio: 0.01, precision: 2, nombre: 'Procter & Gamble' },
            HD: { paso_precio: 0.01, precision: 2, nombre: 'Home Depot Inc.' },
            CVX: { paso_precio: 0.01, precision: 2, nombre: 'Chevron Corp.' },
            MRK: { paso_precio: 0.01, precision: 2, nombre: 'Merck & Co.' },
            ABBV: { paso_precio: 0.01, precision: 2, nombre: 'AbbVie Inc.' },
            PFE: { paso_precio: 0.01, precision: 2, nombre: 'Pfizer Inc.' },
            BAC: { paso_precio: 0.01, precision: 2, nombre: 'Bank of America' },
            KO: { paso_precio: 0.01, precision: 2, nombre: 'Coca-Cola Co.' },
            WMT: { paso_precio: 0.01, precision: 2, nombre: 'Walmart Inc.' },
            CRM: { paso_precio: 0.01, precision: 2, nombre: 'Salesforce Inc.' },
            ACN: { paso_precio: 0.01, precision: 2, nombre: 'Accenture plc' },
            TMO: { paso_precio: 0.01, precision: 2, nombre: 'Thermo Fisher' },
            MCD: { paso_precio: 0.01, precision: 2, nombre: "McDonald's Corp." },
            ABT: { paso_precio: 0.01, precision: 2, nombre: 'Abbott Laboratories' },
            DHR: { paso_precio: 0.01, precision: 2, nombre: 'Danaher Corp.' },
            NEE: { paso_precio: 0.01, precision: 2, nombre: 'NextEra Energy' },
            GE: { paso_precio: 0.01, precision: 2, nombre: 'GE Aerospace' },
            CAT: { paso_precio: 0.01, precision: 2, nombre: 'Caterpillar Inc.' },
            AXP: { paso_precio: 0.01, precision: 2, nombre: 'American Express' },
            IBM: { paso_precio: 0.01, precision: 2, nombre: 'IBM Corp.' },
            RTX: { paso_precio: 0.01, precision: 2, nombre: 'RTX Corp.' },
            LMT: { paso_precio: 0.01, precision: 2, nombre: 'Lockheed Martin' },
            GS: { paso_precio: 0.01, precision: 2, nombre: 'Goldman Sachs' },
            MS: { paso_precio: 0.01, precision: 2, nombre: 'Morgan Stanley' },
            WFC: { paso_precio: 0.01, precision: 2, nombre: 'Wells Fargo' },
            C: { paso_precio: 0.01, precision: 2, nombre: 'Citigroup Inc.' },
            AMT: { paso_precio: 0.01, precision: 2, nombre: 'American Tower' },
            PLD: { paso_precio: 0.01, precision: 2, nombre: 'Prologis Inc.' },
        },
    },

    // ── FOREX — Divisas (Principales, Menores y Exóticos) ──
    FOREX: {
        etiqueta: 'FOREX',
        nombre: 'Mercado de Divisas (FX)',
        activos: {
            // Pares Principales (Majors) — USD como base o cotizada
            EURUSD: { paso_precio: 0.00001, precision: 5, nombre: 'Euro / Dólar US' },
            GBPUSD: { paso_precio: 0.00001, precision: 5, nombre: 'Libra / Dólar US' },
            USDJPY: { paso_precio: 0.001, precision: 3, nombre: 'Dólar US / Yen Japonés' },
            USDCHF: { paso_precio: 0.00001, precision: 5, nombre: 'Dólar US / Franco Suizo' },
            USDCAD: { paso_precio: 0.00001, precision: 5, nombre: 'Dólar US / Dólar Canadiense' },
            AUDUSD: { paso_precio: 0.00001, precision: 5, nombre: 'Dólar Australiano / USD' },
            NZDUSD: { paso_precio: 0.00001, precision: 5, nombre: 'Dólar NZ / USD' },
            // Pares Menores (Crosses)
            EURGBP: { paso_precio: 0.00001, precision: 5, nombre: 'Euro / Libra' },
            EURJPY: { paso_precio: 0.001, precision: 3, nombre: 'Euro / Yen Japonés' },
            EURCHF: { paso_precio: 0.00001, precision: 5, nombre: 'Euro / Franco Suizo' },
            EURCAD: { paso_precio: 0.00001, precision: 5, nombre: 'Euro / CAD' },
            EURAUD: { paso_precio: 0.00001, precision: 5, nombre: 'Euro / AUD' },
            GBPJPY: { paso_precio: 0.001, precision: 3, nombre: 'Libra / Yen Japonés' },
            GBPCHF: { paso_precio: 0.00001, precision: 5, nombre: 'Libra / Franco Suizo' },
            GBPCAD: { paso_precio: 0.00001, precision: 5, nombre: 'Libra / CAD' },
            GBPAUD: { paso_precio: 0.00001, precision: 5, nombre: 'Libra / AUD' },
            AUDCAD: { paso_precio: 0.00001, precision: 5, nombre: 'AUD / CAD' },
            AUDCHF: { paso_precio: 0.00001, precision: 5, nombre: 'AUD / Franco Suizo' },
            AUDJPY: { paso_precio: 0.001, precision: 3, nombre: 'AUD / Yen Japonés' },
            NZDJPY: { paso_precio: 0.001, precision: 3, nombre: 'NZD / Yen Japonés' },
            CADCHF: { paso_precio: 0.00001, precision: 5, nombre: 'CAD / Franco Suizo' },
            CADJPY: { paso_precio: 0.001, precision: 3, nombre: 'CAD / Yen Japonés' },
            CHFJPY: { paso_precio: 0.001, precision: 3, nombre: 'Franco Suizo / Yen' },
            // Pares con Latinoamérica
            USDMXN: { paso_precio: 0.0001, precision: 4, nombre: 'Dólar US / Peso MXN' },
            USDBRL: { paso_precio: 0.0001, precision: 4, nombre: 'Dólar US / Real BRL' },
            USDCLP: { paso_precio: 0.1, precision: 1, nombre: 'Dólar US / Peso CLP' },
            USDCOP: { paso_precio: 1.0, precision: 0, nombre: 'Dólar US / Peso COP' },
            USDARS: { paso_precio: 0.01, precision: 2, nombre: 'Dólar US / Peso ARS' },
            // Pares con materias primas
            XAUUSD: { paso_precio: 0.01, precision: 2, nombre: 'Oro / Dólar (Spot)' },
            XAGUSD: { paso_precio: 0.001, precision: 3, nombre: 'Plata / Dólar (Spot)' },
            XPTUSD: { paso_precio: 0.01, precision: 2, nombre: 'Platino / Dólar' },
        },
    },

    // ── CRYPTO — Top criptomonedas por capitalización de mercado ──
    CRYPTO: {
        etiqueta: 'CRYPTO',
        nombre: 'Criptomonedas (Top 30)',
        activos: {
            BTCUSD: { paso_precio: 1.0, precision: 2, nombre: 'Bitcoin (BTC)' },
            ETHUSD: { paso_precio: 0.1, precision: 2, nombre: 'Ethereum (ETH)' },
            SOLUSD: { paso_precio: 0.01, precision: 2, nombre: 'Solana (SOL)' },
            BNBUSD: { paso_precio: 0.01, precision: 2, nombre: 'BNB (Binance Coin)' },
            XRPUSD: { paso_precio: 0.0001, precision: 4, nombre: 'Ripple (XRP)' },
            ADAUSD: { paso_precio: 0.0001, precision: 4, nombre: 'Cardano (ADA)' },
            AVAXUSD: { paso_precio: 0.01, precision: 2, nombre: 'Avalanche (AVAX)' },
            DOGEUSD: { paso_precio: 0.00001, precision: 5, nombre: 'Dogecoin (DOGE)' },
            DOTSUSD: { paso_precio: 0.001, precision: 3, nombre: 'Polkadot (DOT)' },
            MATICUSD: { paso_precio: 0.0001, precision: 4, nombre: 'Polygon (MATIC)' },
            LINKUSD: { paso_precio: 0.001, precision: 3, nombre: 'Chainlink (LINK)' },
            LTCUSD: { paso_precio: 0.01, precision: 2, nombre: 'Litecoin (LTC)' },
            SHIBUSDT: { paso_precio: 0.000001, precision: 6, nombre: 'Shiba Inu (SHIB)' },
            UNIUSD: { paso_precio: 0.001, precision: 3, nombre: 'Uniswap (UNI)' },
            ATOMUSD: { paso_precio: 0.001, precision: 3, nombre: 'Cosmos (ATOM)' },
            XLMUSD: { paso_precio: 0.00001, precision: 5, nombre: 'Stellar (XLM)' },
            ETCUSD: { paso_precio: 0.001, precision: 3, nombre: 'Ethereum Classic (ETC)' },
            ALGOUSD: { paso_precio: 0.0001, precision: 4, nombre: 'Algorand (ALGO)' },
            VETUSD: { paso_precio: 0.00001, precision: 5, nombre: 'VeChain (VET)' },
            ICPUSD: { paso_precio: 0.001, precision: 3, nombre: 'Internet Computer (ICP)' },
            FILUSD: { paso_precio: 0.001, precision: 3, nombre: 'Filecoin (FIL)' },
            AAVEUSD: { paso_precio: 0.01, precision: 2, nombre: 'Aave (AAVE)' },
            SANDUSD: { paso_precio: 0.0001, precision: 4, nombre: 'The Sandbox (SAND)' },
            MANAUSD: { paso_precio: 0.0001, precision: 4, nombre: 'Decentraland (MANA)' },
            AXSUSD: { paso_precio: 0.001, precision: 3, nombre: 'Axie Infinity (AXS)' },
            APTUSD: { paso_precio: 0.001, precision: 3, nombre: 'Aptos (APT)' },
            OPUSD: { paso_precio: 0.001, precision: 3, nombre: 'Optimism (OP)' },
            ARBUSD: { paso_precio: 0.0001, precision: 4, nombre: 'Arbitrum (ARB)' },
            SUIUSD: { paso_precio: 0.0001, precision: 4, nombre: 'Sui (SUI)' },
            INJUSD: { paso_precio: 0.001, precision: 3, nombre: 'Injective (INJ)' },
        },
    },
});


// ══════════════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN DE TIMEFRAMES
// ══════════════════════════════════════════════════════════════════════════

const TIMEFRAMES_DISPONIBLES = Object.freeze([
    { etiqueta: '5s', segundos: 5 },
    { etiqueta: '1m', segundos: 60 },
    { etiqueta: '5m', segundos: 300 },
    { etiqueta: '15m', segundos: 900 },
    { etiqueta: '30m', segundos: 1800 },
    { etiqueta: '1H', segundos: 3600 },
    { etiqueta: '4H', segundos: 14400 },
    { etiqueta: '1D', segundos: 86400 },
]);


// ══════════════════════════════════════════════════════════════════════════
//  FÁBRICA DE WIDGETS
// ══════════════════════════════════════════════════════════════════════════

class FabricaWidgets {

    /**
     * Busca la configuración de un símbolo en todo el catálogo.
     * @param {string} simbolo - Ej: 'AAPL', 'BTCUSD'
     * @returns {{ mercado: string, simbolo: string, paso_precio: number, precision: number, nombre: string }}
     */
    static obtenerConfiguracion(simbolo) {
        const simUpper = simbolo.toUpperCase();
        for (const [mercadoId, mercado] of Object.entries(CATALOGO_MERCADOS)) {
            if (mercado.activos[simUpper]) {
                const cfg = mercado.activos[simUpper];
                return {
                    mercado: mercadoId,
                    mercado_nombre: mercado.nombre,
                    simbolo: simUpper,
                    paso_precio: cfg.paso_precio,
                    precision: cfg.precision,
                    nombre: cfg.nombre,
                };
            }
        }
        // Default genérico si no se encuentra
        return {
            mercado: 'DESCONOCIDO',
            mercado_nombre: 'Desconocido',
            simbolo: simUpper,
            paso_precio: 0.01,
            precision: 2,
            nombre: simUpper,
        };
    }

    /**
     * Obtiene todos los mercados y sus activos para los selectores.
     * @returns {Object}
     */
    static obtenerCatalogo() {
        return CATALOGO_MERCADOS;
    }

    /**
     * Obtiene la lista de timeframes disponibles.
     * @returns {Array}
     */
    static obtenerTimeframes() {
        return TIMEFRAMES_DISPONIBLES;
    }

    /**
     * Obtiene todos los símbolos del catálogo en un array plano.
     * @returns {string[]}
     */
    static obtenerTodosLosSimbolos() {
        const simbolos = [];
        for (const mercado of Object.values(CATALOGO_MERCADOS)) {
            simbolos.push(...Object.keys(mercado.activos));
        }
        return [...new Set(simbolos)]; // Eliminar duplicados
    }

    /**
     * Busca símbolos que coincidan con un texto en cualquier mercado.
     * Útil para el buscador del selector de activos.
     * @param {string} texto
     * @returns {Array<{ simbolo, nombre, mercado, mercado_nombre }>}
     */
    static buscarActivos(texto) {
        const q = texto.toUpperCase().trim();
        if (!q) return [];
        const resultados = [];
        for (const [mercadoId, mercado] of Object.entries(CATALOGO_MERCADOS)) {
            for (const [simbolo, cfg] of Object.entries(mercado.activos)) {
                if (
                    simbolo.includes(q) ||
                    cfg.nombre.toUpperCase().includes(q)
                ) {
                    resultados.push({
                        simbolo,
                        nombre: cfg.nombre,
                        mercado: mercadoId,
                        mercado_nombre: mercado.nombre,
                        paso_precio: cfg.paso_precio,
                        precision: cfg.precision,
                    });
                }
            }
        }
        return resultados;
    }

    /**
     * Instancia un widget concreto en un contenedor.
     * Para registrar nuevos tipos, agregar al mapa interno.
     *
     * Tipos disponibles:
     *   'selector_activos'  → WidgetSelectorActivos
     *   'selector_tiempo'   → WidgetSelectorTiempo
     *   'libro_ordenes'     → WidgetLibroOrdenes
     *   'grafica'           → WidgetGrafica  (pendiente de implementación)
     *
     * @param {string} tipoWidget
     * @param {HTMLElement} contenedor
     * @param {Object} configuracion
     * @returns {ClaseBaseWidget}
     */
    static crear(tipoWidget, contenedor, configuracion = {}) {
        const mapa = {
            'selector_activos': WidgetSelectorActivos,
            'selector_tiempo': WidgetSelectorTiempo,
            'libro_ordenes': WidgetLibroOrdenes,
            // 'grafica': WidgetGrafica,  ← se registrará cuando se implemente
        };

        const Clase = mapa[tipoWidget];
        if (!Clase) {
            console.error(`[FabricaWidgets] Tipo desconocido: '${tipoWidget}'. Disponibles: ${Object.keys(mapa).join(', ')}`);
            throw new Error(`[FabricaWidgets] Tipo desconocido: '${tipoWidget}'`);
        }

        const widget = new Clase(contenedor, configuracion);
        widget.inicializar();
        widget.renderizar();
        return widget;
    }

    /**
     * Registra un nuevo tipo de widget en la fábrica en tiempo de ejecución.
     * Usar para registrar WidgetGrafica cuando esté disponible:
     *   FabricaWidgets.registrar('grafica', WidgetGrafica);
     *
     * @param {string} tipo
     * @param {typeof ClaseBaseWidget} ClaseWidget
     */
    static registrar(tipo, ClaseWidget) {
        FabricaWidgets._registro = FabricaWidgets._registro || {};
        FabricaWidgets._registro[tipo] = ClaseWidget;
        console.log(`[FabricaWidgets] Tipo '${tipo}' registrado correctamente.`);
    }
}