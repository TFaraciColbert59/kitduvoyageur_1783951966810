// Prompt #4 — mode hors-ligne : IndexedDB pour les données de randonnée
// (géométrie GeoJSON, POIs, métadonnées) téléchargées pour l'offline.
// Petite lib indexée par routeId, sans dépendance externe (idb non installé).

const DB_NAME = 'lkdv-offline-routes';
const STORE_NAME = 'routes';
const DB_VERSION = 1;

export interface OfflinePoi {
  id: number;
  name: string;
  category: string;
  distanceM: number;
  elevationM: string | null;
}

export interface OfflineRouteRecord {
  routeId: string;
  name: string;
  distanceKm: number | null;
  durationHours: number | null;
  difficulty: string | null;
  elevationGain: number | null;
  /** GeoJSON brut (LineString/MultiLineString). */
  geojson: unknown;
  pois: OfflinePoi[];
  /** Métadonnées utiles à l'affichage hors-ligne. */
  metadata: Record<string, unknown>;
  tileCount: number;
  downloadedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME, { keyPath: 'routeId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getRecord(db: IDBDatabase, routeId: string): Promise<OfflineRouteRecord | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(routeId);
    req.onsuccess = () => resolve(req.result as OfflineRouteRecord | undefined);
    req.onerror = () => reject(req.error);
  });
}

function getAllRecords(db: IDBDatabase): Promise<OfflineRouteRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result as OfflineRouteRecord[]) || []);
    req.onerror = () => reject(req.error);
  });
}

function putRecord(db: IDBDatabase, record: OfflineRouteRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function deleteRecord(db: IDBDatabase, routeId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(routeId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getOfflineRoute(routeId: string): Promise<OfflineRouteRecord | undefined> {
  const db = await openDb();
  try {
    return await getRecord(db, routeId);
  } finally {
    db.close();
  }
}

export async function listOfflineRoutes(): Promise<OfflineRouteRecord[]> {
  const db = await openDb();
  try {
    return await getAllRecords(db);
  } finally {
    db.close();
  }
}

export async function saveOfflineRoute(record: OfflineRouteRecord): Promise<void> {
  const db = await openDb();
  try {
    await putRecord(db, record);
  } finally {
    db.close();
  }
}

export async function deleteOfflineRoute(routeId: string): Promise<void> {
  const db = await openDb();
  try {
    await deleteRecord(db, routeId);
  } finally {
    db.close();
  }
}

export async function hasOfflineRoute(routeId: string): Promise<boolean> {
  return Boolean(await getOfflineRoute(routeId));
}