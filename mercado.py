"""
Informe de mercado con gráficos y estadísticas reales.

Uso:
    pip install yfinance pandas matplotlib
    python mercado.py            -> baja datos reales y crea informe-mercado.html
    python mercado.py --demo     -> prueba con datos falsos (sin internet)

Esto es análisis, no consejo financiero.
"""
import sys
import io
import base64
import datetime as dt

import numpy as np
import pandas as pd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

# ---------------------------------------------------------------- configuración
# Cambia o agrega activos aquí (nombre: ticker de Yahoo Finance)
ACTIVOS = {
    "S&P 500": "^GSPC",
    "Nasdaq": "^IXIC",
    "Nvidia": "NVDA",
    "Oro": "GC=F",
    "Petróleo WTI": "CL=F",
    "Bitcoin": "BTC-USD",
    "Ethereum": "ETH-USD",
    "Dólar DXY": "DX-Y.NYB",
    "VIX": "^VIX",
    "Bono 10Y": "^TNX",
}
NIVEL = ["VIX", "Bono 10Y"]  # se miden por nivel, no por rentabilidad
SUBE, BAJA = "#2a9d8f", "#e76f51"
MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]


# ---------------------------------------------------------------- datos
def descargar(demo):
    if demo:
        idx = pd.bdate_range(end=dt.date.today(), periods=15 * 252)
        rng = np.random.default_rng(1)
        datos = {
            n: pd.Series(100 * np.exp(np.cumsum(rng.normal(0.0003, 0.015, len(idx)))), index=idx)
            for n in ACTIVOS
        }
        return pd.DataFrame(datos)
    import yfinance as yf

    df = yf.download(list(ACTIVOS.values()), period="15y", auto_adjust=True, progress=False)["Close"]
    df = df.rename(columns={v: k for k, v in ACTIVOS.items()})
    return df.dropna(how="all").ffill()


# ---------------------------------------------------------------- cálculos
def rsi(s, n=14):
    d = s.diff()
    ganancia = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    perdida = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + ganancia / perdida)


def metricas(s):
    ult = s.iloc[-1]

    def ret(dias):
        return (ult / s.iloc[-1 - dias] - 1) * 100 if len(s) > dias else np.nan

    previo = s[s.index.year < s.index[-1].year]
    ytd = (ult / previo.iloc[-1] - 1) * 100 if len(previo) else np.nan
    max1a = s.iloc[-252:].max()
    sma50 = s.rolling(50).mean().iloc[-1]
    sma200 = s.rolling(200).mean().iloc[-1]
    if ult > sma50 > sma200:
        tend = "Alcista"
    elif ult < sma50 < sma200:
        tend = "Bajista"
    else:
        tend = "Mixta"
    return {
        "ultimo": ult,
        "5d": ret(5),
        "21d": ret(21),
        "63d": ret(63),
        "ytd": ytd,
        "dd": (ult / max1a - 1) * 100,
        "vol": s.pct_change().iloc[-30:].std() * np.sqrt(252) * 100,
        "rsi": rsi(s).iloc[-1],
        "tend": tend,
    }


def construir_tabla(df):
    filas = {}
    for n in ACTIVOS:
        if n in df and df[n].dropna().shape[0] > 220:
            filas[n] = metricas(df[n].dropna())
    return pd.DataFrame.from_dict(filas, orient="index")


def estacionalidad(s):
    try:
        m = s.resample("ME").last()
    except ValueError:
        m = s.resample("M").last()
    m = m[m.index <= s.index[-1]]  # saca el mes en curso si está incompleto
    r = m.pct_change().dropna() * 100
    g = r.groupby(r.index.month)
    prom = g.mean().reindex(range(1, 13))
    pos = g.apply(lambda x: (x > 0).mean() * 100).reindex(range(1, 13))
    return prom, pos, int(len(r) / 12)


