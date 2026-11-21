"""Redacta el informe de cada sesión (texto en español) a partir de los números calculados."""
from __future__ import annotations


def n(x, d=1):
    """Número con formato chileno: 1.234,5"""
    return f"{x:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def pc(x, d=1, signo=True):
    return (f"{x * 100:+.{d}f}" if signo else f"{x * 100:.{d}f}").replace(".", ",") + "%"


def lectura_prob(p):
    if 0.45 <= p <= 0.55:
        return "prácticamente un cara o sello"
    if p > 0.55:
        return "un leve sesgo al alza" if p < 0.62 else "un sesgo al alza marcado"
    return "un leve sesgo a la baja" if p > 0.38 else "un sesgo a la baja marcado"


def _linea_foco(f):
    t = f["ticker"]
    if t == "^VIX":
        return (f"{f['nombre']}: {n(f['precio'])} puntos ({pc(f['d1'])} en el último día). "
                f"Sobre 25 suele indicar estrés; bajo 15, calma.")
    mc = f["mc"]["1"]
    futuro = " (los futuros anticipan la apertura)" if t.endswith("=F") and t in ("ES=F", "NQ=F") else ""
    return (f"{f['nombre']}{futuro}: {n(f['precio'], 2)} ({pc(f['d1'])} último día). Simulación a 1 día: "
            f"{pc(mc['p_sube'], 0, False)} de probabilidad de subir ({lectura_prob(mc['p_sube'])}); "
            f"rango del 90% de los casos entre {pc(mc['p5'])} y {pc(mc['p95'])}; "
            f"probabilidad de caer más de {pc(mc['umbral'], 0, False)}: {pc(mc['p_pierde'], 0, False)}.")


def _linea_rank(f):
    return (f"{f['nombre']} ({f['clase']}): puntaje {n(f['score'], 0)}/100, riesgo {f['riesgo'].lower()}, "
            f"tendencia {f['tendencia'].lower()}, probabilidad de subir en un mes {pc(f['mc']['30']['p_sube'], 0, False)}.")


def construir(sid, nombre_sesion, ahora_chile, ctx):
    por_t, por_id = ctx["por_ticker"], ctx["por_id"]
    tono, rk = ctx["tono"], ctx["rankings"]
    fecha = ahora_chile.strftime("%d-%m-%Y %H:%M")
    resumen = [f"Tono del mercado: {tono['etiqueta']} ({tono['valor']}/100). " + " ".join(tono["detalle"])]

    foco = [por_t[t] for t in ctx["foco"] if t in por_t]
    sec = []
    if foco:
        sec.append({"titulo": "Qué mirar en esta sesión", "items": [_linea_foco(f) for f in foco]})
        prim = next((f for f in foco if f["ticker"] != "^VIX"), None)
        if prim:
            resumen.append(f"{prim['nombre']}: {lectura_prob(prim['mc']['1']['p_sube'])} para el próximo día "
                           f"(probabilidad de subir {pc(prim['mc']['1']['p_sube'], 0, False)}).")

    top = [por_id[i] for i in rk["atractivo"][:5]]
    sec.append({"titulo": "Dónde hay más atractivo estadístico hoy (puntaje)", "items": [_linea_rank(f) for f in top] + [
        "El puntaje mezcla tendencia, momentum, retorno por unidad de riesgo, simulación y cercanía al máximo. "
        "Es una lectura de lo que viene ocurriendo, no una promesa."]})
    aj = [por_id[i] for i in rk["mejor_ajustado"][:4]]
    if aj:
        sec.append({"titulo": "Buen puntaje con riesgo bajo o medio", "items": [_linea_rank(f) for f in aj]})
    bajo = [por_id[i] for i in rk["menor_riesgo"][:4]]
    alto = [por_id[i] for i in rk["mayor_riesgo"][:4]]
    sec.append({"titulo": "Riesgo", "items": [
        "Menor riesgo (menor volatilidad): " + "; ".join(f"{f['nombre']} ({pc(f['vol'], 0, False)} anual)" for f in bajo) + ".",
        "Mayor riesgo (mayor volatilidad): " + "; ".join(f"{f['nombre']} ({pc(f['vol'], 0, False)} anual)" for f in alto) + ".",
    ] + [a["texto"] for a in ctx["alertas"][:6]]})

    cr = [por_t[t] for t in ("BTC-USD", "ETH-USD", "SOL-USD", "DOGE-USD", "PEPE24478-USD") if t in por_t]
    if cr:
        items = [f"{f['nombre']}: {n(f['precio'], 4 if f['precio'] < 1 else 2)} ({pc(f['d1'])} en 24 h, {pc(f['w1'])} en 7 días); "
                 f"probabilidad de subir en una semana {pc(f['mc']['7']['p_sube'], 0, False)}; "
                 f"pérdida típica en un mal caso (semana, 95%): {pc(f['mc']['7']['var95'], 0, False)}." for f in cr]
        fng = ctx.get("fng")
        if fng:
            items.append(f"Índice Fear & Greed: {fng['valor']} ({fng['etiqueta']}); ayer {fng['ayer']}.")
        fund = ctx.get("funding")
        if fund:
            items.append("Funding de futuros perpetuos (OKX, cada 8 h): " +
                         "; ".join(f"{k} {v * 100:+.3f}%" for k, v in fund.items()) +
                         ". Muy positivo = apuestas apalancadas al alza (más riesgo de liquidaciones).")
        sec.append({"titulo": "Cripto y memecoins", "items": items})

    cal = ctx.get("calibracion", {}).get("30")
    if cal and cal.get("desde_60", {}).get("real") is not None:
        d60 = cal["desde_60"]
        items = [f"Cuando el método de análogos dio 60% o más de probabilidad de subida a un mes, subió "
                 f"{pc(d60['real'], 0, False)} de las veces (≈{int(d60['n_ef'])} episodios independientes). "
                 f"La frecuencia general de subidas en el período fue {pc(cal['base'], 0, False)}."]
        if cal.get("desde_70", {}).get("real") is not None:
            items.append(f"Con 70% o más: subió {pc(cal['desde_70']['real'], 0, False)} de las veces "
                         f"(≈{int(cal['desde_70']['n_ef'])} episodios). Ver pestaña Calibración antes de automatizar nada.")
        sec.append({"titulo": "Qué tan confiables han sido estas probabilidades", "items": items})

    sec.append({"titulo": "Lo que este informe no incluye", "items": [
        "Calendario económico, noticias y resultados de empresas: un dato inesperado puede mover todo en minutos.",
        "Flujos on-chain de ballenas y flujos de ETFs: requieren fuentes de pago o verificación manual.",
        "Feriados bursátiles: la detección de sesiones no los considera.",
    ]})
    return {
        "titulo": f"{nombre_sesion} — {fecha} (hora de Chile)",
        "resumen": resumen, "secciones": sec,
        "aviso": "Análisis estadístico sobre datos pasados. No es consejo financiero ni garantiza resultados. "
                 "Puedes perder dinero, especialmente en cripto y memecoins.",
    }
