(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf = (x, d = 1) => (x == null || isNaN(x)) ? '—' : Number(x).toLocaleString('es-CL', {minimumFractionDigits: d, maximumFractionDigits: d});
const pct = (x, d = 1, sign = true) => (x == null || isNaN(x)) ? '—' : (sign && x > 0 ? '+' : '') + nf(x * 100, d) + '%';
const pc0 = x => pct(x, 0, false);
const cls = x => x > 0 ? 'pos' : x < 0 ? 'neg' : '';
const price = x => x == null ? '—' : nf(x, Math.abs(x) < 1 ? 5 : Math.abs(x) < 100 ? 2 : 0);
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '#';
const CFG = window.CFG || {};
const LOCAL = ['localhost', '127.0.0.1', ''].includes(location.hostname);
const BASES = LOCAL ? ['data/'] : [CFG.datos, 'data/'].filter(Boolean);
const RAPIDO = LOCAL ? ['data/rapido.json'] : [CFG.rapido, 'data/rapido.json'].filter(Boolean);
const HZ = {'1': 'Mañana (1 día)', '7': '1 semana', '30': '1 mes'};
const HZS = {'1': '1 día', '7': '1 semana', '30': '1 mes'};
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const COL = {up: '#2dc38a', dn: '#ef5f6b', acc: '#e5b94e', blue: '#7aa2f7', vi: '#e5b94e', mut: '#8b93a1'};

const S = {d: null, r: null, base: BASES[0], live: {}, filtro: 'Todas', orden: {k: 'score', dir: -1}, busca: '', perfil: 'Balanceado', calH: '30',
  mapa: 'Mundo', hz: '1', mqOrden: 'sube', mqId: null, nCat: 'Todas', nSent: 'Todas', nBusca: '', nAct: null, fav: [], vista: 'hoy'};
try { S.fav = JSON.parse(localStorage.getItem('lm_fav') || '[]'); } catch (e) { S.fav = []; }
const saveFav = () => { try { localStorage.setItem('lm_fav', JSON.stringify(S.fav)); } catch (e) { /* sin almacenamiento */ } };
const isFav = id => S.fav.includes(id);
const toggleFav = id => { S.fav = isFav(id) ? S.fav.filter(x => x !== id) : [...S.fav, id]; saveFav(); };

Chart.defaults.color = '#8b93a1';
Chart.defaults.borderColor = 'rgba(255,255,255,.07)';
Chart.defaults.font.family = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
Chart.defaults.animation = false;
Chart.defaults.maintainAspectRatio = false;
let charts = [];
const kill = () => { charts.forEach(c => c.destroy()); charts = []; };
const mk = (id, cfg) => { const el = document.getElementById(id); if (el) charts.push(new Chart(el, cfg)); };
const act = id => S.d.activos.find(a => a.id === id);
const divColor = (v, e = 1) => v == null ? 'transparent' : `rgba(${v >= 0 ? '45,195,138' : '239,95,107'},${Math.min(Math.abs(v) / e, 1) * 0.7})`;
const ago = iso => { const m = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000); if (isNaN(m)) return ''; if (m < 60) return `hace ${Math.round(m)} min`; if (m < 1440) return `hace ${Math.round(m / 60)} h`; return `hace ${Math.round(m / 1440)} d`; };

async function getJSON(rel, bases = BASES) {
  let err;
  for (const b of bases) {
    try { const r = await fetch(b + rel + '?' + Date.now()); if (r.ok) return {j: await r.json(), base: b}; err = new Error(r.status); } catch (e) { err = e; }
  }
  throw err;
}


// ---------------------------------------------------------------- analítica (opcional, sin cookies; se activa en config.js)
(function analitica() {
  const A = CFG.analytics || {};
  const add = (src, attrs) => { const s = document.createElement('script'); s.defer = true; s.src = src; Object.entries(attrs || {}).forEach(([k, v]) => s.setAttribute(k, v)); document.head.appendChild(s); };
  if (LOCAL) return;
  if (A.plausible) add('https://plausible.io/js/script.hash.js', {'data-domain': A.plausible});
  if (A.goatcounter) add('https://gc.zgo.at/count.js', {'data-goatcounter': `https://${A.goatcounter}.goatcounter.com/count`, 'data-goatcounter-settings': '{"no_onload":true}'});
  window.__vista = v => { try { if (A.goatcounter && window.goatcounter && window.goatcounter.count) window.goatcounter.count({path: '/' + v, title: v}); } catch (e) { /* sin analítica */ } };
})();

// ---------------------------------------------------------------- iconos / navegación
const IC = {
  hoy: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  manana: 'M12 3v3M5 12H3M21 12h-2M6.3 6.3L4.9 4.9M17.7 6.3l1.4-1.4M7 16a5 5 0 1 1 10 0M3 20h18',
  noticias: 'M4 5h13v14H6a2 2 0 0 1-2-2V5zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5',
  radar: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 12l6-6M12 3a9 9 0 1 0 9 9',
  mercados: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  sim: 'M3 17l5-6 4 3 4-7 5 5M3 21h18',
  estac: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  corr: 'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z',
  port: 'M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z',
  calib: 'M12 3v18M3 12h18M7 7l10 10',
  hist: 'M4 4v16h16M8 15l3-4 3 2 5-7',
  lista: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  cuenta: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  metodo: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.1',
};
const NAV = [
  ['Panel', [['hoy', 'Hoy'], ['manana', 'Mañana', 'NUEVO'], ['noticias', 'Noticias', 'NUEVO'], ['radar', 'Radar cripto', 'NUEVO'], ['hist', 'Historial', 'ÚNICO']]],
  ['Análisis', [['mercados', 'Mercados'], ['sim', 'Simulador'], ['estac', 'Estacionalidad'], ['corr', 'Correlaciones'], ['port', 'Portafolio'], ['calib', 'Calibración']]],
  ['Mío', [['lista', 'Mi lista'], ['cuenta', 'Cuenta']]],
  ['Info', [['metodo', 'Método']]],
];
$('#nav').innerHTML = NAV.map(([g, items]) => `<div class="ng">${g}</div>` + items.map(([k, t, b]) =>
  `<a class="nv" href="#${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${IC[k]}"/></svg>${t}${b ? `<span class="new">${b}</span>` : ''}</a>`).join('')).join('');

