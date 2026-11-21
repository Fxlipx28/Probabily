"""Sesiones de mercado y detección de cuál toca informar (con horario de verano de cada país)."""
from __future__ import annotations

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

SESIONES = {
    "nueva_york": {"nombre": "Pre-apertura Nueva York", "tz": "America/New_York", "hora": time(9, 30),
                   "foco": ["ES=F", "NQ=F", "^GSPC", "^IXIC", "^VIX", "DX-Y.NYB"]},
    "europa": {"nombre": "Pre-apertura Europa", "tz": "Europe/Berlin", "hora": time(9, 0),
               "foco": ["^GDAXI", "^FTSE", "^FCHI", "^STOXX50E"]},
    "tokio": {"nombre": "Pre-apertura Tokio", "tz": "Asia/Tokyo", "hora": time(9, 0),
              "foco": ["^N225", "^HSI", "000001.SS", "^AXJO", "^KS11"]},
    "santiago": {"nombre": "Pre-apertura Santiago", "tz": "America/Santiago", "hora": time(9, 30),
                 "foco": ["^IPSA", "USDCLP=X", "HG=F", "SQM-B.SN"]},
}
EXTRA = {
    "cierre": {"nombre": "Cierre de Wall Street y perspectiva", "foco": ["^GSPC", "^IXIC", "^VIX", "BTC-USD", "GC=F", "CL=F"]},
    "cripto": {"nombre": "Informe cripto de fin de semana", "foco": ["BTC-USD", "ETH-USD", "SOL-USD", "DOGE-USD"]},
    "manual": {"nombre": "Informe manual", "foco": ["^GSPC", "^IXIC", "BTC-USD", "GC=F", "CL=F", "^IPSA"]},
}
PRIORIDAD = ["nueva_york", "europa", "tokio", "santiago", "cierre", "cripto"]
VENTANA_ANTES_MIN = 100     # se informa hasta 100 min antes de la apertura
VENTANA_DESPUES_MIN = 20    # y hasta 20 min después (cron retrasado)


def proxima_apertura(ahora, tz, hora):
    z = ZoneInfo(tz)
    local = ahora.astimezone(z)
    # incluye ayer y hoy por si la apertura fue hace pocos minutos
    for d in range(-1, 8):
        dia = (local + timedelta(days=d)).date()
        if dia.weekday() >= 5:
            continue
        ap = datetime.combine(dia, hora, tzinfo=z)
        if (ap - ahora).total_seconds() / 60 > -VENTANA_DESPUES_MIN:
            return ap
    return None


def ultimo_cierre_ny(ahora):
    z = ZoneInfo("America/New_York")
    local = ahora.astimezone(z)
    for d in range(0, 8):
        dia = (local - timedelta(days=d)).date()
        if dia.weekday() >= 5:
            continue
        cierre = datetime.combine(dia, time(16, 0), tzinfo=z)
        if cierre <= ahora:
            return cierre
    return None


def detectar(ahora):
    """Devuelve lista de (id_sesion, fecha_referencia). Vacía si ahora no toca ninguna."""
    out = []
    for sid, cfg in SESIONES.items():
        ap = proxima_apertura(ahora, cfg["tz"], cfg["hora"])
        if ap is None:
            continue
        minutos = (ap - ahora).total_seconds() / 60
        if -VENTANA_DESPUES_MIN < minutos <= VENTANA_ANTES_MIN:
            out.append((sid, ap.date().isoformat()))
    c = ultimo_cierre_ny(ahora)
    if c is not None:
        despues = (ahora - c).total_seconds() / 60
        if 30 < despues <= 120:
            out.append(("cierre", c.date().isoformat()))
    if ahora.weekday() in (5, 6) and 14 <= ahora.hour <= 16:
        out.append(("cripto", ahora.date().isoformat()))
    out.sort(key=lambda x: PRIORIDAD.index(x[0]))
    return out


def info(sid):
    return SESIONES.get(sid) or EXTRA[sid]
