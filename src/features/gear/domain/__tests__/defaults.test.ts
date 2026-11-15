import { describe, expect, it } from 'vitest';
import { gearKindsForSport, inferGearKind, normalizeSport } from '../gearKind';
import { primaryGearKindForSport, selectDefaultGear } from '../defaults';
import type { GearRef, GearSportDefault } from '../types';

const items: GearRef[] = [
  { id: 'v1', name: 'Vélo gravel', kind: 'bike' },
  { id: 'v2', name: 'VTT', kind: 'bike' },
  { id: 's1', name: 'Chaussures de rando', kind: 'shoe' },
  { id: 's2', name: 'Trail shoes', kind: 'shoe' },
  { id: 'c1', name: 'Chaîne 11v', kind: 'component' },
  { id: 'o1', name: 'Kayak', kind: 'other' },
];

const defaults: GearSportDefault[] = [
  { gearItemId: 'v2', sport: 'velo', kind: 'bike', priority: 0 },
  { gearItemId: 's2', sport: 'trail', kind: 'shoe', priority: 0 },
];

describe('type de matériel', () => {
  it('reconnaît les vélos, chaussures et composants', () => {
    expect(inferGearKind('Vélo de route')).toBe('bike');
    expect(inferGearKind('Chaussures de randonnée')).toBe('shoe');
    expect(inferGearKind('Pneu arrière 29"')).toBe('component');
    expect(inferGearKind('Sac à dos')).toBe('other');
  });

  it('un composant nommé avec « vélo » reste un composant', () => {
    expect(inferGearKind('Pneu vélo 700c')).toBe('component');
  });

  it('respecte un type explicite', () => {
    expect(inferGearKind('Objet mystère', null, 'shoe')).toBe('shoe');
  });

  it('ne classe pas un objet vide', () => {
    expect(inferGearKind(null)).toBe('other');
  });

  it('normalise les sports de la taxonomie Explorer', () => {
    expect(normalizeSport('Vélo')).toBe('velo');
    expect(normalizeSport('rando')).toBe('rando');
    expect(normalizeSport('natation')).toBeNull();
  });

  it('associe vélo aux vélos et rando aux chaussures', () => {
    expect(gearKindsForSport('velo')).toEqual(['bike']);
    expect(gearKindsForSport('rando')).toEqual(['shoe']);
    expect(gearKindsForSport('kayak')).toEqual([]);
    expect(primaryGearKindForSport('velo')).toBe('bike');
    expect(primaryGearKindForSport('kayak')).toBeNull();
  });
});

describe('matériel par défaut selon le sport', () => {
  it('propose le vélo par défaut en premier pour une sortie vélo', () => {
    const result = selectDefaultGear({ sport: 'velo', items, defaults });
    expect(result.map((entry) => entry.item.id)).toEqual(['v2', 'v1']);
    expect(result[0]?.isDefault).toBe(true);
    expect(result[0]?.source).toBe('sport');
    expect(result[1]?.source).toBe('available');
  });

  it('propose les chaussures par défaut en trail', () => {
    const result = selectDefaultGear({ sport: 'trail', items, defaults });
    expect(result.map((entry) => entry.item.id)).toEqual(['s2', 's1']);
    expect(result[0]?.source).toBe('sport');
  });

  it('fait primer l’objet déjà associé à l’activité', () => {
    const result = selectDefaultGear({
      sport: 'velo',
      items,
      defaults,
      activityGearIds: ['v1'],
    });
    expect(result[0]?.item.id).toBe('v1');
    expect(result[0]?.source).toBe('activity');
    expect(result[0]?.isDefault).toBe(true);
  });

  it('ne propose rien pour un sport sans matériel suivi', () => {
    expect(selectDefaultGear({ sport: 'kayak', items, defaults })).toEqual([]);
    expect(selectDefaultGear({ sport: null, items, defaults })).toEqual([]);
  });

  it('ne mélange pas les sports : un défaut vélo ne sort pas en rando', () => {
    const result = selectDefaultGear({ sport: 'rando', items, defaults });
    expect(result.every((entry) => entry.item.kind === 'shoe')).toBe(true);
    expect(result.some((entry) => entry.item.id === 'v2')).toBe(false);
  });
});
