import { describe, expect, it, vi } from 'vitest';

/**
 * Pont Live Activity (P7-20) : sur le web, aucune méthode native n'est appelée
 * et rien ne lève. Le natif iOS est prouvé par le job `build-ios` (compilation)
 * et par une vérification manuelle sur simulateur.
 */

const registered: string[] = [];

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'web' },
  registerPlugin: (name: string) => {
    registered.push(name);
    return {
      isSupported: vi.fn(async () => {
        throw new Error('ne doit pas être appelé sur le web');
      }),
      start: vi.fn(async () => {
        throw new Error('ne doit pas être appelé sur le web');
      }),
      update: vi.fn(async () => {
        throw new Error('ne doit pas être appelé sur le web');
      }),
      end: vi.fn(async () => {
        throw new Error('ne doit pas être appelé sur le web');
      }),
    };
  },
}));

describe('explorer-v2 · Live Activity (pont web)', () => {
  it('déclare le plugin natif sous son nom iOS', async () => {
    await import('@/features/explorer-v2/native/liveActivity');
    expect(registered).toContain('LkdvLiveActivity');
  });

  it('ne fait rien sur le web et ne lève jamais', async () => {
    const mod = await import('@/features/explorer-v2/native/liveActivity');
    await expect(mod.isLiveActivitySupported()).resolves.toBe(false);
    await expect(
      mod.startLiveActivity({
        distanceM: 0,
        elevGainM: 0,
        movingS: 0,
        paused: false,
        offRoute: false,
        sport: 'rando',
        startedAt: Date.now(),
      }),
    ).resolves.toBe(false);
    await expect(mod.updateLiveActivity({ distanceM: 1, elevGainM: 0, movingS: 1, paused: false, offRoute: false })).resolves.toBeUndefined();
    await expect(mod.endLiveActivity({ distanceM: 1, elevGainM: 0, movingS: 1, paused: false, offRoute: false })).resolves.toBeUndefined();
  });
});
