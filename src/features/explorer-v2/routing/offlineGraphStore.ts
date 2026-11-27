/**
 * Offline CSR Corridor Graph Pack Store (IndexedDB) for 100% offline Rust/WASM POI routing.
 *
 * Whenever a sector corridor graph is fetched or downloaded, it is persisted locally so that
 * when `navigator.onLine === false`, Explorer can still execute `executeRoutingKernel` (WASM)
 * directly in the browser without any network call.
 */

import type { CompactCorridorGraph } from './types';

const DB_NAME = 'lkdv_explorer_routing_packs_v1';
const STORE_NAME = 'corridors';
const MAX_STORED_PACKS = 12;

export interface StoredCorridorPack {
  id: string;
  name: string;
  bounds: { south: number; west: number; north: number; east: number };
  savedAtMs: number;
  graph: CompactCorridorGraph;
}

function openRoutingDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveOfflineCorridorPack(pack: StoredCorridorPack): Promise<boolean> {
  const db = await openRoutingDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(pack);
      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const all = (getAllReq.result as StoredCorridorPack[]) ?? [];
        if (all.length > MAX_STORED_PACKS) {
          all.sort((a, b) => a.savedAtMs - b.savedAtMs);
          for (const old of all.slice(0, all.length - MAX_STORED_PACKS)) {
            store.delete(old.id);
          }
        }
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function findOfflineCorridorPack(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): Promise<StoredCorridorPack | null> {
  const db = await openRoutingDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const packs = (req.result as StoredCorridorPack[]) ?? [];
        const match = packs.find(
          (p) =>
            origin.lat >= p.bounds.south &&
            origin.lat <= p.bounds.north &&
            origin.lng >= p.bounds.west &&
            origin.lng <= p.bounds.east &&
            dest.lat >= p.bounds.south &&
            dest.lat <= p.bounds.north &&
            dest.lng >= p.bounds.west &&
            dest.lng <= p.bounds.east,
        );
        resolve(match ?? null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