# ---------------------------------------------------------------- gráficos
def a_base64(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=110, bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode()


def graf_retornos(t):
    cols = [("1 semana", "5d"), ("1 mes", "21d"), ("3 meses", "63d"), ("En el año", "ytd")]
    base = t.drop(NIVEL, errors="ignore")
    fig, axs = plt.subplots(2, 2, figsize=(11, 7))
    for ax, (titulo, c) in zip(axs.flat, cols):
        v = base[c].dropna().sort_values()
        ax.barh(v.index, v.values, color=[SUBE if x >= 0 else BAJA for x in v.values])
        ax.axvline(0, color="gray", lw=0.8)
        ax.set_title(titulo)
        for i, x in enumerate(v.values):
            ax.text(x, i, f" {x:.1f}%", va="center", ha="left" if x >= 0 else "right", fontsize=8)
        ax.margins(x=0.25)
    fig.tight_layout()
    return a_base64(fig)


def graf_drawdown(t):
    v = t.drop(NIVEL, errors="ignore")["dd"].dropna().sort_values()
    fig, ax = plt.subplots(figsize=(9, 4.5))
    ax.barh(v.index, v.values, color=BAJA)
    for i, x in enumerate(v.values):
        ax.text(x, i, f" {x:.1f}%", va="center", ha="right", fontsize=9)
    ax.set_title("Distancia al máximo de los últimos 12 meses")
    ax.margins(x=0.2)
    fig.tight_layout()
    return a_base64(fig)


def graf_rebase(df, nombres):
    fig, ax = plt.subplots(figsize=(10, 4.8))
    for n in nombres:
        if n in df:
            s = df[n].dropna().iloc[-252:]
            ax.plot(s.index, s / s.iloc[0] * 100, label=n, lw=1.6)
    ax.axhline(100, color="gray", lw=0.8)
    ax.set_title("Último año (todos parten en 100)")
    ax.legend(ncol=3, fontsize=9)
    fig.tight_layout()
    return a_base64(fig)


def graf_estacionalidad(df, nombres):
    hoy = dt.date.today().month
    fig, axs = plt.subplots(2, 2, figsize=(11, 7))
    for ax, n in zip(axs.flat, nombres):
        prom, pos, anios = estacionalidad(df[n].dropna())
        colores = [SUBE if x >= 0 else BAJA for x in prom.fillna(0)]
        barras = ax.bar(MESES, prom.values, color=colores)
        for mes in (hoy, hoy % 12 + 1):
            barras[mes - 1].set_edgecolor("black")
            barras[mes - 1].set_linewidth(2.2)
        for i, (p, q) in enumerate(zip(prom.values, pos.values)):
            if not np.isnan(p):
                ax.text(i, p, f"{q:.0f}%", ha="center", va="bottom" if p >= 0 else "top", fontsize=7)
        ax.axhline(0, color="gray", lw=0.8)
        ax.set_title(f"{n} (≈{anios} años)")
    fig.suptitle("Retorno mensual promedio (%). Número = % de años en que ese mes subió. Borde negro = este mes y el próximo")
    fig.tight_layout()
    return a_base64(fig)


def graf_tecnico(df, nombres):
    fig, axs = plt.subplots(2, len(nombres), figsize=(11, 6), gridspec_kw={"height_ratios": [3, 1]}, sharex="col")
    for j, n in enumerate(nombres):
        s = df[n].dropna()
        v = s.iloc[-180:]
        axs[0, j].plot(v.index, v.values, color="black", lw=1.2, label="Precio")
        axs[0, j].plot(v.index, s.rolling(50).mean().iloc[-180:], color=SUBE, label="Media 50 días")
        axs[0, j].plot(v.index, s.rolling(200).mean().iloc[-180:], color=BAJA, label="Media 200 días")
        axs[0, j].set_title(n)
        axs[0, j].legend(fontsize=8)
        axs[1, j].plot(v.index, rsi(s).iloc[-180:], color="#555")
        axs[1, j].axhline(70, color=BAJA, lw=0.8)
        axs[1, j].axhline(30, color=SUBE, lw=0.8)
        axs[1, j].set_ylim(0, 100)
        axs[1, j].set_ylabel("RSI")
        axs[1, j].tick_params(axis="x", rotation=30)
    fig.tight_layout()
    return a_base64(fig)


# ---------------------------------------------------------------- informe
def lectura(t):
    b = t.drop(NIVEL, errors="ignore")
    out = []
    mejor, peor = b["21d"].idxmax(), b["21d"].idxmin()
    out.append(f"Mejor del último mes: <b>{mejor}</b> ({b.loc[mejor, '21d']:+.1f}%). Peor: <b>{peor}</b> ({b.loc[peor, '21d']:+.1f}%).")
    bajistas = list(b.index[b["tend"] == "Bajista"])
    alcistas = list(b.index[b["tend"] == "Alcista"])
    out.append("Tendencia alcista (precio sobre sus medias): " + (", ".join(alcistas) or "ninguno"))
    out.append("Tendencia bajista (precio bajo sus medias): " + (", ".join(bajistas) or "ninguno"))
    sobrev = list(b.index[b["rsi"] < 30])
    sobrec = list(b.index[b["rsi"] > 70])
    out.append("RSI bajo 30 (sobrevendido): " + (", ".join(sobrev) or "ninguno"))
    out.append("RSI sobre 70 (sobrecomprado): " + (", ".join(sobrec) or "ninguno"))
    for n in NIVEL:
        if n in t.index:
            out.append(f"{n}: nivel {t.loc[n, 'ultimo']:.2f}")
    return "<ul>" + "".join(f"<li>{x}</li>" for x in out) + "</ul>"


def tabla_html(t):
    cab = ["Activo", "Último", "1 sem %", "1 mes %", "3 meses %", "Año %", "Desde máx. 1a %", "Vol. anual %", "RSI", "Tendencia"]
    h = "<table><tr>" + "".join(f"<th>{c}</th>" for c in cab) + "</tr>"
    for n, f in t.iterrows():
        def c(x):
            if pd.isna(x):
                return "<td>-</td>"
            color = SUBE if x >= 0 else BAJA
            return f'<td style="color:{color}">{x:+.1f}</td>'

        h += f"<tr><td><b>{n}</b></td><td>{f['ultimo']:,.2f}</td>{c(f['5d'])}{c(f['21d'])}{c(f['63d'])}{c(f['ytd'])}{c(f['dd'])}"
        h += f"<td>{f['vol']:.0f}</td><td>{f['rsi']:.0f}</td><td>{f['tend']}</td></tr>"
    return h + "</table>"


def seccion(titulo, img, explicacion):
    return f'<h2>{titulo}</h2><img src="data:image/png;base64,{img}"><div class="exp">{explicacion}</div>'


CSS = """
body{font-family:Segoe UI,Arial,sans-serif;max-width:1000px;margin:30px auto;padding:0 16px;color:#222;line-height:1.5}
table{border-collapse:collapse;width:100%;font-size:14px} th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:right}
th:first-child,td:first-child{text-align:left} th{background:#f3f3f3} img{max-width:100%}
.exp{background:#f7f7f7;border-left:4px solid #2a9d8f;padding:10px 14px;margin:8px 0 28px} h2{margin-top:36px}
.aviso{background:#fff3e0;border-left:4px solid #e76f51;padding:10px 14px}
"""


def main():
    demo = "--demo" in sys.argv
    df = descargar(demo)
    t = construir_tabla(df)
    hoy = dt.date.today().strftime("%d-%m-%Y")

    estac = [n for n in ["S&P 500", "Nasdaq", "Bitcoin", "Oro"] if n in df]
    tecnico = [n for n in ["Nvidia", "Bitcoin"] if n in df]

    html = f"<html><head><meta charset='utf-8'><title>Mercado {hoy}</title><style>{CSS}</style></head><body>"
    html += f"<h1>Informe de mercado {hoy}</h1>"
    html += "<div class='aviso'>Datos de Yahoo Finance. Es análisis estadístico, no consejo financiero. El pasado no garantiza el futuro.</div>"
    if demo:
        html += "<p><b>MODO DEMO: datos falsos para probar el script.</b></p>"
    html += "<h2>Lectura rápida</h2>" + lectura(t)
    html += "<h2>Tabla resumen</h2>" + tabla_html(t)
    html += "<div class='exp'><b>Cómo leerla:</b> 'Desde máx. 1a' dice cuánto cayó cada activo desde su punto más alto del año. 'Vol. anual' es cuánto se mueve (más alto = más riesgo). RSI sobre 70 = subió muy rápido; bajo 30 = cayó muy rápido. Tendencia 'Alcista' = precio sobre la media de 50 y esta sobre la de 200.</div>"

    html += seccion("1. Quién sube y quién baja", graf_retornos(t),
        "<b>Por qué importa:</b> te muestra a dónde está yendo el dinero. Si todo está naranja, el mercado está vendiendo en general; si solo cae uno, el problema es de ese activo. <b>Ejemplo:</b> si Nvidia cae mucho más que el Nasdaq, la caída es de la empresa, no del mercado.")
    html += seccion("2. Cuánto han caído desde su máximo", graf_drawdown(t),
        "<b>Por qué importa:</b> es la mejor medida de dolor real. Un activo -30% desde su máximo necesita +43% para volver al punto de partida. Esto es justo lo que te pasó con la caída: no subió tu riesgo, pero no tenías un nivel donde salir.")
    html += seccion("3. Comparación del último año", graf_rebase(df, ["S&P 500", "Nasdaq", "Nvidia", "Bitcoin", "Oro"]),
        "<b>Cómo leerlo:</b> todos parten en 100, así que ves cuánto habrías ganado o perdido con cada uno. Las líneas que se separan del resto muestran quién lideró y quién arrastró.")
    html += seccion("4. Estacionalidad: qué meses suelen ser mejores", graf_estacionalidad(df, estac),
        "<b>Cómo leerlo:</b> cada barra es el retorno promedio de ese mes en los últimos ~15 años. El número arriba dice en cuántos años subió. Un mes con promedio positivo y 70%+ de años al alza tiene una tendencia histórica más fuerte; uno con 50% es casi un cara o sello. <b>Ojo:</b> es una tendencia débil, no una regla. Úsala para ajustar el tamaño, no para entrar a ciegas. Bitcoin tiene menos años de historia, así que sus números son menos fiables.")
    html += seccion("5. Gráfico técnico: precio, medias y RSI", graf_tecnico(df, tecnico),
        "<b>Cómo leerlo:</b> la línea verde (media 50) y la naranja (media 200) marcan la tendencia. Precio sobre ambas = tendencia sana; bajo ambas = tendencia rota. Abajo, el RSI: sobre 70 puede venir una pausa, bajo 30 puede venir un rebote, pero en caídas fuertes puede quedarse bajo 30 por semanas. <b>Regla útil:</b> no comprar un activo que está bajo su media de 200 solo porque 'está barato'.")

    html += """<h2>6. Reglas para no devolver las ganancias</h2><div class='exp'><ul>
    <li><b>Stop loss y trailing stop:</b> en XTB puedes ponerle a cada posición un stop que sube a medida que el precio sube. Así, si te desconectas, el mercado te protege.</li>
    <li><b>Tamaño de posición:</b> decide cuánto estás dispuesto a perder por operación (por ejemplo 1% del portafolio) y calcula el tamaño desde ahí.</li>
    <li><b>Reglas por escrito:</b> si el activo cierra bajo su media de 200 días, reduzco; si sube un X%, saco una parte. Se decide antes, no en medio de la caída.</li>
    <li><b>Alertas de precio:</b> las puedes poner tú en TradingView o en Binance para enterarte sin estar mirando todo el día.</li>
    <li><b>Meme coins:</b> mantenlas en un porcentaje pequeño y fijo, que puedas perder completo sin que cambie nada en tu vida.</li></ul></div>"""
    html += "</body></html>"

    with open("informe-mercado.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("Listo: informe-mercado.html (ábrelo con el navegador)")


if __name__ == "__main__":
    main()
