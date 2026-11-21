// Configuración de la web. Si cambias de usuario o de repositorio, edita estas direcciones.
// En tu computador (localhost) la página lee la carpeta local docs/data.
window.CFG = {
  // Informe completo (se publica en la rama "datos" cada vez que abre un mercado)
  datos: "https://raw.githubusercontent.com/Fxlipx28/Proyecto-1/datos/",
  // Noticias y radar cripto (se publica en la rama "noticias" cada 30 minutos)
  rapido: "https://raw.githubusercontent.com/Fxlipx28/Proyecto-1/noticias/rapido.json",
  // Gráfico de TradingView en el Simulador (false para quitarlo)
  tradingview: true,
  // Contador de visitas SIN cookies. Completa SOLO UNO (ver README, sección "Contar visitas"):
  //   goatcounter: "mi-codigo"      -> gratis; creas la cuenta en goatcounter.com y eliges ese código
  //   plausible:   "fxlipx28.github.io"  -> de pago (prueba 30 días); es el dominio que registraste
  analytics: {goatcounter: "", plausible: ""},
  repo: "https://github.com/Fxlipx28/Proyecto-1",
};
