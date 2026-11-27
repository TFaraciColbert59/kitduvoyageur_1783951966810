/* Explorer v2 — service worker de zone hors ligne.
 *
 * Ne s'active que sur les pages /explorer. Trois responsabilités :
 *   1. mettre en cache le moteur WASM de routage (`/wasm/lkdv_route_core.wasm`),
 *      les styles/sprites/glyphes (`tiles.openfreemap.org`) en stale-while-revalidate,
 *      ainsi que les tuiles vectorielles et DEM Terrarium AWS en cache-first ;
 *   2. télécharger une zone à la demande (`XP_PREFETCH_ZONE`) et rendre le
 *      compte (tuiles traitées, octets) pour que l'interface affiche une taille
 *      réelle avant et après le téléchargement ;
 *   3. ne JAMAIS mettre en cache de réponses API authentifiées ou privées
 *      (`Authorization`, `/api/*`, `Cache-Control: private` / `no-store`).
 *
 * Toute écriture passe par IndexedDB côté page (`offline/queue.ts`) ; ce worker
 * ne fait que du cache réseau.
 */

const CACHE = 'xp-zone-v1';
const MAX_TILES = 2000;
const WASM_ROUTE_CORE_PATH = '/wasm/lkdv_route_core.wasm';

/** Styles, sprites, glyphes et manifeste OpenFreeMap : stale-while-revalidate. */
const STYLE_ASSET_PATTERNS = [
  /^https:\/\/tiles\.openfreemap\.org\/(styles|sprites|fonts)\//,
  /^https:\/\/tiles\.openfreemap\.org\/planet(\?|$)/,
];

/** Tuiles vectorielles OpenFreeMap & DEM AWS Terrarium : cache-first. */
const IMMUTABLE_TILE_PATTERNS = [
  /^https:\/\/tiles\.openfreemap\.org\//,
  /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\/terrarium\//,
  /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\//,
];

function hasAuthorizationHeader(request) {
  try {
    return Boolean(request && request.headers && request.headers.has('Authorization'));
  } catch {
    return false;
  }
}

function isCacheableResponse(response) {
  if (!response || !response.ok) return false;
  const cacheControl = response.headers.get('Cache-Control') || '';
  if (/\b(private|no-store)\b/i.test(cacheControl)) return false;
  if (response.headers.has('Set-Cookie')) return false;
  return true;
}

async function safeCachePut(cache, request, response) {
  if (hasAuthorizationHeader(request) || !isCacheableResponse(response)) return;
  try {
    await cache.put(request, response);
  } catch {
    /* quota dépassé ou requête non sérialisable : ignorer sans bloquer la réponse */
  }
}

function lon2tile(lon, z) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function lat2tile(lat, z) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

function tilesFor(bounds, z) {
  const [w, s, e, n] = bounds;
  const x0 = lon2tile(w, z);
  const x1 = lon2tile(e, z);
  const y0 = lat2tile(n, z);
  const y1 = lat2tile(s, z);
  const out = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) out.push({ z, x, y });
  }
  return out;
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      await safeCachePut(cache, request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 504 });
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        await safeCachePut(cache, request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (hit) {
    event.waitUntil(refresh);
    return hit;
  }

  const network = await refresh;
  if (network) return network;
  return new Response('', { status: 504 });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        const wasmReq = new Request(WASM_ROUTE_CORE_PATH, { method: 'GET' });
        const existing = await cache.match(wasmReq);
        if (!existing) {
          const res = await fetch(wasmReq);
          if (isCacheableResponse(res)) {
            await safeCachePut(cache, wasmReq, res);
          }
        }
      } catch {
        /* pré-chargement WASM opportuniste : ne bloque jamais l'installation */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Ne jamais intercepter ni mettre en cache les requêtes authentifiées.
  if (hasAuthorizationHeader(request)) return;

  let parsedUrl;
  try {
    parsedUrl = new URL(request.url);
  } catch {
    return;
  }

  const url = request.url;
  const sameOrigin = parsedUrl.origin === self.location.origin;

  // Ne jamais mettre en cache les réponses d'API applicatives (données utilisateur / privées).
  if (sameOrigin && parsedUrl.pathname.startsWith('/api/')) return;

  // Document /explorer : réseau d'abord, cache ensuite → la page se rouvre en
  // mode avion dès qu'une zone a été téléchargée (sauf si réponse privée).
  if (request.mode === 'navigate' && parsedUrl.pathname.startsWith('/explorer')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const response = await fetch(request);
          if (isCacheableResponse(response)) {
            await safeCachePut(cache, request, response.clone());
          }
          return response;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          return new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      })(),
    );
    return;
  }

  // Ressources applicatives immuables (chunks JS/CSS hachés, WASM de routage,
  // worker MapLibre et fonds GeoJSON) : cache-first pour fonctionner hors ligne.
  const isAppAsset =
    parsedUrl.pathname === WASM_ROUTE_CORE_PATH ||
    parsedUrl.pathname.startsWith('/wasm/') ||
    parsedUrl.pathname.startsWith('/_next/static/') ||
    parsedUrl.pathname.startsWith('/maplibre/') ||
    parsedUrl.pathname.startsWith('/data/explorer-v2/');

  if (sameOrigin && isAppAsset) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Styles, sprites, glyphes et manifeste OpenFreeMap : stale-while-revalidate.
  if (STYLE_ASSET_PATTERNS.some((pattern) => pattern.test(url))) {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }

  // Tuiles vectorielles OpenFreeMap & tuiles DEM AWS Terrarium : cache-first.
  if (IMMUTABLE_TILE_PATTERNS.some((pattern) => pattern.test(url))) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'XP_PREFETCH_ZONE') {
    event.waitUntil(prefetch(data.payload, event.source));
  }
  if (data.type === 'XP_PURGE_ZONE') {
    event.waitUntil(caches.delete(CACHE).then(() => event.source?.postMessage({ type: 'XP_PURGE_DONE' })));
  }
});

