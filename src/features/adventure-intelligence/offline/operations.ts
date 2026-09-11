/**
 * A7/A11 — Offline V2 : opérations pures, idempotentes et sérialisables.
 *
 * Zéro I/O, zéro Dexie pour les planners : toute la logique testable vit ici
 * (clé d'idempotence SHA-256, migration legacy localStorage, réattribution des
 * lignes globales par utilisateur, déduplication, regroupement par store). La
 * base Dexie (`db.ts`) n'est qu'une façade typée au-dessus de ces opérations.
 *
 * Audit #27 : la clé d'idempotence est désormais un SHA-256 (hex 64) via Web
 * Crypto (`crypto.subtle.digest`). FNV-1a n'est conservé que comme repli
 * explicitement NON SÉCURISÉ pour les environnements sans `crypto.subtle`
 * (32 bits → collisions possibles) ; il ne doit jamais être choisi sciemment.
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
  /** Entité métier visée (uuid de décision, id de session…) si connue. */
  entityId?: string;
  /** Propriétaire de l'opération (partition Dexie par utilisateur, A11 #26). */
  userId?: string;
  /** Priorité de synchronisation : plus grand = plus urgent (défaut 0). */
  priority?: number;
  /** Au-delà de cette date, l'opération expire et n'est plus synchronisée. */
  expiresAt?: string;
  /** Dernière erreur de synchronisation constatée (dead-letter incluse). */
  lastError?: string;
  /** Prochaine tentative planifiée (backoff exponentiel + jitter). */
  nextAttemptAt?: string;
  /** Horodatage de mise en dead-letter (nombre max de tentatives épuisé). */
  deadLetteredAt?: string;
}

