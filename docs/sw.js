/* Probabily · service worker: modo app, funciona sin conexión con lo último que viste y muestra avisos.
   Los datos NO se guardan aquí: siempre se piden frescos a GitHub. */
const V = 'probabily-v2';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'config.js', 'vendor/chart.umd.js', 'manifest.webmanifest', 'icons/icon-192.png'];
const DATOS = 'https://raw.githubusercontent.com/Fxlipx28/Probabily/datos/latest.json';

self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('probabily-') && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Primero la red (así siempre ves la versión nueva); si no hay internet, lo último guardado.
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(r, {cache: 'no-cache'}).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; })
    .catch(() => caches.match(r).then(x => x || caches.match('index.html'))));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './#hoy';
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(cs => {
    for (const c of cs) { if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
// Aviso en segundo plano (solo algunos navegadores de Android con la app instalada): revisa si hay informe nuevo.
self.addEventListener('periodicsync', e => {
  if (e.tag !== 'probabily-senales') return;
  e.waitUntil((async () => {
    try {
      const d = await (await fetch(DATOS + '?' + Date.now())).json();
      const key = d.sesion.id + '|' + d.sesion.ref, st = await caches.open('probabily-estado');
      const prev = await st.match('k').then(r => r && r.text());
      await st.put('k', new Response(key));
      if (prev && prev !== key && (await self.registration.getNotifications({tag: 'senales'})).length === 0) {
        await self.registration.showNotification('Probabily: informe nuevo', {body: 'Hay señales nuevas para mañana. Ábrelas en la app.', tag: 'senales', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: {url: './#hoy'}});
      }
    } catch (err) { /* sin conexión: se reintenta */ }
  })());
});
