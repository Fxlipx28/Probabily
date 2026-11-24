"""Envía las señales del día al teléfono (Telegram y/o ntfy). No hace nada si no hay secretos configurados.

Variables de entorno: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (canal o chat), NTFY_TOPIC (opcional).
Uso: python -m pipeline.notificar salida/latest.json --solo santiago,cripto
"""
import argparse
import json
import os
import sys
import urllib.request

from . import senales


def _post(url, data, headers=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method="POST")
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("latest")
    ap.add_argument("--solo", default="", help="ids de sesión que sí notifican, separados por coma")
    args = ap.parse_args(argv)
    d = json.load(open(args.latest, encoding="utf-8"))
    if d.get("demo"):
        return 0
    ids = [x for x in args.solo.split(",") if x]
    if ids and d.get("sesion", {}).get("id") not in ids:
        print("Sesión sin notificación:", d.get("sesion", {}).get("id"))
        return 0
    msg = senales.mensaje(senales.top(d["activos"]), d.get("sesion", {}).get("ref", ""))
    if not msg:
        print("Sin señales que enviar")
        return 0
    tok, chat, topic = (os.environ.get(k, "").strip() for k in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "NTFY_TOPIC"))
    enviados = 0
    if tok and chat:
        import urllib.parse
        _post(f"https://api.telegram.org/bot{tok}/sendMessage",
              urllib.parse.urlencode({"chat_id": chat, "text": msg, "disable_web_page_preview": "true"}).encode())
        enviados += 1
    if topic:
        _post(f"https://ntfy.sh/{topic}", msg.encode("utf-8"), {"Title": "Probabily: señales del día"})
        enviados += 1
    print("Notificaciones enviadas:", enviados)
    return 0


if __name__ == "__main__":
    sys.exit(main())
