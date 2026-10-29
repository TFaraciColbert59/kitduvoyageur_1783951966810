/* Explorer v2 — service worker de zone hors ligne.
 *
 * Ne s'active que sur les pages /explorer. Deux responsabilités :
 *   1. mettre en cache les tuiles du fond vectoriel et du relief DEM ;
 *   2. télécharger une zone à la demande (`XP_PREFETCH_ZONE`) et rendre le
 *      compte (tuiles traitées, octets) pour que l'interface affiche une taille
 *      réelle avant et après le téléchargement.
 *
 * Toute écriture passe par IndexedDB côté page (`offline/queue.ts`) ; ce worker
 * ne fait que du cache réseau.
 */

const CACHE = 'xp-zone-v1';
const MAX_TILES = 2000;

const TILE_PATTERNS = [
  // Tout l'hôte : style JSON, tuiles vectorielles, glyphes et sprites — sans le
  // style, la carte reste blanche en mode avion même si les tuiles sont en cache.
  /^https:\/\/tiles\.openfreemap\.org\//,
  /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\//,
];

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

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Document /explorer : réseau d'abord, cache ensuite → la page se rouvre en
  // mode avion dès qu'une zone a été téléchargée.
  if (event.request.mode === 'navigate' && url.includes('/explorer')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const response = await fetch(event.request);
          if (response.ok) await cache.put(event.request, response.clone());
          return response;
        } catch (error) {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      })(),
    );
    return;
  }

  // Ressources applicatives immuables (chunks JS/CSS hachés) : sans elles, la
  // page se recharge hors ligne mais n'hydrate pas (carte blanche).
  const sameOrigin = new URL(url).origin === self.location.origin;
  const appAsset =
    url.includes('/_next/static/') ||
    // Worker MapLibre + fonds GeoJSON + service worker lui-même.
    url.includes('/maplibre/') ||
    url.includes('/data/explorer-v2/');
  if (event.request.method === 'GET' && sameOrigin && appAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(event.request);
        if (hit) return hit;
        try {
          const response = await fetch(event.request);
          if (response.ok) await cache.put(event.request, response.clone());
          return response;
        } catch (error) {
          return new Response('', { status: 504 });
        }
      })(),
    );
    return;
  }

  if (!TILE_PATTERNS.some((pattern) => pattern.test(url))) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(event.request);
      if (hit) return hit;
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      } catch (error) {
        return new Response('', { status: 504 });
      }
    })(),
  );
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
  const urls = [];
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
        const response = await fetch(url, { mode: 'cors' });
        if (response.ok) {
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
