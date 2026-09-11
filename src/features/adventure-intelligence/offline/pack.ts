/**
 * A13 (S6) — Pack aventure hors-ligne : caches Dexie par utilisateur et
 * branchement du worker de synchronisation sur les endpoints réels.
 *
 * La planification (mapping pack → entrées de cache) est PURE et testable
 * sans IndexedDB ; l'écriture Dexie est une façade transactionnelle bornée,
 * avec purge/relecture par aventure. Le worker est branché sur
 * `POST /api/adventure/offline/sync` via `createAdventureSyncTransport`.
 */
import {
  createDexieSyncStorage,
  type AdventureOfflineDb,
  type OfflineCacheEntry,
} from './db';
import {
  createAdventureSyncTransport,
  syncPendingOperations,
  type SyncLockManager,
  type SyncReport,
  type SyncTransport,
} from './syncWorker';
import {
  MAX_OFFLINE_PACK_BYTES,
  type OfflineAdventurePack,
} from '../domain/offlinePack';

export interface OfflinePackCaches {
  adventures: OfflineCacheEntry[];
  routes: OfflineCacheEntry[];
  segments: OfflineCacheEntry[];
  predictions: OfflineCacheEntry[];
  pois: OfflineCacheEntry[];
  terrainEvents: OfflineCacheEntry[];
}

function entry(id: string, payload: unknown, updatedAt: string): OfflineCacheEntry {
  return { id, payload, updatedAt };
}

/**
 * Projette le pack serveur dans les six stores Dexie. Tous les ids sont
 * préfixés par l'aventure : lecture et purge strictement par aventure, aucune
 * collision entre utilisateurs (base partitionnée) ni entre aventures.
 */
export function packCacheEntries(pack: OfflineAdventurePack): OfflinePackCaches {
  const prefix = `${pack.adventureId}:`;
  const updatedAt = pack.generatedAt;
  return {
    adventures: [
      entry(
        pack.adventureId,
        {
          version: pack.version,
          adventureId: pack.adventureId,
          userId: pack.userId,
          generatedAt: pack.generatedAt,
          sizeBytes: pack.sizeBytes,
          capped: pack.capped,
          plan: pack.plan,
          planVersion: pack.planVersion,
          warnings: pack.warnings,
        },
        updatedAt
      ),
    ],
    routes: pack.predictions.route.map((row, index) =>
      entry(`${prefix}route:${index}`, row, updatedAt)
    ),
    segments: pack.segments.map((segment) =>
      entry(`${prefix}geometry:${segment.id}`, segment, updatedAt)
    ),
    predictions: pack.predictions.segments.map((row, index) =>
      entry(`${prefix}prediction:${index}`, row, updatedAt)
    ),
    pois: pack.pois.map((poi) => entry(`${prefix}poi:${poi.id}`, poi, updatedAt)),
    terrainEvents: pack.terrain.map((report) =>
      entry(`${prefix}terrain:${report.id}`, report, updatedAt)
    ),
  };
}

/** Un pack plus gros que le plafond n'est jamais écrit dans Dexie. */
export function shouldStoreOfflinePack(
  pack: OfflineAdventurePack,
  maxBytes: number = MAX_OFFLINE_PACK_BYTES
): boolean {
  return pack.sizeBytes <= maxBytes;
}

const CACHE_TABLES = [
  'offline_adventures',
  'offline_routes',
  'offline_segments',
  'offline_predictions',
  'offline_pois',
  'offline_terrain_events',
] as const;

export interface SaveOfflinePackResult {
  stored: boolean;
  entries: number;
  sizeBytes: number;
}

/**
 * Écrit le pack dans la base Dexie de l'utilisateur (store par store) après
 * avoir retiré les entrées de la même aventure — idempotent, jamais de
 * résidu d'une version précédente.
 */
export async function saveOfflinePack(
  db: AdventureOfflineDb,
  pack: OfflineAdventurePack,
  options: { maxBytes?: number } = {}
): Promise<SaveOfflinePackResult> {
  if (!shouldStoreOfflinePack(pack, options.maxBytes)) {
    return { stored: false, entries: 0, sizeBytes: pack.sizeBytes };
  }
  const caches = packCacheEntries(pack);
  const prefix = `${pack.adventureId}:`;
  const tables = CACHE_TABLES.map((name) => db[name]);

  await db.transaction('rw', tables, async () => {
    await db.offline_adventures.delete(pack.adventureId);
    for (const table of [
      db.offline_routes,
      db.offline_segments,
      db.offline_predictions,
      db.offline_pois,
      db.offline_terrain_events,
    ]) {
      await table.where('id').startsWith(prefix).delete();
    }
    await db.offline_adventures.bulkPut(caches.adventures);
    await db.offline_routes.bulkPut(caches.routes);
    await db.offline_segments.bulkPut(caches.segments);
    await db.offline_predictions.bulkPut(caches.predictions);
    await db.offline_pois.bulkPut(caches.pois);
    await db.offline_terrain_events.bulkPut(caches.terrainEvents);
  });

  const entries =
    caches.adventures.length +
    caches.routes.length +
    caches.segments.length +
    caches.predictions.length +
    caches.pois.length +
    caches.terrainEvents.length;
  return { stored: true, entries, sizeBytes: pack.sizeBytes };
}

