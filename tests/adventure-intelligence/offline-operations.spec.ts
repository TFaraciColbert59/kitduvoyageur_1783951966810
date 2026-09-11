import { describe, it, expect } from 'vitest';
import {
  LEGACY_ADVENTURE_PACK_KEY,
  LEGACY_METADATA_KEYS,
  LEGACY_REPORTS_QUEUE_KEY,
  LEGACY_SYNC_QUEUE_KEY,
  OFFLINE_STORES,
  createOfflineOperation,
  dedupeOperations,
  hashPayload,
  isOfflineQueueStore,
  makeIdempotencyKey,
  packSizeBytes,
  planLegacyMigration,
} from '@/features/adventure-intelligence/offline/operations';

const NOW = '2026-09-11T12:00:00.000Z';

async function operation(entityId: string, payload: unknown) {
  return createOfflineOperation({
    store: 'offline_reports_queue',
    kind: 'terrain_report',
    entityId,
    payload,
    createdAt: NOW,
  });
}

describe('Offline V2 — opérations idempotentes (TEST-A7-OFF)', () => {
  it('TEST-A7-OFF-01: clé d’idempotence stable, sensible au type, à l’entité et au payload', async () => {
    const key = makeIdempotencyKey({
      kind: 'terrain_report',
      entityId: 'r1',
      payloadHash: 'abc',
    });

    expect(key).toBe(
      makeIdempotencyKey({ kind: 'terrain_report', entityId: 'r1', payloadHash: 'abc' })
    );
    expect(key).not.toBe(
      makeIdempotencyKey({ kind: 'terrain_report', entityId: 'r2', payloadHash: 'abc' })
    );
    expect(key).not.toBe(
      makeIdempotencyKey({ kind: 'terrain_report', entityId: 'r1', payloadHash: 'def' })
    );
    expect(key).not.toBe(
      makeIdempotencyKey({ kind: 'decision', entityId: 'r1', payloadHash: 'abc' })
    );

    expect(hashPayload({ a: 1, b: 2 })).toBe(hashPayload({ b: 2, a: 1 }));
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));

    const op = await operation('r1', { note: 'boue' });
    expect(op.idempotencyKey.split(':')[2]).toHaveLength(64);
    expect(op.attempts).toBe(0);
    expect(op.createdAt).toBe(NOW);
    expect(op.store).toBe('offline_reports_queue');

    expect(OFFLINE_STORES).toHaveLength(10);
    expect(isOfflineQueueStore('offline_reports_queue')).toBe(true);
    expect(isOfflineQueueStore('offline_adventures')).toBe(false);
  });

  it('TEST-A7-OFF-02: migration legacy — clés connues migrées, clés inconnues ignorées', async () => {
    const queue = JSON.stringify([
      { id: 's1', type: 'hike_session', payload: { distanceM: 1200 }, createdAt: NOW, retryCount: 2 },
      { id: 's2', type: 'journal_event', payload: { note: 'orage' }, createdAt: NOW, retryCount: 0 },
    ]);

    const plan = await planLegacyMigration({
      [LEGACY_SYNC_QUEUE_KEY]: queue,
      lkdv_cle_inconnue: '{"x":1}',
      lkdv_offline_pack_version: '"3"',
    });

    expect(plan.migratedKeys).toEqual([LEGACY_SYNC_QUEUE_KEY, 'lkdv_offline_pack_version']);
    expect(plan.skipped).toEqual(['lkdv_cle_inconnue']);
    expect(plan.operations).toHaveLength(3);

    const session = plan.operations.find((op) => op.kind === 'hike_session');
    expect(session?.store).toBe('offline_sessions_queue');
    expect(session?.payload).toEqual({ distanceM: 1200 });
    expect(session?.attempts).toBe(2);
    expect(session?.createdAt).toBe(NOW);

    const invalid = await planLegacyMigration({ [LEGACY_SYNC_QUEUE_KEY]: 'pas-du-json' });
    expect(invalid.operations).toEqual([]);
    expect(invalid.migratedKeys).toEqual([]);
    expect(invalid.skipped).toContain(LEGACY_SYNC_QUEUE_KEY);

    const reports = await planLegacyMigration({
      [LEGACY_REPORTS_QUEUE_KEY]: JSON.stringify({
        id: 'r9',
        payload: { category: 'mud' },
      }),
    });
    expect(reports.operations[0].store).toBe('offline_reports_queue');
    expect(reports.operations[0].kind).toBe('terrain_report');
    expect(LEGACY_METADATA_KEYS.length).toBeGreaterThan(0);
  });

  it('TEST-A7-OFF-03: taille du pack cumulée, nulle pour un pack vide', async () => {
    expect(packSizeBytes([])).toBe(0);

    const a = await operation('a', { note: 'a' });
    const b = await operation('b', { note: 'b' });
    const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

    expect(packSizeBytes([a])).toBe(bytes(a));
    expect(packSizeBytes([a, b])).toBe(bytes(a) + bytes(b));
    expect(packSizeBytes([a, b])).toBeGreaterThan(packSizeBytes([a]));
  });

  it('TEST-A7-OFF-04: aucune opération en double — déduplication par clé d’idempotence', async () => {
    const op = await operation('same', { note: 'identique' });
    const deduped = dedupeOperations([op, { ...op }, op]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]).toEqual(op);

    const plan = await planLegacyMigration({
      [LEGACY_SYNC_QUEUE_KEY]: JSON.stringify([
        { id: 's1', type: 'hike_session', payload: { distanceM: 1200 } },
        { id: 's1', type: 'hike_session', payload: { distanceM: 1200 } },
      ]),
    });
    expect(plan.operations).toHaveLength(1);
  });

  it('TEST-A7-OFF-05: métadonnées et pack d’aventure migrés vers leurs stores', async () => {
    const plan = await planLegacyMigration({
      lkdv_offline_pack_version: '"3"',
      lkdv_offline_last_sync: '"2026-09-10T00:00:00.000Z"',
      [LEGACY_ADVENTURE_PACK_KEY]: JSON.stringify({ id: 'pack-1', title: 'Queyras' }),
    });

    const metadata = plan.operations.filter((op) => op.store === 'sync_metadata');
    expect(metadata).toHaveLength(2);
    expect(metadata[0].kind).toBe('metadata');
    expect(metadata[0].payload).toEqual({ key: 'lkdv_offline_pack_version', value: '3' });
    expect(metadata[1].payload).toEqual({
      key: 'lkdv_offline_last_sync',
      value: '2026-09-10T00:00:00.000Z',
    });

    const pack = plan.operations.find((op) => op.store === 'offline_adventures');
    expect(pack?.kind).toBe('adventure_pack');
    expect(pack?.payload).toEqual({ id: 'pack-1', title: 'Queyras' });
    expect(plan.migratedKeys).toEqual([
      'lkdv_offline_pack_version',
      'lkdv_offline_last_sync',
      LEGACY_ADVENTURE_PACK_KEY,
    ]);
  });
});
