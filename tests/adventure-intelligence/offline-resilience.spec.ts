/**
 * Phase 6 — Résilience hors-ligne (TEST-PHASE6-RESILIENCE) : extinction réseau,
 * redémarrage de l'application, reprise sans perte ni doublon.
 *
 * Les vrais tests terrain (mode avion physique, batterie faible, tuiles) restent
 * HUMAINS — documenté dans PHASE_6_VERIFICATION.md. Ici : simulé par mocks.
 *
 *   • TEST-PHASE6-RESILIENCE-01 : coupure réseau ⇒ opération conservée, backoff posé ;
 *   • TEST-PHASE6-RESILIENCE-02 : redémarrage après crash (`sync_in_progress`) ⇒ reprise ;
 *   • TEST-PHASE6-RESILIENCE-03 : reconnexion ⇒ envoi unique, file vidée ;
 *   • TEST-PHASE6-RESILIENCE-04 : relance sans réseau ne duplique jamais la clé.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createAdventureSyncTransport,
  syncPendingOperations,
  type SyncWorkerStorage,
} from '@/features/adventure-intelligence/offline/syncWorker';
import {
  createOfflineOperation,
  type OfflineOperation,
  type OfflineStoreRef,
} from '@/features/adventure-intelligence/offline/operations';

const NOW = '2026-09-12T12:00:00.000Z';
const LATER = '2026-09-12T13:00:00.000Z';

/** Stockage sérialisable : simule Dexie avec « redémarrage » (hydratation). */
function makePersistentStorage() {
  const operations = new Map<string, OfflineOperation>();
  const metadata = new Map<string, unknown>();

  const storage: SyncWorkerStorage = {
    loadPending: async () => [...operations.values()],
    removeOperations: async (entries: readonly OfflineStoreRef[]) => {
      let deleted = 0;
      for (const entry of entries) {
        if (operations.delete(`${entry.store}:${entry.id}`)) deleted += 1;
      }
      return deleted;
    },
    saveOperation: async (operation) => {
      operations.set(`${operation.store}:${operation.id}`, operation);
    },
    readMetadata: async (key) => metadata.get(key),
    writeMetadata: async (key, value) => {
      metadata.set(key, value);
    },
    clearMetadata: async (key) => {
      metadata.delete(key);
    },
  };

  return {
    storage,
    operations,
    metadata,
    snapshot: () => JSON.stringify({ operations: [...operations.values()], metadata: [...metadata.entries()] }),
    restart: (): SyncWorkerStorage => {
      const restored = new Map<string, OfflineOperation>(operations);
      const restoredMetadata = new Map<string, unknown>(metadata);
      return {
        ...storage,
        loadPending: async () => [...restored.values()],
        saveOperation: async (operation) => {
          restored.set(`${operation.store}:${operation.id}`, operation);
        },
        removeOperations: async (entries) => {
          let deleted = 0;
          for (const entry of entries) {
            if (restored.delete(`${entry.store}:${entry.id}`)) deleted += 1;
          }
          return deleted;
        },
        readMetadata: async (key) => restoredMetadata.get(key),
        writeMetadata: async (key, value) => {
          restoredMetadata.set(key, value);
        },
        clearMetadata: async (key) => {
          restoredMetadata.delete(key);
        },
      };
    },
  };
}

async function queuedSession(): Promise<OfflineOperation> {
  return createOfflineOperation({
    store: 'offline_sessions_queue',
    kind: 'hike_session',
    entityId: 'session-resilience',
    payload: {
      startedAt: '2026-09-12T08:00:00.000Z',
      endedAt: '2026-09-12T11:00:00.000Z',
      distanceKm: 9.5,
      durationSeconds: 10_800,
      positionsTimed: [
        { lat: 45.1, lng: 6, timestamp: '2026-09-12T08:00:00.000Z' },
        { lat: 45.2, lng: 6.1, timestamp: '2026-09-12T10:00:00.000Z' },
      ],
    },
    createdAt: '2026-09-12T11:00:00.000Z',
    userId: 'a6d00001-0000-4000-8000-000000000001',
  });
}