/** Retire du cache toutes les entrées d'une aventure (jamais un autre). */
export async function clearOfflinePack(
  db: AdventureOfflineDb,
  adventureId: string
): Promise<number> {
  const prefix = `${adventureId}:`;
  const tables = CACHE_TABLES.map((name) => db[name]);
  return db.transaction('rw', tables, async () => {
    let deleted = await db.offline_adventures.where('id').equals(adventureId).delete();
    for (const table of [
      db.offline_routes,
      db.offline_segments,
      db.offline_predictions,
      db.offline_pois,
      db.offline_terrain_events,
    ]) {
      deleted += await table.where('id').startsWith(prefix).delete();
    }
    return deleted;
  });
}

/** Relit un pack complet depuis Dexie (état hors-ligne), `null` si absent. */
export async function readOfflinePack(
  db: AdventureOfflineDb,
  adventureId: string
): Promise<OfflineAdventurePack | null> {
  const header = await db.offline_adventures.get(adventureId);
  if (!header) return null;
  const prefix = `${adventureId}:`;
  const [routes, segments, predictions, pois, terrainEvents] = await Promise.all([
    db.offline_routes.where('id').startsWith(prefix).toArray(),
    db.offline_segments.where('id').startsWith(prefix).toArray(),
    db.offline_predictions.where('id').startsWith(prefix).toArray(),
    db.offline_pois.where('id').startsWith(prefix).toArray(),
    db.offline_terrain_events.where('id').startsWith(prefix).toArray(),
  ]);
  const meta = header.payload as {
    version: OfflineAdventurePack['version'];
    adventureId: string;
    userId: string;
    generatedAt: string;
    sizeBytes: number;
    capped: boolean;
    plan: OfflineAdventurePack['plan'];
    planVersion: OfflineAdventurePack['planVersion'];
    warnings: string[];
  };

  return {
    version: meta.version,
    adventureId: meta.adventureId,
    userId: meta.userId,
    generatedAt: meta.generatedAt,
    sizeBytes: meta.sizeBytes,
    capped: meta.capped,
    plan: meta.plan,
    planVersion: meta.planVersion,
    segments: segments.map((row) => row.payload as OfflineAdventurePack['segments'][number]),
    predictions: {
      route: routes.map((row) => row.payload as Record<string, unknown>),
      segments: predictions.map((row) => row.payload as Record<string, unknown>),
    },
    pois: pois.map((row) => row.payload as OfflineAdventurePack['pois'][number]),
    terrain: terrainEvents.map(
      (row) => row.payload as OfflineAdventurePack['terrain'][number]
    ),
    warnings: meta.warnings,
  };
}

/** Télécharge le pack réel depuis la route dédiée (auth de session). */
export async function offlinePackRequest(
  adventureId: string,
  fetchImpl: typeof fetch = fetch
): Promise<OfflineAdventurePack> {
  const response = await fetchImpl(`/api/adventure/${adventureId}/offline-pack`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Pack hors-ligne indisponible (${response.status}).`);
  }
  const payload = (await response.json()) as { pack?: OfflineAdventurePack };
  if (!payload.pack || typeof payload.pack.version !== 'number') {
    throw new Error('Pack hors-ligne invalide.');
  }
  return payload.pack;
}

/** Télécharge puis stocke le pack dans Dexie (par utilisateur). */
export async function fetchAndStoreOfflinePack(
  db: AdventureOfflineDb,
  adventureId: string,
  options: { fetchImpl?: typeof fetch; maxBytes?: number } = {}
): Promise<SaveOfflinePackResult & { pack: OfflineAdventurePack }> {
  const pack = await offlinePackRequest(adventureId, options.fetchImpl);
  const result = await saveOfflinePack(db, pack, { maxBytes: options.maxBytes });
  return { ...result, pack };
}

export interface RunAdventureSyncOptions {
  transport?: SyncTransport;
  now?: () => Date;
  lock?: SyncLockManager;
  maxOperations?: number;
}

/**
 * Draine la file Dexie de l'utilisateur vers `POST /api/adventure/offline/sync`
 * (transport réel par défaut), avec le backoff/dead-letter du worker A11.
 */
export function runAdventureSync(
  db: AdventureOfflineDb,
  options: RunAdventureSyncOptions = {}
): Promise<SyncReport> {
  return syncPendingOperations({
    storage: createDexieSyncStorage(db),
    transport: options.transport ?? createAdventureSyncTransport(),
    now: options.now,
    lock: options.lock,
    maxOperations: options.maxOperations,
  });
}
