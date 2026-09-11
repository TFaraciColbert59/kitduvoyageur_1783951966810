import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  BASE_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  MAX_SYNC_ATTEMPTS,
  OPERATION_EXPIRY_MS,
  RESUME_METADATA_KEY,
  SYNC_LOCK_NAME,
  classifyOperation,
  getSyncLockManager,
  nextRetryAt,
  operationExpiresAt,
  prioritizeOperations,
  retryDelayMs,
  syncPendingOperations,
  withSyncLock,
  type SyncLockManager,
  type SyncWorkerStorage,
} from '@/features/adventure-intelligence/offline/syncWorker';
import type { OfflineOperation, OfflineStoreRef } from '@/features/adventure-intelligence/offline/operations';

const NOW = new Date('2026-09-11T12:00:00.000Z');
const OLD = new Date('2026-08-01T00:00:00.000Z');

afterEach(() => {
  vi.unstubAllGlobals();
});

function op(overrides: Partial<OfflineOperation> = {}): OfflineOperation {
  return {
    id: 'op-1',
    store: 'offline_reports_queue',
    kind: 'terrain_report',
    payload: { category: 'mud' },
    idempotencyKey: 'terrain_report:op-1:key',
    createdAt: NOW.toISOString(),
    attempts: 0,
    ...overrides,
  };
}

function makeStorage(initial: OfflineOperation[]) {
  const operations = new Map<string, OfflineOperation>();
  for (const operation of initial) {
    operations.set(`${operation.store}:${operation.id}`, operation);
  }
  const metadataStore = new Map<string, unknown>();
  const removed: OfflineStoreRef[] = [];

  const storage: SyncWorkerStorage = {
    loadPending: async () => [...operations.values()],
    removeOperations: async (entries) => {
      let deleted = 0;
      for (const entry of entries) {
        removed.push(entry);
        if (operations.delete(`${entry.store}:${entry.id}`)) deleted += 1;
      }
      return deleted;
    },
    saveOperation: async (operation) => {
      operations.set(`${operation.store}:${operation.id}`, operation);
    },
    readMetadata: async (key) => metadataStore.get(key),
    writeMetadata: async (key, value) => {
      metadataStore.set(key, value);
    },
    clearMetadata: async (key) => {
      metadataStore.delete(key);
    },
  };

  return { storage, operations, metadataStore, removed };
}

