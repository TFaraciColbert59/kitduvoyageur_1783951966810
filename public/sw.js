/* LKDV — Mon Matériel : service worker hors-ligne (mise en cache des routes clés). */
const CACHE = 'lkdv-materiel-v1';
const OFFLINE_URLS = ['/materiel', '/materiel/kits', '/materiel/inventaire'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  if (request.url.includes('/api/materiel')) {
    e.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }
  if (OFFLINE_URLS.some((u) => request.url.includes(u))) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
  }
});
