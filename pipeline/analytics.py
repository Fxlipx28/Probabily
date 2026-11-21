"""Motor de análisis: métricas, simulación Monte Carlo, análogos históricos, puntaje y riesgo.

Todo lo que sale de aquí es estadística descriptiva y simulación sobre datos pasados.
No predice el futuro ni es consejo financiero.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

LAMBDA = 0.94                       # suavizado de volatilidad (tipo RiskMetrics)
GARCH_ALPHA, GARCH_BETA = 0.08, 0.90
HORIZONTES = [1, 7, 30]             # días calendario: 1 día, 1 semana, 1 mes
UMBRAL = {1: 0.02, 7: 0.05, 30: 0.10}
DERIVA_FACTOR = 0.25                # se usa solo el 25% del retorno histórico como deriva
MIN_OBS = 260
N_CAMINOS_MUESTRA = 40


# ------------------------------------------------------------------ utilidades
def pasos_por_anio(s):
    ultimo = s.index[-1]
    n = int((s.index > ultimo - pd.Timedelta(days=365)).sum())
    return max(n, 50)


def pasos(dias, ppy):
    return max(1, int(round(dias * ppy / 365)))


def wilson(p, n, z=1.96):
    if n <= 0:
        return 0.0, 1.0
    den = 1 + z * z / n
    centro = (p + z * z / (2 * n)) / den
    mitad = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return float(max(0, centro - mitad)), float(min(1, centro + mitad))


def rsi_serie(s, n=14):
    d = s.diff()
    g = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    p = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + g / p.replace(0, np.nan))


def _f(x):
    return None if x is None or (isinstance(x, float) and not np.isfinite(x)) else float(x)


# ------------------------------------------------------------------ métricas
def metricas(s):
    ppy = pasos_por_anio(s)
    ultimo = s.index[-1]
    px = float(s.iloc[-1])

    def cal(d):
        b = s.asof(ultimo - pd.Timedelta(days=d))
        return float(px / b - 1) if pd.notna(b) and b > 0 else np.nan

    previo = s[s.index.year < ultimo.year]
    ytd = float(px / previo.iloc[-1] - 1) if len(previo) else np.nan
    anual = s[s.index > ultimo - pd.Timedelta(days=365)]
    dd = float(px / anual.max() - 1)
    mdd = float((anual / anual.cummax() - 1).min())
    lr = np.log(s).diff().dropna()
    vol = float(lr.iloc[-60:].std() * np.sqrt(ppy))
    lr1 = lr[lr.index > ultimo - pd.Timedelta(days=365)]
    sharpe = float(lr1.mean() * ppy / (lr1.std() * np.sqrt(ppy))) if lr1.std() > 0 else 0.0
    sma50 = float(s.rolling(50).mean().iloc[-1])
    sma200 = float(s.rolling(200).mean().iloc[-1])
    if px > sma50 > sma200:
        tend = "Alcista"
    elif px < sma50 < sma200:
        tend = "Bajista"
    else:
        tend = "Mixta"
    return {
        "fecha": ultimo.strftime("%Y-%m-%d"), "precio": px, "ppy": ppy,
        "d1": float(px / s.iloc[-2] - 1), "w1": cal(7), "m1": cal(30), "m3": cal(91),
        "m6": cal(182), "y1": cal(365), "ytd": ytd,
        "vol": vol, "dd": dd, "mdd": mdd, "sharpe": sharpe,
        "rsi": (lambda x: 50.0 if not np.isfinite(x) else float(x))(rsi_serie(s).iloc[-1]), "tendencia": tend,
        "dist_sma50": px / sma50 - 1, "dist_sma200": px / sma200 - 1,
        "sigma1d": float(lr.iloc[-60:].std()),
    }


def nivel_riesgo(vol):
    if vol < 0.12:
        return "Bajo"
    if vol < 0.25:
        return "Medio"
    if vol < 0.45:
        return "Alto"
    return "Muy alto"


# ------------------------------------------------------------------ simulación Monte Carlo
def simular(s, rng, n_sims=10000):
    """Simulación histórica filtrada con volatilidad que se agrupa (tipo GARCH).

    1) Se estandarizan los retornos pasados por su volatilidad del momento.
    2) Se sortean esos retornos estandarizados (con reposición) y se re-escalan por la
       volatilidad simulada, que sube después de sustos y baja en calma.
    3) La deriva (tendencia) es solo el 25% de la histórica, limitada, para no heredar un
       mercado alcista pasado como si fuera una promesa.
    """
    ppy = pasos_por_anio(s)
    r = np.log(s).diff().dropna().to_numpy()[-1500:]
    r = r[np.isfinite(r)]
    sd = float(np.std(r)) if len(r) else 0.0
    if len(r) < 100 or sd <= 0:
        raise ValueError("serie sin variación suficiente")
    piso = (0.3 * sd) ** 2  # evita volatilidad ~0 en activos con muchos días sin movimiento
    var = pd.Series(r ** 2).ewm(alpha=1 - LAMBDA, adjust=False).mean().shift(1).to_numpy().copy()
    var[0] = np.var(r[:30]) if len(r) >= 30 else np.var(r)
    var = np.maximum(np.nan_to_num(var, nan=sd ** 2), piso)
    z = np.clip(r / np.sqrt(var), -10, 10)
    if z.std() <= 0:
        raise ValueError("serie sin variación suficiente")
    z = (z - z.mean()) / z.std()
    var_sig = max(LAMBDA * var[-1] + (1 - LAMBDA) * r[-1] ** 2, piso)
    largo = float(np.var(r))
    omega = (1 - GARCH_ALPHA - GARCH_BETA) * largo
    mu_a = float(np.clip(DERIVA_FACTOR * r.mean() * ppy, -0.15, 0.25))
    mu_d = mu_a / ppy

    steps = {h: pasos(h, ppy) for h in HORIZONTES}
    H = max(steps.values())
    sig2 = np.full(n_sims, var_sig)
    cum = np.zeros(n_sims)
    trayectos = np.zeros((H + 1, n_sims))
    for t in range(H):
        zt = z[rng.integers(0, len(z), n_sims)]
        sig = np.sqrt(sig2)
        cum = cum + mu_d - 0.5 * sig2 + sig * zt
        trayectos[t + 1] = cum
        sig2 = omega + GARCH_ALPHA * (sig * zt) ** 2 + GARCH_BETA * sig2

    resumen = {}
    for h in HORIZONTES:
        R = np.exp(trayectos[steps[h]]) - 1
        q = np.percentile(R, [5, 25, 50, 75, 95])
        thr = UMBRAL[h]
        resumen[str(h)] = {
            "pasos": steps[h], "umbral": thr,
            "p_sube": float((R > 0).mean()), "p_gana": float((R > thr).mean()),
            "p_pierde": float((R < -thr).mean()),
            "p5": float(q[0]), "p25": float(q[1]), "p50": float(q[2]), "p75": float(q[3]), "p95": float(q[4]),
            "media": float(R.mean()), "var95": float(-q[0]), "cvar95": float(-R[R <= q[0]].mean()),
        }
    resumen["1"]["sigma"] = float(np.sqrt(var_sig))
    H30 = steps[30]
    caida10 = float((trayectos[:H30 + 1].min(axis=0) <= np.log(0.90)).mean())
    resumen["30"]["p_toca_menos10"] = caida10

    # detalle para gráficos (horizonte de 1 mes)
    P = (np.exp(trayectos[:H30 + 1]) - 1) * 100
    bandas = {k: np.round(np.percentile(P, p, axis=1), 2).tolist()
              for k, p in [("p5", 5), ("p25", 25), ("p50", 50), ("p75", 75), ("p95", 95)]}
    idx = rng.choice(n_sims, N_CAMINOS_MUESTRA, replace=False)
    caminos = np.round(P[:, idx].T, 1).tolist()
    R30 = P[-1]
    lo, hi = np.percentile(R30, [0.5, 99.5])
    cuentas, bordes = np.histogram(np.clip(R30, lo, hi), bins=30, range=(lo, hi))
    hist = {"bordes": np.round(bordes, 2).tolist(), "cuentas": cuentas.tolist(), "n": int(n_sims)}
    detalle = {"pasos": H30, "bandas": bandas, "caminos": caminos, "hist": hist,
               "deriva_anual": mu_a, "vol_actual": float(np.sqrt(var_sig * ppy))}
    return resumen, detalle


# ------------------------------------------------------------------ regímenes y análogos
def regimen(s):
    """Tendencia (0 bajista, 1 mixta, 2 alcista) y volatilidad relativa (0 baja, 1 normal, 2 alta)."""
    n = len(s)
    sma50 = s.rolling(50).mean()
    sma200 = s.rolling(200).mean()
    ok = sma200.notna().to_numpy()
    alc = ((s > sma50) & (sma50 > sma200)).to_numpy()
    baj = ((s < sma50) & (sma50 < sma200)).to_numpy()
    tr = np.where(ok, 1, -1)
    tr = np.where(ok & alc, 2, tr)
    tr = np.where(ok & baj, 0, tr)
    r = np.log(s).diff()
    vol20 = r.rolling(20).std()
    ratio = (vol20 / vol20.rolling(252, min_periods=120).median()).to_numpy()
    vr = np.where(np.isnan(ratio), -1, np.where(ratio < 0.8, 0, np.where(ratio > 1.25, 2, 1)))
    code = np.where((tr >= 0) & (vr >= 0), tr * 3 + vr, -1)
    assert len(code) == n
    return tr, vr, code


_NT = {0: "bajista", 1: "mixta", 2: "alcista"}
_NV = {0: "baja", 1: "normal", 2: "alta"}


def analogo(s, H):
    """¿Qué pasó antes en situaciones parecidas (misma tendencia y volatilidad)?"""
    tr, vr, code = regimen(s)
    if code[-1] < 0:
        return None
    fwd = (s.shift(-H) / s - 1).to_numpy()
    valido = ~np.isnan(fwd)
    m = (code == code[-1]) & valido
    cond = f"tendencia {_NT[tr[-1]]} y volatilidad {_NV[vr[-1]]}"
    if m.sum() < 40:
        m = (tr == tr[-1]) & valido
        cond = f"tendencia {_NT[tr[-1]]}"
    n = int(m.sum())
    if n < 30:
        return None
    n_ef = max(1.0, n / H)
    p = float((fwd[m] > 0).mean())
    lo, hi = wilson(p, n_ef)
    return {"condicion": cond, "n_dias": n, "n_ef": round(n_ef, 1), "p_sube": p, "ic_bajo": lo, "ic_alto": hi,
            "base": float((fwd[valido] > 0).mean()), "media": float(fwd[m].mean()),
            "p5": float(np.percentile(fwd[m], 5)), "p95": float(np.percentile(fwd[m], 95))}


def calibracion_serie(s, H, min_n=60):
    """Probabilidad que habría dado el método de análogos usando solo datos anteriores, y qué pasó."""
    tr, vr, code = regimen(s)
    fwd = (s.shift(-H) / s - 1).to_numpy()
    valido = ~np.isnan(fwd) & (code >= 0)
    up = fwd > 0
    pred = np.full(len(s), np.nan)
    for k in range(9):
        m = (code == k) & valido
        cn, cu = np.cumsum(m), np.cumsum(m & up)
        idx = np.where(code == k)[0]
        j = idx - H
        ok = j >= 0
        nn, uu = np.zeros(len(idx)), np.zeros(len(idx))
        nn[ok], uu[ok] = cn[j[ok]], cu[j[ok]]
        bueno = nn >= min_n
        pred[idx[bueno]] = (uu[bueno] + 1) / (nn[bueno] + 2)
    real = np.where(np.isnan(fwd), np.nan, up.astype(float))
    return pred, real


BUCKETS = [0.0, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 1.01]


def calibracion_global(series, pasos_h):
    """Agrega las predicciones de todos los activos y compara con lo que realmente ocurrió."""
    P, R = [], []
    for s in series:
        p, r = calibracion_serie(s, pasos_h)
        ok = ~np.isnan(p) & ~np.isnan(r)
        P.append(p[ok])
        R.append(r[ok])
    P, R = np.concatenate(P), np.concatenate(R)
    filas = []
    for a, b in zip(BUCKETS[:-1], BUCKETS[1:]):
        m = (P >= a) & (P < b)
        n = int(m.sum())
        filas.append({"desde": a, "hasta": min(b, 1.0), "n": n,
                      "pred": float(P[m].mean()) if n else None, "real": float(R[m].mean()) if n else None})
    out = {"pasos": pasos_h, "n_total": int(len(P)), "base": float(R.mean()) if len(R) else None, "buckets": filas}
    for corte in (0.60, 0.70):
        m = P >= corte
        out[f"desde_{int(corte * 100)}"] = {
            "n": int(m.sum()), "n_ef": round(m.sum() / pasos_h, 0),
            "real": float(R[m].mean()) if m.sum() else None}
    return out


# ------------------------------------------------------------------ estacionalidad
def estacionalidad(s):
    m = s.resample("ME").last().dropna()
    m = m[m.index <= s.index[-1]]
    r = m.pct_change().dropna() * 100
    g = r.groupby(r.index.month)
    prom = g.mean().reindex(range(1, 13))
    pos = g.apply(lambda x: (x > 0).mean() * 100).reindex(range(1, 13))
    cnt = g.size().reindex(range(1, 13)).fillna(0)
    ln = lambda ser: [None if pd.isna(x) else round(float(x), 2) for x in ser]  # noqa: E731
    return {"prom": ln(prom), "pos": ln(pos), "n": [int(x) for x in cnt]}


# ------------------------------------------------------------------ puntaje
def puntuar(filas):
    """Agrega 'score' (0-100) y sus componentes a cada fila rankeable."""
    idx = [i for i, f in enumerate(filas) if f["rankeable"]]
    if not idx:
        return
    df = pd.DataFrame({k: [filas[i].get(k) for i in idx] for k in ("m3", "m6", "sharpe")}, index=idx)
    rank = df.rank(pct=True).fillna(0.5)
    for i in idx:
        f = filas[i]
        t = {"Alcista": 1.0, "Mixta": 0.5, "Bajista": 0.0}[f["tendencia"]]
        mom = 0.6 * rank.loc[i, "m6"] + 0.4 * rank.loc[i, "m3"]
        sh = rank.loc[i, "sharpe"]
        pu = float(np.clip(((f["mc"]["30"]["p_sube"]) - 0.40) / 0.30, 0, 1))
        ddc = float(np.clip(1 + f["dd"] / 0.30, 0, 1))
        sobre = 1 - 0.5 * float(np.clip((f["rsi"] - 70) / 20, 0, 1))
        score = 100 * (0.30 * t + 0.25 * mom + 0.20 * sh + 0.15 * pu + 0.10 * ddc) * sobre
        f["score"] = round(float(score), 1)
        f["score_comp"] = {"Tendencia": round(t, 2), "Momentum": round(float(mom), 2),
                           "Retorno/riesgo": round(float(sh), 2), "Prob. simulación": round(pu, 2),
                           "Cercanía al máximo": round(ddc, 2), "Sobrecompra (factor)": round(sobre, 2)}


def tono_mercado(por_ticker, filas):
    """Termómetro 0-100 de apetito por riesgo con los datos que haya."""
    partes, detalle = [], []
    rk = [f for f in filas if f["rankeable"]]
    if rk:
        amp = np.mean([f["tendencia"] == "Alcista" for f in rk])
        partes.append(amp)
        detalle.append(f"Amplitud: {amp * 100:.0f}% de los activos analizados está en tendencia alcista.")
    spx = por_ticker.get("^GSPC")
    if spx:
        v = float(np.clip(0.5 + spx["dist_sma200"] / 0.20, 0, 1))
        partes.append(v)
        pos = "sobre" if spx["dist_sma200"] >= 0 else "bajo"
        detalle.append(f"S&P 500 está {abs(spx['dist_sma200']) * 100:.1f}% {pos} su media de 200 días.")
    vix = por_ticker.get("^VIX")
    vix_nivel = None
    if vix:
        vix_nivel = vix["precio"]
        v = float(np.clip(1 - (vix["precio"] - 12) / 28, 0, 1))
        partes.append(v)
        detalle.append(f"VIX en {vix['precio']:.1f} ({'alto' if vix['precio'] >= 25 else 'moderado' if vix['precio'] >= 18 else 'bajo'}).")
    valor = float(np.mean(partes) * 100) if partes else 50.0
    etiqueta = "Apetito por riesgo alto" if valor >= 65 else "Neutral" if valor >= 40 else "Aversión al riesgo"
    return {"valor": round(valor), "etiqueta": etiqueta, "detalle": detalle, "vix": vix_nivel}


def alertas(filas):
    out = []
    for f in filas:
        if not f["rankeable"]:
            continue
        if f["d1"] and abs(f["d1"]) > 3.0 * f["sigma1d"] and abs(f["d1"]) > 0.015:
            out.append((3, "movimiento", f, f"{f['nombre']} se movió {f['d1'] * 100:+.1f}% en un día "
                        f"(más de 3 veces su variación normal)."))
        if f["rsi"] > 78:
            out.append((2, "sobrecompra", f, f"{f['nombre']}: RSI {f['rsi']:.0f}, subió muy rápido (sobrecomprado)."))
        if f["rsi"] < 22:
            out.append((2, "sobreventa", f, f"{f['nombre']}: RSI {f['rsi']:.0f}, cayó muy rápido (sobrevendido)."))
        if f["dd"] <= -0.35:
            out.append((1, "caida", f, f"{f['nombre']} está {f['dd'] * 100:.0f}% bajo su máximo de 12 meses."))
        if f["dd"] >= -0.003 and f["y1"] and f["y1"] > 0.1:
            out.append((1, "maximo", f, f"{f['nombre']} está en su máximo de 12 meses."))
    out.sort(key=lambda x: -x[0])
    return [{"tipo": t, "id": f["id"], "texto": txt} for _, t, f, txt in out[:14]]
