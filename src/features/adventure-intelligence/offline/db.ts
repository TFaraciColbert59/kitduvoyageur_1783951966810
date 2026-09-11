/**
 * A7/A11 — Offline V2 : base Dexie partitionnée par utilisateur (ADR-AI-007).
 *
 * Audit #26 : la base globale `lkdv-adventure-offline-v1` laissait les données
 * d'un utilisateur visibles après changement de compte sur un appareil partagé.
 * Chaque utilisateur possède désormais SA base `lkdv-adventure-offline-v2-<userId>`,
 * les opérations portent un champ `userId` indexé (défense en profondeur) et
 * `purgeOfflineData(userId)` supprime la base à la déconnexion.
 *
 * Couche fine et typée : la logique pure (planner de migration, regroupement,
 * clés d'idempotence) vit dans `operations.ts`, testée séparément.
 */
import Dexie, { type Table } from 'dexie';
import {
  OFFLINE_QUEUE_STORES,
  groupOperationsByStore,
  isOfflineQueueStore,
  type OfflineOperation,
  type OfflineQueueStore,
  type OfflineStoreRef,
} from './operations';

/** Préfixe des bases V2 partitionnées (une base par utilisateur). */
export const ADVENTURE_OFFLINE_DB_PREFIX = 'lkdv-adventure-offline-v2-';

/** Base globale héritée V1 : source de la migration vers les bases par utilisateur. */
export const LEGACY_ADVENTURE_OFFLINE_DB_NAME = 'lkdv-adventure-offline-v1';

/** Nom de base pur, déterministe, à partir de l'identifiant utilisateur. */
export function offlineDbNameForUser(userId: string): string {
  const trimmed = typeof userId === 'string' ? userId.trim() : '';
  if (trimmed.length === 0) {
    throw new Error('offlineDbNameForUser : userId requis pour partitionner la base locale.');
  }
  return `${ADVENTURE_OFFLINE_DB_PREFIX}${trimmed}`;
}

/** Entrée de cache d'un store de données (pack, route, segment, POI…). */
export interface OfflineCacheEntry {
  id: string;
  payload: unknown;
  updatedAt: string;
}

/** Métadonnée de synchronisation (clé/valeur). */
export interface SyncMetadataEntry {
  key: string;
  value: unknown;
  updatedAt: string;
}

export class AdventureOfflineDb extends Dexie {
  offline_adventures!: Table<OfflineCacheEntry, string>;
  offline_routes!: Table<OfflineCacheEntry, string>;
  offline_segments!: Table<OfflineCacheEntry, string>;
  offline_predictions!: Table<OfflineCacheEntry, string>;
  offline_pois!: Table<OfflineCacheEntry, string>;
  offline_terrain_events!: Table<OfflineCacheEntry, string>;
  offline_reports_queue!: Table<OfflineOperation, string>;
  offline_sessions_queue!: Table<OfflineOperation, string>;
  offline_decisions_queue!: Table<OfflineOperation, string>;
  sync_metadata!: Table<SyncMetadataEntry, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      offline_adventures: 'id, updatedAt',
      offline_routes: 'id, updatedAt',
      offline_segments: 'id, updatedAt',
      offline_predictions: 'id, updatedAt',
      offline_pois: 'id, updatedAt',
      offline_terrain_events: 'id, updatedAt',
      offline_reports_queue: 'id, &idempotencyKey, createdAt, store, userId',
      offline_sessions_queue: 'id, &idempotencyKey, createdAt, store, userId',
      offline_decisions_queue: 'id, &idempotencyKey, createdAt, store, userId',
      sync_metadata: 'key',
    });
  }
}

const offlineDbs = new Map<string, AdventureOfflineDb>();

/** Ouvre (ou réutilise) la base Dexie de `userId` — jamais une base partagée. */
export function getOfflineDb(userId: string): AdventureOfflineDb {
  const name = offlineDbNameForUser(userId);
  const existing = offlineDbs.get(name);
  if (existing) return existing;
  const db = new AdventureOfflineDb(name);
  offlineDbs.set(name, db);
  return db;
}

/**
 * Met une opération en file. Retourne `false` si sa clé d'idempotence est
 * déjà présente (rejoue jamais deux fois la même opération).
 */
