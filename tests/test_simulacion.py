import unittest

import numpy as np
import pandas as pd

from pipeline import analytics as A


def serie(frac_planos, n=1500, seed=1):
    rng = np.random.default_rng(seed)
    r = rng.standard_t(4, n) * 0.02
    r[rng.random(n) < frac_planos] = 0.0
    return pd.Series(100 * np.exp(np.cumsum(r)), index=pd.bdate_range("2020-01-01", periods=n))


class TestSimulacion(unittest.TestCase):
    def _mc(self, s):
        out = A.simular(s, np.random.default_rng(2))
        return out[0] if isinstance(out, tuple) else out

    def test_dias_planos_no_sesgan_la_direccion(self):
        # una serie simétrica no debe salir con 30% de "sube" solo porque tiene muchos días sin cambio
        for frac in (0.0, 0.4):
            p = self._mc(serie(frac))["1"]["p_sube"]
            self.assertGreater(p, 0.42, frac)
            self.assertLess(p, 0.58, frac)

    def test_probabilidades_coherentes(self):
        m = self._mc(serie(0.0))["1"]
        self.assertLessEqual(m["p_gana"], m["p_sube"])
        self.assertLessEqual(m["p_pierde"], 1 - m["p_sube"] + 1e-9)


if __name__ == "__main__":
    unittest.main()
