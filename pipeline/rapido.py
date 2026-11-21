"""Noticias y radar cripto. Solo biblioteca estándar: corre cada 30 minutos sin instalar nada.

Uso:
    python -m pipeline.rapido --out docs/data

No usa IA ni consume tokens: lee titulares de RSS públicos y datos de CoinGecko y DEX Screener.
Solo se guardan titular, fuente, fecha y enlace (el texto completo queda en el sitio de origen).
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

from .universe import construir_universo

UA = {"User-Agent": "Mozilla/5.0 (compatible; LectorDeMercado/1.0; +https://github.com/Fxlipx28/Proyecto-1)"}
MAX_EDAD_H = 72


def _gn(consulta, es=True):
    q = urllib.parse.quote_plus(consulta + " when:2d")
    if es:
        return f"https://news.google.com/rss/search?q={q}&hl=es-419&gl=CL&ceid=CL:es-419"
    return f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"


# (categoría, fuente por defecto, url)
FEEDS = [
    ("Mercados", "Yahoo Finance", "https://finance.yahoo.com/news/rssindex"),
    ("Mercados", "CNBC", "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
    ("Mercados", "Investing.com", "https://www.investing.com/rss/news.rss"),
    ("Mercados", "MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_marketpulse"),
    ("Mercados", "Google News", _gn("Wall Street OR bolsas OR acciones mercados")),
    ("Economía y bancos centrales", "CNBC", "https://www.cnbc.com/id/20910258/device/rss/rss.html"),
    ("Economía y bancos centrales", "Google News", _gn("Reserva Federal inflación tasas de interés")),
    ("Tecnología y empresas", "CNBC", "https://www.cnbc.com/id/19854910/device/rss/rss.html"),
    ("Tecnología y empresas", "Google News", _gn("Nvidia OR Apple OR Microsoft OR Tesla OR Amazon", es=False)),
    ("Cripto", "CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
    ("Cripto", "Cointelegraph", "https://cointelegraph.com/rss"),
    ("Cripto", "Decrypt", "https://decrypt.co/feed"),
    ("Cripto", "Google News", _gn("bitcoin ethereum criptomonedas")),
    ("Energía y materias primas", "Google News", _gn("petróleo OR OPEP OR cobre OR \"precio del oro\"")),
    ("Chile y Latam", "Google News", _gn("bolsa de Santiago IPSA dólar Chile")),
    ("Chile y Latam", "Google News", _gn("Banco Central de Chile economía chilena")),
    ("Salmón y alimentos", "Google News", _gn("salmón OR salmonicultura OR Mowi OR Camanchaca")),
    ("Asia y Europa", "Google News", _gn("Nikkei OR DAX OR \"Hang Seng\" OR \"bolsas de Asia\"")),
]

# patrón -> ticker (solo se usa si el activo existe en el universo)
ALIAS = [
    (r"bitcoin|btc", "BTC-USD"), (r"ethereum|ether|ethereum", "ETH-USD"), (r"solana", "SOL-USD"),
    (r"xrp|ripple", "XRP-USD"), (r"dogecoin|doge", "DOGE-USD"), (r"shiba inu", "SHIB-USD"),
    (r"cardano", "ADA-USD"), (r"binance|bnb", "BNB-USD"), (r"chainlink", "LINK-USD"),
    (r"nvidia", "NVDA"), (r"tesla", "TSLA"), (r"apple|iphone", "AAPL"), (r"microsoft", "MSFT"),
    (r"amazon", "AMZN"), (r"meta platforms|facebook|instagram", "META"), (r"google|alphabet", "GOOGL"),
    (r"broadcom", "AVGO"), (r"netflix", "NFLX"), (r"\bamd\b", "AMD"), (r"intel\b", "INTC"),
    (r"palantir", "PLTR"), (r"coinbase", "COIN"), (r"microstrategy|strategy inc", "MSTR"),
    (r"jpmorgan", "JPM"), (r"goldman", "GS"), (r"berkshire|buffett", "BRK-B"), (r"walmart", "WMT"),
    (r"boeing", "BA"), (r"eli lilly|lilly", "LLY"), (r"novo nordisk", "NVO"), (r"asml", "ASML"),
    (r"tsmc|taiwan semiconductor", "TSM"), (r"toyota", "TM"), (r"alibaba", "BABA"), (r"tencent", "0700.HK"),
    (r"samsung", "005930.KS"), (r"mercadolibre", "MELI"), (r"petrobras", "PBR"), (r"vale\b", "VALE"),
    (r"s&p 500|s&p500|wall street", "^GSPC"), (r"nasdaq", "^IXIC"), (r"dow jones", "^DJI"),
    (r"nikkei", "^N225"), (r"hang seng", "^HSI"), (r"\bdax\b", "^GDAXI"), (r"ftse", "^FTSE"),
    (r"ipsa|bolsa de santiago", "ECH"), (r"bovespa", "^BVSP"),
    (r"petr[oó]leo|crude|\boil\b|opep|opec|brent|wti", "CL=F"), (r"\bgold\b|\boro\b", "GC=F"),
    (r"copper|cobre", "HG=F"), (r"silver|\bplata\b", "SI=F"), (r"natural gas|gas natural", "NG=F"),
    (r"d[oó]lar en chile|peso chileno|usd/clp", "USDCLP=X"), (r"vix", "^VIX"),
    (r"litio|lithium|sqm", "SQM-B.SN"), (r"falabella", "FALABELLA.SN"), (r"cencosud", "CENCOSUD.SN"),
    (r"latam airlines", "LTM.SN"), (r"copec", "COPEC.SN"), (r"cmpc", "CMPC.SN"),
    (r"mowi", "MOWI.OL"), (r"salmar", "SALM.OL"), (r"bakkafrost", "BAKKA.OL"), (r"camanchaca", "CAMANCHACA.SN"),
    (r"salm[oó]n|salmon", "MOWI.OL"),
]
TEMAS = [
    (r"\bfed\b|reserva federal|federal reserve|powell", "Fed"),
    (r"inflaci[oó]n|inflation|\bipc\b|\bcpi\b", "Inflación"),
    (r"arancel|tariff", "Aranceles"),
    (r"opep|opec", "OPEP"), (r"china|beijing|pek[ií]n", "China"),
    (r"\bsec\b|etf|regulaci[oó]n|regulation", "Regulación"),
    (r"resultados|earnings|ganancias trimestrales", "Resultados"),
    (r"guerra|war|conflicto|geopol", "Geopolítica"),
    (r"banco central|central bank|bce|\becb\b", "Bancos centrales"),
]
POS = (r"surg\w*|rall\w*|jump\w*|gain\w*|record|soar\w*|rise\w*|rising|beat\w*|bull\w*|upgrad\w*|rebound\w*|climb\w*"
       r"|sub[eií]\w*|alz\w*|r[eé]cord|gana\w*|repunt\w*|dispar\w*|rebot\w*|supera\w*|mejora\w*|avanz\w*")
NEG = (r"plung\w*|tumbl\w*|slump\w*|fall\w*|drop\w*|crash\w*|fear\w*|loss\w*|bear\w*|sell-?off|downgrad\w*|slid\w*|sink\w*"
       r"|ca[eí]\w*|baj[aóo]\w*|desplom\w*|p[eé]rdid\w*|hund\w*|retroced\w*|tem[eo]\w*|miedo|recort\w*|desplom\w*")
_ALIAS_RE = [(re.compile(r"(?<!\w)(?:" + p + r")(?!\w)", re.I), t) for p, t in ALIAS]
_TEMAS_RE = [(re.compile(p, re.I), n) for p, n in TEMAS]
_POS_RE, _NEG_RE = re.compile(r"(?<!\w)(?:" + POS + r")(?!\w)", re.I), re.compile(r"(?<!\w)(?:" + NEG + r")(?!\w)", re.I)


def fetch(url, timeout=15, intentos=2):
    """Descarga con un reintento (las fuentes gratuitas fallan a ratos)."""
    ultimo = None
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            ultimo = e
            if i + 1 < intentos:
                time.sleep(2)
    raise ultimo


def _fecha(s):
    if not s:
        return None
    s = s.strip()
    try:
        d = parsedate_to_datetime(s)
    except (TypeError, ValueError):
        try:
            d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc)


def parsear_feed(contenido, categoria, fuente):
    """Lee un RSS o Atom y devuelve titulares (titular, enlace, fuente, fecha)."""
    try:
        raiz = ET.fromstring(contenido)
    except ET.ParseError:
        return []
    out = []
    for it in raiz.iter("item"):
        titulo = html.unescape((it.findtext("title") or "").strip())
        enlace = (it.findtext("link") or "").strip()
        src = it.find("source")
        fu = src.text.strip() if src is not None and src.text else fuente
        if fu and titulo.endswith(" - " + fu):
            titulo = titulo[: -len(fu) - 3]
        fecha = _fecha(it.findtext("pubDate") or it.findtext("{http://purl.org/dc/elements/1.1/}date"))
        if titulo and enlace and fecha:
            out.append({"titulo": titulo, "enlace": enlace, "fuente": fu, "categoria": categoria, "fecha": fecha})
    atom = "{http://www.w3.org/2005/Atom}"
    for e in raiz.iter(atom + "entry"):
        titulo = html.unescape((e.findtext(atom + "title") or "").strip())
        ln = e.find(atom + "link")
        enlace = (ln.get("href") if ln is not None else "") or ""
        fecha = _fecha(e.findtext(atom + "published") or e.findtext(atom + "updated"))
        if titulo and enlace and fecha:
            out.append({"titulo": titulo, "enlace": enlace, "fuente": fuente, "categoria": categoria, "fecha": fecha})
    return out


def sentimiento(titulo):
    p, n = len(_POS_RE.findall(titulo)), len(_NEG_RE.findall(titulo))
    return "positivo" if p > n else "negativo" if n > p else "neutral"


def etiquetar(noticia, ticker_a_id):
    t = noticia["titulo"]
    ids = []
    for rx, ticker in _ALIAS_RE:
        if rx.search(t) and ticker in ticker_a_id and ticker_a_id[ticker] not in ids:
            ids.append(ticker_a_id[ticker])
    noticia["activos"] = ids[:4]
    noticia["temas"] = [n for rx, n in _TEMAS_RE if rx.search(t)][:3]
    noticia["sentimiento"] = sentimiento(t)
    return noticia


def clave(titulo):
    return re.sub(r"[^a-z0-9áéíóúñ]+", "", titulo.lower())[:70]


def recolectar_noticias(ahora=None, descargar=fetch):
    ahora = ahora or datetime.now(timezone.utc)
    ticker_a_id = {a["ticker"]: a["id"] for a in construir_universo()}
    crudas, ok, error = [], [], []
    for categoria, fuente, url in FEEDS:
        try:
            items = parsear_feed(descargar(url), categoria, fuente)[:30]
            (ok if items else error).append(f"{categoria} · {fuente}" + ("" if items else " (sin titulares)"))
            crudas += items
        except Exception as e:  # noqa: BLE001
            error.append(f"{categoria} · {fuente} ({type(e).__name__})")
    vistos, out = set(), []
    for n in sorted(crudas, key=lambda x: x["fecha"], reverse=True):
        if ahora - n["fecha"] > timedelta(hours=MAX_EDAD_H) or n["fecha"] - ahora > timedelta(hours=2):
            continue
        k = clave(n["titulo"])
        if k in vistos:
            continue
        vistos.add(k)
        etiquetar(n, ticker_a_id)
        n["fecha"] = n["fecha"].isoformat(timespec="seconds")
        out.append(n)
    por_cat, final = {}, []
    for n in out:
        por_cat[n["categoria"]] = por_cat.get(n["categoria"], 0) + 1
        if por_cat[n["categoria"]] <= 40:
            final.append(n)
    return final[:260], ok, error


# ------------------------------------------------------------------ radar cripto
def _pct(x):
    return None if x is None else float(x) / 100.0


def radar_cripto(descargar=fetch):
    out = {"fuente": "CoinGecko y DEX Screener", "trending": [], "ganadores": [], "perdedores": [],
           "volumen": [], "nuevos": []}
    try:
        mk = json.loads(descargar("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc"
                                  "&per_page=250&page=1&sparkline=false&price_change_percentage=24h,7d"))
        filas = [{"nombre": m.get("name"), "simbolo": (m.get("symbol") or "").upper(), "rank": m.get("market_cap_rank"),
                  "precio": m.get("current_price"), "mcap": m.get("market_cap"), "volumen": m.get("total_volume"),
                  "cambio24h": _pct(m.get("price_change_percentage_24h")),
                  "cambio7d": _pct(m.get("price_change_percentage_7d_in_currency"))} for m in mk]
        base = [f for f in filas if f["cambio24h"] is not None and (f["mcap"] or 0) >= 50_000_000]
        out["ganadores"] = sorted(base, key=lambda f: -f["cambio24h"])[:10]
        out["perdedores"] = sorted(base, key=lambda f: f["cambio24h"])[:10]
        vol = [dict(f, ratio=(f["volumen"] or 0) / f["mcap"]) for f in filas if (f["mcap"] or 0) >= 50_000_000]
        out["volumen"] = sorted(vol, key=lambda f: -f["ratio"])[:10]
    except Exception as e:  # noqa: BLE001
        out["error_mercado"] = type(e).__name__
    try:
        tr = json.loads(descargar("https://api.coingecko.com/api/v3/search/trending"))
        for c in tr.get("coins", [])[:10]:
            it = c.get("item", {})
            cam = ((it.get("data") or {}).get("price_change_percentage_24h") or {}).get("usd")
            out["trending"].append({"nombre": it.get("name"), "simbolo": (it.get("symbol") or "").upper(),
                                    "rank": it.get("market_cap_rank"), "cambio24h": _pct(cam)})
    except Exception as e:  # noqa: BLE001
        out["error_trending"] = type(e).__name__
    try:
        perfiles = json.loads(descargar("https://api.dexscreener.com/token-profiles/latest/v1"))
        por_cadena = {}
        for p in perfiles[:60]:
            if p.get("chainId") and p.get("tokenAddress"):
                por_cadena.setdefault(p["chainId"], []).append(p["tokenAddress"])
        vistos, ahora_ms = set(), datetime.now(timezone.utc).timestamp() * 1000
        for cadena, addrs in list(por_cadena.items())[:6]:
            try:
                pares = json.loads(descargar(f"https://api.dexscreener.com/tokens/v1/{cadena}/{','.join(addrs[:30])}"))
            except Exception:  # noqa: BLE001
                continue
            for par in pares if isinstance(pares, list) else []:
                liq = (par.get("liquidity") or {}).get("usd") or 0
                bt = par.get("baseToken") or {}
                if liq < 20_000 or bt.get("address") in vistos:
                    continue
                vistos.add(bt.get("address"))
                creado = par.get("pairCreatedAt")
                out["nuevos"].append({
                    "nombre": bt.get("name"), "simbolo": (bt.get("symbol") or "").upper(), "cadena": cadena,
                    "precio": float(par["priceUsd"]) if par.get("priceUsd") else None, "liquidez": liq,
                    "volumen24h": (par.get("volume") or {}).get("h24"),
                    "cambio24h": _pct((par.get("priceChange") or {}).get("h24")),
                    "edad_horas": round((ahora_ms - creado) / 3.6e6, 1) if creado else None, "url": par.get("url")})
        out["nuevos"] = sorted(out["nuevos"], key=lambda x: -(x["liquidez"] or 0))[:12]
    except Exception as e:  # noqa: BLE001
        out["error_nuevos"] = type(e).__name__
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="docs/data")
    args = ap.parse_args(argv)
    ahora = datetime.now(timezone.utc)
    noticias, ok, error = recolectar_noticias(ahora)
    radar = radar_cripto()
    print(f"Noticias: {len(noticias)} | fuentes ok: {len(ok)} | con problemas: {len(error)}")
    for e in error:
        print("  [sin datos]", e)
    if not noticias and not radar["ganadores"]:
        print("No se obtuvo nada; no se actualiza el archivo.")
        return 1
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "rapido.json").write_text(json.dumps({
        "generado_utc": ahora.isoformat(timespec="seconds"), "noticias": noticias, "radar": radar,
        "fuentes_ok": ok, "fuentes_error": error}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