describe('A11 — worker de synchronisation offline (TEST-A11-SYNC)', () => {
  it('TEST-A11-SYNC-01: backoff exponentiel monotone, déterministe, plafonné', () => {
    for (let attempts = 0; attempts < 6; attempts += 1) {
      expect(retryDelayMs(attempts + 1)).toBeGreaterThan(retryDelayMs(attempts));
      expect(retryDelayMs(attempts)).toBeGreaterThanOrEqual(Math.round(BASE_RETRY_DELAY_MS * 0.85));
    }
    expect(retryDelayMs(100)).toBeLessThanOrEqual(MAX_RETRY_DELAY_MS);

    const first = nextRetryAt(2, NOW);
    expect(nextRetryAt(2, NOW)).toBe(first);
    expect(nextRetryAt(3, NOW)).not.toBe(first);
    expect(Date.parse(first)).toBe(NOW.getTime() + retryDelayMs(2));
    expect(Date.parse(first)).toBeGreaterThan(NOW.getTime());

    expect(classifyOperation(op({ nextAttemptAt: first }), NOW)).toBe('waiting');
    expect(classifyOperation(op({ nextAttemptAt: OLD.toISOString() }), NOW)).toBe('ready');
  });

  it('TEST-A11-SYNC-02: priorité décroissante puis ancienneté, sans mutation', () => {
    const operations = [
      op({ id: 'low', priority: 0, createdAt: '2026-09-01T00:00:00.000Z' }),
      op({ id: 'high-recent', priority: 5, createdAt: '2026-09-02T00:00:00.000Z' }),
      op({ id: 'high-old', priority: 5, createdAt: '2026-09-01T00:00:00.000Z' }),
      op({ id: 'mid', priority: 3, createdAt: '2026-08-01T00:00:00.000Z' }),
      op({ id: 'default-priority', createdAt: '2026-08-01T00:00:00.000Z' }),
    ];

    expect(prioritizeOperations(operations).map((entry) => entry.id)).toEqual([
      'high-old',
      'high-recent',
      'mid',
      'default-priority',
      'low',
    ]);
    expect(operations.map((entry) => entry.id)[0]).toBe('low');
  });

  it('TEST-A11-SYNC-03: échec à la dernière tentative ⇒ dead-letter terminal avec lastError', async () => {
    const send = vi.fn(async () => {
      throw new Error('réseau indisponible');
    });
    const { storage, operations } = makeStorage([op({ attempts: MAX_SYNC_ATTEMPTS - 1 })]);

    const report = await syncPendingOperations({
      storage,
      transport: { send },
      now: () => NOW,
      lock: undefined,
    });

    expect(report.attempted).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.deadLettered).toBe(1);
    const saved = operations.get('offline_reports_queue:op-1');
    expect(saved?.attempts).toBe(MAX_SYNC_ATTEMPTS);
    expect(saved?.lastError).toBe('réseau indisponible');
    expect(saved?.deadLetteredAt).toBe(NOW.toISOString());
    expect(saved?.nextAttemptAt).toBeUndefined();

    send.mockClear();
    const second = await syncPendingOperations({
      storage,
      transport: { send },
      now: () => NOW,
      lock: undefined,
    });
    expect(send).not.toHaveBeenCalled();
    expect(second.attempted).toBe(0);
    expect(second.deadLettered).toBe(1);
  });

  it('TEST-A11-SYNC-04: une opération expirée est retirée sans être envoyée', async () => {
    const send = vi.fn(async (_operation: OfflineOperation) => {});
    const { storage, operations } = makeStorage([
      op({ id: 'old-implicit', createdAt: OLD.toISOString() }),
      op({ id: 'old-explicit', expiresAt: OLD.toISOString() }),
      op({ id: 'fresh', expiresAt: new Date(NOW.getTime() + 1000).toISOString() }),
      op({ id: 'not-yet', nextAttemptAt: new Date(NOW.getTime() + 60_000).toISOString() }),
    ]);
    expect(operationExpiresAt(op({ createdAt: OLD.toISOString() }))).toBe(
      new Date(OLD.getTime() + OPERATION_EXPIRY_MS).toISOString()
    );

    const report = await syncPendingOperations({
      storage,
      transport: { send },
      now: () => NOW,
      lock: undefined,
    });

    expect(report.expired).toBe(2);
    expect(report.succeeded).toBe(1);
    expect(report.skipped).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].id).toBe('fresh');
    expect(operations.has('offline_reports_queue:old-implicit')).toBe(false);
    expect(operations.has('offline_reports_queue:old-explicit')).toBe(false);
  });

  it('TEST-A11-SYNC-05: reprise après crash depuis sync_metadata puis rejeu sûr', async () => {
    const send = vi.fn(async () => {});
    const { storage, metadataStore } = makeStorage([op()]);
    metadataStore.set(RESUME_METADATA_KEY, {
      operationId: 'op-1',
      store: 'offline_reports_queue',
      startedAt: OLD.toISOString(),
    });

    const report = await syncPendingOperations({
      storage,
      transport: { send },
      now: () => NOW,
      lock: undefined,
    });

    expect(report.resumed).toEqual({
      operationId: 'op-1',
      store: 'offline_reports_queue',
      startedAt: OLD.toISOString(),
    });
    expect(report.succeeded).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(metadataStore.has(RESUME_METADATA_KEY)).toBe(false);

    metadataStore.set(RESUME_METADATA_KEY, { inconnu: true });
    const invalid = await syncPendingOperations({
      storage: makeStorage([]).storage,
      transport: { send },
      now: () => NOW,
      lock: undefined,
    });
    expect(invalid.resumed).toBeNull();
  });

  it('TEST-A11-SYNC-06: verrou multi-onglets feature-detect avec repli no-op', async () => {
    // Navigateur sans `navigator.locks` : repli no-op explicite.
    vi.stubGlobal('navigator', {});
    const send = vi.fn(async () => {});
    const fallback = await syncPendingOperations({
      storage: makeStorage([op()]).storage,
      transport: { send },
      now: () => NOW,
      lock: undefined,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(fallback.locked).toBe(false);
    expect(getSyncLockManager()).toBeUndefined();
    await expect(withSyncLock(undefined, async () => 'sans-verrou')).resolves.toBe('sans-verrou');

    const calls: unknown[] = [];
    const request = vi.fn(async (name: string, options: unknown, callback: () => Promise<unknown>) => {
      calls.push([name, options]);
      return callback();
    }) as unknown as SyncLockManager['request'];
    const locked = await syncPendingOperations({
      storage: makeStorage([op()]).storage,
      transport: { send: vi.fn(async () => {}) },
      now: () => NOW,
      lock: { request },
    });
    expect(calls).toEqual([[SYNC_LOCK_NAME, { mode: 'exclusive' }]]);
    expect(locked.locked).toBe(true);

    vi.stubGlobal('navigator', {
      locks: { request: async (_n: string, _o: unknown, cb: () => Promise<unknown>) => cb() },
    });
    expect(getSyncLockManager()).toBeDefined();
  });
});
