/**
 * LKDV — Offline Storage (IndexedDB, vanilla, 0 dépendance)
 *
 * DB : "lkdv-offline"   version : 1
 * Stores :
 *   - "routes"  : clé = routeId (string), valeur = OfflineRoute
 */

const DB_NAME = 'lkdv-offline';
const DB_VERSION = 1;
const STORE_ROUTES = 'routes';

export interface OfflineRoute {
  routeId: string;
  name: string;
  distanceKm: number | null;
  difficulty: string | null;
  geojson: object | null;            // GeoJSON LineString de la route
  pois: OfflinePoi[];
  cachedAt: string;                  // ISO date
  tileCount: number;                 // nombre de tuiles téléchargées
}

export interface OfflinePoi {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
}

// ── Ouverture de la DB ────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_ROUTES)) {
        db.createObjectStore(STORE_ROUTES, { keyPath: 'routeId' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Helpers génériques ────────────────────────────────────────────────────────

function storeGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function storePut(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function storeDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function storeGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

// ── API publique ──────────────────────────────────────────────────────────────

/** Sauvegarde (ou écrase) les métadonnées d'une route hors-ligne. */
export async function saveRouteOffline(route: OfflineRoute): Promise<void> {
  const db = await openDB();
  await storePut(db, STORE_ROUTES, route);
  db.close();
}

/** Récupère les données d'une route hors-ligne, ou undefined si absente. */
export async function getRouteOffline(routeId: string): Promise<OfflineRoute | undefined> {
  const db = await openDB();
  const result = await storeGet<OfflineRoute>(db, STORE_ROUTES, routeId);
  db.close();
  return result;
}

/** Supprime une route hors-ligne de IndexedDB. */
export async function deleteRouteOffline(routeId: string): Promise<void> {
  const db = await openDB();
  await storeDelete(db, STORE_ROUTES, routeId);
  db.close();
}

/** Retourne toutes les routes hors-ligne enregistrées. */
export async function listOfflineRoutes(): Promise<OfflineRoute[]> {
  const db = await openDB();
  const results = await storeGetAll<OfflineRoute>(db, STORE_ROUTES);
  db.close();
  return results;
}

/**
 * Retourne une estimation de la taille en octets du cache de tuiles SW
 * pour une route donnée (via Cache API). Retourne 0 si non supporté.
 */
export async function getOfflineTileSize(routeId: string): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  try {
    const cacheName = `lkdv-tiles-route-${routeId}`;
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    let total = 0;
    for (const req of keys) {
      const resp = await cache.match(req);
      if (resp) {
        const buf = await resp.clone().arrayBuffer();
        total += buf.byteLength;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Retourne une taille formatée lisible (ex: "4.2 Mo", "820 Ko").
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
