// mistLAB service worker: cache-first for same-origin GETs so built packs work offline.
// Asset packs by chapter (M2+) are precached via postMessage({ type: 'cache-pack', urls }).
const CACHE = 'mistlab-v1';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg']))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && !k.startsWith('mistlab-books-')).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((hit) => {
    const net = fetch(req).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; });
    return hit || net;
  }));
});
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'cache-pack') return;
  // Optional: a named 'mistlab-books-*' cache (kept across updates) and a reply port that hears when it is done.
  const name = typeof e.data.cache === 'string' && e.data.cache.startsWith('mistlab-books-') ? e.data.cache : CACHE;
  const done = caches.open(name).then((c) => c.addAll(e.data.urls));
  if (e.waitUntil) e.waitUntil(done.catch(() => {}));
  const port = e.ports && e.ports[0];
  if (port) done.then(() => port.postMessage({ ok: true }), (err) => port.postMessage({ ok: false, error: String(err) }));
});
