import unittest
from pipeline import senales


def A(i, p1, p7, riesgo="Medio", rk=True):
    return {"id": i, "nombre": i, "rankeable": rk, "riesgo": riesgo, "mc": {"1": {"p_sube": p1}}, "analogo": {"7": {"p_sube": p7}}}


class TestSenales(unittest.TestCase):
    def test_filtra_y_ordena(self):
        act = [A("a", .56, .60), A("b", .60, .40), A("c", .40, .30, riesgo="Muy alto"), A("d", .45, .44), A("x", .10, .20), A("e", .5, .5, rk=False)]
        t = senales.top(act)
        self.assertEqual([x["id"] for x in t], ["a", "d"])
        self.assertNotIn("b", [x["id"] for x in t])
        self.assertNotIn("c", [x["id"] for x in t])
        self.assertTrue(next(x for x in t if x["id"] == "d")["sube"] is False)

    def test_mensaje(self):
        self.assertIn("▼ d", senales.mensaje(senales.top([A("d", .45, .44)])))
        self.assertEqual(senales.mensaje([]), "")


if __name__ == "__main__":
    unittest.main()
