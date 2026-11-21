"""Historial público de aciertos: guarda lo que el modelo dijo cada día y lo compara con lo que pasó.

Es una prueba hacia adelante (no un backtest): cada predicción se registra ANTES de conocer el resultado
y se resuelve cuando pasa su horizonte. Así cualquiera puede ver cuánto acierta de verdad, incluso si es poco.
Archivos (se guardan junto al informe, en la rama de datos):
  historial.json    resumen público (pequeño) que lee la página
  pendientes.json   predicciones aún sin resolver (estado interno)
"""
import json
from datetime import date
from pathlib import Path

HORIZONTES = (1, 7, 30)
MAX_SERIE = 150      # días de serie diaria que se conservan
MAX_ULTIMOS = 80     # últimos resultados mostrados
EXPIRA_EXTRA = 20    # días extra de espera antes de descartar una predicción sin dato


def _leer(p):
    try:
        return json.loads(Path(p).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _estado_nuevo():
    return {"res": {str(h): {"n": 0, "y": 0, "brier": 0.0, "acierto": 0, "bins": [[0, 0.0, 0] for _ in range(10)], "clases": {}} for h in HORIZONTES},
            "serie": {str(h): {} for h in HORIZONTES}, "ultimos": [], "desde": None}


def _registrar(st, fila, h, fecha_pred, p, p0):
    y = 1 if fila["precio"] > p0 else 0
    r = st["res"][str(h)]
    r["n"] += 1
    r["y"] += y
    err = (p - y) ** 2
    r["brier"] += err
    hit = 1 if (p >= 0.5) == (y == 1) else 0
    r["acierto"] += hit
    b = r["bins"][min(int(p * 10), 9)]
    b[0] += 1
    b[1] += p
    b[2] += y
    c = r["clases"].setdefault(fila["clase"], [0, 0])
    c[0] += 1
    c[1] += hit
    s = st["serie"][str(h)].setdefault(fila["fecha"], [0, 0.0, 0, 0])
    s[0] += 1
    s[1] += err
    s[2] += hit
    s[3] += y
    ret = fila["precio"] / p0 - 1 if p0 else None
    st["ultimos"].append([fila["id"], fila["nombre"], fecha_pred, fila["fecha"], h, round(p, 3), y, None if ret is None else round(ret, 4)])


def actualizar(prev_dir, filas):
    """Devuelve (resumen_publico, pendientes) tras resolver lo vencido y registrar lo de hoy."""
    prev_dir = Path(prev_dir) if prev_dir else None
    st = (prev_dir and _leer(prev_dir / "historial_estado.json")) or _estado_nuevo()
    pend = (prev_dir and _leer(prev_dir / "pendientes.json")) or []
    por_id = {f["id"]: f for f in filas if f.get("rankeable")}

    nuevas = []
    for id_, fp, h, p, p0 in pend:
        fila = por_id.get(id_)
        if not fila:
            nuevas.append([id_, fp, h, p, p0])
            continue
        dias = (date.fromisoformat(fila["fecha"]) - date.fromisoformat(fp)).days
        if dias >= h:
            _registrar(st, fila, h, fp, p, p0)
        elif dias <= h + EXPIRA_EXTRA:
            nuevas.append([id_, fp, h, p, p0])
    pend = nuevas

    claves = {(e[0], e[1], e[2]) for e in pend}
    for f in por_id.values():
        for h in HORIZONTES:
            if (f["id"], f["fecha"], h) in claves:
                continue
            m = f["mc"].get(str(h))
            if m and f.get("precio"):
                pend.append([f["id"], f["fecha"], h, round(m["p_sube"], 3), f["precio"]])
    hoy = max((f["fecha"] for f in por_id.values()), default=None)
    st["desde"] = st["desde"] or hoy
    for h in HORIZONTES:
        ser = st["serie"][str(h)]
        for k in sorted(ser)[:-MAX_SERIE]:
            del ser[k]
    st["ultimos"] = st["ultimos"][-MAX_ULTIMOS:]
    pub = {"version": 1, "actualizado": hoy, "desde": st["desde"], "pendientes": {str(h): sum(1 for e in pend if e[2] == h) for h in HORIZONTES},
           "res": st["res"], "serie": st["serie"], "ultimos": st["ultimos"]}
    return pub, st, pend
