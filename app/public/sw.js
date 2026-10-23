// mistLAB service worker: cache-first for same-origin GETs so built packs work offline.
// Asset packs by chapter (M2+) are precached via postMessage({ type: 'cache-pack', urls }).
const CACHE = 'mistlab-v1';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg']))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && !k.startsWith('mistlab-books-')).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // ignoreVary: the page loads its module script with crossorigin and the server may send 'Vary: Origin', while copies
  // saved by cache-pack were fetched without an Origin header; they are the same file.
  e.respondWith(caches.match(req, { ignoreSearch: req.mode === 'navigate', ignoreVary: true }).then((hit) => {
    const net = fetch(req).then((res) => {
      // Copy before the page reads the body: a clone taken later, after the body is used, throws and nothing is kept.
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
      return res;
    });
    if (hit) { net.catch(() => {}); return hit; }
    return net;
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
