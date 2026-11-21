# Seguridad

## Qué hace (y qué no) esta página
- Es un sitio estático: no tiene servidor propio, base de datos, cuentas ni contraseñas, así que no guarda datos de nadie.
- Lo único que guarda en tu navegador es tu lista de favoritos (`localStorage`). No usa cookies.
- Todo texto que viene de fuera (titulares, nombres de tokens) se escapa antes de mostrarse y solo se aceptan enlaces `http(s)`.
- Una política de seguridad de contenido (CSP, en `docs/index.html`) limita desde dónde puede cargarse código: solo este sitio, el gráfico de TradingView y el contador de visitas opcional.
- Chart.js se incluye en `docs/vendor/` y su contenido es idéntico al paquete oficial `chart.js@4.4.7` de npm (verificado por hash SHA-256).
- Los workflows solo tienen permiso para escribir en el repositorio, sin acceso a secretos.

## Qué debe hacer el dueño del repositorio (cuenta de GitHub)
1. Activar verificación en dos pasos (2FA) y usar passkey o app autenticadora.
2. Settings → Code security: activar Dependabot alerts, Secret scanning y Push protection.
3. Nunca guardar claves (Binance, XTB, APIs) en el código. Si algún día se necesitan, usar *Secrets* de GitHub, y claves de Binance solo de lectura.
4. Settings → Branches: proteger `main` (requerir pull request) cuando haya más de una persona.

## Reportar un problema
Abre un *issue* privado (Security → Report a vulnerability) en el repositorio.
