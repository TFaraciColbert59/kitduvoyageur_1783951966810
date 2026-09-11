/**
 * A11 — worker de synchronisation offline (audit #29).
 *
 * Le worker draine les files `offline_*_queue` vers un transport injecté :
 * - ordonnancement pur : priorité décroissante puis ancienneté (FIFO à
 *   priorité égale) ;
 * - backoff exponentiel plafonné avec jitter déterministe (`nextRetryAt`) ;
 * - expiration : une opération non synchronisée au bout de 30 jours (ou
 *   `expiresAt` dépassé) est abandonnée sans être envoyée ;
 * - dead-letter après `MAX_SYNC_ATTEMPTS` échecs : terminale, conservée avec
 *   `lastError`, plus jamais envoyée ;
 * - reprise après crash : l'opération en vol est journalisée dans
 *   `sync_metadata['sync_in_progress']` puis rejouée (l'idempotence aval rend
 *   le rejeu sûr) ;
 * - verrou multi-onglets via `navigator.locks` (feature-detect) ; en son
 *   absence le worker s'exécute sans verrou (mono-onglet / navigateurs
 *   anciens), jamais en échec.
 *
 * Aucune dépendance IndexedDB ici : transport et stockage sont injectés.
 */
import type { OfflineOperation, OfflineStoreRef } from './operations';
import { isOfflineQueueStore, type OfflineStore } from './operations';

/** Nom du verrou multi-onglets (`navigator.locks`). */
export const SYNC_LOCK_NAME = 'lkdv-adventure-offline-sync';

/** Nombre maximal de tentatives avant dead-letter. */
export const MAX_SYNC_ATTEMPTS = 8;

/** Délai de base du backoff exponentiel (ms). */
export const BASE_RETRY_DELAY_MS = 5_000;

/** Plafond du backoff (6 h). */
export const MAX_RETRY_DELAY_MS = 6 * 60 * 60 * 1000;

/** Durée de vie d'une opération sans `expiresAt` explicite (30 jours). */
export const OPERATION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

/** Clé de métadonnée de reprise après crash. */
export const RESUME_METADATA_KEY = 'sync_in_progress';

/** Nombre maximal d'opérations traitées par passe (protège le quota réseau). */
export const DEFAULT_MAX_OPERATIONS_PER_RUN = 50;

/**
 * Jitter déterministe ∈ [0, 1) dérivé du nombre de tentatives : deux exécutions
 * avec les mêmes entrées produisent le même délai (testable), sans synchroniser
 * les tentatives de tous les appareils sur le même instant.
 */
function jitterFraction(attempts: number): number {
  const hashed = Math.imul(Math.max(0, Math.trunc(attempts)) + 1, 0x9e3779b1) >>> 0;
  return (hashed % 1000) / 1000;
}

/**
 * Délai avant la prochaine tentative :
 * `min(BASE × 2^attempts, MAX) × (0.85 + 0.15 × jitter(attempts))`.
 * La décroissance maximale du jitter (×0,85) reste sous le doublement de la
 * base : le délai est strictement croissant tant que le plafond n'est pas
 * atteint, puis plateau à `MAX_RETRY_DELAY_MS`.
 */
export function retryDelayMs(attempts: number): number {
  const safeAttempts = Math.max(0, Math.trunc(attempts));
  const exponential = Math.min(BASE_RETRY_DELAY_MS * 2 ** safeAttempts, MAX_RETRY_DELAY_MS);
  const jittered = exponential * (0.85 + 0.15 * jitterFraction(safeAttempts));
  return Math.round(Math.min(jittered, MAX_RETRY_DELAY_MS));
}

/** Horodatage ISO de la prochaine tentative après `attempts` échecs. */
export function nextRetryAt(attempts: number, now: Date | string | number = Date.now()): string {
  const base = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return new Date(base + retryDelayMs(attempts)).toISOString();
}

