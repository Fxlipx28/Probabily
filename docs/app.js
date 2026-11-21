(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nf = (x, d = 1) => (x == null || isNaN(x)) ? '—' : Number(x).toLocaleString('es-CL', {minimumFractionDigits: d, maximumFractionDigits: d});
const pct = (x, d = 1, sign = true) => (x == null || isNaN(x)) ? '—' : (sign && x > 0 ? '+' : '') + nf(x * 100, d) + '%';
const pc0 = x => pct(x, 0, false);
const cls = x => x > 0 ? 'pos' : x < 0 ? 'neg' : '';
const price = x => x == null ? '—' : nf(x, Math.abs(x) < 1 ? 5 : Math.abs(x) < 100 ? 2 : 0);
const S = {d: null, filtro: 'Todas', orden: {k: 'score', dir: -1}, busca: '', perfil: 'Balanceado', calH: '30'};
let charts = [];
const COL = {up: '#2a9d8f', dn: '#e76f51', acc: '#e9c46a', blue: '#5b8def', mut: '#93a1ba'};

Chart.defaults.color = '#93a1ba';
Chart.defaults.borderColor = 'rgba(255,255,255,.07)';
Chart.defaults.font.family = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
Chart.defaults.animation = false;
Chart.defaults.maintainAspectRatio = false;

function kill() { charts.forEach(c => c.destroy()); charts = []; }
function mk(id, cfg) { const el = document.getElementById(id); if (el) charts.push(new Chart(el, cfg)); }
const act = id => S.d.activos.find(a => a.id === id);
const divColor = (v, esc_ = 1) => v == null ? 'transparent' :
  `rgba(${v >= 0 ? '42,157,143' : '231,111,81'},${Math.min(Math.abs(v) / esc_, 1) * 0.85})`;

// ---------------------------------------------------------------- carga
async function cargar() {
  try {
    const r = await fetch('data/latest.json?' + Date.now());
    S.d = await r.json();
  } catch (e) {
    $('#vista').innerHTML = '<div class="card"><h2>Aún no hay datos</h2><p>Falta generar <code>docs/data/latest.json</code>. ' +
      'Ejecuta <code>python -m pipeline.run --sesion manual</code> o lanza el workflow “Actualizar informe de mercado” en GitHub.</p></div>';
    $('#estado').textContent = 'Sin datos todavía';
    return;
  }
  const d = S.d;
  $('#estado').textContent = `Informe: ${d.sesion.nombre} · generado ${d.generado_chile} (hora de Chile) · último dato de mercado: ${d.fecha_datos} · ${d.n_sims.toLocaleString('es-CL')} escenarios por activo`;
  if (d.demo) { const b = $('#demo'); b.hidden = false; b.textContent = 'DATOS DE DEMOSTRACIÓN: son números inventados para probar la página. Los reales aparecen cuando corre la actualización automática.'; }
  window.addEventListener('hashchange', ruta);
  ruta();
}

function ruta() {
  kill();
  const [vista, arg] = (location.hash.slice(1) || 'hoy').split('/');
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + vista));
  const V = {hoy: vHoy, mercados: vMercados, sim: vSim, estac: vEstac, corr: vCorr, port: vPort, calib: vCalib, informes: vInformes, metodo: vMetodo};
  (V[vista] || vHoy)(arg);
  window.scrollTo(0, 0);
}
const go = id => { location.hash = '#sim/' + id; };

