# Probabily

Página web que lee el mercado mundial (índices, ETFs, acciones de EE.UU., globales y chilenas, salmoneras, materias primas, bonos, divisas, cripto y memecoins) y se actualiza sola antes de la apertura de los mercados importantes.

**Es una herramienta de lectura de mercado y apoyo a decisiones. No es consejo financiero.**

## Qué muestra

- **Hoy:** termómetro de apetito por riesgo, resumen de mañana, rankings, últimas noticias, alertas y mapa del día.
- **Mañana:** probabilidad de que suba y de que baje cada activo (1 día, 1 semana, 1 mes), con consulta rápida por activo.
- **Noticias:** titulares de fuentes públicas etiquetados por activo y tema, con tono (positivo/negativo) por palabras clave.
- **Radar cripto:** mayores subidas y caídas, tendencias, volumen anormal y tokens nuevos en DEX (con advertencia de riesgo).
- **Mercados / Simulador / Estacionalidad / Correlaciones / Portafolio / Calibración:** análisis por activo y por cartera.
- **Historial (lo que hace única a la página):** guarda cada día las probabilidades ANTES del resultado y las compara con lo que pasó (acierto, puntaje frente a un método tonto, calibración). Código en `pipeline/historial.py`; los archivos viajan en la rama `datos`.
- **Mi lista:** activos favoritos guardados en el navegador. **Cuenta:** reservado para el futuro inicio de sesión.

Cubre ~220 activos: índices, ETFs, acciones de EE.UU., globales y chilenas, salmoneras, materias primas, bonos, divisas, cripto, cripto nuevas y memecoins.

## Cómo se mantiene al día (sin gastar tokens de IA)

Todo lo hacen programas normales en GitHub Actions; la página solo lee archivos ya listos.

| Qué | Cada cuánto | Workflow | Rama donde se publica |
|---|---|---|---|
| Informe completo (precios, simulaciones, probabilidades) | Antes de abrir Tokio, Europa, Santiago y Nueva York, tras el cierre de Wall Street, y fines de semana cripto | `actualizar.yml` | `datos` |
| Noticias y radar cripto | Cada 30 minutos | `noticias.yml` | `noticias` |
| Revisión en tu navegador | Cada 5 minutos | `docs/app.js` | — |
| Precio de cripto en vivo | Continuo (WebSocket de Binance) | `docs/app.js` | — |

Las ramas `datos` y `noticias` se reescriben en cada ejecución (sin historial), así el repositorio no crece. La dirección de lectura está en `docs/config.js`.

Para detener todo: borra los dos archivos de `.github/workflows/` o desactívalos en la pestaña Actions.

## Puesta en marcha

1. **Activar la página:** `Settings → Pages → Deploy from a branch → main → /docs`.
2. **Primer informe real:** `Actions → Actualizar informe de mercado → Run workflow` (deja `manual`), y lo mismo con `Actualizar noticias y radar cripto`.
3. La página queda en `https://<tu-usuario>.github.io/Probabily/`.

GitHub puede retrasar varios minutos las ejecuciones programadas y desactiva los workflows de un repositorio sin actividad por 60 días (se reactivan a mano).

Hacia un producto público (cuentas, planes, licencias de datos): ver `PRODUCTO.md`.

## Correr en tu computador

```powershell
pip install -r requirements.txt
python -m pipeline.run --sesion manual        # datos reales
python -m pipeline.run --demo --sesion manual # datos falsos, sin internet
python -m pipeline.rapido                      # noticias y radar (necesita internet)
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
docs/       la página web (HTML, CSS, JS); los datos se publican en las ramas `datos` y `noticias`
.github/    actualización automática
tests/      pruebas
mercado.py  script simple de informe local (primera versión)
```

## Contar visitas (sin cookies)

En `docs/config.js`, dentro de `analytics`, completa **uno**:

- **GoatCounter (gratis):** crea una cuenta en goatcounter.com, elige un código (por ejemplo `probability`) y escríbelo en `goatcounter`. Ves las visitas en `https://TU-CODIGO.goatcounter.com`.
- **Plausible (de pago, 30 días de prueba):** registra el dominio en plausible.io y escribe ese dominio en `plausible`.

No usan cookies ni guardan datos personales. En tu computador (localhost) no cuentan.

## Gráfico de TradingView

El Simulador carga un solo gráfico: el del activo que tienes abierto. Cambia el símbolo automáticamente (`tvSymbol` en `docs/app.js`). Si algún activo no coincide, se puede cambiar dentro del mismo gráfico o abrir en TradingView. Para quitarlo: `tradingview: false` en `config.js`.
