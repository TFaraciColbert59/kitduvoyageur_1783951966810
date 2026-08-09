// LKDV Service Worker v3
// - Shell app-shell precache + network-first navigation w/ offline.html fallback
// - API network-only
// - Tile caching (Prompt #4): cache-first, per-route caches `lkdv-tiles-route-{routeId}`
const CACHE_NAME = 'lkdv-cache-v2';

const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/app_logo.png',
  '/favicon.ico',
  '/no_image.png'
];

// Tile providers (ExplorerMap / carte-interactive, Prompt #4). Leaflet
// utilise des sous-domaines {s} (a/b/c…) : on canonicalise l'URL pour que
// les clés de cache restent stables quelle que soit la sous-domaine.
const TILE_HOSTS = [
  'tile.opentopomap.org',
  'tile.openstreetmap.org',
  'basemaps.cartocdn.com',
  'server.arcgisonline.com',
];
const ROUTE_CACHE_PREFIX = 'lkdv-tiles-route-';

let activeRouteId = null;

function isTileUrl(href) {
  try {
    const host = new URL(href).hostname;
    return TILE_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

/** Normalise l'URL d'une tuile pour ignorer la sous-domaine {s}. */
function canonicalTileUrl(href) {
  try {
    const u = new URL(href);
    for (const h of TILE_HOSTS) {
      if (u.hostname.endsWith('.' + h)) {
        u.hostname = h;
        break;
      }
    }
    u.search = '';
    return u.href;
  } catch {
    return href;
  }
}

// Search every per-route tile cache for a cached tile (via son URL canonique).
async function matchAnyRouteTile(request) {
  const canonical = canonicalTileUrl(request.url);
  const names = (await caches.keys()).filter((n) => n.startsWith(ROUTE_CACHE_PREFIX));
  for (const name of names) {
    const hit = await caches.match(canonical, { cacheName: name });
    if (hit) return hit;
  }
  return null;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Keep the app-shell cache and all per-route tile caches.
          if (cacheName !== CACHE_NAME && !cacheName.startsWith(ROUTE_CACHE_PREFIX)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Controler message: route actuele pour le cache des tuiles hors-ligne.
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'lkdv:set-active-route') {
    activeRouteId = String(event.data.routeId || '');
    return;
  }
  if (event.data.type === 'lkdv:delete-route') {
    const cacheName = ROUTE_CACHE_PREFIX + String(event.data.routeId);
    caches.delete(cacheName).catch(() => {});
    if (activeRouteId === String(event.data.routeId)) activeRouteId = null;
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API requests: network-only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Tile requests: cache-first across per-route caches, then network + stash
  if (isTileUrl(url.href)) {
    event.respondWith(
      matchAnyRouteTile(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.ok && activeRouteId) {
            const cacheName = ROUTE_CACHE_PREFIX + activeRouteId;
            caches.open(cacheName).then((cache) => {
              cache.put(event.request, response.clone()).catch(() => {});
            }).catch(() => {});
          }
          return response;
        });
      })
    );
    return;
  }

  // Navigation requests: network-first, fallback to offline.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline.html');
      })
    );
    return;
  }

  // Static assets (images, fonts, CSS, JS): cache-first, fallback to network
  const isStaticAsset =
    event.request.destination === 'image' ||
    event.request.destination === 'font' ||
    event.request.destination === 'style' ||
    event.request.destination === 'script' ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|css|js|woff|woff2|ttf|eot)$/i);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((fetchResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
    return;
  }

  // Default: network-first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});