describe('Phase 6 — résilience hors-ligne (TEST-PHASE6-RESILIENCE)', () => {
  it('TEST-PHASE6-RESILIENCE-01: coupure réseau ⇒ opération conservée avec backoff', async () => {
    const operation = await queuedSession();
    const persistent = makePersistentStorage();
    await persistent.storage.saveOperation(operation);

    const offlineTransport = createAdventureSyncTransport({
      fetchImpl: vi.fn(async () => {
        throw new TypeError('Network request failed');
      }) as unknown as typeof fetch,
    });

    const report = await syncPendingOperations({
      storage: persistent.storage,
      transport: offlineTransport,
      now: () => new Date(NOW),
      lock: undefined,
    });

    expect(report.attempted).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.succeeded).toBe(0);

    const pending = await persistent.storage.loadPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].attempts).toBe(1);
    expect(pending[0].nextAttemptAt).toBeTruthy();
    expect(pending[0].deadLetteredAt).toBeUndefined();
    expect(persistent.snapshot()).not.toContain('"payload":null');
  });

  it('TEST-PHASE6-RESILIENCE-02: redémarrage après crash ⇒ état de reprise rejoué', async () => {
    const operation = await queuedSession();
    const persistent = makePersistentStorage();
    await persistent.storage.saveOperation(operation);
    // Crash simulé : l'opération était « en vol » au moment du redémarrage.
    await persistent.storage.writeMetadata('sync_in_progress', {
      operationId: operation.id,
      store: operation.store,
      startedAt: NOW,
    });

    const restarted = persistent.restart();
    const sent: OfflineOperation[] = [];
    const transport = createAdventureSyncTransport({
      fetchImpl: vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { operations: OfflineOperation[] };
        sent.push(...body.operations);
        return new Response(
          JSON.stringify({
            results: body.operations.map((entry) => ({
              idempotencyKey: entry.idempotencyKey,
              status: 'applied',
            })),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }) as unknown as typeof fetch,
    });

    const report = await syncPendingOperations({
      storage: restarted,
      transport,
      now: () => new Date(LATER),
      lock: undefined,
    });

    expect(report.resumed).toMatchObject({ operationId: operation.id });
    expect(report.succeeded).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].idempotencyKey).toBe(operation.idempotencyKey);
  });

  it('TEST-PHASE6-RESILIENCE-03: reconnexion ⇒ envoi unique puis file vide', async () => {
    const operation = await queuedSession();
    const persistent = makePersistentStorage();
    await persistent.storage.saveOperation(operation);

    let online = false;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (!online) throw new TypeError('offline');
      const body = JSON.parse(String(init?.body)) as { operations: OfflineOperation[] };
      return new Response(
        JSON.stringify({
          results: body.operations.map((entry) => ({
            idempotencyKey: entry.idempotencyKey,
            status: 'applied',
          })),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    const transport = createAdventureSyncTransport({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const offlineReport = await syncPendingOperations({
      storage: persistent.storage,
      transport,
      now: () => new Date(NOW),
      lock: undefined,
    });
    expect(offlineReport.failed).toBe(1);

    // Redémarrage + reconnexion : backoff dépassé (1 h plus tard).
    online = true;
    const restarted = persistent.restart();
    const onlineReport = await syncPendingOperations({
      storage: restarted,
      transport,
      now: () => new Date(LATER),
      lock: undefined,
    });

    expect(onlineReport.succeeded).toBe(1);
    expect(onlineReport.failed).toBe(0);
    expect(await restarted.loadPending()).toHaveLength(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('TEST-PHASE6-RESILIENCE-04: relance sans réseau — clé d’idempotence strictement stable', async () => {
    const first = await queuedSession();
    const second = await queuedSession();

    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(first.idempotencyKey.split(':')[2]).toMatch(/^[0-9a-f]{64}$/);
    expect(first.id).toBe(first.idempotencyKey);
  });
});
