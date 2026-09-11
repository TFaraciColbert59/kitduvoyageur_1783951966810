/**
 * A7 — Offline V2 : base Dexie `lkdv-adventure-offline-v1` (ADR-AI-007).
 *
 * Couche fine et typée : aucune logique métier ici (testée dans
 * `operations.ts`), uniquement la persistance des 10 stores, la file
 * idempotente et les métadonnées de synchronisation.
 */
import Dexie, { type Table } from 'dexie';
import {
  OFFLINE_QUEUE_STORES,
  isOfflineQueueStore,
  type OfflineOperation,
  type OfflineQueueStore,
} from './operations';

export const ADVENTURE_OFFLINE_DB_NAME = 'lkdv-adventure-offline-v1';

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

  constructor() {
    super(ADVENTURE_OFFLINE_DB_NAME);
    this.version(1).stores({
      offline_adventures: 'id, updatedAt',
      offline_routes: 'id, updatedAt',
      offline_segments: 'id, updatedAt',
      offline_predictions: 'id, updatedAt',
      offline_pois: 'id, updatedAt',
      offline_terrain_events: 'id, updatedAt',
      offline_reports_queue: 'id, &idempotencyKey, createdAt, store',
      offline_sessions_queue: 'id, &idempotencyKey, createdAt, store',
      offline_decisions_queue: 'id, &idempotencyKey, createdAt, store',
      sync_metadata: 'key',
    });
  }
}

export const adventureOfflineDb = new AdventureOfflineDb();

function queueTable(store: OfflineQueueStore): Table<OfflineOperation, string> {
  return adventureOfflineDb[store];
}

function queueTables(): Table<OfflineOperation, string>[] {
  return OFFLINE_QUEUE_STORES.map((store) => adventureOfflineDb[store]);
}

/**
 * Met une opération en file. Retourne `false` si sa clé d'idempotence est
 * déjà présente (rejoue jamais deux fois la même opération).
 */
export async function enqueue(operation: OfflineOperation): Promise<boolean> {
  if (!isOfflineQueueStore(operation.store)) {
    throw new Error(`Store non file d'attente : ${operation.store}`);
  }
  const table = queueTable(operation.store);
  return adventureOfflineDb.transaction('rw', table, async () => {
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
export async function pending(store?: OfflineQueueStore): Promise<OfflineOperation[]> {
  if (store) {
    return queueTable(store).orderBy('createdAt').toArray();
  }
  const batches = await Promise.all(
    OFFLINE_QUEUE_STORES.map((name) => adventureOfflineDb[name].orderBy('createdAt').toArray())
  );
  return batches.flat().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Supprime les opérations synchronisées ; retourne le nombre supprimé. */
export async function markSynced(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const tables = queueTables();
  return adventureOfflineDb.transaction('rw', tables, async () => {
    let deleted = 0;
    for (const table of tables) {
      deleted += await table.where('id').anyOf(ids).delete();
    }
    return deleted;
  });
}

/** Incrémente le compteur de tentatives des opérations en échec. */
export async function markFailed(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const tables = queueTables();
  return adventureOfflineDb.transaction('rw', tables, async () => {
    let updated = 0;
    for (const table of tables) {
      const operations = await table.where('id').anyOf(ids).toArray();
      for (const operation of operations) {
        await table.put({ ...operation, attempts: operation.attempts + 1 });
        updated += 1;
      }
    }
    return updated;
  });
}

/** Lit (`metadata(key)`) ou écrit (`metadata(key, value)`) une métadonnée. */
export async function metadata(key: string): Promise<SyncMetadataEntry | undefined>;
export async function metadata(key: string, value: unknown): Promise<SyncMetadataEntry>;
export async function metadata(key: string, value?: unknown): Promise<SyncMetadataEntry | undefined> {
  if (arguments.length < 2) {
    return adventureOfflineDb.sync_metadata.get(key);
  }
  const entry: SyncMetadataEntry = { key, value, updatedAt: new Date().toISOString() };
  await adventureOfflineDb.sync_metadata.put(entry);
  return entry;
}
