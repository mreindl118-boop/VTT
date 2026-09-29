// mistLAB service worker: cache-first for same-origin GETs so built packs work offline.
// Asset packs by chapter (M2+) are precached via postMessage({ type: 'cache-pack', urls }).
const CACHE = 'mistlab-v1';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg']))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((hit) => {
    const net = fetch(req).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; });
    return hit || net;
  }));
});
self.addEventListener('message', (e) => {
  if (e.data?.type === 'cache-pack') caches.open(CACHE).then((c) => c.addAll(e.data.urls));
});