/** Priorité décroissante, puis ancienneté croissante, puis id — stable. */
export function prioritizeOperations(
  operations: readonly OfflineOperation[]
): OfflineOperation[] {
  return [...operations].sort((left, right) => {
    const priorityDiff = (right.priority ?? 0) - (left.priority ?? 0);
    if (priorityDiff !== 0) return priorityDiff;
    const createdDiff = left.createdAt.localeCompare(right.createdAt);
    if (createdDiff !== 0) return createdDiff;
    return left.id.localeCompare(right.id);
  });
}

/** État d'ordonnancement pur d'une opération à un instant donné. */
export type OperationScheduling = 'ready' | 'waiting' | 'dead_letter' | 'expired';

/** Date d'expiration effective (explicite, sinon createdAt + 30 jours). */
export function operationExpiresAt(operation: OfflineOperation): string {
  if (operation.expiresAt) return operation.expiresAt;
  const created = new Date(operation.createdAt).getTime();
  const base = Number.isFinite(created) ? created : Date.now();
  return new Date(base + OPERATION_EXPIRY_MS).toISOString();
}

/**
 * Décision pure : dead-letter (terminale), expirée (abandon), en attente de
 * backoff, ou prête. Le dead-letter prime : une opération ayant épuisé ses
 * tentatives reste terminale même si elle expire ensuite.
 */
export function classifyOperation(
  operation: OfflineOperation,
  now: Date | string | number = Date.now()
): OperationScheduling {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (operation.deadLetteredAt || operation.attempts >= MAX_SYNC_ATTEMPTS) {
    return 'dead_letter';
  }
  if (new Date(operationExpiresAt(operation)).getTime() <= nowMs) {
    return 'expired';
  }
  if (operation.nextAttemptAt && new Date(operation.nextAttemptAt).getTime() > nowMs) {
    return 'waiting';
  }
  return 'ready';
}

/** Transport de synchronisation injecté (API HTTP, RPC, bridge natif…). */
export interface SyncTransport {
  send(operation: OfflineOperation): Promise<void>;
}

/** Stockage injecté (Dexie en production, mémoire en test). */
export interface SyncWorkerStorage {
  loadPending(): Promise<OfflineOperation[]>;
  removeOperations(entries: readonly OfflineStoreRef[]): Promise<number>;
  saveOperation(operation: OfflineOperation): Promise<void>;
  readMetadata(key: string): Promise<unknown>;
  writeMetadata(key: string, value: unknown): Promise<void>;
  clearMetadata(key: string): Promise<void>;
}

/** Verrou multi-onglets compatible `navigator.locks` (sous-ensemble utilisé). */
export interface SyncLockManager {
  request<T>(
    name: string,
    options: { mode: 'exclusive' },
    callback: () => Promise<T>
  ): Promise<T>;
}

export interface SyncResumeState {
  operationId: string;
  store: OfflineStoreRef['store'];
  startedAt: string;
}

/** `navigator.locks` si disponible, sinon `undefined` (repli no-op). */
export function getSyncLockManager(): SyncLockManager | undefined {
  const navigatorLike = globalThis.navigator as
    | (Navigator & { locks?: Partial<SyncLockManager> })
    | undefined;
  const locks = navigatorLike?.locks;
  return locks && typeof locks.request === 'function'
    ? (locks as SyncLockManager)
    : undefined;
}

/**
 * Exécute `run` sous le verrou si un gestionnaire est fourni ; sinon exécute
 * directement (repli no-op, jamais d'échec pour absence de `navigator.locks`).
 */
