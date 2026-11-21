import json
import tempfile
import unittest
from pathlib import Path

from pipeline import historial as H


def fila(id_, fecha, precio, p1=0.6, clase="Cripto"):
    mc = {str(h): {"p_sube": p1} for h in H.HORIZONTES}
    return {"id": id_, "nombre": id_, "clase": clase, "rankeable": True, "fecha": fecha, "precio": precio, "mc": mc}


def guardar(d, pub, est, pend):
    Path(d, "historial_estado.json").write_text(json.dumps(est))
    Path(d, "pendientes.json").write_text(json.dumps(pend))


class TestHistorial(unittest.TestCase):
    def test_registra_y_resuelve(self):
        with tempfile.TemporaryDirectory() as d:
            pub, est, pend = H.actualizar(d, [fila("A", "2026-01-01", 100)])
            self.assertEqual(len(pend), 3)
            self.assertEqual(pub["res"]["1"]["n"], 0)
            guardar(d, pub, est, pend)
            # mismo día: no duplica
            pub, est, pend = H.actualizar(d, [fila("A", "2026-01-01", 100)])
            self.assertEqual(len(pend), 3)
            guardar(d, pub, est, pend)
            # al día siguiente sube: se resuelve el de 1 día como acierto (p=0.6, subió)
            pub, est, pend = H.actualizar(d, [fila("A", "2026-01-02", 105)])
            r = pub["res"]["1"]
            self.assertEqual((r["n"], r["y"], r["acierto"]), (1, 1, 1))
            self.assertAlmostEqual(r["brier"], 0.16, places=6)
            self.assertEqual(pub["res"]["7"]["n"], 0)
            self.assertEqual(len(pend), 3 + 2)   # 7d y 30d de ayer + 3 nuevos - 1 resuelto
            guardar(d, pub, est, pend)
            # a los 7 días cae: el de 7 días falla
            pub, est, pend = H.actualizar(d, [fila("A", "2026-01-08", 90)])
            self.assertEqual(pub["res"]["7"]["n"], 1)
            self.assertEqual(pub["res"]["7"]["acierto"], 0)

    def test_sin_historial_previo(self):
        pub, est, pend = H.actualizar(None, [fila("A", "2026-01-01", 100)])
        self.assertEqual(pub["desde"], "2026-01-01")
        self.assertEqual(len(pend), 3)


if __name__ == "__main__":
    unittest.main()
