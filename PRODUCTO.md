# De proyecto personal a producto: guía de lanzamiento

Esto es una hoja de ruta práctica, no asesoría legal ni financiera. Antes de cobrar, consulta con un abogado en tu país.

## 1. Qué es el producto (y qué NO)

**Probabily** muestra, para cientos de activos del mundo, la probabilidad de que suba o baje, el riesgo, noticias y un radar cripto, en español y con honestidad sobre cuánto se equivoca.

- **Diferencial real:** probabilidades *calibradas* y la prueba pública de cuánto fallan. Casi todos los competidores prometen señales; este dice "la dirección de mañana es casi cara o sello, pero el riesgo sí se puede medir".
- **Público inicial:** inversionistas minoristas hispanohablantes (Chile y Latam) que operan en XTB, Binance, Buda, etc. y no saben análisis técnico.
- **Lo que NO debe hacer:** vender "señales de compra/venta", prometer rentabilidad ni operar por el usuario. Eso cambia el tipo de negocio y lo regula (en Chile, la CMF).

## 2. Fases

| Fase | Objetivo | Qué construir | Costo aprox. |
|---|---|---|---|
| 0. Hoy | Validar | Web pública gratis en GitHub Pages | US$0 |
| 1. Beta | Usuarios reales | Dominio propio, analítica (Plausible), formulario de lista de espera, contenido (posts/redes con el informe del día) | US$15–30/año |
| 2. Cuentas | Retener | Login (Supabase Auth o Firebase Auth), "Mi lista" sincronizada, alertas por correo/Telegram | US$0–25/mes |
| 3. Pago | Ingresos | Plan gratis + Pro (Stripe, o Mercado Pago/Flow para Chile), alertas ilimitadas, más activos, historial | comisión ~3–5% |
| 4. Escala | Confiabilidad | Servidor propio (API + base de datos), datos de pago, actualización cada pocos minutos, soporte | US$50–300/mes |

Regla: no pases a la siguiente fase hasta que la anterior tenga gente usándola de verdad.

## 3. Login y cuentas (cuando llegue la fase 2)

GitHub Pages es solo archivos estáticos: **no puede guardar usuarios ni contraseñas**. Opciones:

1. **Supabase (recomendada):** login con correo/Google, base de datos Postgres y reglas por usuario; se usa desde el mismo HTML con su librería JS. Plan gratis suficiente para empezar.
2. **Firebase Auth + Firestore:** similar, muy documentada.
3. **Servidor propio (FastAPI/Node):** más control, más trabajo y mantenimiento.

Nunca guardes contraseñas tú mismo ni claves de Binance/XTB de los usuarios. Si algún día conectas exchanges: solo claves de **lectura** (sin permiso de retiro ni de operar), cifradas, y con aviso claro.

La sección **Cuenta** y **Mi lista** de la web ya están preparadas como punto de entrada; hoy la lista vive en `localStorage`.

## 4. Datos: la parte que más puede frenar el lanzamiento comercial

El prototipo usa fuentes gratuitas que **no están pensadas para uso comercial**:

| Fuente actual | Problema para un negocio | Alternativa |
|---|---|---|
| Yahoo Finance (yfinance) | Uso personal; sin garantía ni licencia comercial | Polygon.io, Twelve Data, Financial Modeling Prep, Alpha Vantage (planes comerciales) |
| CoinGecko gratis | Plan Demo no permite uso comercial | CoinGecko API de pago, CoinMarketCap, o Binance/OKX API pública (permisiva) |
| DEX Screener | Términos propios, límites de uso | API oficial de pago o GeckoTerminal |
| Noticias por RSS | Los titulares tienen derechos de autor; hoy solo se muestra titular + enlace (práctica común, no garantía) | APIs con licencia (NewsAPI, Finnhub news, Benzinga) |
| Binance WebSocket | Datos públicos, uso razonable | Mantener, respetando sus términos |

Presupuesta US$50–300/mes de datos antes de cobrar. Es el costo fijo real del negocio.

## 5. Legal y confianza (Chile y Latam)

- Avisos visibles: "no es asesoría financiera", pasado ≠ futuro, riesgo de pérdida (ya están en la web).
- No uses lenguaje de recomendación personalizada ("compra X"). La web habla de probabilidades y riesgo.
- Política de privacidad y términos de uso antes de pedir datos personales (Ley 19.628 y reforma de datos personales en Chile; GDPR si hay usuarios europeos).
- Si algún día das recomendaciones personalizadas o gestionas dinero, entras al régimen de asesores de inversión (CMF). Confírmalo con un abogado.
- Registra la marca y el dominio antes de hacer publicidad.

## 6. Cómo se gana dinero (sin vender humo)

- **Freemium:** gratis = panel, mañana, noticias, 10 activos en Mi lista. Pro (≈US$5–12/mes) = alertas, lista ilimitada, portafolio propio, historial, exportar a Excel.
- **Educación:** cursos/guías de gestión de riesgo (la audiencia lo pide: "no sé análisis técnico").
- **B2B:** informes en marca blanca para asesores, comunidades o canales de trading.
- **Evita:** comisiones por derivar a exchanges sin transparencia, "señales" pagadas, cualquier promesa de ganancia.

## 7. Qué ya está listo en el código

- Motor de simulación y calibración (`pipeline/`), con tests.
- Actualización automática sin costo de IA (`.github/workflows/`).
- Web oscura, responsive, con noticias, radar, lista y sección de cuenta de ejemplo (`docs/`).
- Separación datos/código: la web lee `docs/config.js`, así que cambiar el origen de datos (de GitHub a una API propia) no obliga a reescribir la interfaz.

## 8. Qué falta, en orden

1. Verificar tickers sin datos y limpiar el universo.
2. Dominio propio + analítica + lista de espera.
3. Medir: ¿cuánta gente vuelve cada semana? Si nadie vuelve, no hay negocio todavía.
4. Elegir proveedor de datos con licencia comercial.
5. Login (Supabase) y alertas.
6. Términos, privacidad, y revisión legal.
7. Plan de pago.

## 9. Riesgos honestos

- La calibración histórica no muestra ventaja para predecir dirección. Vender eso como "predicción" sería engañar; vender **medición de riesgo y contexto** es defendible.
- Los datos gratuitos fallan (tickers que desaparecen, límites). Un producto de pago necesita monitoreo y respaldo.
- Cripto y memecoins atraen estafas y reclamos: mantén las advertencias del radar.
- Mantener esto toma tiempo semanal. Decide cuánto estás dispuesto a dedicarle.
