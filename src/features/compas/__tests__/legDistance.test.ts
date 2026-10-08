/**
 * Plan 1.5 (8 octobre) : ce que BRouter faisait pour les lieux de montagne
 * (P1.10) se fait autrement, sans service aux conditions inconnues.
 *
 *   - Une étape que ni Geoapify ni Valhalla ne savent mesurer (refuge des
 *     Grands Mulets : les graphes s'arrêtent 2,9 km plus bas) garde une
 *     distance, mais ANNONCÉE : vol d'oiseau × coefficient, « estimation ».
 *   - Le dénivelé positif d'une journée, que seul BRouter donnait, se lit sur
 *     le relief (Terrain Tiles) le long du tracé mesuré.
 */
import { describe, expect, it, vi } from 'vitest';
import { ascentFromElevations, estimatedLegKm, estimationNote, LEG_DETOUR, stepDistanceMetadata } from '../engine/legDistance';

const terrain = vi.hoisted(() => ({ calls: [] as Array<ReadonlyArray<readonly [number, number]>>, values: null as (number | null)[] | null }));
vi.mock('@/lib/geo/terrainElevation', () => ({
  TERRAIN_SOURCE: 'Terrain Tiles (test)',
  terrainElevations: vi.fn(async (points: ReadonlyArray<readonly [number, number]>) => {
    terrain.calls.push(points);
    return terrain.values ?? points.map((_, i) => 1000 + i * 10);
  }),
}));

import { routeAscentM } from '../server/elevation';

describe('distance estimée, annoncée', () => {
  it('vol d’oiseau × le détour du terrain, au dixième', () => {
    // Chamonix → Grands Mulets : 6,4 km à vol d'oiseau.
    expect(estimatedLegKm(6.4, 'marche')).toBe(9);
    expect(estimatedLegKm(10, 'velo')).toBe(13);
    expect(estimatedLegKm(100, 'voiture')).toBe(130);
    expect(LEG_DETOUR.marche).toBeGreaterThan(LEG_DETOUR.voiture);
  });

  it('pas de vol d’oiseau exploitable : pas de distance, jamais zéro', () => {
    expect(estimatedLegKm(0, 'marche')).toBeNull();
    expect(estimatedLegKm(Number.NaN, 'velo')).toBeNull();
    expect(estimatedLegKm(-3, 'voiture')).toBeNull();
  });

  it('l’annonce dit « estimée », la méthode, et « à vérifier »', () => {
    const note = estimationNote(9, 'marche');
    expect(note).toContain('estimée');
    expect(note).toContain('vol d’oiseau × 1,4');
    expect(note).toContain('à vérifier');
    expect(estimationNote(12.5, 'velo')).toContain('12,5 km');
  });
});

describe('source de la distance gardée avec l’étape', () => {
  it('le routeur ou « estimation », et jamais null (colonne NOT NULL)', () => {
    expect(stepDistanceMetadata('geoapify')).toEqual({ distance: { source: 'geoapify' } });
    expect(stepDistanceMetadata('estimation')).toEqual({ distance: { source: 'estimation' } });
    expect(stepDistanceMetadata(null)).toEqual({});
    expect(stepDistanceMetadata(undefined)).toEqual({});
  });
});

describe('dénivelé positif lu sur le relief', () => {
  it('cumule les montées réelles', () => {
    expect(ascentFromElevations([1000, 1100, 1050, 1300])).toBe(350);
  });

  it('le bruit du relief (quelques mètres) ne fabrique pas de dénivelé', () => {
    expect(ascentFromElevations([1000, 1004, 999, 1005, 1001, 1006, 1000])).toBe(0);
  });

  it('une montée après un petit creux compte depuis le creux', () => {
    expect(ascentFromElevations([100, 95, 91, 105])).toBe(14);
  });

  it('les trous sont sautés ; moins de deux altitudes : rien, jamais 0', () => {
    expect(ascentFromElevations([1000, null, 1200])).toBe(200);
    expect(ascentFromElevations([1000])).toBeNull();
    expect(ascentFromElevations([null, null])).toBeNull();
  });

  it('un tracé [lon, lat] est échantillonné tous les 100 m environ, puis lu', async () => {
    terrain.calls = [];
    terrain.values = null;
    // ~3,2 km vers l'est à 45,9° N.
    const up = await routeAscentM([
      [6.8693, 45.9237],
      [6.9105, 45.9237],
    ]);
    expect(terrain.calls).toHaveLength(1);
    const pts = terrain.calls[0];
    expect(pts.length).toBeGreaterThanOrEqual(20);
    expect(pts.length).toBeLessThanOrEqual(150);
    // Les points partent en [lon, lat], dans l'ordre du tracé.
    expect(pts[0][0]).toBeCloseTo(6.8693, 4);
    expect(pts[0][1]).toBeCloseTo(45.9237, 4);
    expect(up).toBe((pts.length - 1) * 10);
  });

  it('relief injoignable : null, la distance reste', async () => {
    terrain.values = [null, null] as unknown as (number | null)[];
    const up = await routeAscentM([
      [6.8693, 45.9237],
      [6.9105, 45.9237],
    ]);
    expect(up).toBeNull();
  });
});