// ---------------------------------------------------------------- componentes visuales
function spark(arr, w = 90, h = 28) {
  if (!arr || arr.length < 2) return '';
  const mn = Math.min(...arr), mx = Math.max(...arr), rg = (mx - mn) || 1;
  const pts = arr.map((v, i) => `${(i / (arr.length - 1) * w).toFixed(1)},${(h - 2 - (v - mn) / rg * (h - 4)).toFixed(1)}`).join(' ');
  const c = arr[arr.length - 1] >= arr[0] ? COL.up : COL.dn;
  return `<svg class="spk" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function pbar(p) {
  const u = Math.round(p * 100);
  return `<div class="pb"><i class="u" style="width:${u}%"></i><i class="d" style="width:${100 - u}%"></i></div><div class="pbt"><span class="u">▲ ${u}%</span><span class="d">▼ ${100 - u}%</span></div>`;
}
function gauge(t, sm) {
  const L = Math.PI * 90, f = Math.max(0, Math.min(100, t.valor)) / 100;
  return `<h2>Termómetro del mercado</h2><div class="gwrap">
    <svg class="gsvg" viewBox="0 0 200 118"><defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="#ef5f6b"/><stop offset=".5" stop-color="#e5b94e"/><stop offset="1" stop-color="#2dc38a"/></linearGradient></defs>
      <path d="M10 104A90 90 0 0 1 190 104" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="16" stroke-linecap="round"/>
      <path d="M10 104A90 90 0 0 1 190 104" fill="none" stroke="url(#gg)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${(L * f).toFixed(1)} ${L.toFixed(1)}"/>
      <text class="gtx" x="100" y="92" text-anchor="middle">${t.valor}</text><text x="100" y="112" text-anchor="middle" fill="#8b93a1" font-size="12">${esc(t.etiqueta)}</text></svg>
    <div><div class="glab">0 = miedo · 100 = apetito por riesgo</div></div></div>
    ${sm ? '' : `<ul>${t.detalle.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`}`;
}
function hero(kick, titulo, texto) {
  return `<div class="hero"><span class="kick">${esc(kick)}</span><h1>${titulo}</h1>${texto ? `<p>${texto}</p>` : ''}</div>`;
}
function rk(a, tipo) {
  const v = tipo === 'score' ? nf(a.score, 0) : tipo === 'vol' ? pc0(a.vol) : tipo;
  return `<a class="rk" href="#sim/${a.id}"><span class="i">${esc((a.ticker || '').slice(0, 2))}</span><span class="n">${esc(a.nombre)}<span class="tag">${esc(a.clase)}</span></span><span class="badge r-${a.riesgo}">${a.riesgo}</span><span class="v">${v}</span></a>`;
}
function rkCard(titulo, desc, lista, tipo) {
  return `<div class="card"><h2>${titulo}</h2><p class="muted" style="margin:0 0 6px;font-size:13px">${desc}</p>${lista.map(a => rk(a, typeof tipo === 'function' ? tipo(a) : tipo)).join('') || '<p class="muted">Sin datos.</p>'}</div>`;
}
function chipsH(lista, actual, attr) {
  return `<div class="chips">${lista.map(c => `<span class="chip ${c === actual ? 'on' : ''}" data-${attr}="${esc(c)}">${esc(c)}</span>`).join('')}</div>`;
}
const star = id => `<button class="star ${isFav(id) ? 'on' : ''}" data-fav="${id}" title="Agregar o quitar de Mi lista">${isFav(id) ? '★' : '☆'}</button>`;
function bindFav(rerender) {
  $$('[data-fav]').forEach(b => b.onclick = e => { e.stopPropagation(); e.preventDefault(); toggleFav(b.dataset.fav); rerender ? rerender() : ruta(true); });
}
function newsCard(n) {
  const sent = n.sentimiento || 'neutral';
  const tags = (n.activos || []).slice(0, 4).map(id => { const a = act(id); return a ? `<a class="pill" href="#sim/${esc(id)}">${esc(a.nombre)}</a>` : ''; }).join('') +
    (n.temas || []).slice(0, 3).map(t => `<span class="pill">${esc(t)}</span>`).join('');
  return `<div class="news">
    <div class="nm1"><span class="src">${esc(n.fuente)}</span><span>${ago(n.fecha)}</span><span class="cat">${esc(n.categoria)}</span><span class="sent s-${esc(sent)}">${esc(sent)}</span></div>
    <h3><a href="${esc(safeUrl(n.enlace))}" target="_blank" rel="noopener noreferrer">${esc(n.titulo)} <span class="muted">↗</span></a></h3>${tags ? `<div class="nt">${tags}</div>` : ''}</div>`;
}
const sinNoticias = () => '<div class="card"><h2>Noticias</h2><p class="muted">Todavía no hay noticias publicadas. Aparecen cuando corre la actualización de noticias (cada 30 minutos en GitHub Actions).</p></div>';

// ---------------------------------------------------------------- carga
async function cargar() {
  try {
    const r = await getJSON('latest.json');
    S.d = r.j; S.base = r.base;
  } catch (e) {
    $('#vista').innerHTML = '<div class="card"><h2>Aún no hay datos</h2><p>No se pudo leer <code>latest.json</code>. Lanza el workflow “Actualizar informe de mercado” en GitHub (pestaña Actions) o ejecuta <code>python -m pipeline.run --sesion manual</code>.</p></div>';
    $('#estado').textContent = 'Sin datos todavía';
    return;
  }
  encabezado();
  await cargarRapido();
  window.addEventListener('hashchange', () => ruta());
  ruta();
  cinta();
  conectarBinance();
  setInterval(refrescar, 3 * 60 * 1000);
}
async function cargarRapido() {
  S.r = null; S.p = null; let base = null;
  for (const u of RAPIDO) {
    try { const r = await fetch(u + '?' + Date.now()); if (r.ok) { S.r = await r.json(); base = u.replace(/rapido\.json$/, ''); break; } } catch (e) { /* siguiente fuente */ }
  }
  if (base !== null) { try { const r = await fetch(base + 'precios.json?' + Date.now()); if (r.ok) S.p = await r.json(); } catch (e) { /* sin precios rápidos */ } }
  aplicarPrecios();
}
// Los precios rápidos (cada ~10 min) reemplazan precio y variación del último informe si son más recientes.
function aplicarPrecios() {
  if (!S.p || !S.d || new Date(S.p.generado_utc) < new Date(S.d.generado_utc)) return;
  S.d.activos.forEach(a => { const v = S.p.p[a.id]; if (v) { a.precio = v[0]; a.d1 = v[1]; } });
}
function encabezado() {
  const d = S.d;
  const rr = (S.p ? ` · precios ${ago(S.p.generado_utc)}` : '') + (S.r ? ` · noticias ${ago(S.r.generado_utc)}` : '');
  $('#estado').innerHTML = `<span><span class="dot"></span>Informe: <b>${esc(d.sesion.nombre)}</b> · ${esc(d.generado_chile)} (hora de Chile)</span><span>Último dato de mercado: ${esc(d.fecha_datos)}</span><span>${d.n_sims.toLocaleString('es-CL')} escenarios por activo${rr}</span>`;
  const b = $('#demo');
  if (d.demo) { b.hidden = false; b.textContent = 'DATOS DE DEMOSTRACIÓN: números inventados para probar la página. Los reales aparecen cuando corre la actualización automática.'; } else b.hidden = true;
}
async function refrescar() {
  try {
    const r = await getJSON('latest.json', [S.base]);
    if (r.j.generado_utc !== S.d.generado_utc) { S.d = r.j; }
  } catch (e) { /* se reintenta en 5 minutos */ }
  await cargarRapido();
  encabezado();
  cinta();
  if (['hoy', 'manana', 'mercados', 'noticias', 'radar', 'lista'].includes(S.vista) && !document.activeElement?.matches?.('input,select,textarea')) ruta(true);
}

function ruta(keep) {
  kill();
  const [vista, arg] = (location.hash.slice(1) || 'hoy').split('/');
  S.vista = vista;
  if (!keep && window.__vista) window.__vista(vista);
  $$('#nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + vista));
  const V = {hoy: vHoy, manana: vManana, noticias: vNoticias, radar: vRadar, mercados: vMercados, sim: vSim, estac: vEstac, corr: vCorr, port: vPort, calib: vCalib, hist: vHist, lista: vLista, cuenta: vCuenta, metodo: vMetodo};
  (V[vista] || vHoy)(arg);
  if (!keep) window.scrollTo(0, 0);
}
const go = id => { location.hash = '#sim/' + id; };

// ---------------------------------------------------------------- cinta + cripto en vivo
const CINTA = ['^GSPC', '^IXIC', '^DJI', '^STOXX50E', '^N225', 'ECH', 'BTC-USD', 'ETH-USD', 'SOL-USD', 'GC=F', 'CL=F', 'HG=F', 'EURUSD=X', 'USDCLP=X', '^VIX'];
function cinta() {
  const items = CINTA.map(t => S.d.activos.find(a => a.ticker === t)).filter(Boolean);
  if (!items.length) { $('#tape').hidden = true; return; }
  const una = items.map(a => `<span class="tk" data-t="${a.id}"><b>${esc(a.nombre)}</b><span class="lv-p">${price(a.precio)}</span><em class="${cls(a.d1)}">${pct(a.d1, 2)}</em></span>`).join('');
  $('#tape').innerHTML = `<div class="rail">${una}${una}</div>`;
}
function pintarVivo(id) {
  const v = S.live[id]; if (!v) return;
  $$(`.tk[data-t="${id}"]`).forEach(el => { el.querySelector('.lv-p').textContent = price(v.p); const e = el.querySelector('em'); if (v.ch != null) { e.textContent = pct(v.ch, 2); e.className = cls(v.ch); } });
  $$(`[data-live="${id}"]`).forEach(el => { el.textContent = price(v.p); });
}
function conectarBinance() {
  const mapa = {};
  S.d.activos.filter(a => /^[A-Z]{2,6}-USD$/.test(a.ticker) && ['Cripto', 'Memecoins', 'Cripto nuevas'].includes(a.clase)).forEach(a => { mapa[a.ticker.replace('-USD', '').toLowerCase() + 'usdt'] = a.id; });
  const syms = Object.keys(mapa); if (!syms.length || !('WebSocket' in window)) return;
  let ws, espera = 3000;
  const abrir = () => {
    try { ws = new WebSocket('wss://stream.binance.com:9443/stream?streams=' + syms.map(s => s + '@miniTicker').join('/')); } catch (e) { return; }
    ws.onopen = () => { espera = 3000; };
    ws.onmessage = m => {
      try {
        const x = JSON.parse(m.data).data; if (!x || !x.s) return;
        const id = mapa[x.s.toLowerCase()]; if (!id) return;
        const p = parseFloat(x.c), o = parseFloat(x.o);
        S.live[id] = {p, ch: o ? p / o - 1 : null}; pintarVivo(id);
      } catch (e) { /* mensaje inválido */ }
    };
    ws.onclose = () => { setTimeout(abrir, espera); espera = Math.min(espera * 2, 60000); };
    ws.onerror = () => { try { ws.close(); } catch (e) { /* ya cerrado */ } };
  };
  abrir();
}

// ---------------------------------------------------------------- HOY
const MAPAS = [['Mundo', ['Índices']], ['EE.UU.', ['Acciones EE.UU.', 'ETFs']], ['Global', ['Acciones globales']], ['Chile', ['Chile', 'Salmoneras']],
  ['Materias primas', ['Materias primas']], ['Cripto', ['Cripto', 'Cripto nuevas', 'Memecoins']], ['Divisas y bonos', ['Divisas', 'Bonos']]];
function mapaHTML() {
  const d = S.d, g = MAPAS.find(m => m[0] === S.mapa) || MAPAS[0];
  const l = d.activos.filter(a => g[1].includes(a.clase) && a.d1 != null).sort((x, y) => y.d1 - x.d1);
  const sube = l.filter(a => a.d1 > 0).length, prom = l.length ? l.reduce((s, a) => s + a.d1, 0) / l.length : null;
  return `<div class="chips">${MAPAS.map(m => `<span class="chip ${m[0] === g[0] ? 'on' : ''}" data-mapa="${esc(m[0])}">${esc(m[0])}</span>`).join('')}</div>
    <p class="muted" style="margin:0 0 8px;font-size:12.5px">${l.length} activos · <span class="pos">${sube} suben</span> · <span class="neg">${l.length - sube} bajan</span> · promedio <b class="${cls(prom)}">${pct(prom, 2)}</b></p>
    <div class="heat">${l.map(a => `<a class="tile" href="#sim/${a.id}" style="background:${divColor(a.d1, 0.04)}"><b>${esc(a.nombre)}</b>${pct(a.d1)}</a>`).join('') || '<span class="muted">Sin datos.</span>'}</div>`;
}
function vHoy() {
  const d = S.d, rk_ = d.activos.filter(a => a.rankeable);
  const kp = ['^GSPC', '^IXIC', 'BTC-USD', 'GC=F', 'USDCLP=X', '^VIX'].map(t => d.activos.find(a => a.ticker === t)).filter(Boolean);
  const top = (h, dir) => [...rk_].sort((a, b) => dir * (b.mc[h].p_sube - a.mc[h].p_sube)).slice(0, 4);
  const tg = d.tono;
  let h = `<div class="hero sm"><span class="kick">Panel del mercado</span><h1>Hoy y <span class="grad">mañana</span></h1><p>${esc(d.manana.texto)}</p></div>`;
  h += `<div class="kpis sm">${kp.map(a => `<a class="kpi" href="#sim/${a.id}"><small>${esc(a.nombre)}</small><b data-live="${a.id}">${price(a.precio)}</b><span class="c ${cls(a.d1)}">${pct(a.d1, 2)}</span>${spark(a.spark, 56, 22)}</a>`).join('')}</div>`;
  const rkc = (t, l, tipo) => `<div class="card sm"><h2>${t}</h2><div class="fill">${l.map(a => rk(a, tipo)).join('')}</div></div>`;
  const top5 = (dir) => [...rk_].sort((x, y) => dir * (y.mc['1'].p_sube - x.mc['1'].p_sube)).slice(0, 5);
  h += `<div class="grid3 eq">
    <div class="card sm glow"><div class="fill">${gauge(tg, true)}</div></div>
    <div class="card sm"><h2>Resumen</h2><div class="fill">${resumenHTML(d.informe.resumen)}</div></div>
    <div class="card sm"><h2>Alertas</h2><div class="fill">${d.alertas.length ? alertasHTML(d.alertas.slice(0, 4)) : '<p class="muted">Sin alertas.</p>'}</div></div></div>
  <div class="grid2 eq">
    <div class="card sm glow"><h2>Mañana en una mirada <span class="sub">prob. a 1 día</span></h2>
      <div class="grid2 in fill"><div><h3 class="pos">▲ Suben</h3>${top5(1).map(a => rk(a, pc0(a.mc['1'].p_sube))).join('')}</div><div><h3 class="neg">▼ Bajan</h3>${top5(-1).map(a => rk(a, pc0(1 - a.mc['1'].p_sube))).join('')}</div></div>
      <div class="btns"><a class="btn pri" href="#manana">Ver todos →</a></div></div>
    <div class="card sm"><h2>Últimas noticias <span class="sub">${S.r ? ago(S.r.generado_utc) : ''}</span></h2><div class="fill">${S.r && S.r.noticias.length ? S.r.noticias.slice(0, 5).map(n => `<a class="nrow" href="${esc(safeUrl(n.enlace))}" target="_blank" rel="noopener noreferrer"><span class="src">${esc(n.fuente)}</span>${esc(n.titulo)}</a>`).join('') : '<p class="muted">Sin noticias aún.</p>'}</div>
      <div class="btns"><a class="btn" href="#noticias">Ver todas →</a></div></div></div>
  <div class="grid4 eq">${rkc('Mayor puntaje', d.rankings.atractivo.slice(0, 4).map(act).filter(Boolean), 'score')}
    ${rkc('Puntaje y riesgo contenido', d.rankings.mejor_ajustado.slice(0, 4).map(act).filter(Boolean), 'score')}
    ${rkc('Menor riesgo', d.rankings.menor_riesgo.slice(0, 4).map(act).filter(Boolean), 'vol')}
    ${rkc('Mayor riesgo', d.rankings.mayor_riesgo.slice(0, 4).map(act).filter(Boolean), 'vol')}</div>`;
  h += `<div class="card sm"><h2>Mapa del día <span class="sub">variación en el último día</span></h2><div id="mapa">${mapaHTML()}</div></div>`;
  h += `<details class="card sm" id="inf"><summary>Informe completo <span class="sub">${esc(d.informe.titulo)}</span></summary><div id="infb">${informeHTML()}</div></details>`;
  $('#vista').innerHTML = h;
  const ligar = () => $$('.chip[data-mapa]').forEach(c => c.onclick = () => { S.mapa = c.dataset.mapa; $('#mapa').innerHTML = mapaHTML(); ligar(); });
  ligar();
  const ligarInf = () => $$('[data-inf]').forEach(c => c.onclick = () => { S.inf = +c.dataset.inf; $('#infb').innerHTML = informeHTML(); ligarInf(); });
  ligarInf();
}
function alertasHTML(l) {
  return `<div class="als">${l.map(x => {
    const t = String(x.texto), m = t.match(/^(.*?) se movió ([+\-−]?\d+(?:[.,]\d+)?)%/), k = t.match(/más de (\d+) veces/);
    if (!m) return `<a class="al" href="#sim/${x.id}"><span class="an">${esc(t)}</span></a>`;
    const v = parseFloat(m[2].replace(',', '.'));
    return `<a class="al" href="#sim/${x.id}"><span class="an">${esc(m[1])}<small>${k ? 'más de ' + k[1] + '× lo normal en 1 día' : 'movimiento inusual en 1 día'}</small></span><span class="ap ${v >= 0 ? 'up' : 'dn'}">${v >= 0 ? '+' : ''}${m[2].replace('-', '−')}%</span></a>`;
  }).join('')}</div>`;
}
function resumenHTML(res) {
  const fr = res.join(' ').split(/\.\s+(?=[A-ZÁÉÍÓÚ])/).map(s => s.replace(/\.$/, '')).filter(Boolean).slice(0, 4);
  const num = t => { let m = t.match(/\((\d+)\/100\)/) || t.match(/(?:subir|alcista)\D{0,12}?(\d+)%/) || t.match(/^[^:]*:\s*(\d+)%/); return m ? +m[1] : null; };
  const cl = v => v >= 60 ? 'up' : v <= 40 ? 'dn' : 'wn';
  return `<div class="rsm">${fr.map(s => {
    const m = s.match(/^([^:]{2,30}):\s+(.*)$/) || s.match(/^(.{2,24}?)\s+(?:está|en)\s+(.*)$/), lab = m ? m[1] : s.split(' ').slice(0, 2).join(' '), txt = m ? m[2] : s;
    let v = num(txt) ?? num(s), c = null;
    const vx = /VIX/i.test(lab) && txt.match(/(\d+(?:[.,]\d+)?)/), md = txt.match(/(\d+(?:[.,]\d+)?)%\s+(bajo|sobre|por encima de|por debajo de)/);
    if (vx) { const n = parseFloat(vx[1].replace(',', '.')); v = n * 2; c = n < 20 ? 'up' : n < 28 ? 'wn' : 'dn'; }
    else if (md) { const n = parseFloat(md[1].replace(',', '.')); v = Math.max(8, n * 6); c = /bajo|debajo/.test(md[2]) ? 'dn' : 'up'; }
    const t = esc(txt).replace(/(\d+(?:[.,]\d+)?(?:\/100|%)?)/g, '<b>$1</b>');
    return `<div class="rs"><div class="rl">${esc(lab)}</div><div class="rt">${t}</div>${v !== null ? `<div class="rbar"><i class="${c || cl(v)}" style="width:${Math.min(100, v)}%"></i></div>` : ''}</div>`;
  }).join('')}</div>`;
}
const INF_CORTO = ['Qué mirar', 'Más atractivo', 'Buen puntaje, bajo riesgo', 'Riesgo', 'Cripto', 'Confiabilidad', 'Límites'];
const INF_ICO = ['👁', '⭐', '⚖️', '⚠️', '₿', '🎯', 'ℹ️'];
function infItem(x) {
  x = String(x);
  const m = x.match(/^((?:[^:.(]|\([^)]*\)){2,60}):\s+(.*)$/s);
  const col = t => esc(t).replace(/([+\-−]\d+(?:[.,]\d+)?%)/g, (q) => `<span class="${/^\+/.test(q) ? 'pos' : 'neg'}">${q}</span>`).replace(/(\d+\/100)/g, '<b>$1</b>');
  if (!m) return `<li>${col(x)}</li>`;
  const partes = m[2].split(/;\s+|,\s+(?=probabilidad|riesgo|tendencia)|\.\s+(?=[A-ZÁÉÍÓÚ])/).filter(Boolean);
  const pj = x.match(/puntaje (\d+)\/100/), pr = x.match(/subir en un mes (\d+)%/);
  const bar = pj ? `<div class="rbar"><i class="${+pj[1] >= 70 ? 'up' : +pj[1] >= 40 ? 'wn' : 'dn'}" style="width:${pj[1]}%"></i></div>` : '';
  return `<li class="ii"><b class="ih">${esc(m[1])}${pj ? `<span class="big">${pj[1]}</span>` : ''}</b>${bar}${partes.length > 1 ? `<div class="chips2">${partes.map(p => `<span>${col(p.replace(/\.$/, ''))}</span>`).join('')}</div>` : `<span class="it">${col(m[2])}</span>`}</li>`;
}
function informeHTML() {
  const sec = S.d.informe.secciones, k = Math.min(S.inf || 0, sec.length - 1), s = sec[k];
  return `<div class="infnav">${sec.map((q, n) => `<button class="chip ${n === k ? 'on' : ''}" data-inf="${n}">${INF_ICO[n] || '•'} ${INF_CORTO[n] || esc(q.titulo.slice(0, 24))}</button>`).join('')}</div>
    <div class="infsec"><h3>${INF_ICO[k] || ''} ${esc(s.titulo)}</h3><ul class="inflist">${s.items.map(infItem).join('')}</ul></div>
    <div class="note">${esc(S.d.informe.aviso)}</div>`;
}

// ---------------------------------------------------------------- MAÑANA
function mqCard(a) {
  const hs = ['1', '7', '30'];
  return `<div class="grid3">${hs.map(k => { const m = a.mc[k], u = m.umbral;
    return `<div class="card glow"><h2>${HZ[k]}</h2>
      <div class="kpis" style="grid-template-columns:1fr 1fr;margin:6px 0">
        <div class="kpi"><small>Prob. de SUBIR</small><b class="pos">${pc0(m.p_sube)}</b></div>
        <div class="kpi"><small>Prob. de BAJAR</small><b class="neg">${pc0(1 - m.p_sube)}</b></div></div>
      ${pbar(m.p_sube)}
      <p style="margin:10px 0 2px">Subir más de ${pc0(u)}: <b class="pos">${pc0(m.p_gana)}</b></p>
      <p style="margin:2px 0">Caer más de ${pc0(u)}: <b class="neg">${pc0(m.p_pierde)}</b></p>
      <p class="muted" style="margin:6px 0 0;font-size:13px">9 de cada 10 escenarios quedan entre ${pct(m.p5)} y ${pct(m.p95)}. En un mal caso (1 de 20) pierde ${pc0(m.var95)} o más.</p></div>`; }).join('')}</div>`;
}
function vManana() {
  const d = S.d, hz = S.hz;
  const ids = d.activos.filter(a => a.clase !== 'Indicadores');
  if (!S.mqId || !act(S.mqId)) S.mqId = (d.activos.find(a => a.ticker === 'BTC-USD') || d.activos[0]).id;
  const opt = d.clases.map(c => `<optgroup label="${esc(c)}">${ids.filter(x => x.clase === c).map(x => `<option value="${x.id}" ${x.id === S.mqId ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</optgroup>`).join('');
  const sel = act(S.mqId);
  const ORD = {sube: ['Más probable que suba', a => -a.mc[hz].p_sube], baja: ['Más probable que baje', a => a.mc[hz].p_sube], mov: ['Mayor movimiento posible', a => -(a.mc[hz].p95 - a.mc[hz].p5)],
    riesgo: ['Menor riesgo', a => a.vol], score: ['Mayor puntaje', a => -(a.score ?? -1)]};
  let h = hero('Probabilidades', `¿Cómo podría comportarse el mercado <span class="grad">mañana</span>?`, esc(d.manana.texto));
  h += `<div class="note info"><b>Cómo leerlo.</b> Para cada activo se simularon ${d.n_sims.toLocaleString('es-CL')} futuros posibles con su historia real. “▲ 54%” significa que en 54 de cada 100 escenarios cierra más alto. En 1 día casi todo queda cerca de 50%: es lo normal, nadie sabe qué pasará mañana. La calibración histórica muestra que estas cifras ayudan a medir el <b>riesgo</b> (cuánto puede moverse y cuánto perder) mucho más que a adivinar la dirección.</div>`;
  h += `<div class="card"><h2>Consulta rápida: elige un activo</h2><div class="sel"><select id="mqsel">${opt}</select><a class="btn" href="#sim/${sel.id}">Ver simulación completa</a>${star(sel.id)}</div>
    <p style="margin:4px 0 10px"><b>${esc(sel.nombre)}</b> <span class="tag">${esc(sel.ticker)} · ${esc(sel.clase)}</span> · precio <b data-live="${sel.id}">${price(sel.precio)}</b> · <span class="badge r-${sel.riesgo}">Riesgo ${sel.riesgo}</span> · tendencia <span class="t-${sel.tendencia}">${sel.tendencia}</span></p>${mqCard(sel)}</div>`;
  const rows = [...ids].filter(a => (S.filtro === 'Todas' || a.clase === S.filtro) && (!S.busca || (a.nombre + ' ' + a.ticker).toLowerCase().includes(S.busca.toLowerCase())));
  rows.sort((a, b) => ORD[S.mqOrden][1](a) - ORD[S.mqOrden][1](b));
  const m = a => a.mc[hz], an = a => (a.analogo && a.analogo[hz]) ? pc0(a.analogo[hz].p_sube) : '—';
  h += `<div class="card"><h2>Todos los activos <span class="sub">${rows.length} resultados</span></h2>
    <div class="chips">${['1', '7', '30'].map(k => `<span class="chip ${k === hz ? 'on' : ''}" data-hz="${k}">${HZ[k]}</span>`).join('')}</div>
    <div class="sel"><input id="q" placeholder="Buscar activo…" value="${esc(S.busca)}"><select id="ord">${Object.entries(ORD).map(([k, v]) => `<option value="${k}" ${k === S.mqOrden ? 'selected' : ''}>Ordenar: ${v[0]}</option>`).join('')}</select></div>
    ${chipsH(['Todas', ...d.clases], S.filtro, 'c')}
    <div class="scroll" style="max-height:640px;overflow:auto"><table class="tb"><thead><tr><th class="l">Activo</th><th>Precio</th><th style="min-width:150px">Sube ▲ / Baja ▼ (${HZS[hz]})</th><th>Sube más de umbral</th><th>Cae más de umbral</th><th>Rango 90%</th><th>Riesgo</th>${hz !== '1' ? '<th>Históricamente (situaciones parecidas)</th>' : ''}</tr></thead><tbody>
    ${rows.map(a => `<tr data-id="${a.id}" style="cursor:pointer"><td>${star(a.id)}<span class="nm">${esc(a.nombre)}</span><span class="tag">${esc(a.ticker)}</span></td><td data-live="${a.id}">${price(a.precio)}</td>
      <td>${pbar(m(a).p_sube)}</td><td class="pos">${pc0(m(a).p_gana)} <span class="muted">(>${pc0(m(a).umbral)})</span></td><td class="neg">${pc0(m(a).p_pierde)} <span class="muted">(>${pc0(m(a).umbral)})</span></td>
      <td>${pct(m(a).p5)} a ${pct(m(a).p95)}</td><td><span class="badge r-${a.riesgo}">${a.riesgo}</span></td>${hz !== '1' ? `<td>${an(a)}</td>` : ''}</tr>`).join('')}</tbody></table></div></div>`;
  $('#vista').innerHTML = h;
  $('#mqsel').onchange = e => { S.mqId = e.target.value; vManana(); };
  $('#q').oninput = e => { S.busca = e.target.value; const p = e.target.selectionStart; vManana(); const q = $('#q'); q.focus(); q.setSelectionRange(p, p); };
  $('#ord').onchange = e => { S.mqOrden = e.target.value; vManana(); };
  $$('.chip[data-hz]').forEach(c => c.onclick = () => { S.hz = c.dataset.hz; vManana(); });
  $$('.chip[data-c]').forEach(c => c.onclick = () => { S.filtro = c.dataset.c; vManana(); });
  $$('tr[data-id]').forEach(tr => tr.onclick = () => go(tr.dataset.id));
  bindFav(vManana);
}

// ---------------------------------------------------------------- NOTICIAS
function vNoticias(arg) {
  if (arg) { S.nAct = arg; }
  const r = S.r;
  if (!r || !r.noticias.length) { $('#vista').innerHTML = hero('Noticias', 'Noticias del <span class="grad">mercado</span>', 'Titulares de fuentes públicas, etiquetados por activo y tema.') + sinNoticias(); return; }
  const cats = ['Todas', ...new Set(r.noticias.map(n => n.categoria))];
  const sents = ['Todas', 'positivo', 'neutral', 'negativo'];
  let l = r.noticias.filter(n => (S.nCat === 'Todas' || n.categoria === S.nCat) && (S.nSent === 'Todas' || n.sentimiento === S.nSent) &&
    (!S.nAct || (n.activos || []).includes(S.nAct)) && (!S.nBusca || n.titulo.toLowerCase().includes(S.nBusca.toLowerCase())));
  l.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const a0 = S.nAct && act(S.nAct);
  let h = hero('Noticias', 'Lo que <span class="grad">mueve</span> los mercados', `Titulares recogidos automáticamente de ${r.fuentes_ok.length} fuentes públicas (se actualiza cada 30 minutos, la página lo revisa cada 5). Al tocar una noticia se abre la fuente original.`);
  h += `<div class="card"><div class="sel"><input id="nq" placeholder="Buscar en titulares…" value="${esc(S.nBusca)}"></div>
    ${chipsH(cats, S.nCat, 'nc')}<div class="chips">${sents.map(s => `<span class="chip ${s === S.nSent ? 'on' : ''}" data-ns="${s}">${s === 'Todas' ? 'Cualquier tono' : s}</span>`).join('')}</div>
    ${a0 ? `<div class="chips"><span class="chip on" id="qa">Activo: ${esc(a0.nombre)} ✕</span></div>` : ''}
    <p class="muted" style="font-size:12.5px;margin:0">El tono (positivo/negativo) sale de palabras clave del titular, es solo una pista. ${l.length} noticias.</p></div>
    <div class="ngrid">${l.slice(0, 90).map(newsCard).join('') || '<p class="muted">Sin resultados con esos filtros.</p>'}</div>`;
  $('#vista').innerHTML = h;
  $('#nq').oninput = e => { S.nBusca = e.target.value; const p = e.target.selectionStart; vNoticias(); const q = $('#nq'); q.focus(); q.setSelectionRange(p, p); };
  $$('.chip[data-nc]').forEach(c => c.onclick = () => { S.nCat = c.dataset.nc; vNoticias(); });
  $$('.chip[data-ns]').forEach(c => c.onclick = () => { S.nSent = c.dataset.ns; vNoticias(); });
  const qa = $('#qa'); if (qa) qa.onclick = () => { S.nAct = null; vNoticias(); };
}

// ---------------------------------------------------------------- RADAR CRIPTO
function filaRadar(x) {
  return `<tr><td class="l"><b>${esc(x.nombre)}</b> <span class="tag">${esc(x.simbolo)}</span></td><td>${x.precio != null ? price(x.precio) : '—'}</td><td class="${cls(x.cambio24h)}">${pct(x.cambio24h)}</td><td class="${cls(x.cambio7d)}">${pct(x.cambio7d)}</td><td>${x.rank ?? '—'}</td><td>${x.volumen ? '$' + nf(x.volumen / 1e6, 0) + ' M' : '—'}</td></tr>`;
}
function tablaRadar(lista) {
  return lista && lista.length ? `<div class="scroll"><table><thead><tr><th class="l">Cripto</th><th>Precio USD</th><th>24 h</th><th>7 d</th><th>Ranking</th><th>Volumen 24 h</th></tr></thead><tbody>${lista.map(filaRadar).join('')}</tbody></table></div>` : '<p class="muted">Sin datos por ahora.</p>';
}
function vRadar() {
  const R = S.r && S.r.radar;
  let h = hero('Radar cripto', 'Lo que se <span class="grad">mueve</span> y lo que está <span class="grad">naciendo</span>', 'Mayores subidas y caídas, tendencias, volumen anormal y tokens recién listados en exchanges descentralizados (DEX).');
  if (!R || (!R.ganadores.length && !R.nuevos.length && !R.trending.length)) {
    $('#vista').innerHTML = h + '<div class="card"><h2>Radar</h2><p class="muted">Aún no hay datos del radar. Se publican junto con las noticias (cada 30 minutos). Si CoinGecko o DEX Screener no respondieron, se reintenta en la siguiente ejecución.</p></div>'; return;
  }
  h += `<div class="note bad"><b>Mucho cuidado con lo nuevo.</b> Los tokens recién creados son los de mayor riesgo del mercado: muchos son estafas (“rug pulls”), no se pueden vender, o pierden 90% en horas. Aparecer aquí NO significa que sean seguros ni una recomendación. Si decides mirar uno, revisa liquidez, quién tiene los tokens y usa montos que puedas perder por completo.</div>`;
  h += `<div class="grid2"><div class="card"><h2>🔥 Tendencia ahora</h2>${R.trending.length ? `<div class="scroll"><table><thead><tr><th class="l">Cripto</th><th>Ranking</th><th>24 h</th></tr></thead><tbody>${R.trending.map(x => `<tr><td class="l"><b>${esc(x.nombre)}</b> <span class="tag">${esc(x.simbolo)}</span></td><td>${x.rank ?? '—'}</td><td class="${cls(x.cambio24h)}">${pct(x.cambio24h)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Sin datos.</p>'}</div>
    <div class="card"><h2>📊 Volumen anormal <span class="sub">más dinero circulando que su tamaño</span></h2>${tablaRadar(R.volumen)}</div></div>
    <div class="grid2"><div class="card"><h2 class="pos">▲ Mayores subidas 24 h</h2>${tablaRadar(R.ganadores)}</div><div class="card"><h2 class="neg">▼ Mayores caídas 24 h</h2>${tablaRadar(R.perdedores)}</div></div>`;
  h += `<div class="card glow"><h2>🌱 Tokens nuevos en DEX <span class="sub">liquidez mínima US$20 mil · riesgo extremo</span></h2>${R.nuevos && R.nuevos.length ? `<div class="scroll"><table><thead><tr><th class="l">Token</th><th>Cadena</th><th>Precio USD</th><th>Liquidez</th><th>Volumen 24 h</th><th>24 h</th><th>Edad</th><th></th></tr></thead><tbody>
    ${R.nuevos.map(x => `<tr><td class="l"><b>${esc(x.nombre)}</b> <span class="tag">${esc(x.simbolo)}</span></td><td>${esc(x.cadena)}</td><td>${x.precio != null ? price(x.precio) : '—'}</td><td>$${nf((x.liquidez || 0) / 1e3, 0)} mil</td><td>${x.volumen24h ? '$' + nf(x.volumen24h / 1e3, 0) + ' mil' : '—'}</td><td class="${cls(x.cambio24h)}">${pct(x.cambio24h, 0)}</td><td>${x.edad_horas != null ? nf(x.edad_horas, 0) + ' h' : '—'}</td><td>${x.url ? `<a class="pill" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(x.url))}">Ver ↗</a>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No hay tokens nuevos que cumplan el filtro de liquidez en este momento.</p>'}</div>`;
  const cr = S.r.noticias.filter(n => n.categoria === 'Cripto').slice(0, 6);
  if (cr.length) h += `<div class="card"><h2>Noticias cripto</h2><div class="ngrid">${cr.map(newsCard).join('')}</div></div>`;
  $('#vista').innerHTML = h;
}

// ---------------------------------------------------------------- MERCADOS
const COLS = [
  {k: 'nombre', t: 'Activo', l: 1, f: a => `${star(a.id)}<span class="nm">${esc(a.nombre)}</span><span class="tag">${esc(a.ticker)}</span>`, v: a => a.nombre},
  {k: 'clase', t: 'Clase', l: 1, f: a => esc(a.clase), v: a => a.clase},
  {k: 'precio', t: 'Precio', f: a => `<span data-live="${a.id}">${price(a.precio)}</span>`, v: a => a.precio},
  {k: 'spark', t: '30 días', f: a => spark(a.spark, 80, 24), v: a => a.m1},
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
    const rows = d.activos.filter(a => (S.filtro === 'Todas' || a.clase === S.filtro) && (!S.busca || (a.nombre + ' ' + a.ticker).toLowerCase().includes(S.busca.toLowerCase())));
    rows.sort((a, b) => { const x = col.v(a), y = col.v(b); return (typeof x === 'string' ? x.localeCompare(y) : (x ?? -1e9) - (y ?? -1e9)) * S.orden.dir; });
    $('#tbl').innerHTML = `<div class="scroll" style="max-height:700px;overflow:auto"><table class="tb"><thead><tr>${COLS.map(c => `<th data-k="${c.k}" class="${c.l ? 'l' : ''}">${c.t}${S.orden.k === c.k ? (S.orden.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr data-id="${r.id}" style="cursor:pointer">${COLS.map(c => `<td class="${c.l ? 'l' : ''}">${c.f(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    $$('#tbl th').forEach(th => th.onclick = () => { const k = th.dataset.k; S.orden = {k, dir: S.orden.k === k ? -S.orden.dir : -1}; draw(); });
    $$('#tbl tr[data-id]').forEach(tr => tr.onclick = () => go(tr.dataset.id));
    bindFav(draw);
    Object.keys(S.live).forEach(pintarVivo);
  };
  $('#vista').innerHTML = hero('Mercados', `Todos los activos, <span class="grad">un solo lugar</span>`, `${d.activos.length} activos: índices, acciones del mundo, Chile, salmoneras, materias primas, bonos, divisas y cripto.`) +
    `<div class="card"><p class="muted" style="margin-top:0">Toca un encabezado para ordenar y una fila para ver su simulación. “P(sube)” sale de la simulación; “Pérdida 95%” es cuánto podría caer en un mal mes (1 de cada 20).</p>
    <div class="sel"><input id="q" placeholder="Buscar activo…" value="${esc(S.busca)}"></div>${chipsH(['Todas', ...d.clases], S.filtro, 'c')}<div id="tbl"></div>
    ${d.sin_datos.length ? `<p class="muted" style="font-size:12.5px">Sin datos hoy: ${d.sin_datos.map(x => esc(x.nombre + ' (' + x.ticker + ')')).join(', ')}.</p>` : ''}</div>`;
  $('#q').oninput = e => { S.busca = e.target.value; draw(); };
  $$('.chip[data-c]').forEach(c => c.onclick = () => { S.filtro = c.dataset.c; vMercados(); });
  draw();
}


// ---------------------------------------------------------------- TradingView (un solo gráfico, el del activo abierto)
const TV_IDX = {'^GSPC': 'SP:SPX', '^IXIC': 'NASDAQ:IXIC', '^DJI': 'DJ:DJI', '^RUT': 'TVC:RUT', '^VIX': 'CBOE:VIX', '^FTSE': 'TVC:UKX', '^GDAXI': 'XETR:DAX', '^FCHI': 'TVC:CAC40',
  '^STOXX50E': 'TVC:SX5E', '^N225': 'TVC:NI225', '^HSI': 'TVC:HSI', '^KS11': 'TVC:KOSPI', '^BVSP': 'BMFBOVESPA:IBOV', '^AXJO': 'ASX:XJO', '000001.SS': 'SSE:000001', '^BSESN': 'BSE:SENSEX',
  '^NSEI': 'NSE:NIFTY', '^TWII': 'TWSE:TAIEX', '^IBEX': 'BME:IBC', '^GSPTSE': 'TSX:TSX', '^TNX': 'TVC:US10Y', 'DX-Y.NYB': 'TVC:DXY', 'BRK-B': 'NYSE:BRK.B',
  'GC=F': 'COMEX:GC1!', 'SI=F': 'COMEX:SI1!', 'HG=F': 'COMEX:HG1!', 'PL=F': 'NYMEX:PL1!', 'CL=F': 'NYMEX:CL1!', 'BZ=F': 'NYMEX:BZ1!', 'NG=F': 'NYMEX:NG1!', 'ZW=F': 'CBOT:ZW1!',
  'ZC=F': 'CBOT:ZC1!', 'ZS=F': 'CBOT:ZS1!', 'KC=F': 'ICEUS:KC1!', 'CC=F': 'ICEUS:CC1!', 'SB=F': 'ICEUS:SB1!', 'ES=F': 'CME_MINI:ES1!', 'NQ=F': 'CME_MINI:NQ1!'};
function tvSymbol(a) {
  const t = a.ticker;
  if (TV_IDX[t]) return TV_IDX[t];
  let m;
  if ((m = t.match(/^([A-Z]+)\d*-USD$/))) return `BINANCE:${m[1]}USDT`;
  if ((m = t.match(/^([A-Z]{6})=X$/))) return `FX_IDC:${m[1]}`;
  if ((m = t.match(/^(.+)\.SN$/))) return `BCS:${m[1]}`;
  if ((m = t.match(/^(.+)\.OL$/))) return `OSL:${m[1]}`;
  if ((m = t.match(/^(\d+)\.KS$/))) return `KRX:${m[1]}`;
  if ((m = t.match(/^0*(\d+)\.HK$/))) return `HKEX:${m[1]}`;
  if ((m = t.match(/^(.+)\.NS$/))) return `NSE:${m[1]}`;
  return t.replace(/^\^/, '');
}
function montarTV(a) {
  const box = document.getElementById('tvbox'); if (!box || CFG.tradingview === false) return;
  const sym = tvSymbol(a);
  box.innerHTML = '<div class="tradingview-widget-container" style="height:100%;width:100%"><div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div></div>';
  const s = document.createElement('script');
  s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  s.async = true;
  s.text = JSON.stringify({autosize: true, symbol: sym, interval: 'D', timezone: 'America/Santiago', theme: 'dark', style: '1', locale: 'es', backgroundColor: 'rgba(20,23,28,1)',
    gridColor: 'rgba(255,255,255,0.05)', allow_symbol_change: true, hide_side_toolbar: false, calendar: false, support_host: 'https://www.tradingview.com'});
  box.firstChild.appendChild(s);
  const l = document.getElementById('tvlink'); if (l) l.href = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(sym);
}

// ---------------------------------------------------------------- SIMULADOR
async function vSim(id) {
  const d = S.d;
  id = id || S.ultimo || 'GSPC';
  S.ultimo = id;
  const a = act(id) || d.activos[0];
  const opciones = d.clases.map(c => `<optgroup label="${esc(c)}">${d.activos.filter(x => x.clase === c).map(x => `<option value="${x.id}" ${x.id === a.id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</optgroup>`).join('');
  const nn = S.r ? S.r.noticias.filter(n => (n.activos || []).includes(a.id)).slice(0, 6) : [];
  $('#vista').innerHTML = hero('Simulador', `${esc(a.nombre)} <span class="grad">¿qué podría pasar?</span>`, `${esc(a.ticker)} · ${esc(a.clase)}${a.region && a.region !== a.clase ? " · " + esc(a.region) : ""}`) +
    `<div class="card"><div class="sel"><select id="sel">${opciones}</select>${star(a.id)}</div><div id="det"><p class="muted">Cargando simulación…</p></div></div>
    ${nn.length ? `<div class="card"><h2>Noticias relacionadas</h2><div class="ngrid">${nn.map(newsCard).join('')}</div><div class="btns"><a class="btn" href="#noticias/${a.id}">Ver todas de ${esc(a.nombre)}</a></div></div>` : ''}`;
  $('#sel').onchange = e => { location.hash = '#sim/' + e.target.value; };
  bindFav(() => vSim(a.id));
  let det;
  try { det = (await getJSON(`assets/${a.id}.json`, [S.base])).j; } catch (e) { $('#det').innerHTML = '<p>No se pudo cargar el detalle.</p>'; return; }
  if (S.vista !== 'sim' || S.ultimo !== a.id) return;
  const mc = a.mc, sim = det.sim;
  const fila = (h, nom) => { const m = mc[h]; return `<tr><td class="l">${nom}</td><td class="pos">${pc0(m.p_sube)}</td><td class="neg">${pc0(1 - m.p_sube)}</td><td>${pc0(m.p_gana)} <span class="muted">(>+${pc0(m.umbral)})</span></td><td>${pc0(m.p_pierde)} <span class="muted">(<−${pc0(m.umbral)})</span></td><td>${pct(m.p5)} a ${pct(m.p95)}</td><td>${pct(m.p50)}</td><td>${pc0(m.var95)}</td><td>${pc0(m.cvar95)}</td></tr>`; };
  const an = k => { const x = det.analogos[k]; if (!x) return '<li>Sin suficiente historia para este horizonte.</li>';
    return `<li><b>${k === '7' ? 'Semana' : 'Mes'}:</b> en situaciones con ${esc(x.condicion)} subió <b>${pc0(x.p_sube)}</b> de las veces (rango de confianza 95%: ${pc0(x.ic_bajo)}–${pc0(x.ic_alto)}; frecuencia general ${pc0(x.base)}; ≈${nf(x.n_ef, 0)} episodios independientes). Retorno típico: ${pct(x.media)}; mal caso (5%): ${pct(x.p5)}.</li>`; };
  const comp = det.score_comp ? Object.entries(det.score_comp).map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><i style="width:${Math.round(v * 140)}px"></i><span style="width:auto">${nf(v, 2)}</span></div>`).join('') : '';
  $('#det').innerHTML = `
    <div class="kpis">
      <div class="kpi"><small>Precio (${esc(a.fecha)})</small><b data-live="${a.id}">${price(a.precio)}</b></div>
      <div class="kpi"><small>1 día / 1 mes</small><b><span class="${cls(a.d1)}">${pct(a.d1)}</span> / <span class="${cls(a.m1)}">${pct(a.m1)}</span></b></div>
      <div class="kpi"><small>Riesgo (volatilidad anual)</small><b>${a.riesgo} · ${pc0(a.vol)}</b></div>
      <div class="kpi"><small>Desde máximo 12 meses</small><b class="neg">${pct(a.dd)}</b></div>
      <div class="kpi"><small>Tendencia · RSI</small><b class="t-${a.tendencia}">${a.tendencia} · ${nf(a.rsi, 0)}</b></div>
      <div class="kpi"><small>Puntaje (0-100)</small><b>${a.score == null ? '—' : nf(a.score, 0)}</b></div>
    </div>
    ${CFG.tradingview === false ? '' : `<h3>Gráfico en vivo <span class="tag">TradingView · puedes cambiar indicadores, zoom y escala</span></h3><div class="cv tv" id="tvbox"></div><p class="muted" style="font-size:12.5px;margin:6px 0 0">Gráfico de TradingView. Si no carga o el símbolo no coincide, <a id="tvlink" target="_blank" rel="noopener noreferrer" style="color:var(--warn)">ábrelo en TradingView ↗</a>.</p>`}
    <h3>Probabilidades de subir y bajar</h3>${mqCard(a)}
    <h3>${d.n_sims.toLocaleString('es-CL')} escenarios posibles a un mes</h3>
    <p class="muted" style="margin-top:0">Cada línea tenue es uno de 40 escenarios simulados. La banda cubre el 90% de los casos (clara) y el 50% central (oscura); la línea amarilla es el caso del medio. El eje horizontal son días de mercado.</p>
    <div class="cv"><canvas id="fan"></canvas></div>
    <h3>Resumen por horizonte</h3>
    <div class="scroll"><table><thead><tr><th class="l">Horizonte</th><th>Sube</th><th>Baja</th><th>Gana mucho</th><th>Pierde mucho</th><th>Rango 90%</th><th>Caso medio</th><th>Pérdida 95%</th><th>Pérdida si es muy malo</th></tr></thead><tbody>
      ${fila('1', '1 día')}${fila('7', '1 semana')}${fila('30', '1 mes')}</tbody></table></div>
    <div class="note">Probabilidad de tocar −10% en algún momento del próximo mes: <b>${pc0(mc['30'].p_toca_menos10)}</b>. “Pérdida 95%” = lo que se pierde o más solo 1 de cada 20 veces. “Pérdida si es muy malo” = promedio de ese 5% peor.</div>
    <div class="grid2" style="margin-top:12px"><div><h3>Cómo se reparten los resultados a 1 mes</h3><div class="cv s"><canvas id="hist"></canvas></div></div>
    <div><h3>Último año: precio y medias</h3><div class="cv s"><canvas id="px"></canvas></div></div></div>
    <div class="grid2" style="margin-top:12px"><div><h3>Qué pasó antes en situaciones parecidas</h3><ul>${an('7')}${an('30')}</ul>
      <p class="muted" style="font-size:12.5px">Es historia, no promesa. Si el rango de confianza incluye la frecuencia general, no hay evidencia de ventaja.</p></div>
    <div><h3>Estacionalidad (retorno mensual promedio)</h3><div class="cv s"><canvas id="se"></canvas></div></div></div>
    ${comp ? `<h3>De qué se compone el puntaje</h3>${comp}` : ''}`;
  Object.keys(S.live).forEach(pintarVivo);
  montarTV(a);
  const lab = [...Array(sim.pasos + 1).keys()], B = sim.bandas;
  const ds = sim.caminos.map(c => ({data: c, borderColor: 'rgba(160,170,190,.16)', borderWidth: 1, pointRadius: 0}));
  ds.push({data: B.p5, borderColor: 'rgba(0,0,0,0)', pointRadius: 0});
  ds.push({data: B.p95, borderColor: 'rgba(0,0,0,0)', backgroundColor: 'rgba(229,185,78,.14)', fill: '-1', pointRadius: 0});
  ds.push({data: B.p25, borderColor: 'rgba(0,0,0,0)', pointRadius: 0});
  ds.push({data: B.p75, borderColor: 'rgba(0,0,0,0)', backgroundColor: 'rgba(229,185,78,.28)', fill: '-1', pointRadius: 0});
  ds.push({data: B.p50, borderColor: COL.acc, borderWidth: 2.5, pointRadius: 0});
  mk('fan', {type: 'line', data: {labels: lab, datasets: ds}, options: {plugins: {legend: {display: false}, tooltip: {enabled: false}}, scales: {y: {ticks: {callback: v => v + '%'}}, x: {ticks: {maxTicksLimit: 8}}}}});
  const H = sim.hist, mids = H.cuentas.map((_, i) => (H.bordes[i] + H.bordes[i + 1]) / 2);
  mk('hist', {type: 'bar', data: {labels: mids.map(m => nf(m, 0) + '%'), datasets: [{data: H.cuentas.map(c => c / H.n), backgroundColor: mids.map(m => m >= 0 ? COL.up : COL.dn), borderWidth: 0, barPercentage: 1, categoryPercentage: 1}]},
    options: {plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => nf(c.raw * 100, 1) + '% de los escenarios'}}}, scales: {y: {ticks: {callback: v => nf(v * 100, 0) + '%'}}, x: {ticks: {maxTicksLimit: 7}}}}});
  const P = det.historia;
  mk('px', {type: 'line', data: {labels: P.fechas, datasets: [
    {label: 'Precio', data: P.cierre, borderColor: '#e9ecf1', borderWidth: 1.5, pointRadius: 0},
    {label: 'Media 50', data: P.sma50, borderColor: COL.up, borderWidth: 1.5, pointRadius: 0},
    {label: 'Media 200', data: P.sma200, borderColor: COL.dn, borderWidth: 1.5, pointRadius: 0}]},
    options: {plugins: {legend: {labels: {boxWidth: 12}}}, scales: {x: {ticks: {maxTicksLimit: 6}}}}});
  const E = det.estac;
  mk('se', {type: 'bar', data: {labels: MESES, datasets: [{data: E.prom, backgroundColor: E.prom.map(v => v == null ? 'transparent' : v >= 0 ? COL.up : COL.dn), borderWidth: 0}]},
    options: {plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${nf(c.raw, 1)}% promedio · subió ${nf(E.pos[c.dataIndex], 0)}% de los años (n=${E.n[c.dataIndex]})`}}}, scales: {y: {ticks: {callback: v => v + '%'}}}}});
}

// ---------------------------------------------------------------- ESTACIONALIDAD
function vEstac() {
  const d = S.d, mAct = new Date().getMonth();
  const rows = d.estacionalidad.filas.filter(f => S.filtro === 'Todas' || f.clase === S.filtro);
  $('#vista').innerHTML = hero('Calendario', `¿Qué meses suelen ser <span class="grad">mejores</span>?`, 'Retorno mensual promedio de los últimos años.') + `<div class="card">
    <p class="muted" style="margin-top:0">Pasa el cursor por una celda para ver en cuántos años subió ese mes. Con 10-12 años de historia, un mes “bueno” es una tendencia débil: úsalo para ajustar tamaño o paciencia, no para entrar a ciegas. El mes actual está marcado.</p>
    ${chipsH(['Todas', ...d.clases], S.filtro, 'c')}
    <div class="scroll"><table class="hm"><thead><tr><th>Activo</th>${MESES.map((m, i) => `<th class="${i === mAct ? 'neg' : ''}">${m}${i === mAct ? '•' : ''}</th>`).join('')}</tr></thead><tbody>
    ${rows.map(f => `<tr><td><a href="#sim/${f.id}">${esc(f.nombre)}</a></td>${f.prom.map((v, i) => `<td class="c" style="background:${divColor(v, 8)}" title="${v == null ? '' : `Subió ${nf(f.pos[i], 0)}% de los años (n=${f.n[i]})`}">${v == null ? '' : nf(v, 1)}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div></div>`;
  $$('.chip[data-c]').forEach(c => c.onclick = () => { S.filtro = c.dataset.c; vEstac(); });
}

// ---------------------------------------------------------------- CORRELACIONES
function vCorr() {
  const C = S.d.correlaciones;
  $('#vista').innerHTML = hero('Diversificación', `¿Qué activos se mueven <span class="grad">juntos</span>?`, 'Correlaciones de los últimos 2 años con retornos semanales.') + `<div class="card">
    <p class="muted" style="margin-top:0">1 = se mueven igual, 0 = sin relación, −1 = opuestos. Para diversificar de verdad busca valores bajos o negativos: si todo tiene 0,8 con todo, tener muchos activos no te protege cuando cae el mercado.</p>
    <div class="scroll"><table class="hm"><thead><tr><th></th>${C.nombres.map(n => `<th class="v">${esc(n)}</th>`).join('')}</tr></thead><tbody>
    ${C.matriz.map((row, i) => `<tr><td>${esc(C.nombres[i])}</td>${row.map(v => `<td class="c" style="background:${divColor(v, 1)}">${v == null ? '' : nf(v, 1)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}

// ---------------------------------------------------------------- PORTAFOLIO
function vPort() {
  const d = S.d, P = d.portafolios, nombres = Object.keys(P);
  if (!nombres.length) { $('#vista').innerHTML = '<div class="card">Sin datos suficientes para armar portafolios.</div>'; return; }
  if (!P[S.perfil]) S.perfil = nombres[0];
  const p = P[S.perfil], m = p.mensual, an = p.anual;
  $('#vista').innerHTML = hero('Portafolio', `Un reparto de ejemplo <span class="grad">para todo el mundo</span>`, 'Por perfil de riesgo, distribuido entre bonos, acciones globales, Chile, salmoneras, materias primas y cripto.') + `<div class="card">
    <p class="muted" style="margin-top:0">Dentro de cada clase se eligen los activos de mayor puntaje y se pondera por menor volatilidad. Es un punto de partida para pensar, no una recomendación personalizada.</p>
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
    <h3>Composición</h3><div class="scroll"><table><thead><tr><th class="l">Activo</th><th class="l">Clase</th><th>Peso</th><th>Riesgo</th><th>Puntaje</th></tr></thead><tbody>
    ${p.pesos.map(w => `<tr style="cursor:pointer" data-id="${esc(w.id)}"><td class="l">${esc(w.nombre)}</td><td class="l">${esc(w.clase)}</td><td><b>${nf(w.peso * 100, 1)}%</b></td><td><span class="badge r-${w.riesgo}">${w.riesgo}</span></td><td>${nf(w.score, 0)}</td></tr>`).join('')}</tbody></table></div>
    ${p.excluidos.length ? `<p class="muted" style="font-size:12.5px">Quedaron fuera por tener muy poca historia: ${p.excluidos.map(esc).join(', ')}.</p>` : ''}
    <div class="note">La simulación vuelve a sortear semanas reales de los últimos ${nf(p.n_semanas / 52, 1)} años manteniendo cómo se mueven los activos entre sí, y descuenta el 75% de la tendencia pasada. Tu portafolio real en XTB y Binance será distinto: úsalo como referencia de cuánto riesgo asume cada perfil.</div></div>`;
  $$('.btn[data-p]').forEach(b => b.onclick = () => { S.perfil = b.dataset.p; kill(); vPort(); });
  $$('tr[data-id]').forEach(tr => tr.onclick = () => go(tr.dataset.id));
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
  $('#vista').innerHTML = hero('Honestidad', `¿Qué tan buenas han sido las <span class="grad">probabilidades</span>?`, 'La prueba más importante antes de pensar en automatizar.') + `<div class="card">
    <p class="muted" style="margin-top:0">Se toma el método de “situaciones parecidas” (tendencia y volatilidad), se calcula qué probabilidad de subida habría dado <b>usando solo datos anteriores a cada día</b>, y se compara con lo que pasó de verdad, en todos los activos.</p>
    <div class="btns"><span class="btn ${S.calH === '7' ? 'on' : ''}" data-h="7">1 semana</span><span class="btn ${S.calH === '30' ? 'on' : ''}" data-h="30">1 mes</span></div>
    <div class="kpis"><div class="kpi"><small>Frecuencia general de subidas</small><b>${f(c.base)}</b></div>
      <div class="kpi"><small>Cuando daba ≥60%, subió</small><b>${f(c.desde_60.real)}</b><small>≈${nf(c.desde_60.n_ef, 0)} episodios independientes</small></div>
      <div class="kpi"><small>Cuando daba ≥70%, subió</small><b>${f(c.desde_70.real)}</b><small>≈${nf(c.desde_70.n_ef, 0)} episodios independientes</small></div></div>
    <div class="cv s"><canvas id="cal"></canvas></div>
    <div class="scroll"><table><thead><tr><th class="l">Probabilidad que dio el método</th><th>Casos</th><th>Dio en promedio</th><th>Subió en la realidad</th></tr></thead><tbody>
    ${rows.map(b => `<tr><td class="l">${pc0(b.desde)}–${pc0(b.hasta)}</td><td>${b.n.toLocaleString('es-CL')}</td><td>${f(b.pred)}</td><td><b>${f(b.real)}</b></td></tr>`).join('')}</tbody></table></div>
    <div class="note info">Si el método fuera muy bueno, “Subió en la realidad” crecería junto con “Dio en promedio”. Si es casi plana, la probabilidad de dirección no aporta ventaja y operar solo con eso (o automatizarlo) no tiene respaldo. Los casos se traslapan en el tiempo, por eso los episodios independientes son muchos menos.</div>
    <div class="note">Para automatizar con Binance más adelante: prueba primero en modo simulado (testnet) durante semanas, usa una API con permiso de operar pero <b>sin permiso de retiro</b>, arriesga montos pequeños y define una pérdida máxima diaria que apague el sistema.</div></div>`;
  $$('.btn[data-h]').forEach(b => b.onclick = () => { S.calH = b.dataset.h; kill(); vCalib(); });
  mk('cal', {type: 'bar', data: {labels: rows.map(b => pc0(b.desde) + '–' + pc0(b.hasta)), datasets: [
    {label: 'Dio el método', data: rows.map(b => b.pred), backgroundColor: COL.blue}, {label: 'Subió en la realidad', data: rows.map(b => b.real), backgroundColor: COL.acc}]},
    options: {plugins: {legend: {labels: {boxWidth: 12}}}, scales: {y: {min: 0, max: 1, ticks: {callback: v => pc0(v)}}}}});
}


// ---------------------------------------------------------------- HISTORIAL (prueba pública hacia adelante)
async function vHist() {
  let h = hero('Transparencia', `Lo que dijimos y lo que <span class="grad">pasó de verdad</span>`, 'Cada día se guardan las probabilidades del modelo ANTES de conocer el resultado. Cuando pasa el plazo, se comparan con lo que ocurrió. Aquí ves el marcador real, sea bueno o malo.');
  $('#vista').innerHTML = h + '<p class="muted pad">Cargando historial…</p>';
  let H;
  try { H = (await getJSON('historial.json', [S.base])).j; } catch (e) { H = null; }
  if (S.vista !== 'hist') return;
  if (!H) { $('#vista').innerHTML = h + '<div class="card"><h2>Aún no hay historial</h2><p class="muted">Se empieza a llenar con el próximo informe real. La primera medición (1 día) aparece al día siguiente; la de 1 mes, a los 30 días.</p></div>'; return; }
  const hs = ['1', '7', '30'];
  const tot = hs.reduce((s, k) => s + H.res[k].n, 0);
  const sk = k => { const r = H.res[k]; if (!r.n) return null; const b = r.y / r.n, ref = b * (1 - b); return ref > 0 ? 1 - (r.brier / r.n) / ref : null; };
  h += `<div class="note info"><b>Cómo leerlo.</b> “Acierto de dirección” es cuántas veces el lado con más del 50% fue el correcto. “Puntaje de habilidad” compara al modelo con un método tonto que siempre dice la frecuencia histórica de subidas: <b>0 = igual de bueno que el tonto</b>, positivo = aporta algo, negativo = peor. Medimos desde ${esc(H.desde || '—')}. ${tot ? '' : 'Todavía no vence ninguna predicción: vuelve mañana.'}</div>`;
  h += `<div class="grid3">${hs.map(k => { const r = H.res[k], s = sk(k);
    return `<div class="card glow"><h2>${HZ[k]}</h2>${r.n ? `<div class="kpis" style="grid-template-columns:1fr 1fr;margin:6px 0"><div class="kpi"><small>Acierto de dirección</small><b>${pc0(r.acierto / r.n)}</b></div>
      <div class="kpi"><small>Puntaje de habilidad</small><b class="${s > 0.01 ? 'pos' : s < -0.01 ? 'neg' : ''}">${s == null ? '—' : nf(s, 3)}</b></div></div>
      <p class="muted" style="margin:6px 0 0;font-size:13px">${r.n.toLocaleString('es-CL')} predicciones resueltas · subieron ${pc0(r.y / r.n)} de las veces · ${(H.pendientes[k] || 0).toLocaleString('es-CL')} esperando resultado.</p>` : `<p class="muted">Sin resultados todavía. ${(H.pendientes[k] || 0).toLocaleString('es-CL')} predicciones esperando su plazo.</p>`}</div>`; }).join('')}</div>`;
  const cl = {};
  hs.forEach(k => Object.entries(H.res[k].clases).forEach(([c, v]) => { cl[c] = cl[c] || [0, 0]; cl[c][0] += v[0]; cl[c][1] += v[1]; }));
  const filasC = Object.entries(cl).filter(([, v]) => v[0] >= 20).sort((x, y) => y[1] / y[0] - x[1] / x[0]);
  h += `<div class="grid2"><div class="card"><h2>¿Las probabilidades son honestas? <span class="sub">1 mes</span></h2><div class="cv s"><canvas id="hc"></canvas></div>
    <p class="muted" style="font-size:12.5px;margin:8px 0 0">Si el modelo dice “60%”, lo ideal es que suba ~60% de las veces. Cuanto más cerca de la diagonal, mejor calibrado.</p></div>
    <div class="card"><h2>Acierto por tipo de activo <span class="sub">todos los plazos</span></h2>${filasC.length ? filasC.map(([c, v]) => `<div class="bar"><span>${esc(c)}</span><i style="width:${Math.round(v[1] / v[0] * 160)}px"></i><span style="width:auto">${pc0(v[1] / v[0])} <span class="muted">(${v[0]})</span></span></div>`).join('') : '<p class="muted">Aún hay pocos datos por clase.</p>'}</div></div>`;
  const ult = [...H.ultimos].reverse().slice(0, 40);
  h += `<div class="card"><h2>Últimos resultados</h2>${ult.length ? `<div class="scroll" style="max-height:420px;overflow:auto"><table><thead><tr><th class="l">Activo</th><th>Plazo</th><th>Fecha</th><th>Dijimos “sube”</th><th>Pasó</th><th>Retorno</th><th></th></tr></thead><tbody>
    ${ult.map(u => { const ok = (u[5] >= 0.5) === (u[6] === 1); return `<tr><td class="l">${esc(u[1])}</td><td>${HZS[u[4]]}</td><td>${esc(u[2])}</td><td>${pc0(u[5])}</td><td class="${u[6] ? 'pos' : 'neg'}">${u[6] ? 'Subió' : 'Bajó'}</td><td class="${cls(u[7])}">${pct(u[7])}</td><td class="${ok ? 'pos' : 'neg'}">${ok ? '✔' : '✘'}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">Todavía no hay resultados.</p>'}</div>
    <div class="note">Los resultados son parte del producto: se publican aunque sean malos. Una herramienta que muestra cuánto falla es más útil que una que solo muestra aciertos.</div>`;
  $('#vista').innerHTML = h;
  const bins = H.res['30'].bins.map((b, i) => b[0] >= 5 ? {x: b[1] / b[0], y: b[2] / b[0], n: b[0]} : null).filter(Boolean);
  if (bins.length) mk('hc', {type: 'scatter', data: {datasets: [{label: 'Real', data: bins, backgroundColor: COL.acc, pointRadius: 6}, {type: 'line', label: 'Perfecto', data: [{x: 0, y: 0}, {x: 1, y: 1}], borderColor: COL.mut, borderDash: [5, 4], pointRadius: 0}]},
    options: {plugins: {legend: {labels: {boxWidth: 12}}, tooltip: {callbacks: {label: c => `Dijimos ${pc0(c.raw.x)} · subió ${pc0(c.raw.y)}${c.raw.n ? ' (' + c.raw.n + ' casos)' : ''}`}}}, scales: {x: {min: 0, max: 1, title: {display: true, text: 'Probabilidad que dijimos'}, ticks: {callback: v => pc0(v)}}, y: {min: 0, max: 1, title: {display: true, text: 'Lo que pasó'}, ticks: {callback: v => pc0(v)}}}}});
}

// ---------------------------------------------------------------- MI LISTA
function vLista() {
  const d = S.d, l = S.fav.map(act).filter(Boolean);
  const opt = d.clases.map(c => `<optgroup label="${esc(c)}">${d.activos.filter(x => x.clase === c && !isFav(x.id)).map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}</optgroup>`).join('');
  let h = hero('Mi lista', `Tus activos, <span class="grad">de un vistazo</span>`, 'Se guarda en este navegador (no hay cuenta todavía). Con la estrella ☆ puedes agregar activos desde cualquier tabla.');
  h += `<div class="card"><div class="sel"><select id="add"><option value="">Agregar activo…</option>${opt}</select><button class="btn" id="exp">Exportar</button><button class="btn" id="imp">Importar</button></div><div id="io"></div></div>`;
  if (!l.length) h += '<div class="card"><p class="muted">Tu lista está vacía. Agrega activos con el selector de arriba o con la estrella ☆ en “Mañana” y “Mercados”.</p></div>';
  else {
    h += `<div class="card"><div class="scroll"><table class="tb"><thead><tr><th class="l">Activo</th><th>Precio</th><th>30 días</th><th>1 día</th><th style="min-width:150px">Sube ▲ / Baja ▼ mañana</th><th>Sube ▲ / Baja ▼ 1 mes</th><th>Riesgo</th></tr></thead><tbody>
      ${l.map(a => `<tr data-id="${a.id}" style="cursor:pointer"><td class="l">${star(a.id)}<span class="nm">${esc(a.nombre)}</span><span class="tag">${esc(a.ticker)}</span></td><td data-live="${a.id}">${price(a.precio)}</td><td>${spark(a.spark, 80, 24)}</td><td class="${cls(a.d1)}">${pct(a.d1)}</td><td>${pbar(a.mc['1'].p_sube)}</td><td style="min-width:150px">${pbar(a.mc['30'].p_sube)}</td><td><span class="badge r-${a.riesgo}">${a.riesgo}</span></td></tr>`).join('')}</tbody></table></div></div>`;
    const nn = S.r ? S.r.noticias.filter(n => (n.activos || []).some(id => isFav(id))).slice(0, 9) : [];
    if (nn.length) h += `<div class="card"><h2>Noticias de tu lista</h2><div class="ngrid">${nn.map(newsCard).join('')}</div></div>`;
  }
  $('#vista').innerHTML = h;
  $('#add').onchange = e => { if (e.target.value) { toggleFav(e.target.value); vLista(); } };
  $$('tr[data-id]').forEach(tr => tr.onclick = () => go(tr.dataset.id));
  bindFav(vLista);
  $('#exp').onclick = () => { $('#io').innerHTML = `<p class="muted">Copia este texto para guardarlo o pasarlo a otro dispositivo:</p><textarea readonly rows="3" style="width:100%">${esc(JSON.stringify(S.fav))}</textarea>`; };
  $('#imp').onclick = () => { $('#io').innerHTML = '<p class="muted">Pega aquí una lista exportada:</p><textarea id="tx" rows="3" style="width:100%"></textarea><div class="btns"><button class="btn pri" id="ok">Importar</button></div>';
    $('#ok').onclick = () => { try { const x = JSON.parse($('#tx').value); if (Array.isArray(x)) { S.fav = [...new Set(x.filter(i => typeof i === 'string' && act(i)))]; saveFav(); vLista(); } } catch (e) { $('#io').insertAdjacentHTML('beforeend', '<p class="neg">Texto inválido.</p>'); } }; };
  Object.keys(S.live).forEach(pintarVivo);
}

// ---------------------------------------------------------------- CUENTA
function vCuenta() {
  $('#vista').innerHTML = hero('Cuenta', `Próximamente: <span class="grad">tu cuenta</span>`, 'Hoy la página es abierta y no pide registro. Esta sección muestra hacia dónde va el producto.') + `
    <div class="grid2"><div class="card glow"><h2>Ingresar (aún no disponible)</h2>
      <div class="lock"><div class="sel"><input type="email" placeholder="correo@ejemplo.com" disabled></div><div class="sel"><input type="password" placeholder="contraseña" disabled></div><div class="btns"><button class="btn pri" disabled>Entrar</button><button class="btn" disabled>Crear cuenta</button></div></div>
      <p class="muted" style="font-size:13px">Por ahora tu lista (“Mi lista”) se guarda solo en este navegador.</p></div>
    <div class="card"><h2>Qué traerá una cuenta</h2><ul>
      <li>Mi lista sincronizada entre computador, tablet y celular.</li><li>Alertas por correo o Telegram: “avísame si BTC cae más de 5%” o “si sale una noticia de Nvidia”.</li>
      <li>Portafolio propio (tus posiciones de XTB y Binance cargadas a mano o por archivo) con riesgo y probabilidades calculados sobre lo que realmente tienes.</li><li>Historial de lo que decía el modelo cada día y cómo resultó.</li><li>Plan gratuito con lo esencial y plan Pro con alertas ilimitadas y más activos.</li></ul></div></div>
    <div class="note info">Esta página no vende señales de compra/venta ni promete rentabilidad. Su valor es mostrar riesgo y probabilidades de forma clara y honesta, incluyendo cuánto fallan.</div>`;
}

// ---------------------------------------------------------------- MÉTODO
function vMetodo() {
  $('#vista').innerHTML = hero('Método', `Cómo funciona <span class="grad">(y qué no hace)</span>`, '') + `<div class="card">
  <h3>Actualización continua sin gastar IA</h3><p>Todo se calcula con programas normales (Python en GitHub Actions) y la página solo lee archivos ya listos: no hay IA corriendo cuando la usas. El informe completo (precios, simulaciones, probabilidades) se recalcula antes de la apertura de Tokio, Europa, Santiago y Nueva York y tras el cierre de Wall Street; los fines de semana hay un informe cripto. Las noticias y el radar cripto se actualizan cada 30 minutos, y esta página revisa si hay algo nuevo cada 3 minutos. Los precios cripto se mueven en vivo desde Binance mientras tienes la página abierta.</p>
  <h3>Datos</h3><p>Precios diarios de Yahoo Finance (≈12 años); noticias de RSS públicos (solo titular y enlace a la fuente); radar cripto de CoinGecko y DEX Screener; sentimiento Fear &amp; Greed de alternative.me. Si una fuente falla, esa parte queda con su último dato y el resto sigue.</p>
  <h3>Escenarios simulados (Monte Carlo)</h3><p>Para cada activo se simulan ${S.d.n_sims.toLocaleString('es-CL')} futuros posibles. Se toman los retornos diarios pasados, se normalizan por la volatilidad de ese momento y se sortean con reposición; luego se reescalan con una volatilidad simulada que sube después de sustos y baja en calma (tipo GARCH). Así las caídas bruscas, más frecuentes que en una campana normal, quedan representadas. La <b>deriva</b> (tendencia esperada) es solo el 25% de la histórica y está limitada, para no tratar un mercado alcista pasado como una promesa. De los escenarios salen: probabilidad de subir y de bajar, rango del 90% de los casos, pérdida 95% (VaR), pérdida promedio del peor 5% (CVaR) y probabilidad de tocar −10%.</p>
  <h3>Situaciones parecidas</h3><p>Se buscan en la historia del mismo activo los días con igual tendencia (precio vs. medias de 50 y 200 días) y volatilidad relativa, y se mide cuántas veces subió después, con rango de confianza y comparado con la frecuencia general.</p>
  <h3>Puntaje (0-100)</h3><p>30% tendencia, 25% momentum, 20% retorno por unidad de riesgo del último año, 15% probabilidad simulada de subir en un mes, 10% cercanía al máximo; se reduce hasta un 50% si el RSI supera 70. Mide lo que viene pasando, no lo que va a pasar.</p>
  <h3>Riesgo</h3><p>Según la volatilidad anual de los últimos 60 días: Bajo (&lt;12%), Medio (12–25%), Alto (25–45%), Muy alto (&gt;45%). Las cripto nuevas y memecoins pueden perder la mitad de su valor.</p>
  <h3>Límites</h3><ul><li>El <a href="#hist" style="color:var(--warn)">Historial</a> guarda lo que decía el modelo cada día y lo compara con lo que pasó, para que lo verifiques tú mismo.</li><li>La calibración histórica muestra que la dirección de un día o una semana es casi un cara o sello; lo confiable es el tamaño del riesgo.</li><li>No considera calendario económico, resultados de empresas ni feriados. Las noticias se muestran como contexto, no entran al cálculo.</li><li>No incluye flujos de ballenas on-chain ni de ETFs (requieren fuentes de pago).</li><li>Un ticker sin datos aparece listado en “Mercados” y se omite sin afectar el resto. Los datos pueden tener minutos u horas de retraso.</li></ul>
  <div class="note">Herramienta para leer el mercado y apoyar tus decisiones. No es asesoría financiera.</div></div>`;
}

// ---------------------------------------------------------------- arranque
cargar();
})();
