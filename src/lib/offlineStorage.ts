/**
 * LKDV — Offline Storage (IndexedDB, vanilla, 0 dépendance)
 *
 * DB : "lkdv-offline"   version : 1
 * Stores :
 *   - "routes"  : clé = routeId (string), valeur = OfflineRoute
 */

import { newId } from '@/lib/uuid';

const DB_NAME = 'lkdv-offline';
const DB_VERSION = 3; // 3 : instantanés hors ligne du Compas
const STORE_ROUTES = 'routes';
export const STORE_INVENTORY = 'inventory';
export const STORE_OFFLINE_ACTIONS = 'offline_actions';
/** Instantanés hors ligne des aventures du Compas (clé `${userId}:${tripId}`). */
export const STORE_COMPAS_SNAPSHOTS = 'compas_snapshots';

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

export interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

// ── Ouverture de la DB ────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available in this environment'));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_ROUTES)) {
        db.createObjectStore(STORE_ROUTES, { keyPath: 'routeId' });
      }
      if (!db.objectStoreNames.contains(STORE_INVENTORY)) {
        db.createObjectStore(STORE_INVENTORY, { keyPath: 'userId' });
      }
      if (!db.objectStoreNames.contains(STORE_OFFLINE_ACTIONS)) {
        db.createObjectStore(STORE_OFFLINE_ACTIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_COMPAS_SNAPSHOTS)) {
        db.createObjectStore(STORE_COMPAS_SNAPSHOTS, { keyPath: 'key' });
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
 * Place prise sur l'appareil par une randonnée gardée hors ligne : son tracé
 * et ses points dans IndexedDB (taille du JSON en UTF-8), plus les tuiles
 * d'un ancien téléchargement s'il en reste (plus aucune n'est téléchargée
 * depuis le plan 1.6).
 */
export async function getOfflineRouteSize(route: OfflineRoute): Promise<number> {
  let stored = 0;
  try {
    stored = new TextEncoder().encode(JSON.stringify(route)).byteLength;
  } catch {
    stored = 0;
  }
  return stored + (await getOfflineTileSize(route.routeId));
}

/**
 * Taille en octets du cache de tuiles d'un ancien téléchargement (Cache API).
 * Retourne 0 si non supporté ou s'il n'y en a pas.
 */
export async function getOfflineTileSize(routeId: string): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  try {
    const cacheName = `lkdv-tiles-route-${routeId}`;
    // `caches.open` créerait un cache vide pour chaque randonnée : on regarde d'abord.
    if (!(await caches.has(cacheName))) return 0;
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

// ── API publique pour Inventaire et Offline Actions ───────────────────────────────────

export async function saveInventoryOffline(userId: string, inventory: any[]): Promise<void> {
  const db = await openDB();
  await storePut(db, STORE_INVENTORY, { userId, inventory, updatedAt: Date.now() });
  db.close();
}

export async function getInventoryOffline(userId: string): Promise<any[] | undefined> {
  const db = await openDB();
  const result = await storeGet<{ userId: string; inventory: any[] }>(db, STORE_INVENTORY, userId);
  db.close();
  return result?.inventory;
}

export async function enqueueOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp'>): Promise<void> {
  const db = await openDB();
  const fullAction: OfflineAction = {
    ...action,
    id: newId(),
    timestamp: Date.now(),
  };
  await storePut(db, STORE_OFFLINE_ACTIONS, fullAction);
  db.close();
}

export async function getOfflineActions(): Promise<OfflineAction[]> {
  const db = await openDB();
  const results = await storeGetAll<OfflineAction>(db, STORE_OFFLINE_ACTIONS);
  db.close();
  return results.sort((a, b) => a.timestamp - b.timestamp);
}

export async function clearOfflineAction(id: string): Promise<void> {
  const db = await openDB();
  await storeDelete(db, STORE_OFFLINE_ACTIONS, id);
  db.close();
}

// ── Instantanés hors ligne du Compas ───────────────────────────────────────────
// Données d'un compte : jamais dans le cache du service worker (SEC-1), seulement
// ici, sur l'appareil, et effacées au changement de compte ou à la déconnexion.

export async function saveCompasSnapshot(snapshot: { key: string; userId: string }): Promise<void> {
  const db = await openDB();
  await storePut(db, STORE_COMPAS_SNAPSHOTS, snapshot);
  db.close();
}

export async function listCompasSnapshots<T extends { userId: string }>(): Promise<T[]> {
  const db = await openDB();
  const all = await storeGetAll<T>(db, STORE_COMPAS_SNAPSHOTS);
  db.close();
  return all;
}

export async function deleteCompasSnapshot(key: string): Promise<void> {
  const db = await openDB();
  await storeDelete(db, STORE_COMPAS_SNAPSHOTS, key);
  db.close();
}

/** Garde seulement les instantanés du compte connecté (aucun si `keepUserId` est null). */
export async function purgeCompasSnapshots(keepUserId: string | null): Promise<void> {
  const db = await openDB();
  const all = await storeGetAll<{ key: string; userId: string }>(db, STORE_COMPAS_SNAPSHOTS);
  for (const s of all) if (s.userId !== keepUserId) await storeDelete(db, STORE_COMPAS_SNAPSHOTS, s.key);
  db.close();
}
