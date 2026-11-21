"""Universo de activos que analiza la app.

Para agregar o quitar activos, edita las listas de abajo.
Formato de cada fila: (ticker de Yahoo Finance, nombre, región, banderas)
Banderas: "core" = entra en la matriz de correlaciones.
Si un ticker no existe o no tiene datos, la app lo muestra en "sin datos" y sigue.
"""

CLASES = [
    "Índices", "ETFs", "Acciones EE.UU.", "Acciones globales", "Chile", "Salmoneras",
    "Materias primas", "Bonos", "Divisas", "Cripto", "Memecoins", "Indicadores",
]

# Clases que NO entran en los rankings de "dónde invertir" (no son inversión directa)
NO_RANKEABLES = {"Divisas", "Indicadores"}

_FILAS = {
    "Índices": [
        ("^GSPC", "S&P 500", "EE.UU.", "core"),
        ("^IXIC", "Nasdaq Composite", "EE.UU.", "core"),
        ("^DJI", "Dow Jones", "EE.UU.", ""),
        ("^RUT", "Russell 2000", "EE.UU.", ""),
        ("^N225", "Nikkei 225", "Japón", "core"),
        ("^HSI", "Hang Seng", "Hong Kong", "core"),
        ("000001.SS", "Shanghai Composite", "China", ""),
        ("^AXJO", "ASX 200", "Australia", ""),
        ("^BSESN", "Sensex", "India", ""),
        ("^KS11", "KOSPI", "Corea del Sur", ""),
        ("^GDAXI", "DAX", "Alemania", "core"),
        ("^FTSE", "FTSE 100", "Reino Unido", ""),
        ("^FCHI", "CAC 40", "Francia", ""),
        ("^STOXX50E", "Euro Stoxx 50", "Eurozona", ""),
        ("^IPSA", "IPSA", "Chile", "core"),
        ("^BVSP", "Bovespa", "Brasil", ""),
        ("^MXX", "IPC México", "México", ""),
    ],
    "ETFs": [
        ("VT", "Mundo (acciones globales)", "Global", ""),
        ("VEA", "Desarrollados ex EE.UU.", "Global", ""),
        ("VWO", "Mercados emergentes", "Global", "core"),
        ("XLK", "Tecnología EE.UU.", "EE.UU.", ""),
        ("SMH", "Semiconductores", "Global", ""),
        ("XLF", "Financiero EE.UU.", "EE.UU.", ""),
        ("XLE", "Energía EE.UU.", "EE.UU.", "core"),
        ("XLV", "Salud EE.UU.", "EE.UU.", ""),
        ("XLU", "Servicios públicos EE.UU.", "EE.UU.", "core"),
        ("XLP", "Consumo básico EE.UU.", "EE.UU.", ""),
        ("VNQ", "Inmobiliario EE.UU.", "EE.UU.", "core"),
    ],
    "Acciones EE.UU.": [
        ("NVDA", "Nvidia", "EE.UU.", "core"),
        ("MSFT", "Microsoft", "EE.UU.", ""),
        ("AAPL", "Apple", "EE.UU.", ""),
        ("GOOGL", "Alphabet (Google)", "EE.UU.", ""),
        ("AMZN", "Amazon", "EE.UU.", ""),
        ("META", "Meta", "EE.UU.", ""),
        ("TSLA", "Tesla", "EE.UU.", ""),
        ("AVGO", "Broadcom", "EE.UU.", ""),
        ("JPM", "JPMorgan", "EE.UU.", ""),
        ("JNJ", "Johnson & Johnson", "EE.UU.", ""),
        ("PG", "Procter & Gamble", "EE.UU.", ""),
        ("KO", "Coca-Cola", "EE.UU.", ""),
        ("XOM", "Exxon Mobil", "EE.UU.", ""),
        ("LLY", "Eli Lilly", "EE.UU.", ""),
    ],
    "Acciones globales": [
        ("ASML", "ASML", "Países Bajos", ""),
        ("NVO", "Novo Nordisk", "Dinamarca", ""),
        ("SAP", "SAP", "Alemania", ""),
        ("TSM", "TSMC", "Taiwán", ""),
        ("TM", "Toyota", "Japón", ""),
        ("SONY", "Sony", "Japón", ""),
        ("BABA", "Alibaba", "China", ""),
        ("MELI", "MercadoLibre", "Latinoamérica", ""),
        ("VALE", "Vale", "Brasil", ""),
    ],
    "Chile": [
        ("SQM-B.SN", "SQM-B (litio)", "Chile", "core"),
        ("FALABELLA.SN", "Falabella", "Chile", ""),
        ("CENCOSUD.SN", "Cencosud", "Chile", ""),
        ("CHILE.SN", "Banco de Chile", "Chile", ""),
        ("BSANTANDER.SN", "Banco Santander Chile", "Chile", ""),
        ("COPEC.SN", "Copec", "Chile", ""),
        ("CMPC.SN", "CMPC", "Chile", ""),
        ("LTM.SN", "LATAM Airlines", "Chile", ""),
        ("COLBUN.SN", "Colbún", "Chile", ""),
        ("ENELCHILE.SN", "Enel Chile", "Chile", ""),
    ],
    "Salmoneras": [
        ("CAMANCHACA.SN", "Camanchaca", "Chile", ""),
        ("BLUMAR.SN", "Blumar", "Chile", ""),
        ("MOWI.OL", "Mowi", "Noruega", "core"),
        ("SALM.OL", "SalMar", "Noruega", ""),
        ("BAKKA.OL", "Bakkafrost", "Islas Feroe", ""),
        ("LSG.OL", "Lerøy Seafood", "Noruega", ""),
    ],
    "Materias primas": [
        ("GC=F", "Oro", "Global", "core"),
        ("SI=F", "Plata", "Global", ""),
        ("CL=F", "Petróleo WTI", "Global", "core"),
        ("BZ=F", "Petróleo Brent", "Global", ""),
        ("NG=F", "Gas natural", "Global", ""),
        ("HG=F", "Cobre", "Global", "core"),
        ("ZW=F", "Trigo", "Global", ""),
        ("ZS=F", "Soja", "Global", ""),
    ],
    "Bonos": [
        ("TLT", "Bonos Tesoro EE.UU. 20+ años", "EE.UU.", "core"),
        ("IEF", "Bonos Tesoro EE.UU. 7-10 años", "EE.UU.", ""),
        ("SHY", "Bonos Tesoro EE.UU. 1-3 años", "EE.UU.", ""),
        ("TIP", "Bonos ligados a inflación EE.UU.", "EE.UU.", ""),
        ("LQD", "Bonos corporativos grado inversión", "EE.UU.", ""),
        ("HYG", "Bonos corporativos alto rendimiento", "EE.UU.", "core"),
        ("EMB", "Bonos emergentes (USD)", "Global", ""),
    ],
    "Divisas": [
        ("EURUSD=X", "EUR/USD", "Global", ""),
        ("USDJPY=X", "USD/JPY", "Global", ""),
        ("GBPUSD=X", "GBP/USD", "Global", ""),
        ("AUDUSD=X", "AUD/USD", "Global", ""),
        ("USDCLP=X", "USD/CLP (dólar en Chile)", "Chile", "core"),
        ("USDBRL=X", "USD/BRL", "Brasil", ""),
        ("USDMXN=X", "USD/MXN", "México", ""),
        ("USDCNY=X", "USD/CNY", "China", ""),
    ],
    "Cripto": [
        ("BTC-USD", "Bitcoin", "Cripto", "core"),
        ("ETH-USD", "Ethereum", "Cripto", "core"),
        ("BNB-USD", "BNB", "Cripto", ""),
        ("SOL-USD", "Solana", "Cripto", "core"),
        ("XRP-USD", "XRP", "Cripto", ""),
        ("ADA-USD", "Cardano", "Cripto", ""),
        ("AVAX-USD", "Avalanche", "Cripto", ""),
        ("LINK-USD", "Chainlink", "Cripto", ""),
        ("LTC-USD", "Litecoin", "Cripto", ""),
    ],
    "Memecoins": [
        ("DOGE-USD", "Dogecoin", "Cripto", "core"),
        ("SHIB-USD", "Shiba Inu", "Cripto", ""),
        ("PEPE24478-USD", "Pepe", "Cripto", ""),
        ("FLOKI-USD", "Floki", "Cripto", ""),
        ("BONK24478-USD", "Bonk", "Cripto", ""),
    ],
    "Indicadores": [
        ("^VIX", "VIX (índice del miedo)", "EE.UU.", ""),
        ("^TNX", "Bono 10 años EE.UU. (rendimiento %)", "EE.UU.", ""),
        ("DX-Y.NYB", "Índice dólar DXY", "Global", "core"),
        ("ES=F", "Futuro S&P 500", "EE.UU.", ""),
        ("NQ=F", "Futuro Nasdaq 100", "EE.UU.", ""),
    ],
}


def construir_universo():
    """Devuelve la lista de activos como diccionarios, con un id único para cada uno."""
    import re

    out, usados = [], set()
    for clase in CLASES:
        for ticker, nombre, region, banderas in _FILAS[clase]:
            base = re.sub(r"[^A-Za-z0-9]+", "_", ticker).strip("_")
            ident, k = base, 2
            while ident in usados:
                ident, k = f"{base}_{k}", k + 1
            usados.add(ident)
            out.append({
                "id": ident, "ticker": ticker, "nombre": nombre, "clase": clase, "region": region,
                "core": "core" in banderas,
                "rankeable": clase not in NO_RANKEABLES,
                "cripto": clase in ("Cripto", "Memecoins"),
            })
    return out