export interface CreateOfflineOperationInput {
  store: OfflineStore;
  kind: string;
  entityId: string;
  payload: unknown;
  createdAt?: string;
  attempts?: number;
  userId?: string;
  priority?: number;
  expiresAt?: string;
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

/**
 * Empreinte FNV-1a 32 bits, stable quelle que soit l'ordre des clés.
 * NON SÉCURISÉE : repli uniquement quand `crypto.subtle` est indisponible.
 * Toute nouvelle opération doit passer par `hashPayloadSha256`.
 */
export function hashPayload(payload: unknown): string {
  const text = stableStringify(payload);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** `crypto.subtle` présent et exploitable (Node ≥ 20 ou navigateur sécurisé). */
export function isWebCryptoAvailable(): boolean {
  return typeof globalThis.crypto?.subtle?.digest === 'function';
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Empreinte SHA-256 du payload, hex 64. Repli FNV-1a 32 bits (non sécurisé)
 * uniquement si `crypto.subtle` est absent : les clés restent stables, mais
 * une collision devient possible et doit être considérée comme un défaut.
 */
export async function hashPayloadSha256(payload: unknown): Promise<string> {
  if (!isWebCryptoAvailable()) return hashPayload(payload);
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(stableStringify(payload))
  );
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Clé d'idempotence robuste : SHA-256 du payload (hex 64) par défaut.
 * Le segment d'empreinte est exactement 64 caractères hexadécimaux.
 */
export async function makeIdempotencyKeySha256(input: {
  kind: string;
  entityId: string;
  payload: unknown;
}): Promise<string> {
  const payloadHash = await hashPayloadSha256(input.payload);
  return makeIdempotencyKey({
    kind: input.kind,
    entityId: input.entityId,
    payloadHash,
  });
}

export async function createOfflineOperation(
  input: CreateOfflineOperationInput
): Promise<OfflineOperation> {
  const idempotencyKey = await makeIdempotencyKeySha256({
    kind: input.kind,
    entityId: input.entityId,
    payload: input.payload,
  });
  return {
    id: idempotencyKey,
    store: input.store,
    kind: input.kind,
    payload: input.payload,
    idempotencyKey,
    createdAt: input.createdAt ?? new Date().toISOString(),
    attempts: Math.max(0, Math.trunc(input.attempts ?? 0)),
    entityId: input.entityId,
    userId: input.userId,
    priority: Math.trunc(input.priority ?? 0),
    expiresAt: input.expiresAt,
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

/** Référence minimale `{ store, id }` d'une opération à supprimer (A11 #28). */
export interface OfflineStoreRef {
  store: OfflineQueueStore;
  id: string;
}

/**
 * Regroupe les références par store pour ne supprimer QUE les files nommées
 * (audit #28 : l'ancien `markSynced(ids)` cherchait dans les trois files et
 * pouvait supprimer une opération homonyme d'une autre file). Pur, testé.
 */
export function groupOperationsByStore(
  entries: readonly OfflineStoreRef[]
): Map<OfflineQueueStore, string[]> {
  const grouped = new Map<OfflineQueueStore, string[]>();
  for (const entry of entries) {
    if (!entry.id) continue;
    const ids = grouped.get(entry.store);
    if (ids) {
      ids.push(entry.id);
    } else {
      grouped.set(entry.store, [entry.id]);
    }
  }
  return grouped;
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
 * ne détruit jamais silencieusement une donnée. `userId` (optionnel) rattache
 * les opérations à la partition de l'utilisateur (A11 #26).
 */
export async function planLegacyMigration(
  raw: Record<string, string>,
  userId?: string
): Promise<LegacyMigrationPlan> {
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
        await createOfflineOperation({
          store: 'sync_metadata',
          kind: 'metadata',
          entityId: key,
          payload: { key, value: parsed.value },
          userId,
        })
      );
      migratedKeys.push(key);
      continue;
    }

    const queue = LEGACY_QUEUE_KEYS[key];
    if (queue) {
      const items = Array.isArray(parsed.value) ? parsed.value : [parsed.value];
      for (const [index, item] of items.entries()) {
        const record = asRecord(item);
        const payload = record && 'payload' in record ? record.payload : item;
        const entityId = (record && nonEmptyString(record.id)) ?? `${key}:${index}`;
        const kind = (record && nonEmptyString(record.type)) ?? queue.defaultKind;
        operations.push(
          await createOfflineOperation({
            store: queue.store,
            kind,
            entityId,
            payload,
            createdAt: (record && nonEmptyString(record.createdAt)) ?? undefined,
            attempts: finiteNumberOr(record?.retryCount, 0),
            userId,
          })
        );
      }
      migratedKeys.push(key);
      continue;
    }

    if (key === LEGACY_ADVENTURE_PACK_KEY) {
      const record = asRecord(parsed.value);
      operations.push(
        await createOfflineOperation({
          store: 'offline_adventures',
          kind: 'adventure_pack',
          entityId: (record && nonEmptyString(record.id)) ?? 'pack',
          payload: parsed.value,
          userId,
        })
      );
      migratedKeys.push(key);
      continue;
    }

    skipped.push(key);
  }

  return { operations: dedupeOperations(operations), migratedKeys, skipped };
}

export interface LegacyGlobalMigrationPlan {
  operations: OfflineOperation[];
  skipped: number;
}

/**
 * Réattribue à `userId` les lignes de l'ancienne base GLOBALE `v1` (A11 #26).
 * Les lignes sont des opérations déjà formées (ou proches) : la clé
 * d'idempotence existante est conservée telle quelle pour ne jamais rejouer une
 * opération déjà acquittée ; à défaut elle est recalculée en SHA-256. Les
 * entrées non exploitables sont comptées dans `skipped`, jamais devinées.
 */
export async function planLegacyGlobalMigration(
  raw: readonly unknown[],
  userId: string
): Promise<LegacyGlobalMigrationPlan> {
  if (!userId || userId.trim().length === 0) {
    throw new Error('planLegacyGlobalMigration : userId requis');
  }
  const operations: OfflineOperation[] = [];
  let skipped = 0;

  for (const entry of raw) {
    const record = asRecord(entry);
    if (!record) {
      skipped += 1;
      continue;
    }
    const store = record.store;
    if (typeof store !== 'string' || !isOfflineQueueStore(store as OfflineStore)) {
      skipped += 1;
      continue;
    }
    const kind = nonEmptyString(record.kind);
    const entityId = nonEmptyString(record.entityId) ?? nonEmptyString(record.id);
    if (!kind || !entityId || !('payload' in record)) {
      skipped += 1;
      continue;
    }

    const payload = record.payload;
    const idempotencyKey =
      nonEmptyString(record.idempotencyKey) ??
      (await makeIdempotencyKeySha256({ kind, entityId, payload }));
    operations.push({
      id: nonEmptyString(record.id) ?? idempotencyKey,
      store: store as OfflineQueueStore,
      kind,
      payload,
      idempotencyKey,
      createdAt: nonEmptyString(record.createdAt) ?? new Date().toISOString(),
      attempts: Math.max(0, Math.trunc(finiteNumberOr(record.attempts, 0))),
      entityId,
      userId,
      priority: Math.trunc(finiteNumberOr(record.priority, 0)),
      expiresAt: nonEmptyString(record.expiresAt) ?? undefined,
      lastError: nonEmptyString(record.lastError) ?? undefined,
      nextAttemptAt: nonEmptyString(record.nextAttemptAt) ?? undefined,
      deadLetteredAt: nonEmptyString(record.deadLetteredAt) ?? undefined,
    });
  }

  return { operations: dedupeOperations(operations), skipped };
}
