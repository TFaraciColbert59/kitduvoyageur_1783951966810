import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createOfflineOperation,
  groupOperationsByStore,
  hashPayload,
  hashPayloadSha256,
  isWebCryptoAvailable,
  makeIdempotencyKeySha256,
  planLegacyGlobalMigration,
  type OfflineOperation,
} from '@/features/adventure-intelligence/offline/operations';
import {
  ADVENTURE_OFFLINE_DB_PREFIX,
  LEGACY_ADVENTURE_OFFLINE_DB_NAME,
  offlineDbNameForUser,
  purgeOfflineData,
} from '@/features/adventure-intelligence/offline/db';

const USER_A = 'a11a11a1-1111-4111-8111-111111111111';
const USER_B = 'b22b22b2-2222-4222-8222-222222222222';

afterEach(() => {
  vi.unstubAllGlobals();
});

function legacyRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'op-1',
    store: 'offline_reports_queue',
    kind: 'terrain_report',
    entityId: 'r1',
    payload: { category: 'mud' },
    idempotencyKey: 'terrain_report:r1:legacykey',
    createdAt: '2026-09-01T00:00:00.000Z',
    attempts: 1,
    ...overrides,
  };
}

describe('A11 — offline par utilisateur et idempotence SHA-256 (TEST-A11-OFF)', () => {
  it('TEST-A11-OFF-01: le planner global réattribue les lignes v1 au userId et préserve la clé', async () => {
    const plan = await planLegacyGlobalMigration(
      [legacyRow(), legacyRow({ id: 'op-1' }), legacyRow({ id: 'op-2', idempotencyKey: undefined })],
      USER_A
    );

    expect(plan.skipped).toBe(0);
    expect(plan.operations).toHaveLength(2);

    const preserved = plan.operations.find((op) => op.id === 'op-1');
    expect(preserved?.userId).toBe(USER_A);
    expect(preserved?.idempotencyKey).toBe('terrain_report:r1:legacykey');
    expect(preserved?.createdAt).toBe('2026-09-01T00:00:00.000Z');
    expect(preserved?.attempts).toBe(1);

    const recomputed = plan.operations.find((op) => op.id === 'op-2');
    expect(recomputed?.idempotencyKey.split(':')[2]).toHaveLength(64);
    expect(recomputed?.userId).toBe(USER_A);
  });

  it('TEST-A11-OFF-02: le planner refuse un userId vide et compte les lignes non exploitables', async () => {
    await expect(planLegacyGlobalMigration([legacyRow()], '')).rejects.toThrow(/userId requis/);

    const plan = await planLegacyGlobalMigration(
      [legacyRow(), null, 'texte', { store: 'offline_adventures', id: 'x' }, legacyRow({ store: 'inconnu' })],
      USER_A
    );
    expect(plan.operations).toHaveLength(1);
    expect(plan.skipped).toBe(4);
  });

  it('TEST-A11-OFF-03: makeIdempotencyKeySha256 produit un hex 64 stable et sensible aux entrées', async () => {
    const first = await makeIdempotencyKeySha256({
      kind: 'terrain_report',
      entityId: 'r1',
      payload: { a: 1, b: 2 },
    });
    const same = await makeIdempotencyKeySha256({
      kind: 'terrain_report',
      entityId: 'r1',
      payload: { b: 2, a: 1 },
    });
    const otherPayload = await makeIdempotencyKeySha256({
      kind: 'terrain_report',
      entityId: 'r1',
      payload: { a: 1, b: 3 },
    });
    const otherEntity = await makeIdempotencyKeySha256({
      kind: 'terrain_report',
      entityId: 'r2',
      payload: { a: 1, b: 2 },
    });

    const digest = first.split(':')[2];
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toBe(same);
    expect(first).not.toBe(otherPayload);
    expect(first).not.toBe(otherEntity);
    expect(hashPayloadSha256).toBeTypeOf('function');
  });

  it('TEST-A11-OFF-04: SHA-256 insensible à l’ordre des clés ; repli FNV documenté sans crypto.subtle', async () => {
    expect(isWebCryptoAvailable()).toBe(true);

    const source = { z: [1, 2], a: { y: true, x: null } };
    const digest = await hashPayloadSha256(source);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toBe(await hashPayloadSha256({ a: { x: null, y: true }, z: [1, 2] }));

    vi.stubGlobal('crypto', {});
    expect(isWebCryptoAvailable()).toBe(false);
    const fallback = await hashPayloadSha256(source);
    expect(fallback).toHaveLength(8);
    expect(fallback).toBe(hashPayload(source));
    expect(fallback).not.toBe(digest);
  });

  it('TEST-A11-OFF-05: createOfflineOperation porte userId, priorité et expiration', async () => {
    const operation = await createOfflineOperation({
      store: 'offline_reports_queue',
      kind: 'terrain_report',
      entityId: 'r1',
      payload: { category: 'mud' },
      userId: USER_A,
      priority: 5,
      expiresAt: '2026-10-01T00:00:00.000Z',
    });

    expect(operation.userId).toBe(USER_A);
    expect(operation.priority).toBe(5);
    expect(operation.expiresAt).toBe('2026-10-01T00:00:00.000Z');
    expect(operation.idempotencyKey.split(':')[2]).toHaveLength(64);
  });

  it('TEST-A11-OFF-06: chaque utilisateur a un nom de base distinct, le legacy reste isolé', () => {
    const nameA = offlineDbNameForUser(USER_A);
    const nameB = offlineDbNameForUser(USER_B);

    expect(nameA).toBe(`${ADVENTURE_OFFLINE_DB_PREFIX}${USER_A}`);
    expect(nameB).toBe(`${ADVENTURE_OFFLINE_DB_PREFIX}${USER_B}`);
    expect(nameA).not.toBe(nameB);
    expect(nameA).not.toBe(LEGACY_ADVENTURE_OFFLINE_DB_NAME);
    expect(nameA.startsWith('lkdv-adventure-offline-v2-')).toBe(true);
    expect(() => offlineDbNameForUser('  ')).toThrow(/userId requis/);
  });

  it('TEST-A11-OFF-07: la purge cible uniquement la base de l’utilisateur demandé', async () => {
    const deleteDatabase = vi.fn(async (_name: string) => {});
    await purgeOfflineData(USER_A, { deleteDatabase });

    expect(deleteDatabase).toHaveBeenCalledTimes(1);
    expect(deleteDatabase).toHaveBeenCalledWith(offlineDbNameForUser(USER_A));
    expect(deleteDatabase).not.toHaveBeenCalledWith(offlineDbNameForUser(USER_B));
  });

  it('TEST-A11-OFF-08: markSynced est limité aux stores nommés par { store, id }', () => {
    const entries = [
      { store: 'offline_reports_queue' as const, id: 'r1' },
      { store: 'offline_reports_queue' as const, id: 'r2' },
      { store: 'offline_decisions_queue' as const, id: 'd1' },
      { store: 'offline_decisions_queue' as const, id: '' },
    ];
    const grouped = groupOperationsByStore(entries);

    expect([...grouped.keys()].sort()).toEqual([
      'offline_decisions_queue',
      'offline_reports_queue',
    ]);
    expect(grouped.get('offline_reports_queue')).toEqual(['r1', 'r2']);
    expect(grouped.get('offline_decisions_queue')).toEqual(['d1']);
    expect(grouped.has('offline_sessions_queue')).toBe(false);

    const homonym = {
      store: 'offline_sessions_queue' as const,
      id: 'r1',
    } satisfies Pick<OfflineOperation, 'store' | 'id'>;
    expect(groupOperationsByStore([homonym]).has('offline_reports_queue')).toBe(false);
  });
});
