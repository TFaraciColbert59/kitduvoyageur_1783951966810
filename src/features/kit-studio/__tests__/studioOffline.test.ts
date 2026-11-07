// @vitest-environment jsdom
// Tests du cache client de la donnée serveur RÉELLE (repli hors-ligne, jamais de démo).
import { afterEach, describe, expect, it } from 'vitest';
import { COLORWAYS, DEFAULT_CONFIG, FAMILIES, ITEMS, KITS, ONE } from '../domain/catalog';
import type { StudioData } from '../domain/studioData';
import { STUDIO_CACHE_KEY, clearStudioCache, loadStudioCache, saveStudioCache } from '../services/studioOffline';

const serverData: StudioData = {
  items: ITEMS,
  kits: KITS,
  one: ONE,
  colorways: COLORWAYS,
  config: DEFAULT_CONFIG,
  own: { chassis: 'foret' },
  order: {},
  bodyKg: 72,
  families: FAMILIES,
};

afterEach(() => {
  localStorage.clear();
});

describe('cache de la donnée serveur réelle', () => {
  it('aller-retour : la donnée synchronisée est relue avec son horodatage', () => {
    saveStudioCache(serverData);
    const cached = loadStudioCache();
    expect(cached).not.toBeNull();
    expect(cached!.data).toEqual(serverData);
    expect(new Date(cached!.savedAt).toString()).not.toBe('Invalid Date');
  });

  it('aucun cache → null (le studio affichera « indisponible », pas la démo)', () => {
    expect(loadStudioCache()).toBeNull();
  });

  it('cache corrompu ou incomplet → ignoré, jamais utilisé à moitié', () => {
    localStorage.setItem(STUDIO_CACHE_KEY, '{pas du json');
    expect(loadStudioCache()).toBeNull();
    localStorage.setItem(STUDIO_CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data: { items: [] } }));
    expect(loadStudioCache()).toBeNull();
    localStorage.setItem(STUDIO_CACHE_KEY, JSON.stringify({ savedAt: 'x', data: { ...serverData, kits: [] } }));
    expect(loadStudioCache()).toBeNull();
  });

  it('clear efface le cache', () => {
    saveStudioCache(serverData);
    clearStudioCache();
    expect(loadStudioCache()).toBeNull();
  });
});
