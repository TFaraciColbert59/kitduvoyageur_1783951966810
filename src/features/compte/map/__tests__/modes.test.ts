import { describe, expect, it } from 'vitest';
import { filterTracksForMode, mapModeConfig, resolveSheetMode } from '../modes';
import type { MapTrack } from '../types';

function track(overrides: Partial<MapTrack> = {}): MapTrack {
  return {
    id: 's1',
    title: 'Sortie',
    startedAt: null,
    year: 2026,
    km: 1,
    dplus: 10,
    maxAlt: null,
    verified: true,
    visibility: 'private',
    massif: null,
    massifId: null,
    kitId: null,
    kitName: null,
    carnetId: null,
    photosCount: 0,
    participantsCount: 0,
    coordinates: [],
    bounds: [0, 0, 1, 1],
    start: { lng: 0, lat: 0 },
    end: { lng: 1, lat: 1 },
    ...overrides,
  };
}

describe('mapModeConfig', () => {
  it('ne montre aucun calque de données pour Prêts, Compte et Réseau', () => {
    for (const mode of ['prets', 'compte', 'reseau'] as const) {
      const config = mapModeConfig(mode);
      expect(config.layers.tracks).toBe('none');
      expect(config.layers.massifs).toBe(false);
      expect(config.dimmed).toBe(true);
    }
  });

  it('la sortie ne montre qu’une trace sélectionnée', () => {
    const config = mapModeConfig('sortie');
    expect(config.layers.tracks).toBe('selected');
    expect(config.camera).toBe('fit-selected');
  });
});

describe('resolveSheetMode', () => {
  it('mappe les cinq slots du profil', () => {
    for (const slot of ['vitrine', 'kit', 'prets', 'souvenirs', 'communaute'] as const) {
      expect(
        resolveSheetMode({ kind: 'step', step: 0, slot, detent: 'card', outingId: null })
      ).toBe(slot);
    }
  });

  it('mappe les drawers Réseau, Compte et Sortie', () => {
    const base = { step: 0, slot: null, detent: 'card', outingId: null };
    expect(resolveSheetMode({ ...base, kind: 'followers_sheet' })).toBe('reseau');
    expect(resolveSheetMode({ ...base, kind: 'account_drawer' })).toBe('compte');
    expect(resolveSheetMode({ ...base, kind: 'outing_drawer' })).toBe('sortie');
  });

  it('retombe sur overview sans drawer', () => {
    expect(
      resolveSheetMode({ kind: null, step: 0, slot: null, detent: 'closed', outingId: null })
    ).toBe('overview');
  });
});

describe('filterTracksForMode', () => {
  const tracks = [
    track({ id: 'a', kitId: 'k1', participantsCount: 0 }),
    track({ id: 'b', kitId: null, participantsCount: 2 }),
  ];

  it('kit : ne garde que les sorties liées à un kit', () => {
    expect(filterTracksForMode(tracks, 'kit').map((t) => t.id)).toEqual(['a']);
  });

  it('communauté : ne garde que les sorties partagées', () => {
    expect(filterTracksForMode(tracks, 'communaute').map((t) => t.id)).toEqual(['b']);
  });

  it('sortie : ne garde que la sortie sélectionnée', () => {
    expect(filterTracksForMode(tracks, 'sortie', 'b').map((t) => t.id)).toEqual(['b']);
  });

  it('prêts : aucun calque', () => {
    expect(filterTracksForMode(tracks, 'prets')).toEqual([]);
  });
});
