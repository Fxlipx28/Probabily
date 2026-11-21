"""Descarga de datos (Yahoo Finance) y generador de datos de demostración."""
from __future__ import annotations

import json
import urllib.request
import zlib

import numpy as np
import pandas as pd

MIN_OBS = 260


# ------------------------------------------------------------------ datos reales
def _normalizar(idx):
    idx = pd.DatetimeIndex(idx)
    if idx.tz is not None:
        idx = idx.tz_localize(None)
    return idx.normalize()


def _extraer_close(raw, tickers):
    if raw is None or len(raw) == 0:
        return pd.DataFrame()
    if isinstance(raw.columns, pd.MultiIndex):
        niveles0 = raw.columns.get_level_values(0)
        close = raw["Close"] if "Close" in niveles0 else raw.xs("Close", axis=1, level=-1)
    else:
        close = raw[["Close"]].rename(columns={"Close": tickers[0]}) if "Close" in raw else pd.DataFrame()
    if isinstance(close, pd.Series):
        close = close.to_frame(tickers[0])
    close.index = _normalizar(close.index)
    return close[~close.index.duplicated(keep="last")]


def descargar(universo, demo=False, anios=12):
    """Devuelve (DataFrame de cierres con una columna por id, lista de activos sin datos)."""
    if demo:
        return _demo(universo)
    import yfinance as yf

    tickers = [a["ticker"] for a in universo]
    partes = []
    for i in range(0, len(tickers), 40):
        lote = tickers[i:i + 40]
        try:
            raw = yf.download(lote, period=f"{anios}y", auto_adjust=True, progress=False, threads=True)
            partes.append(_extraer_close(raw, lote))
        except Exception as e:  # noqa: BLE001
            print(f"[aviso] falló un lote de descarga: {e}")
    close = pd.concat(partes, axis=1) if partes else pd.DataFrame()
    close = close.loc[:, ~close.columns.duplicated()]

    # reintento individual de los que quedaron cortos
    for t in tickers:
        if t not in close or close[t].dropna().shape[0] < MIN_OBS:
            try:
                h = yf.Ticker(t).history(period=f"{anios}y", auto_adjust=True)["Close"]
                h.index = _normalizar(h.index)
                h = h[~h.index.duplicated(keep="last")]
                if h.dropna().shape[0] > (close[t].dropna().shape[0] if t in close else 0):
                    close[t] = h
            except Exception:  # noqa: BLE001
                pass

    por_ticker = {a["ticker"]: a for a in universo}
    cols, sin_datos = {}, []
    for t, a in por_ticker.items():
        if t in close and close[t].dropna().shape[0] >= MIN_OBS:
            cols[a["id"]] = close[t]
        else:
            sin_datos.append({"ticker": t, "nombre": a["nombre"]})
    df = pd.DataFrame(cols).sort_index()
    return df, sin_datos


# ------------------------------------------------------------------ datos opcionales
def _get_json(url, timeout=8):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def fear_greed():
    """Índice Fear & Greed de cripto (alternative.me). Devuelve None si no hay acceso."""
    try:
        d = _get_json("https://api.alternative.me/fng/?limit=2")["data"]
        return {"valor": int(d[0]["value"]), "etiqueta": d[0]["value_classification"],
                "ayer": int(d[1]["value"]) if len(d) > 1 else None}
    except Exception:  # noqa: BLE001
        return None


def funding_cripto():
    """Tasa de financiamiento de futuros perpetuos (OKX, pública). None si no hay acceso."""
    out = {}
    for nombre, inst in [("Bitcoin", "BTC-USDT-SWAP"), ("Ethereum", "ETH-USDT-SWAP"),
                         ("Solana", "SOL-USDT-SWAP"), ("Dogecoin", "DOGE-USDT-SWAP")]:
        try:
            d = _get_json(f"https://www.okx.com/api/v5/public/funding-rate?instId={inst}")["data"][0]
            out[nombre] = float(d["fundingRate"])
        except Exception:  # noqa: BLE001
            continue
    return out or None


# ------------------------------------------------------------------ demo
_VOL = {"Índices": .16, "ETFs": .17, "Acciones EE.UU.": .28, "Acciones globales": .30, "Chile": .27,
        "Salmoneras": .38, "Materias primas": .27, "Bonos": .08, "Divisas": .09, "Cripto": .75,
        "Memecoins": 1.2, "Indicadores": .18}
_DRIFT = {"Índices": .08, "ETFs": .08, "Acciones EE.UU.": .13, "Acciones globales": .10, "Chile": .07,
          "Salmoneras": .08, "Materias primas": .04, "Bonos": .02, "Divisas": .0, "Cripto": .30,
          "Memecoins": .15, "Indicadores": .05}
_BETA = {"Índices": .85, "ETFs": .8, "Acciones EE.UU.": .65, "Acciones globales": .55, "Chile": .4,
         "Salmoneras": .25, "Materias primas": .25, "Bonos": -.1, "Divisas": .05, "Cripto": .4,
         "Memecoins": .35, "Indicadores": .6}


def _demo(universo):
    fin = pd.Timestamp.today().normalize()
    dias = pd.date_range(fin - pd.DateOffset(years=12), fin, freq="D")
    habiles = dias.dayofweek < 5
    n = len(dias)
    rng0 = np.random.default_rng(7)
    # factor de mercado común con regímenes de volatilidad
    regimen = np.ones(n)
    for ini in rng0.choice(n - 90, 12, replace=False):
        regimen[ini:ini + rng0.integers(20, 90)] = rng0.uniform(1.8, 3.0)
    regimen[-25:] = 1.7  # volatilidad algo alta al final, para que haya movimiento
    mkt = rng0.standard_normal(n) * regimen
    cols = {}
    for a in universo:
        rng = np.random.default_rng(zlib.crc32(a["ticker"].encode()))
        clase = a["clase"]
        vol, mu, beta = _VOL[clase], _DRIFT[clase], _BETA[clase]
        vol *= rng.uniform(0.75, 1.3)
        diario = 365 if a["cripto"] else 252
        idio = rng.standard_normal(n) * np.where(rng.random(n) < .02, 3.0, 1.0)
        if a["ticker"] == "^VIX":
            x = np.zeros(n)
            for i in range(1, n):
                x[i] = 0.97 * x[i - 1] + 0.12 * (-mkt[i]) + 0.05 * rng.standard_normal()
            serie = 17 * np.exp(0.6 * x)
        elif a["ticker"] == "^TNX":
            serie = np.clip(2.5 + np.cumsum(0.02 * (0.3 * mkt + rng.standard_normal(n))) / 3, 0.5, 6.5)
        else:
            z = beta * mkt + np.sqrt(max(1 - beta ** 2, 0.05)) * idio
            r = (mu - 0.5 * vol ** 2) / diario + vol / np.sqrt(diario) * z
            inicio = {"Cripto": 20000, "Memecoins": 0.05}.get(clase, rng.uniform(20, 400))
            if a["ticker"] == "BTC-USD":
                inicio = 12000
            serie = inicio * np.exp(np.cumsum(r))
        s = pd.Series(serie, index=dias)
        if not a["cripto"]:
            s = s.where(habiles)
        if a["ticker"] in ("PEPE24478-USD", "BONK24478-USD"):  # historia corta, como en la realidad
            s = s.iloc[-1100:].reindex(dias)
        cols[a["id"]] = s
    df = pd.DataFrame(cols)
    # quita fines de semana sin ningún dato
    df = df.dropna(how="all")
    return df, []
