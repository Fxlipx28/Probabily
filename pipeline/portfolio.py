"""Portafolios modelo por perfil de riesgo, con simulación conjunta (bootstrap de semanas reales)."""
from __future__ import annotations

import numpy as np
import pandas as pd

# Presupuesto por clase (% del portafolio). Es un punto de partida educativo, no una recomendación.
PERFILES = {
    "Conservador": {"Bonos": 45, "ETFs": 25, "Materias primas": 12, "Chile": 6, "Acciones EE.UU.": 6,
                    "Acciones globales": 4, "Cripto": 2},
    "Balanceado": {"Bonos": 25, "ETFs": 25, "Acciones EE.UU.": 12, "Acciones globales": 8, "Chile": 8,
                   "Salmoneras": 3, "Materias primas": 10, "Cripto": 8, "Memecoins": 1},
    "Crecimiento": {"Bonos": 10, "ETFs": 25, "Acciones EE.UU.": 20, "Acciones globales": 12, "Chile": 8,
                    "Salmoneras": 5, "Materias primas": 8, "Cripto": 10, "Memecoins": 2},
    "Agresivo": {"ETFs": 15, "Acciones EE.UU.": 25, "Acciones globales": 15, "Chile": 8, "Salmoneras": 7,
                 "Materias primas": 5, "Cripto": 14, "Cripto nuevas": 4, "Memecoins": 7},
}
K_POR_CLASE = {"Memecoins": 2}
MIN_SEMANAS = 150


def _stats(R):
    q = np.percentile(R, [5, 25, 50, 75, 95])
    return {"p_sube": float((R > 0).mean()), "p5": float(q[0]), "p25": float(q[1]), "p50": float(q[2]),
            "p75": float(q[3]), "p95": float(q[4]), "var95": float(-q[0]),
            "cvar95": float(-R[R <= q[0]].mean()), "media": float(R.mean())}


def armar(filas, df, rng, n_sims=10000):
    semanal = df.resample("W-FRI").last().iloc[-312:]
    por_id = {f["id"]: f for f in filas}
    out = {}
    for perfil, presupuesto in PERFILES.items():
        pesos = {}
        for clase, pct in presupuesto.items():
            cand = [f for f in filas if f["clase"] == clase and f.get("score") is not None
                    and f["id"] in semanal and semanal[f["id"]].dropna().shape[0] >= MIN_SEMANAS]
            cand.sort(key=lambda f: -f["score"])
            elegidos = cand[:K_POR_CLASE.get(clase, 3)]
            if not elegidos:
                continue
            inv = np.array([1 / max(f["vol"], 0.02) for f in elegidos])
            for f, w in zip(elegidos, inv / inv.sum() * pct / 100):
                pesos[f["id"]] = pesos.get(f["id"], 0) + float(w)
        if not pesos:
            continue
        ids = list(pesos)
        excluidos = []
        while True:
            R = semanal[ids].pct_change().replace([np.inf, -np.inf], np.nan).dropna()
            if len(R) >= MIN_SEMANAS or len(ids) <= 1:
                break
            corto = min(ids, key=lambda i: semanal[i].dropna().shape[0])
            excluidos.append(por_id[corto]["nombre"])
            ids.remove(corto)
        w = np.array([pesos[i] for i in ids])
        w = w / w.sum()
        Rm = R.to_numpy()
        port = Rm @ w
        curva = 100 * np.cumprod(1 + port)
        ref = None
        if "GSPC" in semanal:
            sp = semanal["GSPC"].reindex(R.index).ffill()
            ref = (100 * sp / sp.iloc[0]).round(1).tolist()
        Radj = Rm - 0.75 * Rm.mean(axis=0)
        filas_m = rng.integers(0, len(Radj), (n_sims, 4))
        r_mes = np.prod(1 + Radj[filas_m] @ w, axis=1) - 1
        filas_a = rng.integers(0, len(Radj), (n_sims, 52))
        r_anio = np.prod(1 + Radj[filas_a] @ w, axis=1) - 1
        lo, hi = np.percentile(r_mes * 100, [0.5, 99.5])
        cuentas, bordes = np.histogram(np.clip(r_mes * 100, lo, hi), bins=30, range=(lo, hi))
        mdd = float((curva / np.maximum.accumulate(curva) - 1).min())
        nc = min(260, len(curva))
        por_clase = {}
        for i, wi in zip(ids, w):
            por_clase[por_id[i]["clase"]] = por_clase.get(por_id[i]["clase"], 0) + float(wi)
        out[perfil] = {
            "perfil": perfil,
            "pesos": sorted([{"id": i, "nombre": por_id[i]["nombre"], "clase": por_id[i]["clase"],
                              "peso": float(wi), "vol": por_id[i]["vol"], "riesgo": por_id[i]["riesgo"],
                              "score": por_id[i]["score"]} for i, wi in zip(ids, w)], key=lambda x: -x["peso"]),
            "por_clase": por_clase, "excluidos": excluidos, "n_semanas": int(len(R)),
            "vol_anual": float(np.std(port) * np.sqrt(52)), "mdd_hist": mdd,
            "peor_semana": float(port.min()), "mejor_semana": float(port.max()),
            "mensual": _stats(r_mes), "anual": _stats(r_anio),
            "hist": {"bordes": np.round(bordes, 2).tolist(), "cuentas": cuentas.tolist()},
            "curva": {"fechas": [d.strftime("%Y-%m-%d") for d in R.index[-nc:]],
                      "cartera": np.round(curva[-nc:] / curva[-nc] * 100, 1).tolist(),
                      "ref": (np.round(np.array(ref[-nc:]) / ref[-nc] * 100, 1).tolist() if ref else None)},
        }
    return out