export async function enqueue(
  db: AdventureOfflineDb,
  operation: OfflineOperation
): Promise<boolean> {
  if (!isOfflineQueueStore(operation.store)) {
    throw new Error(`Store non file d'attente : ${operation.store}`);
  }
  const table = db[operation.store];
  return db.transaction('rw', table, async () => {
    const existing = await table
      .where('idempotencyKey')
      .equals(operation.idempotencyKey)
      .first();
    if (existing) return false;
    await table.put(operation);
    return true;
  });
}

/** Opérations en attente, triées par date de création (tous stores ou un seul). */
export async function pending(
  db: AdventureOfflineDb,
  store?: OfflineQueueStore
): Promise<OfflineOperation[]> {
  if (store) {
    return db[store].orderBy('createdAt').toArray();
  }
  const batches = await Promise.all(
    OFFLINE_QUEUE_STORES.map((name) => db[name].orderBy('createdAt').toArray())
  );
  return batches.flat().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Supprime les opérations synchronisées : UNIQUEMENT dans les stores nommés
 * par `{ store, id }` (audit #28 — plus jamais de suppression à l'aveugle
 * dans les trois files). Retourne le nombre de lignes supprimées.
 */
export async function markSynced(
  db: AdventureOfflineDb,
  entries: readonly OfflineStoreRef[]
): Promise<number> {
  const grouped = groupOperationsByStore(entries);
  if (grouped.size === 0) return 0;
  const tables = [...grouped.keys()].map((store) => db[store]);
  return db.transaction('rw', tables, async () => {
    let deleted = 0;
    for (const [store, ids] of grouped) {
      deleted += await db[store].where('id').anyOf(ids).delete();
    }
    return deleted;
  });
}

/** Incrémente le compteur de tentatives des opérations en échec (stores nommés). */
export async function markFailed(
  db: AdventureOfflineDb,
  entries: readonly OfflineStoreRef[]
): Promise<number> {
  const grouped = groupOperationsByStore(entries);
  if (grouped.size === 0) return 0;
  const tables = [...grouped.keys()].map((store) => db[store]);
  return db.transaction('rw', tables, async () => {
    let updated = 0;
    for (const [store, ids] of grouped) {
      const operations = await db[store].where('id').anyOf(ids).toArray();
      for (const operation of operations) {
        await db[store].put({ ...operation, attempts: operation.attempts + 1 });
        updated += 1;
      }
    }
    return updated;
  });
}

/** Réécrit une opération après une tentative (backoff, erreur, dead-letter). */
export async function updateOperation(
  db: AdventureOfflineDb,
  operation: OfflineOperation
): Promise<void> {
  if (!isOfflineQueueStore(operation.store)) {
    throw new Error(`Store non file d'attente : ${operation.store}`);
  }
  await db[operation.store].put(operation);
}

/**
 * Purge locale d'un utilisateur (déconnexion, RLS, changement de compte) :
 * ferme puis supprime sa base Dexie. `deleteDatabase` est injectable pour
 * rester testable sans IndexedDB réel.
 */
export interface PurgeOfflineDeps {
  deleteDatabase?: (name: string) => Promise<void>;
}

function defaultDeleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const indexedDb = globalThis.indexedDB;
    if (!indexedDb) {
      reject(new Error('purgeOfflineData : IndexedDB indisponible.'));
      return;
    }
    const request = indexedDb.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('suppression IndexedDB en échec'));
    request.onblocked = () => resolve();
  });
}

export async function purgeOfflineData(
  userId: string,
  deps: PurgeOfflineDeps = {}
): Promise<void> {
  const name = offlineDbNameForUser(userId);
  const cached = offlineDbs.get(name);
  if (cached) {
    cached.close();
    offlineDbs.delete(name);
  }
  const deleteDatabase = deps.deleteDatabase ?? defaultDeleteDatabase;
  await deleteDatabase(name);
}

/** Lit (`metadata(db, key)`) ou écrit (`metadata(db, key, value)`) une métadonnée. */
export async function metadata(
  db: AdventureOfflineDb,
  key: string
): Promise<SyncMetadataEntry | undefined>;
export async function metadata(
  db: AdventureOfflineDb,
  key: string,
  value: unknown
): Promise<SyncMetadataEntry>;
export async function metadata(
  db: AdventureOfflineDb,
  key: string,
  value?: unknown
): Promise<SyncMetadataEntry | undefined> {
  if (arguments.length < 3) {
    return db.sync_metadata.get(key);
  }
  const entry: SyncMetadataEntry = { key, value, updatedAt: new Date().toISOString() };
  await db.sync_metadata.put(entry);
  return entry;
}
