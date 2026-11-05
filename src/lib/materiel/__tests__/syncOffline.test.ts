import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dirtyGear: [] as any[],
  dirtyKits: [] as any[],
  markGearSynced: vi.fn(),
  markKitsSynced: vi.fn(),
}));

vi.mock('dexie', () => {
  return {
    default: class MockDexie {
      gear = {
        where: () => ({ equals: () => ({ toArray: async () => mocks.dirtyGear }) }),
        bulkUpdate: async (updates: any[]) => mocks.markGearSynced(updates.map((u: any) => u.key)),
      };
      kits = {
        where: () => ({ equals: () => ({ toArray: async () => mocks.dirtyKits }) }),
        bulkUpdate: async (updates: any[]) => mocks.markKitsSynced(updates.map((u: any) => u.key)),
      };
      history = {
        where: () => ({ equals: () => ({ reverse: () => ({ sortBy: async () => [] }) }) }),
      };
      version() {
        return { stores: () => this };
      }
    },
  };
});

import { syncOffline } from '@/lib/materiel/db';

describe('L0-1d: syncOffline error propagation and dirty retention', () => {
  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dirtyGear = [];
    mocks.dirtyKits = [];
  });

  it('Un échec serveur HTTP 500 ne marque pas le kit comme synchronisé (ÉCHOUE SUR CODE ACTUEL)', async () => {
    mocks.dirtyKits = [
      { id: 'kit-failing', user_id: 'usr-1', updated_at: '2026-10-31T00:00:00Z', dirty: true, data: { name: 'Kit Test' } },
    ];

    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Database timeout' }),
    } as any);

    const result = await syncOffline('usr-1');

    // Sur code non corrigé : markKitsSynced est appelé avec ['kit-failing'] malgré le 500 !
    // Sur code corrigé : markKitsSynced n'est jamais appelé avec ['kit-failing'] et pushedKits vaut 0
    expect(mocks.markKitsSynced).not.toHaveBeenCalledWith(expect.arrayContaining(['kit-failing']));
    expect(mocks.markKitsSynced).not.toHaveBeenCalled();
    expect(result.pushedKits).toBe(0);
  });

  it('Une erreur réseau (fetch throws) conserve le kit sale en local', async () => {
    mocks.dirtyKits = [
      { id: 'kit-offline', user_id: 'usr-1', updated_at: '2026-10-31T00:00:00Z', dirty: true, data: { name: 'Kit Offline' } },
    ];

    fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await syncOffline('usr-1');

    expect(mocks.markKitsSynced).not.toHaveBeenCalledWith(expect.arrayContaining(['kit-offline']));
    expect(mocks.markKitsSynced).not.toHaveBeenCalled();
    expect(result.pushedKits).toBe(0);
  });

  it('Un payload items: [] en file sans allowEmptyItems est refusé et non poussé au serveur', async () => {
    mocks.dirtyKits = [
      { id: 'kit-poison', user_id: 'usr-1', updated_at: '2026-10-31T00:00:00Z', dirty: true, data: { name: 'Kit Poison', items: [] } },
    ];
    fetchSpy = vi.spyOn(global, 'fetch');

    await syncOffline('usr-1');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mocks.markKitsSynced).not.toHaveBeenCalled();
  });

  it('Uniquement les requêtes ayant réussi (res.ok: true) sont marquées synchronisées', async () => {
    mocks.dirtyKits = [
      { id: 'kit-1-ok', user_id: 'usr-1', updated_at: '2026-10-31T00:00:00Z', dirty: true, data: { name: 'Kit OK' } },
      { id: 'kit-2-fail', user_id: 'usr-1', updated_at: '2026-10-31T00:00:00Z', dirty: true, data: { name: 'Kit Fail' } },
    ];

    fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, status: 200 } as any)
      .mockResolvedValueOnce({ ok: false, status: 409 } as any);

    const result = await syncOffline('usr-1');

    expect(mocks.markKitsSynced).toHaveBeenCalledWith(['kit-1-ok']);
    expect(result.pushedKits).toBe(1);
  });
});
