# Lector de Mercado

Página web que lee el mercado mundial (índices, ETFs, acciones de EE.UU., globales y chilenas, salmoneras, materias primas, bonos, divisas, cripto y memecoins) y se actualiza sola antes de la apertura de los mercados importantes.

**Es una herramienta de lectura de mercado y apoyo a decisiones. No es consejo financiero.**

## Qué muestra

- **Hoy:** termómetro de apetito por riesgo, informe de la sesión, rankings (mayor puntaje, riesgo contenido, menor y mayor riesgo), alertas y mapa del día.
- **Mercados:** tabla ordenable y filtrable de todos los activos, con probabilidades.
- **Simulador:** por activo, 10.000 escenarios a 1 mes (40 se dibujan), probabilidad de subir, rango del 90%, pérdida 95% y probabilidad de tocar −10%, más "qué pasó antes en situaciones parecidas".
- **Estacionalidad:** qué meses suelen ser mejores, por activo.
- **Correlaciones:** qué activos se mueven juntos (para diversificar).
- **Portafolio:** reparto mundial de ejemplo por perfil (conservador a agresivo) con simulación conjunta.
- **Calibración:** prueba de qué tan buenas han sido las probabilidades en el pasado. Revísala antes de pensar en automatizar.
- **Informes:** historial de informes por sesión.

## Cuándo se actualiza

GitHub Actions (`.github/workflows/actualizar.yml`) corre hasta 100 minutos antes de la apertura de:

| Sesión | Apertura |
|---|---|
| Tokio | 09:00 JST |
| Europa | 09:00 hora de Fráncfort |
| Santiago | 09:30 hora de Chile |
| Nueva York | 09:30 hora de Nueva York |

Además hay un informe tras el cierre de Wall Street y uno cripto los fines de semana. Considera el horario de verano de cada país. No considera feriados bursátiles.

## Puesta en marcha

1. **Activar la página:** en GitHub, `Settings → Pages → Build and deployment → Deploy from a branch → main → /docs`.
2. **Primer informe real:** pestaña `Actions → Actualizar informe de mercado → Run workflow` (deja `manual`). Tarda unos minutos y reemplaza los datos de demostración.
3. La página queda en `https://<tu-usuario>.github.io/Proyecto-1/`.

Nota: GitHub desactiva los workflows programados si el repositorio no tiene actividad por 60 días; se reactivan a mano en la pestaña Actions.

## Correr en tu computador

```powershell
pip install -r requirements.txt
python -m pipeline.run --sesion manual        # datos reales
python -m pipeline.run --demo --sesion manual # datos falsos, sin internet
cd docs
python -m http.server 8000                    # abrir http://localhost:8000
```

Tests: `python -m unittest discover -s tests -t .`

## Personalizar

- **Activos:** edita `pipeline/universe.py`. Si un ticker no tiene datos aparece como "sin datos" y el resto sigue funcionando. Verifica en Yahoo Finance los tickers de memecoins y de salmoneras chilenas si alguno sale sin datos.
- **Perfiles de portafolio:** `pipeline/portfolio.py`.
- **Puntaje y riesgo:** `pipeline/analytics.py` (`puntuar`, `nivel_riesgo`).

## Cómo se calculan las probabilidades

Resumen (el detalle está en la pestaña Método de la página):

1. **Monte Carlo:** retornos históricos normalizados por su volatilidad, sorteados con reposición y reescalados con volatilidad simulada que se agrupa en el tiempo (tipo GARCH). Deriva reducida al 25% de la histórica.
2. **Situaciones parecidas:** frecuencia con que subió el activo tras días con igual tendencia y volatilidad, con intervalo de confianza.
3. **Calibración:** prueba hacia atrás usando solo datos anteriores a cada día.

## Idea a futuro: automatizar operaciones en Binance

No está implementado a propósito. Antes de hacerlo:

- Mira la pestaña **Calibración**: una regla tipo "operar si la probabilidad es ≥ 60-70%" solo tiene sentido si en el pasado esas probabilidades realmente se cumplieron.
- Prueba en la red de pruebas (testnet) durante semanas.
- Usa claves de API con permiso de operar y **sin permiso de retiro**, y limita por IP.
- Define pérdida máxima por operación y por día, con un interruptor que apague todo.
- Empieza con montos que puedas perder por completo.

## Estructura

```
pipeline/   motor en Python (datos, simulación, puntaje, informe, sesiones)
docs/       la página web (HTML, CSS, JS) y docs/data con los datos generados
.github/    actualización automática
tests/      pruebas
mercado.py  script simple de informe local (primera versión)
```
