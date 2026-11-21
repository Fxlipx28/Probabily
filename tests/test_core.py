import unittest
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from pipeline import analytics as A
from pipeline import sessions
from pipeline.universe import construir_universo


def serie(n=1800, seed=1, mu=0.0003, sig=0.01):
    r = np.random.default_rng(seed).normal(mu, sig, n)
    return pd.Series(100 * np.exp(np.cumsum(r)), index=pd.bdate_range(end="2026-11-20", periods=n))


def utc(s):
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


def ids(s):
    return [x[0] for x in sessions.detectar(utc(s))]


class Analitica(unittest.TestCase):
    def test_wilson(self):
        lo, hi = A.wilson(0.6, 100)
        self.assertTrue(0.49 < lo < 0.6 < hi < 0.70)

    def test_simulacion_coherente(self):
        mc, det = A.simular(serie(), np.random.default_rng(0), 4000)
        for h in ("1", "7", "30"):
            m = mc[h]
            self.assertTrue(0 <= m["p_sube"] <= 1)
            self.assertTrue(m["p5"] <= m["p25"] <= m["p50"] <= m["p75"] <= m["p95"])
            self.assertGreaterEqual(m["cvar95"], m["var95"] - 1e-9)
        self.assertGreater(mc["30"]["p95"] - mc["30"]["p5"], mc["1"]["p95"] - mc["1"]["p5"])
        self.assertEqual(len(det["caminos"]), A.N_CAMINOS_MUESTRA)

    def test_sin_ventaja_en_caminata_aleatoria(self):
        # En datos sin señal, lo que el método "predice" no debe superar mucho a la frecuencia general
        p, r = A.calibracion_serie(serie(3000, seed=5, mu=0.0), 21)
        ok = ~np.isnan(p) & ~np.isnan(r)
        alto = ok & (p >= 0.55)
        if alto.sum() > 200:
            self.assertLess(abs(r[alto].mean() - r[ok].mean()), 0.08)

    def test_metricas_y_riesgo(self):
        m = A.metricas(serie())
        self.assertIn(m["tendencia"], ("Alcista", "Mixta", "Bajista"))
        self.assertEqual(A.nivel_riesgo(0.05), "Bajo")
        self.assertEqual(A.nivel_riesgo(0.9), "Muy alto")


class Sesiones(unittest.TestCase):
    def test_verano_ny(self):  # EDT: apertura 13:30 UTC
        self.assertIn("nueva_york", ids("2026-07-15T12:30"))

    def test_invierno_ny(self):  # EST: apertura 14:30 UTC
        self.assertIn("nueva_york", ids("2026-12-15T13:30"))
        self.assertNotIn("nueva_york", ids("2026-12-15T12:30"))

    def test_santiago(self):
        self.assertIn("santiago", ids("2026-12-15T11:30"))

    def test_cierre(self):
        self.assertIn("cierre", ids("2026-07-15T21:30"))
        self.assertIn("cierre", ids("2026-12-15T22:30"))

    def test_tokio_y_fin_de_semana(self):
        self.assertIn("tokio", ids("2026-12-13T23:00"))   # domingo UTC -> lunes en Tokio
        self.assertNotIn("tokio", ids("2026-12-11T23:00"))  # viernes UTC -> sábado en Tokio
        self.assertIn("cripto", ids("2026-12-12T15:00"))

    def test_europa(self):
        self.assertIn("europa", ids("2026-07-15T06:00"))
        self.assertIn("europa", ids("2026-12-15T07:00"))


class Universo(unittest.TestCase):
    def test_ids_unicos(self):
        u = construir_universo()
        self.assertEqual(len({a["id"] for a in u}), len(u))
        self.assertEqual(len({a["ticker"] for a in u}), len(u))


if __name__ == "__main__":
    unittest.main()