export async function withSyncLock<T>(
  manager: SyncLockManager | undefined,
  run: () => Promise<T>
): Promise<T> {
  if (!manager) return run();
  return manager.request(SYNC_LOCK_NAME, { mode: 'exclusive' }, run);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Relit l'état de reprise persisté avant un crash (jamais deviné). */
export async function readSyncResumeState(
  storage: Pick<SyncWorkerStorage, 'readMetadata'>
): Promise<SyncResumeState | null> {
  const record = asRecord(await storage.readMetadata(RESUME_METADATA_KEY));
  if (!record) return null;
  const operationId = typeof record.operationId === 'string' ? record.operationId : null;
  const store = typeof record.store === 'string' ? record.store : null;
  const startedAt = typeof record.startedAt === 'string' ? record.startedAt : null;
  if (!operationId || !store || !startedAt) return null;
  if (!isOfflineQueueStore(store as OfflineStore)) return null;
  return { operationId, store: store as SyncResumeState['store'], startedAt };
}

export interface SyncWorkerDeps {
  storage: SyncWorkerStorage;
  transport: SyncTransport;
  now?: () => Date;
  lock?: SyncLockManager;
  maxOperations?: number;
}

export interface SyncReport {
  attempted: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
  expired: number;
  skipped: number;
  resumed: SyncResumeState | null;
  locked: boolean;
}

function emptyReport(): SyncReport {
  return {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    deadLettered: 0,
    expired: 0,
    skipped: 0,
    resumed: null,
    locked: false,
  };
}

/**
 * Draine les opérations prêtes dans l'ordre de priorité. Best-effort : une
 * erreur de transport marque l'opération (backoff puis dead-letter), jamais
 * le lot entier. Retourne un rapport chiffré, sans jamais jeter.
 */
export async function syncPendingOperations(deps: SyncWorkerDeps): Promise<SyncReport> {
  const now = deps.now ? deps.now() : new Date();
  const nowIso = now.toISOString();
  const manager = deps.lock ?? getSyncLockManager();
  const maxOperations = Math.max(1, deps.maxOperations ?? DEFAULT_MAX_OPERATIONS_PER_RUN);

  return withSyncLock(manager, async () => {
    const report = emptyReport();
    if (manager) report.locked = true;

    const resume = await readSyncResumeState(deps.storage);
    if (resume) {
      report.resumed = resume;
      await deps.storage.clearMetadata(RESUME_METADATA_KEY);
    }

    const operations = prioritizeOperations(await deps.storage.loadPending());
    let processed = 0;

    for (const operation of operations) {
      if (!isOfflineQueueStore(operation.store)) {
        report.skipped += 1;
        continue;
      }
      const scheduling = classifyOperation(operation, now);
      if (scheduling === 'expired') {
        report.expired += 1;
        await deps.storage.removeOperations([{ store: operation.store, id: operation.id }]);
        continue;
      }
      if (scheduling === 'dead_letter') {
        report.deadLettered += 1;
        continue;
      }
      if (scheduling === 'waiting' || processed >= maxOperations) {
        report.skipped += 1;
        continue;
      }

      processed += 1;
      report.attempted += 1;
      await deps.storage.writeMetadata(RESUME_METADATA_KEY, {
        operationId: operation.id,
        store: operation.store,
        startedAt: nowIso,
      });

      try {
        await deps.transport.send(operation);
        await deps.storage.removeOperations([{ store: operation.store, id: operation.id }]);
        await deps.storage.clearMetadata(RESUME_METADATA_KEY);
        report.succeeded += 1;
      } catch (error) {
        const attempts = operation.attempts + 1;
        const lastError = error instanceof Error ? error.message : String(error);
        const terminal = attempts >= MAX_SYNC_ATTEMPTS;
        await deps.storage.saveOperation({
          ...operation,
          attempts,
          lastError,
          nextAttemptAt: terminal ? undefined : nextRetryAt(attempts, now),
          deadLetteredAt: terminal ? nowIso : operation.deadLetteredAt,
        });
        await deps.storage.clearMetadata(RESUME_METADATA_KEY);
        if (terminal) report.deadLettered += 1;
        report.failed += 1;
      }
    }

    return report;
  });
}
