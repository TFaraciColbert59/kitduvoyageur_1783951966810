import Dexie, { type Table } from "dexie";

/**
 * lkdv-cache — Base Dexie pour le cache generaliste de l'application.
 *
 * Utilisee par useOfflineCache pour remplacer localStorage :
 * - Asynchrone, ne bloque pas le thread JS (contrairement a localStorage)
 * - Capacite ~500 MB (vs ~5 MB pour localStorage)
 * - Stocke les objets sans serialisation JSON manuelle
 */

export interface CacheEntry {
  key: string;
  data: unknown;
  timestamp: number;
  expiresAt: number;
}

class LkdvCacheDatabase extends Dexie {
  entries!: Table<CacheEntry, string>;

  constructor() {
    super("lkdv-cache");
    this.version(1).stores({
      entries: "key, expiresAt",
    });
  }
}

export const cacheDB = new LkdvCacheDatabase();

/** Lit une entree du cache. Retourne null si absente ou expiree. */
export async function getCacheEntry<T>(key: string): Promise<T | null> {
  const entry = await cacheDB.entries.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheDB.entries.delete(key).catch(() => {});
    return null;
  }
  return entry.data as T;
}

/** Ecrit une entree dans le cache avec TTL en millisecondes. */
export async function setCacheEntry<T>(
  key: string,
  data: T,
  ttlMs: number,
): Promise<void> {
  const now = Date.now();
  await cacheDB.entries.put({
    key,
    data,
    timestamp: now,
    expiresAt: now + ttlMs,
  });
}

/** Supprime une entree du cache. */
export async function deleteCacheEntry(key: string): Promise<void> {
  await cacheDB.entries.delete(key);
}

/** Supprime toutes les entrees expirees. */
export async function purgeExpiredCache(): Promise<number> {
  const now = Date.now();
  return cacheDB.entries.where("expiresAt").below(now).delete();
}
