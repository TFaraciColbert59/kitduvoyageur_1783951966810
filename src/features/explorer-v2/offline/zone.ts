'use client';

/**
 * Zone hors ligne de l'Explorer v2 (05_DONNEES §7).
 *
 * Le service worker (`public/explorer-v2-sw.js`) met en cache les tuiles du
 * fond et du relief ; ce module pilote le téléchargement, mesure la taille
 * réelle et conserve en IndexedDB les données de la zone (repères, itinéraires).
 */

import { EXPLORER_SW_PATH, EXPLORER_SW_SCOPE } from '@/lib/pwa/serviceWorkerScopes';

export interface ZoneBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface ZoneProgress {
  done: number;
  total: number;
  bytes: number;
}

const ZONE_CACHE = 'xp-zone-v1';
const MAX_ZONE_TILES = 400;
const DB_NAME = 'lkdv-explorer-v2';
const STORE = 'zones';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function putZone(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function getZone<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => resolve((request.result as T) ?? null);
    request.onerror = () => resolve(null);
  });
}

export async function registerOfflineWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    // Portée propre : sur `/`, il remplaçait le worker de l'app et la page se rechargeait en boucle.
    await navigator.serviceWorker.register(EXPLORER_SW_PATH, { scope: EXPLORER_SW_SCOPE });
    // `ready` attend l'activation : sans cela, le premier téléchargement part
    // avant que le worker ne contrôle la page (constaté en recette).
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
  } catch {
    return null;
  }
}

/** Modèle d'URL courant du fond vectoriel (le préfixe est daté). */
async function vectorTemplate(): Promise<string | null> {
  try {
    const res = await fetch('https://tiles.openfreemap.org/planet');
    const json = (await res.json()) as { tiles?: string[] };
    return json.tiles?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Tuiles couvrant l'emprise, zooms inclus. */
function tilesFor(bounds: ZoneBounds, minZoom: number, maxZoom: number) {
  const out: Array<{ z: number; x: number; y: number }> = [];
  for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) {
    const x0 = lonToTileX(bounds.west, zoom);
    const x1 = lonToTileX(bounds.east, zoom);
    const y0 = latToTileY(bounds.north, zoom);
    const y1 = latToTileY(bounds.south, zoom);
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) out.push({ z: zoom, x, y });
    }
  }
  return out;
}

function lonToTileX(lon: number, zoom: number) {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}
function latToTileY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
}

/** Nombre de tuiles nécessaires (estimation immédiate, sans réseau). */
export function countTiles(bounds: ZoneBounds, minZoom = 10, maxZoom = 15): number {
  let total = 0;
  for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) {
    const x = Math.abs(lonToTileX(bounds.east, zoom) - lonToTileX(bounds.west, zoom)) + 1;
    const y = Math.abs(latToTileY(bounds.south, zoom) - latToTileY(bounds.north, zoom)) + 1;
    total += x * y;
  }
  return total;
}

export interface ZoneRecord {
  bounds: ZoneBounds;
  tiles: number;
  bytes: number;
  /** Tuiles effectivement en cache et tuiles en échec. */
  ok?: number;
  failed?: number;
  minZoom: number;
  maxZoom: number;
  savedAt: number;
  /** Données de la zone : repères et itinéraires déjà chargés. */
  pois: unknown[];
  routes: unknown[];
}

export async function downloadZone(
  bounds: ZoneBounds,
  data: { pois: unknown[]; routes: unknown[] },
  options: { minZoom?: number; maxZoom?: number; onProgress?: (progress: ZoneProgress) => void } = {},
): Promise<ZoneRecord> {
  const minZoom = options.minZoom ?? 10;
  const maxZoom = options.maxZoom ?? 15;

  // Le téléchargement se fait **dans la page** : un `fetch` cross-origin depuis
  // le service worker échoue silencieusement dans certains environnements
  // (constaté : 0 tuile en cache). La page écrit dans le même Cache Storage que
  // celui que le worker consulte pour servir les tuiles.
  await registerOfflineWorker();

  const plan = countTiles(bounds, minZoom, maxZoom);
  const record: ZoneRecord = {
    bounds,
    tiles: Math.min(plan, MAX_ZONE_TILES),
    bytes: 0,
    ok: 0,
    failed: 0,
    minZoom,
    maxZoom,
    savedAt: Date.now(),
    pois: data.pois,
    routes: data.routes,
  };

  const template = await vectorTemplate();
  const urls: string[] = [];
  // Le style et les glyphes conditionnent l'affichage de la carte hors ligne.
  urls.push('https://tiles.openfreemap.org/styles/positron');
  urls.push('https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/0-255.pbf');
  for (const tile of tilesFor(bounds, minZoom, maxZoom).slice(0, MAX_ZONE_TILES)) {
    if (template) {
      urls.push(template.replace('{z}', String(tile.z)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y)));
    }
    urls.push(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${tile.z}/${tile.x}/${tile.y}.png`);
  }

  const cache = typeof caches !== 'undefined' ? await caches.open(ZONE_CACHE) : null;
  let done = 0;
  const queue = urls.slice();
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      if (!url) return;
      try {
        const cached = await cache?.match(url);
        if (cached) {
          record.ok = (record.ok ?? 0) + 1;
        } else {
          const response = await fetch(url, { mode: 'cors' });
          if (response.ok) {
            const buffer = await response.clone().arrayBuffer();
            record.bytes += buffer.byteLength;
            await cache?.put(url, response);
            record.ok = (record.ok ?? 0) + 1;
          } else {
            record.failed = (record.failed ?? 0) + 1;
          }
        }
      } catch {
        record.failed = (record.failed ?? 0) + 1;
      } finally {
        done += 1;
        if (done % 10 === 0 || done === urls.length) {
          options.onProgress?.({ done, total: urls.length, bytes: record.bytes });
        }
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, () => worker()));

  await putZone('current', record);
  return record;
}

export async function readZone(): Promise<ZoneRecord | null> {
  return getZone<ZoneRecord>('current');
}

export async function purgeZone(): Promise<void> {
  const db = await openDb();
  if (db) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete('current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
  const registration = await navigator.serviceWorker?.getRegistration();
  const worker = registration?.active;
  worker?.postMessage({ type: 'XP_PURGE_ZONE' });
  if (typeof caches !== 'undefined') {
    await caches.delete(ZONE_CACHE);
  }
}
