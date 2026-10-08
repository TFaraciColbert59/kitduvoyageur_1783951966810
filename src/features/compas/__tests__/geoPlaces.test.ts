import { describe, expect, it } from 'vitest';
import {
  areaBox,
  geoPlaceToArea,
  mergeReferential,
  referentialEnough,
  type GeoPlaceRow,
} from '../engine/geoPlaces';
import type { AreaPlace } from '../engine/itinerary';

const VILLARD: GeoPlaceRow = {
  geoname_id: 2968984,
  name: 'Villard-de-Lans',
  kind: 'village',
  country_code: 'FR',
  lat: 45.07156,
  lon: 5.55637,
  ele_m: 1032,
  population: 4287,
};

function place(over: Partial<AreaPlace>): AreaPlace {
  return { id: 'x', name: 'Lieu', lat: 45, lon: 5.5, kind: 'village', population: null, eleM: null, countryCode: 'FR', ...over };
}

describe('référentiel des lieux habités (plan 3.2)', () => {
  it('une ligne GeoNames devient un lieu de zone, sans rien inventer', () => {
    expect(geoPlaceToArea(VILLARD)).toEqual({
      id: 'g2968984',
      name: 'Villard-de-Lans',
      lat: 45.07156,
      lon: 5.55637,
      kind: 'village',
      population: 4287,
      eleM: 1032,
      countryCode: 'FR',
    });
    // Population inconnue (0 chez GeoNames) : null, jamais 0 habitant.
    expect(geoPlaceToArea({ ...VILLARD, population: 0 })?.population).toBeNull();
    expect(geoPlaceToArea({ ...VILLARD, kind: 'hut' })).toBeNull();
    expect(geoPlaceToArea({ ...VILLARD, name: '  ' })).toBeNull();
  });

  it('l’emprise : celle de la carte si elle existe, sinon le carré du rayon', () => {
    const extent = areaBox({ center: { lat: 45, lon: 5.5 }, radiusKm: 30, extent: [5.2, 45.3, 5.9, 44.8], activity: 'rando' });
    expect(extent).toEqual([5.2, 44.8, 5.9, 45.3]);
    const [w, s, e, n] = areaBox({ center: { lat: 45, lon: 5.5 }, radiusKm: 22.2, activity: 'rando' });
    expect(n - s).toBeCloseTo(0.4, 3);
    // Plus large en longitude à 45° N (un degré y est plus court).
    expect(e - w).toBeGreaterThan(n - s);
    // Rayon démesuré : plafonné à 400 km comme les autres cartes.
    const big = areaBox({ center: { lat: 0, lon: 0 }, radiusKm: 5000, activity: 'voyage' });
    expect(big[3] - big[1]).toBeCloseTo((2 * 400) / 111, 3);
  });

  it('assez de lieux ? trois dans un pays détaillé, une douzaine ailleurs', () => {
    const fr = [1, 2, 3].map((i) => place({ id: `g${i}` }));
    expect(referentialEnough(fr)).toBe(true);
    const ar = [1, 2, 3].map((i) => place({ id: `g${i}`, countryCode: 'AR' }));
    expect(referentialEnough(ar)).toBe(false);
    const arMany = Array.from({ length: 12 }, (_, i) => place({ id: `g${i}`, countryCode: 'AR' }));
    expect(referentialEnough(arMany)).toBe(true);
    expect(referentialEnough([])).toBe(false);
  });

  it('fusion : le même village vu par Photon n’est pas compté deux fois', () => {
    const ref = [place({ id: 'g1', name: 'Villard-de-Lans', lat: 45.0716, lon: 5.5564 })];
    const photon = [
      // Même nom, 600 m plus loin (centre OSM ≠ centre GeoNames) : doublon.
      place({ id: 'n10', name: 'Villard de Lans', lat: 45.0768, lon: 5.5564 }),
      // Autre lieu habité à 200 m : le même endroit sous un autre nom.
      place({ id: 'n11', name: 'Les Geymonds', lat: 45.0734, lon: 5.5564, kind: 'hamlet' }),
      // Un refuge passe toujours : le référentiel n'en a pas.
      place({ id: 'n12', name: 'Refuge de la Combe Male', lat: 45.0716, lon: 5.5565, kind: 'hut' }),
      // Un vrai autre village.
      place({ id: 'n13', name: 'Corrençon-en-Vercors', lat: 45.0264, lon: 5.5245 }),
    ];
    const merged = mergeReferential(ref, photon);
    expect(merged.map((p) => p.id)).toEqual(['g1', 'n12', 'n13']);
  });
});
