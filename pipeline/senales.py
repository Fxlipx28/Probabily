"""Señales del día: los activos donde la simulación a 1 día y los análogos a 7 días apuntan al mismo lado.

No son recomendaciones: es la lectura más consistente del modelo ese día. Se excluyen los activos de riesgo
"Muy alto" (memecoins, etc.) porque su simulación es la menos fiable.
"""


def top(activos, n=6):
    out = []
    for a in activos:
        if not a.get("rankeable") or a.get("riesgo") == "Muy alto":
            continue
        try:
            p1 = a["mc"]["1"]["p_sube"]
            p7 = a["analogo"]["7"]["p_sube"]
        except (KeyError, TypeError):
            continue
        if (p1 - 0.5) * (p7 - 0.5) <= 0 or abs(p1 - 0.5) > 0.2:
            continue  # sin acuerdo, o probabilidad tan extrema que suele ser un artefacto del modelo
        out.append({"id": a["id"], "nombre": a["nombre"], "sube": p1 > 0.5, "p1": p1, "p7": p7,
                    "riesgo": a.get("riesgo"), "conf": min(abs(p1 - 0.5), abs(p7 - 0.5))})
    out.sort(key=lambda x: -x["conf"])
    return out[:n]


def mensaje(sen, fecha=""):
    if not sen:
        return ""
    l = [f"Probabily · señales {fecha}".strip()]
    for s in sen:
        p = s["p1"] if s["sube"] else 1 - s["p1"]
        l.append(f"{'▲' if s['sube'] else '▼'} {s['nombre']}: {p * 100:.0f}% de {'subir' if s['sube'] else 'bajar'} mañana")
    l.append("Probabilidades, no recomendaciones. https://fxlipx28.github.io/Probabily/")
    return "\n".join(l)
