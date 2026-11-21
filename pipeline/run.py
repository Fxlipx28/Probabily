"""Genera los datos de la web.

Uso:
    python -m pipeline.run                    # auto: solo corre si toca una sesión (lo usa GitHub Actions)
    python -m pipeline.run --sesion manual    # fuerza un informe ahora
    python -m pipeline.run --sesion nueva_york --force
    python -m pipeline.run --demo --sesion manual   # datos falsos, sin internet
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from . import analytics as A
from . import data as D
from . import narrative, portfolio, sessions
from .universe import CLASES, construir_universo

MAX_INFORMES = 120


def limpio(o):
    if isinstance(o, dict):
        return {str(k): limpio(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [limpio(v) for v in o]
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating, float)):
        x = float(o)
        if not math.isfinite(x):
            return None
        return round(x, 4) if abs(x) >= 1 else float(f"{x:.6g}")
    if isinstance(o, (np.bool_,)):
        return bool(o)
    return o


def escribir(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(limpio(obj), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def detalle_activo(s, fila, detalle_sim, analogos):
    cola = s.iloc[-260:]
    sma50 = s.rolling(50).mean().iloc[-260:]
    sma200 = s.rolling(200).mean().iloc[-260:]
    return {
        "id": fila["id"], "nombre": fila["nombre"], "ticker": fila["ticker"],
        "historia": {"fechas": [d.strftime("%Y-%m-%d") for d in cola.index], "cierre": cola.round(6).tolist(),
                     "sma50": [None if pd.isna(x) else round(float(x), 6) for x in sma50],
                     "sma200": [None if pd.isna(x) else round(float(x), 6) for x in sma200]},
        "sim": detalle_sim, "analogos": analogos, "estac": fila["estac"], "score_comp": fila.get("score_comp"),
    }


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--sesion", default="auto")
    ap.add_argument("--demo", action="store_true")
    ap.add_argument("--sims", type=int, default=10000)
    ap.add_argument("--out", default="docs/data")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args(argv)

    ahora = datetime.now(timezone.utc)
    chile = ahora.astimezone(ZoneInfo("America/Santiago"))
    out = Path(args.out)

    foco_extra = []
    if args.sesion == "auto":
        det = sessions.detectar(ahora)
        if not det:
            print("Ahora no toca ninguna sesión (apertura/cierre). No se actualiza nada.")
            return 0
        sid, ref = det[0]
        for otro, _ in det[1:]:
            foco_extra += sessions.info(otro)["foco"]
    elif args.sesion == "manual":
        sid, ref = "manual", chile.strftime("%Y-%m-%d_%H%M")
    else:
        sid, ref = args.sesion, chile.strftime("%Y-%m-%d")
    nombre_sesion = sessions.info(sid)["nombre"]
    archivo = f"{ref}_{sid}.json"
    if args.sesion == "auto" and not args.force and (out / "informes" / archivo).exists():
        print(f"Ya existe el informe {archivo}. Nada que hacer.")
        return 0
    print(f"Generando: {nombre_sesion} ({ref})")

    universo = construir_universo()
    df, sin_datos = D.descargar(universo, demo=args.demo)
    if df.empty:
        print("No se pudo descargar ningún dato. Se mantiene el informe anterior.")
        return 1
    rng = np.random.default_rng(int(ahora.timestamp()) % (2 ** 32))
    por_id_u = {a["id"]: a for a in universo}

    filas, series = [], {}
    for aid in df.columns:
        a = por_id_u[aid]
        s = df[aid].dropna()
        s = s[s > 0]
        if len(s) < A.MIN_OBS or s.index[-1] < df.index.max() - pd.Timedelta(days=10):  # sin historia o dato viejo
            sin_datos.append({"ticker": a["ticker"], "nombre": a["nombre"]})
            continue
        m = A.metricas(s)
        mc, det_sim = A.simular(s, rng, args.sims)
        analogos = {str(h): A.analogo(s, A.pasos(h, m["ppy"])) for h in (7, 30)}
        fila = {**{k: a[k] for k in ("id", "ticker", "nombre", "clase", "region", "rankeable")}, **m,
                "riesgo": A.nivel_riesgo(m["vol"]), "mc": mc,
                "analogo": {k: (None if v is None else {kk: v[kk] for kk in ("p_sube", "ic_bajo", "ic_alto", "base", "n_ef")})
                            for k, v in analogos.items()},
                "estac": A.estacionalidad(s)}
        filas.append(fila)
        series[aid] = (s, det_sim, analogos)

    A.puntuar(filas)
    por_ticker = {f["ticker"]: f for f in filas}
    por_id = {f["id"]: f for f in filas}
    for f in filas:
        s, det_sim, analogos = series[f["id"]]
        escribir(out / "assets" / f"{f['id']}.json", detalle_activo(s, f, det_sim, analogos))

    # rankings
    rk = [f for f in filas if f["rankeable"] and f.get("score") is not None]
    por_score = sorted(rk, key=lambda f: -f["score"])
    rankings = {
        "atractivo": [f["id"] for f in por_score[:15]],
        "mejor_ajustado": [f["id"] for f in por_score if f["riesgo"] in ("Bajo", "Medio") and f["tendencia"] != "Bajista"][:10],
        "menor_riesgo": [f["id"] for f in sorted(rk, key=lambda f: f["vol"])[:10]],
        "mayor_riesgo": [f["id"] for f in sorted(rk, key=lambda f: -f["vol"])[:10]],
    }
    tono = A.tono_mercado(por_ticker, filas)
    alert = A.alertas(filas)

    # calibración (¿qué tan buenas han sido estas probabilidades?)
    calib = {str(h): A.calibracion_global([series[i][0] for i in series], A.pasos(h, 252)) for h in (7, 30)}

    # estacionalidad y correlaciones
    estac = {"filas": [{"id": f["id"], "nombre": f["nombre"], "clase": f["clase"], **f["estac"]}
                       for f in filas if max(f["estac"]["n"]) >= 5]}
    core = [f["id"] for f in filas if por_id_u[f["id"]]["core"]]
    sem = df[core].resample("W-FRI").last().iloc[-105:].pct_change()
    corr = sem.corr(min_periods=40).round(2)
    correl = {"ids": core, "nombres": [por_id[i]["nombre"] for i in core],
              "matriz": [[None if pd.isna(v) else float(v) for v in row] for row in corr.to_numpy()]}

    cartera = portfolio.armar(filas, df, rng, args.sims)

    ctx = {"por_ticker": por_ticker, "por_id": por_id, "tono": tono, "rankings": rankings, "alertas": alert,
           "foco": sessions.info(sid)["foco"] + foco_extra, "calibracion": calib,
           "fng": None if args.demo else D.fear_greed(), "funding": None if args.demo else D.funding_cripto()}
    informe = narrative.construir(sid, nombre_sesion, chile, ctx)

    ref_spx = por_ticker.get("^GSPC") or max(filas, key=lambda f: f["fecha"])
    latest = {
        "version": 1, "demo": bool(args.demo), "generado_utc": ahora.isoformat(timespec="seconds"),
        "generado_chile": chile.strftime("%d-%m-%Y %H:%M"), "sesion": {"id": sid, "nombre": nombre_sesion, "ref": ref},
        "fecha_datos": ref_spx["fecha"], "n_sims": args.sims, "clases": CLASES, "sin_datos": sin_datos,
        "tono": tono, "informe": informe, "activos": filas, "rankings": rankings, "alertas": alert,
        "estacionalidad": estac, "correlaciones": correl, "portafolios": cartera, "calibracion": calib,
        "fng": ctx["fng"], "funding": ctx["funding"],
    }
    escribir(out / "latest.json", latest)

    # archivo de informes (resumen liviano)
    def mini(i):
        f = por_id[i]
        return {"id": i, "nombre": f["nombre"], "clase": f["clase"], "score": f["score"], "riesgo": f["riesgo"],
                "p_sube_1m": f["mc"]["30"]["p_sube"], "vol": f["vol"]}
    escribir(out / "informes" / archivo, {
        "sesion": latest["sesion"], "generado_chile": latest["generado_chile"], "demo": latest["demo"],
        "tono": tono, "informe": informe, "alertas": alert,
        "rankings": {k: [mini(i) for i in v[:8]] for k, v in rankings.items()}})
    idx_path = out / "informes" / "indice.json"
    previo = json.loads(idx_path.read_text(encoding="utf-8")) if idx_path.exists() else []
    previo = [p for p in previo if p["archivo"] != archivo]
    if not args.demo:  # al llegar datos reales, se descartan los informes de demostración
        for p in previo:
            if p.get("demo"):
                (out / "informes" / p["archivo"]).unlink(missing_ok=True)
        previo = [p for p in previo if not p.get("demo")]
    previo.insert(0, {"archivo": archivo, "titulo": informe["titulo"], "sesion": sid, "tono": tono["valor"],
                      "generado_chile": latest["generado_chile"], "demo": latest["demo"]})
    previo.sort(key=lambda p: p["archivo"], reverse=True)
    for viejo in previo[MAX_INFORMES:]:
        (out / "informes" / viejo["archivo"]).unlink(missing_ok=True)
    escribir(idx_path, previo[:MAX_INFORMES])
    print(f"Listo: {len(filas)} activos, {len(sin_datos)} sin datos. Archivos en {out}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
