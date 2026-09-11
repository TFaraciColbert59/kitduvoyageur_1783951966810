/**
 * A7 — Offline V2 : opérations pures, idempotentes et sérialisables.
 *
 * Zéro I/O, zéro Dexie : toute la logique testable vit ici (clé d'idempotence,
 * migration legacy localStorage, taille de pack, déduplication). La base Dexie
 * (`db.ts`) n'est qu'une façade typée au-dessus de ces opérations.
 */
export const OFFLINE_STORES = [
  'offline_adventures',
  'offline_routes',
  'offline_segments',
  'offline_predictions',
  'offline_pois',
  'offline_terrain_events',
  'offline_reports_queue',
  'offline_sessions_queue',
  'offline_decisions_queue',
  'sync_metadata',
] as const;

export type OfflineStore = (typeof OFFLINE_STORES)[number];

export const OFFLINE_QUEUE_STORES = [
  'offline_reports_queue',
  'offline_sessions_queue',
  'offline_decisions_queue',
] as const;

export type OfflineQueueStore = (typeof OFFLINE_QUEUE_STORES)[number];

export function isOfflineQueueStore(store: OfflineStore): store is OfflineQueueStore {
  return (OFFLINE_QUEUE_STORES as readonly string[]).includes(store);
}

export interface OfflineOperation {
  id: string;
  store: OfflineStore;
  kind: string;
  payload: unknown;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
}

export interface CreateOfflineOperationInput {
  store: OfflineStore;
  kind: string;
  entityId: string;
  payload: unknown;
  createdAt?: string;
  attempts?: number;
}

/** Clé d'idempotence stable : type + entité + empreinte du payload. */
export function makeIdempotencyKey(input: {
  kind: string;
  entityId: string;
  payloadHash: string;
}): string {
  return `${input.kind}:${input.entityId}:${input.payloadHash}`;
}

function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

/** Empreinte FNV-1a 32 bits, stable quelle que soit l'ordre des clés. */
export function hashPayload(payload: unknown): string {
  const text = stableStringify(payload);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createOfflineOperation(input: CreateOfflineOperationInput): OfflineOperation {
  const payloadHash = hashPayload(input.payload);
  const idempotencyKey = makeIdempotencyKey({
    kind: input.kind,
    entityId: input.entityId,
    payloadHash,
  });
  return {
    id: idempotencyKey,
    store: input.store,
    kind: input.kind,
    payload: input.payload,
    idempotencyKey,
    createdAt: input.createdAt ?? new Date().toISOString(),
    attempts: Math.max(0, Math.trunc(input.attempts ?? 0)),
  };
}

/** Première occurrence gagnante, ordre stable — jamais de doublon à synchroniser. */
export function dedupeOperations(operations: readonly OfflineOperation[]): OfflineOperation[] {
  const seen = new Set<string>();
  const result: OfflineOperation[] = [];
  for (const operation of operations) {
    if (seen.has(operation.idempotencyKey)) continue;
    seen.add(operation.idempotencyKey);
    result.push(operation);
  }
  return result;
}

/** Taille sérialisée du pack en octets (0 pour un pack vide). */
export function packSizeBytes(operations: readonly OfflineOperation[]): number {
  let total = 0;
  for (const operation of operations) {
    total += new TextEncoder().encode(JSON.stringify(operation)).length;
  }
  return total;
}

/** Clés localStorage legacy connues (migration V1 → Dexie V2). */
export const LEGACY_SYNC_QUEUE_KEY = 'lkdv_offline_sync_queue';
export const LEGACY_REPORTS_QUEUE_KEY = 'lkdv_offline_reports_queue';
export const LEGACY_DECISIONS_QUEUE_KEY = 'lkdv_offline_decisions_queue';
export const LEGACY_ADVENTURE_PACK_KEY = 'lkdv_offline_adventure_pack';
export const LEGACY_METADATA_KEYS = [
  'lkdv_offline_pack_version',
  'lkdv_offline_last_sync',
] as const;

const LEGACY_QUEUE_KEYS: Record<string, { store: OfflineQueueStore; defaultKind: string }> = {
  [LEGACY_SYNC_QUEUE_KEY]: { store: 'offline_sessions_queue', defaultKind: 'hike_session' },
  [LEGACY_REPORTS_QUEUE_KEY]: { store: 'offline_reports_queue', defaultKind: 'terrain_report' },
  [LEGACY_DECISIONS_QUEUE_KEY]: { store: 'offline_decisions_queue', defaultKind: 'decision' },
};

export interface LegacyMigrationPlan {
  operations: OfflineOperation[];
  migratedKeys: string[];
  skipped: string[];
}

function safeParse(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false };
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function finiteNumberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Convertit les clés localStorage V1 connues en opérations idempotentes V2.
 * Toute clé inconnue ou valeur illisible part dans `skipped` : la migration
 * ne détruit jamais silencieusement une donnée.
 */
export function planLegacyMigration(raw: Record<string, string>): LegacyMigrationPlan {
  const operations: OfflineOperation[] = [];
  const migratedKeys: string[] = [];
  const skipped: string[] = [];

  for (const [key, rawValue] of Object.entries(raw)) {
    const parsed = safeParse(rawValue);
    if (!parsed.ok) {
      skipped.push(key);
      continue;
    }

    if ((LEGACY_METADATA_KEYS as readonly string[]).includes(key)) {
      operations.push(
        createOfflineOperation({
          store: 'sync_metadata',
          kind: 'metadata',
          entityId: key,
          payload: { key, value: parsed.value },
        })
      );
      migratedKeys.push(key);
      continue;
    }

    const queue = LEGACY_QUEUE_KEYS[key];
    if (queue) {
      const items = Array.isArray(parsed.value) ? parsed.value : [parsed.value];
      items.forEach((item, index) => {
        const record = asRecord(item);
        const payload = record && 'payload' in record ? record.payload : item;
        const entityId = (record && nonEmptyString(record.id)) ?? `${key}:${index}`;
        const kind = (record && nonEmptyString(record.type)) ?? queue.defaultKind;
        operations.push(
          createOfflineOperation({
            store: queue.store,
            kind,
            entityId,
            payload,
            createdAt: (record && nonEmptyString(record.createdAt)) ?? undefined,
            attempts: finiteNumberOr(record?.retryCount, 0),
          })
        );
      });
      migratedKeys.push(key);
      continue;
    }

    if (key === LEGACY_ADVENTURE_PACK_KEY) {
      const record = asRecord(parsed.value);
      operations.push(
        createOfflineOperation({
          store: 'offline_adventures',
          kind: 'adventure_pack',
          entityId: (record && nonEmptyString(record.id)) ?? 'pack',
          payload: parsed.value,
        })
      );
      migratedKeys.push(key);
      continue;
    }

    skipped.push(key);
  }

  return { operations: dedupeOperations(operations), migratedKeys, skipped };
}
