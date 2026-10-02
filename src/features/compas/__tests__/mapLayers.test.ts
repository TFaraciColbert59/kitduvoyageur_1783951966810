import { describe, expect, it } from 'vitest';
import { ALL_LAYERS, NO_LAYERS, layerOf, parseLayers, visiblePoints } from '../engine/mapLayers';

const pts = [
  { id: 's1', kind: 'step' as const, category: 'stay' },
  { id: 'w1', kind: 'poi' as const, category: 'water' },
  { id: 'r1', kind: 'poi' as const, category: 'refuge' },
  { id: 'x1', kind: 'poi' as const, category: 'inconnu' },
];

describe('mapLayers — seulement des calques dont la donnée existe', () => {
  it('rattache étapes et points du tracé à leur calque', () => {
    expect(pts.map(layerOf)).toEqual(['etapes', 'water', 'refuge', null]);
  });

  it('masque les calques éteints, garde ce qui n’a pas de calque', () => {
    expect(visiblePoints(pts, { ...ALL_LAYERS, water: false }).map((p) => p.id)).toEqual([
      's1',
      'r1',
      'x1',
    ]);
    expect(visiblePoints(pts, NO_LAYERS).map((p) => p.id)).toEqual(['x1']);
  });

  it('relit un réglage enregistré sans jamais planter', () => {
    expect(parseLayers({ water: false, bidon: true }).water).toBe(false);
    expect(parseLayers('n’importe quoi')).toEqual(ALL_LAYERS);
    expect(parseLayers(null).profil).toBe(true);
  });
});
