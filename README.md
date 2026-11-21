# Proyecto-1

## Informe de mercado (`mercado.py`)

Baja datos reales de Yahoo Finance y genera `informe-mercado.html` con tabla, gráficos de barras, drawdown, estacionalidad por mes y gráfico técnico (medias móviles y RSI).

```powershell
pip install yfinance pandas matplotlib
python mercado.py          # datos reales
python mercado.py --demo   # prueba con datos falsos, sin internet
```

Para cambiar los activos, edita el diccionario `ACTIVOS` al inicio del archivo.

Es análisis estadístico, no consejo financiero.
