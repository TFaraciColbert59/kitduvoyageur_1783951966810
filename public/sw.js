/* ============================================================
   LKDV — High-Performance Mobile Service Worker
   Stratégie multi-niveaux :
   - CacheFirst : polices Google, CSS/JS statiques Next.js, images locales
   - StaleWhileRevalidate : images distantes, routes API (hikes, carnets)
   - NetworkFirst : pages de navigation avec fallback offline
   ============================================================ */

const CACHE_VERSION = 'lkdv-v2';
const STATIC_CACHE = `lkdv-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `lkdv-runtime-${CACHE_VERSION}`;
const IMAGE_CACHE = `lkdv-images-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/',
  '/explorer',
  '/communaute',
  '/materiel',
  '/compte',
  '/pays',
  '/hors-ligne',
  '/offline.html',
  '/manifest.json',
  '/assets/images/app_logo.png',
  '/favicon.ico',
];

// 1. Installation & pré-mise en cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pré-cache partiel:', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activation & purge des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => !k.includes(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// 3. Routage et stratégies de requêtes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET ou externes non-visées
  if (request.method !== 'GET') return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // -- Stratégie A : Polices & Chunks JS/CSS Next.js (Cache-First) --
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com')
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // -- Stratégie B : Images (Stale-While-Revalidate avec cache dédié) --
  if (
    request.destination === 'image' ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|avif)$/) ||
    url.hostname.includes('images.unsplash.com') ||
    url.hostname.includes('supabase.co')
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // -- Stratégie C : API Routes GET (Stale-While-Revalidate) --
  if (url.pathname.startsWith('/api/hikes') || url.pathname.startsWith('/api/carnets') || url.pathname.startsWith('/api/materiel')) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // -- Stratégie E : Tuiles de Carte MapLibre / Leaflet / ESRI (Cache-First ultra-rapide) --
  if (
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('tile.opentopomap.org') ||
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('arcgisonline.com') ||
    url.hostname.includes('maplibre.org')
  ) {
    event.respondWith(
      caches.open('lkdv-tiles-v1').then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // -- Stratégie D : Navigation HTML (Network-First avec Fallback Cache/Offline) --
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offlinePage = await caches.match('/offline.html');
          return offlinePage || caches.match('/hors-ligne');
        })
    );
    return;
  }
});