// ---------------------------------------------------------------- componentes
function informeHTML(inf) {
  return `<div class="card"><h2>${esc(inf.titulo)}</h2><ul>${inf.resumen.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
  <div class="grid2">${inf.secciones.map(s => `<div class="card"><h2>${esc(s.titulo)}</h2><ul>${s.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>
  <div class="note warn">${esc(inf.aviso)}</div>`;
}
function gauge(t) {
  return `<h2>Termómetro del mercado</h2><div class="big">${t.valor}<small class="muted"> / 100</small> <span class="tag">${esc(t.etiqueta)}</span></div>
  <div class="gauge"><i style="left:${t.valor}%"></i></div><div class="gauge-l"><span>Aversión al riesgo</span><span>Neutral</span><span>Apetito por riesgo</span></div>
  <ul>${t.detalle.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
}
function rkList(titulo, ids, tipo, desc) {
  const rows = ids.map(id => { const a = act(id); if (!a) return '';
    const v = tipo === 'score' ? nf(a.score, 0) : pc0(a.vol);
    return `<a class="rk" href="#sim/${id}"><span class="n">${esc(a.nombre)}<span class="tag">${esc(a.clase)}</span></span><span class="badge r-${a.riesgo}">${a.riesgo}</span><span class="v">${v}</span></a>`; }).join('');
  return `<div class="card"><h2>${titulo}</h2><p class="muted" style="margin:0 0 6px;font-size:13px">${desc}</p>${rows}</div>`;
}
function tabla(cols, rows, onclick) {
  return `<div class="scroll"><table><thead><tr>${cols.map(c => `<th data-k="${c.k}" class="${c.l ? 'l' : ''}">${c.t}${S.orden.k === c.k ? (S.orden.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(r => `<tr data-id="${r.id}" style="cursor:pointer">${cols.map(c => `<td class="${c.l ? 'l' : ''}">${c.f(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function chips(lista, actual, attr) {
  return `<div class="chips">${lista.map(c => `<span class="chip ${c === actual ? 'on' : ''}" data-${attr}="${esc(c)}">${esc(c)}</span>`).join('')}</div>`;
}

// ---------------------------------------------------------------- HOY
function vHoy() {
  const d = S.d;
  let h = `<div class="grid2"><div class="card">${gauge(d.tono)}</div><div class="card"><h2>${esc(d.informe.titulo)}</h2><ul>${d.informe.resumen.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div><div style="height:14px"></div>`;
  h += `<div class="grid4">${rkList('Mayor puntaje', d.rankings.atractivo.slice(0, 8), 'score', 'Mejor combinación de tendencia, momentum y simulación.')}
    ${rkList('Buen puntaje, riesgo contenido', d.rankings.mejor_ajustado.slice(0, 8), 'score', 'Riesgo bajo o medio y sin tendencia bajista.')}
    ${rkList('Menor riesgo', d.rankings.menor_riesgo.slice(0, 8), 'vol', 'Menor volatilidad anual.')}
    ${rkList('Mayor riesgo', d.rankings.mayor_riesgo.slice(0, 8), 'vol', 'Mayor volatilidad anual.')}</div><div style="height:14px"></div>`;
  if (d.alertas.length) h += `<div class="card"><h2>Alertas</h2><ul>${d.alertas.map(a => `<li><a href="#sim/${a.id}">${esc(a.texto)}</a></li>`).join('')}</ul></div>`;
  h += `<div class="card"><h2>Mapa del día (variación en el último día)</h2>`;
  d.clases.forEach(c => {
    const l = d.activos.filter(a => a.clase === c && a.d1 != null); if (!l.length) return;
    h += `<h3>${esc(c)}</h3><div class="heat">${l.map(a => `<a class="tile" href="#sim/${a.id}" style="background:${divColor(a.d1, 0.04)}"><b>${esc(a.nombre)}</b>${pct(a.d1)}</a>`).join('')}</div>`;
  });
  h += `</div>` + `<div class="grid2">${d.informe.secciones.map(s => `<div class="card"><h2>${esc(s.titulo)}</h2><ul>${s.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div><div class="note warn">${esc(d.informe.aviso)}</div>`;
  $('#vista').innerHTML = h;
}

// ---------------------------------------------------------------- MERCADOS
const COLS = [
  {k: 'nombre', t: 'Activo', l: 1, f: a => `${esc(a.nombre)}<span class="tag">${esc(a.ticker)}</span>`, v: a => a.nombre},
  {k: 'clase', t: 'Clase', l: 1, f: a => esc(a.clase), v: a => a.clase},
  {k: 'precio', t: 'Precio', f: a => price(a.precio), v: a => a.precio},
  {k: 'd1', t: '1 día', f: a => `<span class="${cls(a.d1)}">${pct(a.d1)}</span>`, v: a => a.d1},
  {k: 'w1', t: '1 sem', f: a => `<span class="${cls(a.w1)}">${pct(a.w1)}</span>`, v: a => a.w1},
  {k: 'm1', t: '1 mes', f: a => `<span class="${cls(a.m1)}">${pct(a.m1)}</span>`, v: a => a.m1},
  {k: 'ytd', t: 'Año', f: a => `<span class="${cls(a.ytd)}">${pct(a.ytd)}</span>`, v: a => a.ytd},
  {k: 'vol', t: 'Volat.', f: a => pc0(a.vol), v: a => a.vol},
  {k: 'riesgo', t: 'Riesgo', f: a => `<span class="badge r-${a.riesgo}">${a.riesgo}</span>`, v: a => a.vol},
  {k: 'tendencia', t: 'Tendencia', f: a => `<span class="t-${a.tendencia}">${a.tendencia}</span>`, v: a => ({Alcista: 2, Mixta: 1, Bajista: 0})[a.tendencia]},
  {k: 'rsi', t: 'RSI', f: a => nf(a.rsi, 0), v: a => a.rsi},
  {k: 'p1', t: 'P(sube) 1 día', f: a => pc0(a.mc['1'].p_sube), v: a => a.mc['1'].p_sube},
  {k: 'p30', t: 'P(sube) 1 mes', f: a => pc0(a.mc['30'].p_sube), v: a => a.mc['30'].p_sube},
  {k: 'var', t: 'Pérdida 95% (1 mes)', f: a => pc0(a.mc['30'].var95), v: a => a.mc['30'].var95},
  {k: 'score', t: 'Puntaje', f: a => a.score == null ? '—' : `<b>${nf(a.score, 0)}</b>`, v: a => a.score ?? -1},
];
function vMercados() {
  const d = S.d;
  const draw = () => {
    const col = COLS.find(c => c.k === S.orden.k) || COLS[0];
    let rows = d.activos.filter(a => (S.filtro === 'Todas' || a.clase === S.filtro) &&
      (!S.busca || (a.nombre + ' ' + a.ticker).toLowerCase().includes(S.busca.toLowerCase())));
    rows.sort((a, b) => { const x = col.v(a), y = col.v(b); return (typeof x === 'string' ? x.localeCompare(y) : (x ?? -1e9) - (y ?? -1e9)) * S.orden.dir; });
    $('#tbl').innerHTML = tabla(COLS, rows);
    $('#tbl').querySelectorAll('th').forEach(th => th.onclick = () => { const k = th.dataset.k; S.orden = {k, dir: S.orden.k === k ? -S.orden.dir : -1}; draw(); });
    $('#tbl').querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => go(tr.dataset.id));
  };
  $('#vista').innerHTML = `<div class="card"><h2>Mercados</h2><p class="muted" style="margin-top:0">Toca un encabezado para ordenar y una fila para ver su simulación. “P(sube)” sale de la simulación; “Pérdida 95%” es cuánto podría caer en un mal mes (1 de cada 20).</p>
    <div class="sel"><input id="q" placeholder="Buscar activo…" value="${esc(S.busca)}"></div>${chips(['Todas', ...d.clases], S.filtro, 'c')}<div id="tbl"></div>
    ${d.sin_datos.length ? `<p class="muted" style="font-size:12.5px">Sin datos hoy: ${d.sin_datos.map(x => esc(x.nombre + ' (' + x.ticker + ')')).join(', ')}.</p>` : ''}</div>`;
  $('#q').oninput = e => { S.busca = e.target.value; draw(); };
  document.querySelectorAll('.chip[data-c]').forEach(c => c.onclick = () => { S.filtro = c.dataset.c; vMercados(); });
  draw();
}

// ---------------------------------------------------------------- SIMULADOR
async function vSim(id) {
  const d = S.d;
  id = id || S.ultimo || 'GSPC';
  S.ultimo = id;
  const a = act(id) || d.activos[0];
  const opciones = d.clases.map(c => `<optgroup label="${esc(c)}">${d.activos.filter(x => x.clase === c).map(x => `<option value="${x.id}" ${x.id === a.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</optgroup>`).join('');
  $('#vista').innerHTML = `<div class="card"><div class="sel"><select id="sel">${opciones}</select></div>
    <h2>${esc(a.nombre)} <span class="tag">${esc(a.ticker)} · ${esc(a.clase)}</span></h2><div id="det"><p class="muted">Cargando simulación…</p></div></div>`;
  $('#sel').onchange = e => { location.hash = '#sim/' + e.target.value; };
  let det;
  try { det = await (await fetch(`data/assets/${a.id}.json?` + Date.now())).json(); } catch (e) { $('#det').innerHTML = '<p>No se pudo cargar el detalle.</p>'; return; }
  const mc = a.mc, sim = det.sim;
  const fila = (h, nom) => { const m = mc[h]; return `<tr><td>${nom}</td><td>${pc0(m.p_sube)}</td><td>${pc0(m.p_gana)} <span class="muted">(>+${pc0(m.umbral)})</span></td><td>${pc0(m.p_pierde)} <span class="muted">(<−${pc0(m.umbral)})</span></td><td>${pct(m.p5)} a ${pct(m.p95)}</td><td>${pct(m.p50)}</td><td>${pc0(m.var95)}</td><td>${pc0(m.cvar95)}</td></tr>`; };
  const an = k => { const x = det.analogos[k]; if (!x) return '<li>Sin suficiente historia para este horizonte.</li>';
    return `<li><b>${k === '7' ? 'Semana' : 'Mes'}:</b> en situaciones con ${esc(x.condicion)} subió <b>${pc0(x.p_sube)}</b> de las veces (rango de confianza 95%: ${pc0(x.ic_bajo)}–${pc0(x.ic_alto)}; frecuencia general del activo ${pc0(x.base)}; ≈${nf(x.n_ef, 0)} episodios independientes). Retorno típico en esos casos: ${pct(x.media)}; mal caso (5%): ${pct(x.p5)}.</li>`; };
  const comp = det.score_comp ? Object.entries(det.score_comp).map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><i style="width:${Math.round(v * 140)}px"></i><span style="width:auto">${nf(v, 2)}</span></div>`).join('') : '';
  $('#det').innerHTML = `
    <div class="kpis">
      <div class="kpi"><small>Precio (${esc(a.fecha)})</small><b>${price(a.precio)}</b></div>
      <div class="kpi"><small>1 día / 1 mes</small><b><span class="${cls(a.d1)}">${pct(a.d1)}</span> / <span class="${cls(a.m1)}">${pct(a.m1)}</span></b></div>
      <div class="kpi"><small>Riesgo (volatilidad anual)</small><b>${a.riesgo} · ${pc0(a.vol)}</b></div>
      <div class="kpi"><small>Desde máximo 12 meses</small><b class="neg">${pct(a.dd)}</b></div>
      <div class="kpi"><small>Tendencia · RSI</small><b class="t-${a.tendencia}">${a.tendencia}</b> · ${nf(a.rsi, 0)}</div>
      <div class="kpi"><small>Puntaje (0-100)</small><b>${a.score == null ? '—' : nf(a.score, 0)}</b></div>
    </div>
    <h3>${S.d.n_sims.toLocaleString('es-CL')} escenarios posibles a un mes</h3>
    <p class="muted" style="margin-top:0">Cada línea gris tenue es uno de 40 escenarios simulados. La banda verde cubre el 90% de los casos (clara) y el 50% central (oscura); la línea amarilla es el caso del medio. El eje horizontal son días de mercado.</p>
    <div class="cv"><canvas id="fan"></canvas></div>
    <h3>Probabilidades por horizonte</h3>
    <div class="scroll"><table><thead><tr><th>Horizonte</th><th>Sube</th><th>Gana mucho</th><th>Pierde mucho</th><th>Rango 90%</th><th>Caso medio</th><th>Pérdida 95%</th><th>Pérdida si es muy malo</th></tr></thead><tbody>
      ${fila('1', '1 día')}${fila('7', '1 semana')}${fila('30', '1 mes')}</tbody></table></div>
    <div class="note">Probabilidad de tocar −10% en algún momento del próximo mes: <b>${pc0(mc['30'].p_toca_menos10)}</b>. “Pérdida 95%” = lo que se pierde o más solo 1 de cada 20 veces. “Pérdida si es muy malo” = promedio de ese 5% peor.</div>
    <div class="grid2" style="margin-top:12px"><div><h3>Cómo se reparten los resultados a 1 mes</h3><div class="cv s"><canvas id="hist"></canvas></div></div>
    <div><h3>Último año: precio y medias</h3><div class="cv s"><canvas id="px"></canvas></div></div></div>
    <div class="grid2" style="margin-top:12px"><div><h3>Qué pasó antes en situaciones parecidas</h3><ul>${an('7')}${an('30')}</ul>
      <p class="muted" style="font-size:12.5px">Es historia, no promesa. Si el rango de confianza incluye la frecuencia general, no hay evidencia de ventaja.</p></div>
    <div><h3>Estacionalidad (retorno mensual promedio)</h3><div class="cv s"><canvas id="se"></canvas></div></div></div>
    ${comp ? `<h3>De qué se compone el puntaje</h3>${comp}` : ''}`;
  // fan
  const lab = [...Array(sim.pasos + 1).keys()], B = sim.bandas;
  const ds = sim.caminos.map(c => ({data: c, borderColor: 'rgba(150,170,200,.16)', borderWidth: 1, pointRadius: 0}));
  ds.push({data: B.p5, borderColor: 'rgba(0,0,0,0)', pointRadius: 0});
  ds.push({data: B.p95, borderColor: 'rgba(0,0,0,0)', backgroundColor: 'rgba(42,157,143,.14)', fill: '-1', pointRadius: 0});
  ds.push({data: B.p25, borderColor: 'rgba(0,0,0,0)', pointRadius: 0});
  ds.push({data: B.p75, borderColor: 'rgba(0,0,0,0)', backgroundColor: 'rgba(42,157,143,.30)', fill: '-1', pointRadius: 0});
  ds.push({data: B.p50, borderColor: COL.acc, borderWidth: 2.5, pointRadius: 0});
  mk('fan', {type: 'line', data: {labels: lab, datasets: ds}, options: {plugins: {legend: {display: false}, tooltip: {enabled: false}},
    scales: {y: {ticks: {callback: v => v + '%'}}, x: {ticks: {maxTicksLimit: 8}}}}});
  // hist
  const H = sim.hist, mids = H.cuentas.map((_, i) => (H.bordes[i] + H.bordes[i + 1]) / 2);
  mk('hist', {type: 'bar', data: {labels: mids.map(m => nf(m, 0) + '%'), datasets: [{data: H.cuentas.map(c => c / H.n), backgroundColor: mids.map(m => m >= 0 ? COL.up : COL.dn), borderWidth: 0, barPercentage: 1, categoryPercentage: 1}]},
    options: {plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => nf(c.raw * 100, 1) + '% de los escenarios'}}}, scales: {y: {ticks: {callback: v => nf(v * 100, 0) + '%'}}, x: {ticks: {maxTicksLimit: 7}}}}});
  // precio
  const P = det.historia;
  mk('px', {type: 'line', data: {labels: P.fechas, datasets: [
    {label: 'Precio', data: P.cierre, borderColor: '#e6ecf5', borderWidth: 1.5, pointRadius: 0},
    {label: 'Media 50', data: P.sma50, borderColor: COL.up, borderWidth: 1.5, pointRadius: 0},
    {label: 'Media 200', data: P.sma200, borderColor: COL.dn, borderWidth: 1.5, pointRadius: 0}]},
    options: {plugins: {legend: {labels: {boxWidth: 12}}}, scales: {x: {ticks: {maxTicksLimit: 6}}}}});
  // estacionalidad
  const E = det.estac, meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  mk('se', {type: 'bar', data: {labels: meses, datasets: [{data: E.prom, backgroundColor: E.prom.map(v => v == null ? 'transparent' : v >= 0 ? COL.up : COL.dn), borderWidth: 0}]},
    options: {plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${nf(c.raw, 1)}% promedio · subió ${nf(E.pos[c.dataIndex], 0)}% de los años (n=${E.n[c.dataIndex]})`}}}, scales: {y: {ticks: {callback: v => v + '%'}}}}});
}

// ---------------------------------------------------------------- ESTACIONALIDAD
function vEstac() {
  const d = S.d, meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const mAct = new Date().getMonth();
  const rows = d.estacionalidad.filas.filter(f => S.filtro === 'Todas' || f.clase === S.filtro);
  const h = `<div class="card"><h2>Estacionalidad: qué meses suelen ser mejores</h2>
    <p class="muted" style="margin-top:0">Retorno mensual promedio de los últimos años. Pasa el dedo o el cursor por una celda para ver en cuántos años subió ese mes. Con 10-12 años de historia, un mes “bueno” es una tendencia débil: úsalo para ajustar el tamaño o la paciencia, no para entrar a ciegas. La columna del mes actual está marcada.</p>
    ${chips(['Todas', ...d.clases], S.filtro, 'c')}
    <div class="scroll"><table class="hm"><thead><tr><th>Activo</th>${meses.map((m, i) => `<th class="${i === mAct ? 'neg' : ''}">${m}${i === mAct ? '•' : ''}</th>`).join('')}</tr></thead><tbody>
    ${rows.map(f => `<tr><td><a href="#sim/${f.id}">${esc(f.nombre)}</a></td>${f.prom.map((v, i) => `<td class="c" style="background:${divColor(v, 8)}" title="${v == null ? '' : `Subió ${nf(f.pos[i], 0)}% de los años (n=${f.n[i]})`}">${v == null ? '' : nf(v, 1)}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div></div>`;
  $('#vista').innerHTML = h;
  document.querySelectorAll('.chip[data-c]').forEach(c => c.onclick = () => { S.filtro = c.dataset.c; vEstac(); });
}

// ---------------------------------------------------------------- CORRELACIONES
function vCorr() {
  const C = S.d.correlaciones;
  $('#vista').innerHTML = `<div class="card"><h2>Correlaciones (últimos 2 años, retornos semanales)</h2>
    <p class="muted" style="margin-top:0">Mide si dos activos se mueven juntos. 1 = igual, 0 = sin relación, −1 = opuestos. Para diversificar de verdad busca valores bajos o negativos: si todo tiene 0,8 con todo, tener muchos activos no te protege cuando cae el mercado.</p>
    <div class="scroll"><table class="hm"><thead><tr><th></th>${C.nombres.map(n => `<th class="v">${esc(n)}</th>`).join('')}</tr></thead><tbody>
    ${C.matriz.map((row, i) => `<tr><td>${esc(C.nombres[i])}</td>${row.map(v => `<td class="c" style="background:${divColor(v, 1)}">${v == null ? '' : nf(v, 1)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}

// ---------------------------------------------------------------- PORTAFOLIO
function vPort() {
  const d = S.d, P = d.portafolios, nombres = Object.keys(P);
  if (!nombres.length) { $('#vista').innerHTML = '<div class="card">Sin datos suficientes para armar portafolios.</div>'; return; }
  if (!P[S.perfil]) S.perfil = nombres[0];
  const p = P[S.perfil], m = p.mensual, an = p.anual;
  $('#vista').innerHTML = `<div class="card"><h2>Portafolio modelo mundial</h2>
    <p class="muted" style="margin-top:0">Reparto de ejemplo por perfil de riesgo, distribuido entre clases (bonos, acciones globales, Chile, salmoneras, materias primas, cripto…). Dentro de cada clase se eligen los activos de mayor puntaje y se pondera por menor volatilidad. Es un punto de partida para pensar, no una recomendación personalizada.</p>
    <div class="btns">${nombres.map(n => `<span class="btn ${n === S.perfil ? 'on' : ''}" data-p="${n}">${n}</span>`).join('')}</div>
    <div class="kpis">
      <div class="kpi"><small>Prob. de ganar en 1 mes</small><b>${pc0(m.p_sube)}</b></div>
      <div class="kpi"><small>Rango 90% a 1 mes</small><b>${pct(m.p5)} a ${pct(m.p95)}</b></div>
      <div class="kpi"><small>Pérdida 95% a 1 mes</small><b class="neg">${pc0(m.var95)}</b></div>
      <div class="kpi"><small>Prob. de ganar en 1 año</small><b>${pc0(an.p_sube)}</b></div>
      <div class="kpi"><small>Rango 90% a 1 año</small><b>${pct(an.p5, 0)} a ${pct(an.p95, 0)}</b></div>
      <div class="kpi"><small>Volatilidad anual · caída máx. histórica</small><b>${pc0(p.vol_anual)} · ${pct(p.mdd_hist, 0)}</b></div>
    </div>
    <div class="grid2"><div><h3>Cómo se habría comportado (semanal, base 100)</h3><div class="cv s"><canvas id="cv"></canvas></div></div>
    <div><h3>Resultados simulados a 1 mes</h3><div class="cv s"><canvas id="hp"></canvas></div></div></div>
    <h3>Composición</h3><div class="scroll"><table><thead><tr><th>Activo</th><th class="l">Clase</th><th>Peso</th><th>Riesgo</th><th>Puntaje</th></tr></thead><tbody>
    ${p.pesos.map(w => `<tr style="cursor:pointer" onclick="location.hash='#sim/${w.id}'"><td>${esc(w.nombre)}</td><td class="l">${esc(w.clase)}</td><td><b>${nf(w.peso * 100, 1)}%</b></td><td><span class="badge r-${w.riesgo}">${w.riesgo}</span></td><td>${nf(w.score, 0)}</td></tr>`).join('')}</tbody></table></div>
    ${p.excluidos.length ? `<p class="muted" style="font-size:12.5px">Quedaron fuera por tener muy poca historia: ${p.excluidos.map(esc).join(', ')}.</p>` : ''}
    <div class="note">La simulación vuelve a sortear semanas reales de los últimos ${nf(p.n_semanas / 52, 1)} años manteniendo cómo se mueven los activos entre sí, y descuenta el 75% de la tendencia pasada. Tu portafolio real en XTB y Binance será distinto: usa esto como referencia de cuánto riesgo asume cada perfil.</div></div>`;
  document.querySelectorAll('.btn[data-p]').forEach(b => b.onclick = () => { S.perfil = b.dataset.p; kill(); vPort(); });
  const cu = p.curva;
  mk('cv', {type: 'line', data: {labels: cu.fechas, datasets: [{label: 'Portafolio ' + S.perfil, data: cu.cartera, borderColor: COL.acc, borderWidth: 2, pointRadius: 0}]
    .concat(cu.ref ? [{label: 'S&P 500', data: cu.ref, borderColor: COL.mut, borderWidth: 1.3, pointRadius: 0}] : [])},
    options: {plugins: {legend: {labels: {boxWidth: 12}}}, scales: {x: {ticks: {maxTicksLimit: 6}}}}});
  const H = p.hist, mids = H.cuentas.map((_, i) => (H.bordes[i] + H.bordes[i + 1]) / 2), tot = H.cuentas.reduce((a, b) => a + b, 0);
  mk('hp', {type: 'bar', data: {labels: mids.map(x => nf(x, 0) + '%'), datasets: [{data: H.cuentas.map(c => c / tot), backgroundColor: mids.map(x => x >= 0 ? COL.up : COL.dn), borderWidth: 0, barPercentage: 1, categoryPercentage: 1}]},
    options: {plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => nf(c.raw * 100, 1) + '% de los escenarios'}}}, scales: {y: {ticks: {callback: v => nf(v * 100, 0) + '%'}}, x: {ticks: {maxTicksLimit: 7}}}}});
}

// ---------------------------------------------------------------- CALIBRACIÓN
function vCalib() {
  const c = S.d.calibracion[S.calH] || S.d.calibracion['30'];
  const rows = c.buckets.filter(b => b.n > 0);
  const f = x => x == null ? '—' : pc0(x);
  $('#vista').innerHTML = `<div class="card"><h2>Calibración: ¿qué tan buenas han sido las probabilidades?</h2>
    <p class="muted" style="margin-top:0">Esta es la prueba más importante antes de pensar en automatizar. Se toma el método de “situaciones parecidas” (tendencia y volatilidad), se calcula qué probabilidad de subida habría dado <b>usando solo datos anteriores a cada día</b>, y se compara con lo que pasó de verdad, en todos los activos.</p>
    <div class="btns"><span class="btn ${S.calH === '7' ? 'on' : ''}" data-h="7">1 semana</span><span class="btn ${S.calH === '30' ? 'on' : ''}" data-h="30">1 mes</span></div>
    <div class="kpis"><div class="kpi"><small>Frecuencia general de subidas</small><b>${f(c.base)}</b></div>
      <div class="kpi"><small>Cuando daba ≥60%, subió</small><b>${f(c.desde_60.real)}</b><small>≈${nf(c.desde_60.n_ef, 0)} episodios independientes</small></div>
      <div class="kpi"><small>Cuando daba ≥70%, subió</small><b>${f(c.desde_70.real)}</b><small>≈${nf(c.desde_70.n_ef, 0)} episodios independientes</small></div></div>
    <div class="cv s"><canvas id="cal"></canvas></div>
    <div class="scroll"><table><thead><tr><th>Probabilidad que dio el método</th><th>Casos</th><th>Dio en promedio</th><th>Subió en la realidad</th></tr></thead><tbody>
    ${rows.map(b => `<tr><td>${pc0(b.desde)}–${pc0(b.hasta)}</td><td>${b.n.toLocaleString('es-CL')}</td><td>${f(b.pred)}</td><td><b>${f(b.real)}</b></td></tr>`).join('')}</tbody></table></div>
    <div class="note">Cómo leerlo: si el método fuera muy bueno, la columna “Subió en la realidad” crecería junto con “Dio en promedio”. Si es casi plana, la probabilidad que ves no aporta ventaja y operar solo con eso (o automatizarlo) no tiene respaldo. Los casos se traslapan en el tiempo, por eso el número de episodios independientes es mucho menor que el de casos.</div>
    <div class="note warn">Para automatizar con Binance más adelante: antes de dar acceso real, prueba en modo simulado (testnet) durante semanas, usa una API con permiso de operar pero <b>sin permiso de retiro</b>, arriesga montos pequeños y define una pérdida máxima diaria que apague el sistema.</div></div>`;
  document.querySelectorAll('.btn[data-h]').forEach(b => b.onclick = () => { S.calH = b.dataset.h; kill(); vCalib(); });
  mk('cal', {type: 'bar', data: {labels: rows.map(b => pc0(b.desde) + '–' + pc0(b.hasta)), datasets: [
    {label: 'Dio el método', data: rows.map(b => b.pred), backgroundColor: COL.blue}, {label: 'Subió en la realidad', data: rows.map(b => b.real), backgroundColor: COL.acc}]},
    options: {plugins: {legend: {labels: {boxWidth: 12}}}, scales: {y: {min: 0, max: 1, ticks: {callback: v => pc0(v)}}}}});
}

// ---------------------------------------------------------------- INFORMES
async function vInformes(arg) {
  $('#vista').innerHTML = '<div class="card"><h2>Historial de informes</h2><div id="lst"><p class="muted">Cargando…</p></div></div><div id="inf"></div>';
  let idx = [];
  try { idx = await (await fetch('data/informes/indice.json?' + Date.now())).json(); } catch (e) { /* sin historial */ }
  $('#lst').innerHTML = idx.length ? idx.slice(0, 40).map(i => `<a class="rk" href="#informes/${i.archivo}"><span class="n">${esc(i.titulo)}${i.demo ? ' (demo)' : ''}</span><span class="v">${i.tono}/100</span></a>`).join('') : '<p class="muted">Aún no hay informes guardados.</p>';
  const archivo = arg || (idx[0] && idx[0].archivo);
  if (!archivo) return;
  try {
    const r = await (await fetch('data/informes/' + archivo + '?' + Date.now())).json();
    $('#inf').innerHTML = informeHTML(r.informe);
  } catch (e) { $('#inf').innerHTML = ''; }
}

// ---------------------------------------------------------------- MÉTODO
function vMetodo() {
  $('#vista').innerHTML = `<div class="card"><h2>Cómo funciona (y qué no hace)</h2>
  <h3>Datos</h3><p>Precios diarios de Yahoo Finance (≈12 años). La página se actualiza sola con GitHub Actions antes de la apertura de Tokio, Europa, Santiago y Nueva York, y tras el cierre de Wall Street; los fines de semana hay un informe cripto. Los futuros del S&P 500 y Nasdaq sirven de pista antes de la apertura.</p>
  <h3>Escenarios simulados (Monte Carlo)</h3><p>Para cada activo se simulan ${S.d.n_sims.toLocaleString('es-CL')} futuros posibles. Se toman los retornos diarios pasados, se normalizan por la volatilidad de ese momento y se sortean con reposición; luego se reescalan con una volatilidad simulada que sube después de sustos y baja en calma (tipo GARCH). Así las caídas bruscas, que son más frecuentes que en una campana normal, quedan representadas. La <b>deriva</b> (tendencia esperada) es solo el 25% de la histórica y está limitada, para no tratar un mercado alcista pasado como una promesa. De los escenarios salen: probabilidad de subir, rango del 90% de los casos, pérdida 95% (VaR), pérdida promedio del peor 5% (CVaR) y probabilidad de tocar −10%.</p>
  <h3>Situaciones parecidas</h3><p>Se buscan en la historia del mismo activo los días con igual tendencia (precio vs. medias de 50 y 200 días) y volatilidad relativa, y se mide cuántas veces subió después. Se muestra con rango de confianza y se compara con la frecuencia general; si no la supera con claridad, no hay ventaja demostrada.</p>
  <h3>Puntaje (0-100)</h3><p>30% tendencia, 25% momentum (3 y 6 meses, relativo al resto), 20% retorno por unidad de riesgo del último año, 15% probabilidad simulada de subir en un mes, 10% cercanía al máximo; se reduce hasta un 50% si el RSI supera 70 (sobrecompra). Mide lo que viene pasando, no lo que va a pasar. No incluye precios “baratos”, balances de empresas ni noticias.</p>
  <h3>Riesgo</h3><p>Según la volatilidad anual de los últimos 60 días: Bajo (&lt;12%), Medio (12–25%), Alto (25–45%), Muy alto (&gt;45%). Los activos “Muy alto” (muchas cripto, todas las memecoins) pueden perder la mitad de su valor.</p>
  <h3>Calibración</h3><p>Se prueba el método en el pasado usando solo datos previos a cada día. Revisa esa pestaña: es la evidencia de cuánto se puede confiar en las probabilidades.</p>
  <h3>Límites</h3><ul><li>No considera calendario económico, noticias, resultados de empresas ni feriados.</li><li>No incluye flujos de ballenas on-chain ni de ETFs (requieren fuentes de pago o verificación manual); solo Fear &amp; Greed y financiamiento de futuros cuando están disponibles.</li><li>Un ticker sin datos aparece listado en “Mercados” y se omite sin afectar el resto.</li><li>Las cripto de mucha volatilidad pueden producir probabilidades que cambian rápido.</li></ul>
  <div class="note warn">Esto es una herramienta para leer el mercado y apoyar tus decisiones. No es asesoría financiera.</div></div>`;
}

// ---------------------------------------------------------------- arranque
cargar();
})();