/** Modèle d'URL courant du fond vectoriel (le préfixe est daté). */
async function vectorTemplate() {
  try {
    const res = await fetch('https://tiles.openfreemap.org/planet', { cache: 'no-store' });
    const json = await res.json();
    const template = json?.tiles?.[0];
    if (typeof template === 'string') return template;
  } catch {
    /* repli : aucun fond, seules les tuiles DEM seront mises en cache */
  }
  return null;
}

async function prefetch(payload, client) {
  const { bounds, minZoom, maxZoom, estimateOnly } = payload;
  const plan = [];
  for (let z = minZoom; z <= maxZoom; z += 1) plan.push(...tilesFor(bounds, z));
  const tiles = plan.slice(0, MAX_TILES);

  if (estimateOnly) {
    client?.postMessage({ type: 'XP_PREFETCH_ESTIMATE', tiles: tiles.length, capped: plan.length > MAX_TILES });
    return;
  }

  const template = await vectorTemplate();
  const urls = [
    WASM_ROUTE_CORE_PATH,
    'https://tiles.openfreemap.org/styles/positron',
    'https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/0-255.pbf',
  ];
  for (const tile of tiles) {
    if (template) {
      urls.push(
        template
          .replace('{z}', tile.z)
          .replace('{x}', tile.x)
          .replace('{y}', tile.y),
      );
    }
    urls.push(
      `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${tile.z}/${tile.x}/${tile.y}.png`,
    );
  }

  const cache = await caches.open(CACHE);
  let done = 0;
  let bytes = 0;
  let ok = 0;
  let failed = 0;
  const total = urls.length;

  // Concurrence 8 : un téléchargement séquentiel de 500 tuiles dépasse la minute.
  const queue = urls.slice();
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      if (!url) return;
      try {
        const cached = await cache.match(url);
        if (cached) {
          ok += 1;
          done += 1;
          continue;
        }
        const isSameOrigin = url.startsWith('/');
        const response = await fetch(url, isSameOrigin ? undefined : { mode: 'cors' });
        if (isCacheableResponse(response)) {
          // La taille se mesure avant la mise en cache : un clone déjà consommé
          // renvoie un blob vide (constaté en recette : taille affichée à 0).
          const buffer = await response.clone().arrayBuffer();
          bytes += buffer.byteLength;
          await cache.put(url, response);
          ok += 1;
        } else {
          failed += 1;
        }
      } catch (error) {
        failed += 1;
        if (failed <= 3) {
          client?.postMessage({
            type: 'XP_PREFETCH_ERROR',
            url: String(url).slice(0, 120),
            message: String(error && error.message ? error.message : error).slice(0, 200),
          });
        }
      } finally {
        done += 1;
        if (done % 25 === 0 || done === total) {
          client?.postMessage({ type: 'XP_PREFETCH_PROGRESS', done, total, bytes });
        }
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, () => worker()));
  client?.postMessage({ type: 'XP_PREFETCH_DONE', done, total, bytes, ok, failed });
}
