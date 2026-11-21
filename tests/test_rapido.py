import json
import unittest
from datetime import datetime, timezone

from pipeline import rapido as R

RSS = b"""<?xml version="1.0"?><rss><channel>
<item><title>Bitcoin se desploma y arrastra a Nvidia - Diario Uno</title><link>https://ej.cl/a</link>
<pubDate>Sat, 21 Nov 2026 02:00:00 GMT</pubDate><source url="https://ej.cl">Diario Uno</source></item>
<item><title>Wall Street rebota tras decision de la Reserva Federal</title><link>https://ej.cl/b</link>
<pubDate>Sat, 21 Nov 2026 01:00:00 GMT</pubDate></item>
<item><title>Noticia vieja</title><link>https://ej.cl/c</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item>
<item><title>Bitcoin se desploma y arrastra a Nvidia</title><link>https://ej.cl/d</link>
<pubDate>Sat, 21 Nov 2026 02:05:00 GMT</pubDate></item>
</channel></rss>"""
ATOM = b"""<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Ether sube con fuerza</title>
<link href="https://ej.cl/e"/><published>2026-11-21T00:30:00Z</published></entry></feed>"""


class Noticias(unittest.TestCase):
    def test_parseo_rss_y_atom(self):
        a = R.parsear_feed(RSS, "Mercados", "X")
        self.assertEqual(len(a), 4)
        self.assertEqual(a[0]["titulo"], "Bitcoin se desploma y arrastra a Nvidia")  # quita " - fuente"
        self.assertEqual(a[0]["fuente"], "Diario Uno")
        b = R.parsear_feed(ATOM, "Cripto", "Y")
        self.assertEqual(b[0]["enlace"], "https://ej.cl/e")
        self.assertEqual(R.parsear_feed(b"no es xml", "a", "b"), [])

    def test_recolectar_filtra_deduplica_etiqueta(self):
        ahora = datetime(2026, 11, 21, 3, 0, tzinfo=timezone.utc)
        n, ok, err = R.recolectar_noticias(ahora, descargar=lambda url: RSS)
        titulos = [x["titulo"] for x in n]
        self.assertNotIn("Noticia vieja", titulos)              # más de 72 h
        self.assertEqual(sum("Bitcoin se desploma" in t for t in titulos), 1)  # duplicado fuera
        btc = next(x for x in n if "Bitcoin" in x["titulo"])
        self.assertIn("BTC_USD", btc["activos"])
        self.assertIn("NVDA", btc["activos"])
        self.assertEqual(btc["sentimiento"], "negativo")
        fed = next(x for x in n if "Reserva Federal" in x["titulo"])
        self.assertIn("Fed", fed["temas"])
        self.assertEqual(fed["sentimiento"], "positivo")
        self.assertEqual(len(ok), len(R.FEEDS))

    def test_fuente_caida_no_rompe(self):
        def falla(url):
            raise OSError("sin red")
        n, ok, err = R.recolectar_noticias(descargar=falla)
        self.assertEqual(n, [])
        self.assertEqual(len(err), len(R.FEEDS))


class Radar(unittest.TestCase):
    def test_radar(self):
        def fake(url):
            if "coins/markets" in url:
                return json.dumps([
                    {"name": "A", "symbol": "a", "market_cap_rank": 1, "current_price": 1, "market_cap": 1e9, "total_volume": 2e9,
                     "price_change_percentage_24h": 12.0, "price_change_percentage_7d_in_currency": 3.0},
                    {"name": "B", "symbol": "b", "market_cap_rank": 2, "current_price": 2, "market_cap": 2e9, "total_volume": 1e8,
                     "price_change_percentage_24h": -8.0, "price_change_percentage_7d_in_currency": -1.0}])
            if "trending" in url:
                return json.dumps({"coins": [{"item": {"name": "T", "symbol": "t", "market_cap_rank": 50,
                                                       "data": {"price_change_percentage_24h": {"usd": 20.0}}}}]})
            if "token-profiles" in url:
                return json.dumps([{"chainId": "solana", "tokenAddress": "AAA"}, {"chainId": "solana", "tokenAddress": "BBB"}])
            return json.dumps([
                {"baseToken": {"address": "AAA", "name": "Nuevo", "symbol": "nw"}, "liquidity": {"usd": 50000}, "priceUsd": "0.001",
                 "volume": {"h24": 1000}, "priceChange": {"h24": 150}, "pairCreatedAt": 1.0e12, "url": "https://d"},
                {"baseToken": {"address": "BBB", "name": "Chico", "symbol": "ch"}, "liquidity": {"usd": 100}}])
        r = R.radar_cripto(fake)
        self.assertEqual(r["ganadores"][0]["simbolo"], "A")
        self.assertAlmostEqual(r["ganadores"][0]["cambio24h"], 0.12)
        self.assertEqual(r["perdedores"][0]["simbolo"], "B")
        self.assertEqual(r["trending"][0]["simbolo"], "T")
        self.assertEqual([x["simbolo"] for x in r["nuevos"]], ["NW"])  # liquidez baja se descarta

    def test_radar_con_fallas(self):
        def falla(url):
            raise OSError("x")
        r = R.radar_cripto(falla)
        self.assertEqual(r["ganadores"], [])
        self.assertIn("error_mercado", r)


if __name__ == "__main__":
    unittest.main()
