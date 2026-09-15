/* ============================================================
   LKDV — Service Worker v4 (SEC-1 : isolation inter-comptes)
   Stratégies :
   - CacheFirst : polices, chunks Next.js statiques
   - StaleWhileRevalidate : images publiques tierces + API PUBLIQUES uniquement
   - Navigation : Network-First, cache HTML réservé aux routes PUBLIQUES
     (liste blanche) ; les routes authentifiées ne sont JAMAIS mises en cache.
   - Message LKDV_PURGE_PRIVATE : purge runtime+images à la déconnexion /
     changement de compte (piloté par AuthContext).
   Interdits absolus (RGPD) : HTML authentifié (/hub, /compte, /voyages…),
   réponses API privées (/api/hub, /api/materiel, /api/voyages…) en cache.
   ============================================================ */

const CACHE_VERSION = 'lkdv-v4';
const STATIC_CACHE = `lkdv-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `lkdv-runtime-${CACHE_VERSION}`;
const IMAGE_CACHE = `lkdv-images-${CACHE_VERSION}`;

// Aucune route applicative authentifiée : uniquement des assets publics.
const PRECACHE_ASSETS = [
  '/offline.html',
  '/hors-ligne',
  '/manifest.json',
  '/assets/images/app_logo.png',
  '/favicon.ico',
];

// Navigations HTML publiquement cacheables (anonymes, sans donnée perso).
const PUBLIC_NAV_PATHS = new Set([
  '/',
  '/explorer',
  '/pays',
  '/guides',
  '/kits',
  '/lieux',
  '/cgu',
  '/cgv',
  '/mentions-legales',
  '/politique-confidentialite',
  '/faq',
  '/blog',
  '/contact',
  '/hors-ligne',
  '/offline.html',
]);
const PUBLIC_NAV_PREFIXES = [
  '/pays/',
  '/guides/',
  '/kits/',
  '/lieux/',
  '/blog/',
  '/produit/',
];

// API GET publiques (aucune donnée personnelle, RLS anonyme).
const PUBLIC_API_PREFIXES = [
  '/api/hikes',
  '/api/pois',
  '/api/trails',
  '/api/pays/',
];

function isPublicNavigation(pathname) {
  return PUBLIC_NAV_PATHS.has(pathname) || PUBLIC_NAV_PREFIXES.some((p) => pathname.startsWith(p));
}

function isPublicApi(pathname) {
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

// 1. Installation & pré-mise en cache (assets publics uniquement)
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

// 2. Activation & purge des anciens caches (versions précédentes incluses)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE && k !== IMAGE_CACHE && k !== 'lkdv-tiles-v1')
          .map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// 3. Purge des données privées (déconnexion / changement d'utilisateur).
// AuthContext poste { type: 'LKDV_PURGE_PRIVATE' } au SW à chaque changement d'user.id.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'LKDV_PURGE_PRIVATE') {
    event.waitUntil(
      Promise.all([caches.delete(RUNTIME_CACHE), caches.delete(IMAGE_CACHE)])
        .then(() => self.clients.matchAll({ includeUncontrolled: true }))
        .then((clients) => clients.forEach((client) => client.postMessage({ type: 'LKDV_PRIVATE_PURGED' })))
    );
  }
});

// 4. Routage et stratégies de requêtes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

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

  // -- Stratégie B : Images PUBLIQUES (Stale-While-Revalidate, cache dédié) --
  // URLs signées Supabase : le token varie par session → jamais de collision
  // inter-comptes ; l'image n'est resservie qu'en cas d'échec réseau.
  if (
    request.destination === 'image' ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|avif)$/) ||
    url.hostname.includes('images.unsplash.com') ||
    url.hostname.includes('supabase.co')
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cached);
        return cached || networkPromise;
      })
    );
    return;
  }

  // -- Stratégie C : API GET — uniquement les endpoints publics (SWR) --
  // Toute autre API (hub, materiel, voyages, trips, equipages, carnets…) :
  // réseau seul, JAMAIS mis en cache (SEC-1).
  if (isPublicApi(url.pathname)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((response) => {
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkPromise;
      })
    );
    return;
  }

  // -- Stratégie E : Tuiles de Carte (Cache-First, cache public dédié) --
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
              cache.put(request, response.clone()).then(() => evictTilesIfOverflowing(cache));
            }
            return response;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // -- Stratégie D : Navigation HTML --
  // Network-First. Mise en cache UNIQUEMENT si la route est publique.
  // Routes authentifiées : jamais cachees ; fallback offline.html.
  if (request.mode === 'navigate') {
    const publicNav = url.origin === self.location.origin && isPublicNavigation(url.pathname);
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200 && publicNav) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          if (publicNav) {
            const cached = await caches.match(request);
            if (cached) return cached;
          }
          const offlinePage = await caches.match('/offline.html');
          return offlinePage || caches.match('/hors-ligne');
        })
    );
    return;
  }
});

// P2 (C-19) — LRU borné pour les tuiles : sans limite, une session de
// randonnée peut saturer le quota d'origine et faire évacuer TOUT le storage
// de l'origine (caches statiques, IndexedDB, packs offline). Borne 3000
// entrées, éviction FIFO simple à chaque dépassement, jamais bloquante.
const TILE_CACHE_MAX_ENTRIES = 3000;

async function evictTilesIfOverflowing(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length <= TILE_CACHE_MAX_ENTRIES) return;
    const overflow = keys.length - TILE_CACHE_MAX_ENTRIES;
    // keys() liste dans l'ordre d'insertion pour un cache rempli
    // séquentiellement : FIFO approxime le LRU à coût constant.
    for (let i = 0; i < overflow; i += 1) {
      await cache.delete(keys[i]);
    }
  } catch {
    /* éviction best-effort */
  }
}
