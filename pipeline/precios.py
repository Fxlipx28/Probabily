"""Precios casi en vivo para toda la lista (cada ~10 min, sin IA).

Solo trae los últimos días y calcula precio actual y variación vs. el cierre anterior.
No recalcula simulaciones: esas se actualizan con cada informe. Escribe <out>/precios.json.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import data as D
from .universe import construir_universo


def calcular(close, universo):
    """close: DataFrame con una columna por ticker. Devuelve {id: [precio, d1]}."""
    out = {}
    for a in universo:
        t = a["ticker"]
        if t not in close:
            continue
        s = close[t].dropna()
        if len(s) < 2:
            continue
        px, prev = float(s.iloc[-1]), float(s.iloc[-2])
        if not (math.isfinite(px) and math.isfinite(prev)) or prev <= 0 or px <= 0:
            continue
        out[a["id"]] = [round(px, 6), round(px / prev - 1, 5)]
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="docs/data")
    args = ap.parse_args(argv)
    import yfinance as yf

    universo = construir_universo()
    tickers = [a["ticker"] for a in universo]
    partes = []
    for i in range(0, len(tickers), 40):
        lote = tickers[i:i + 40]
        try:
            raw = yf.download(lote, period="7d", auto_adjust=True, progress=False, threads=True)
            partes.append(D._extraer_close(raw, lote))
        except Exception as e:  # noqa: BLE001
            print(f"[aviso] falló un lote: {e}")
    if not partes:
        print("Sin datos de precios")
        return 1
    import pandas as pd
    close = pd.concat(partes, axis=1)
    close = close.loc[:, ~close.columns.duplicated()]
    p = calcular(close, universo)
    if len(p) < 50:
        print(f"Muy pocos precios ({len(p)}): no se publica")
        return 1
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "precios.json").write_text(json.dumps({"generado_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"), "p": p}, separators=(",", ":")), encoding="utf-8")
    print(f"Precios: {len(p)} de {len(universo)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
