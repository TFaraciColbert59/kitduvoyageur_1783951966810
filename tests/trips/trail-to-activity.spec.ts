import { describe, expect, it } from 'vitest';
import {
  buildTrailRawInput,
  distanceToCorridorKm,
  isWithinCorridor,
  mapTrailDifficulty,
  samplePolyline,
  type TrailDifficulty,
  type TrailInput,
} from '@/features/trips/domain/trailToActivity';

const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;

/** Ligne GeoJSON [lng, lat] régulièrement espacée. */
function geoLine(lat: number, lngStart: number, count: number, step: number): number[][] {
  return Array.from({ length: count }, (_, i) => [lngStart + i * step, lat]);
}

const BASE_TRAIL: TrailInput = {
  id: 42,
  name: 'Tour du Lac Blanc',
  ref: 'GR5',
  network: 'GR',
  distanceKm: 12.4,
  geom: { type: 'MultiLineString', coordinates: [[[2.0, 48.0], [2.1, 48.1]]] },
};

describe('mapTrailDifficulty', () => {
  it('mappe les valeurs EN/FR, null et inconnues (repli moderate)', () => {
    const cases: [(string | null | undefined), TrailDifficulty][] = [
      ['easy', 'easy'],
      ['facile', 'easy'],
      ['moderate', 'moderate'],
      ['moyen', 'moderate'],
      ['hard', 'hard'],
      ['difficile', 'hard'],
      ['expert', 'expert'],
      [null, 'moderate'],
      [undefined, 'moderate'],
      ['inconnue', 'moderate'],
    ];
    for (const [input, expected] of cases) {
      expect(mapTrailDifficulty(input)).toBe(expected);
    }
  });
});

describe('samplePolyline', () => {
  it('MultiLineString (2 lignes) → ≤ maxPoints, coordonnées valides, décimation régulière', () => {
    const lineA = geoLine(48.0, 2.0, 120, 0.001);
    const lineB = geoLine(48.1, 2.12, 120, 0.001);
    const original = [...lineA, ...lineB];
    const points = samplePolyline({ type: 'MultiLineString', coordinates: [lineA, lineB] }, 60);

    expect(points.length).toBeLessThanOrEqual(60);
    expect(points.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))).toBe(true);
    expect(points[0]).toEqual({ lat: 48.0, lng: 2.0 });
    expect(points[points.length - 1].lat).toBeCloseTo(48.1, 9);
    expect(points[points.length - 1].lng).toBeCloseTo(2.12 + 119 * 0.001, 9);

    const indices = points.map((p) =>
      original.findIndex(([lng, lat]) => lng === p.lng && lat === p.lat)
    );
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(239);
    const gaps = indices.slice(1).map((index, i) => index - indices[i]);
    expect(new Set(gaps).size).toBeLessThanOrEqual(2);
  });

  it('décime à 120 points par défaut en gardant premier et dernier', () => {
    const line = geoLine(48, 2, 300, 0.001);
    const points = samplePolyline({ type: 'LineString', coordinates: line });

    expect(points).toHaveLength(120);
    expect(points[0]).toEqual({ lat: 48, lng: 2 });
    expect(points[119].lat).toBe(48);
    expect(points[119].lng).toBeCloseTo(2 + 299 * 0.001, 9);
    for (let i = 1; i < points.length; i += 1) {
      expect(points[i].lng).toBeGreaterThan(points[i - 1].lng);
    }
  });

  it('ignore silencieusement les coordonnées invalides (NaN, lat/lng hors bornes)', () => {
    const points = samplePolyline({
      type: 'MultiLineString',
      coordinates: [
        [
          [2, 48],
          [Number.NaN, 48.01],
          [2.02, 95],
          [200, 48.03],
          [2.04, 48.04],
        ],
      ],
    });

    expect(points).toEqual([
      { lat: 48, lng: 2 },
      { lat: 48.04, lng: 2.04 },
    ]);
  });

  it('retourne [] pour une géométrie absente ou d’un type non supporté', () => {
    expect(samplePolyline(null)).toEqual([]);
    expect(samplePolyline(undefined)).toEqual([]);
    expect(samplePolyline({ type: 'Point', coordinates: [2, 48] })).toEqual([]);
  });
});

describe('distanceToCorridorKm / isWithinCorridor', () => {
  const segment = [
    { lat: 48, lng: 1.95 },
    { lat: 48, lng: 2.05 },
  ];

  it('point sur le segment → distance ≈ 0 et dans le corridor', () => {
    const distance = distanceToCorridorKm({ lat: 48, lng: 2 }, segment);
    expect(distance).toBeCloseTo(0, 5);
    expect(isWithinCorridor({ lat: 48, lng: 2 }, segment)).toBe(true);
  });

  it('point à ~3,2 km au nord d’un segment droit ouest-est → > 3 km (formule documentée)', () => {
    const point = { lat: 48.029, lng: 2 };
    // Vérification à la main : 0,029° de latitude séparent le point de son
    // pied de perpendiculaire (même lng) ; sur une sphère de rayon 6 371 km,
    // cela vaut 0,029 × (π/180) × 6 371 ≈ 3,225 km.
    const expectedKm = 0.029 * DEG_TO_RAD * EARTH_RADIUS_KM;

    const distance = distanceToCorridorKm(point, segment);
    expect(distance).toBeGreaterThan(3);
    expect(distance).toBeCloseTo(expectedKm, 3);
    expect(isWithinCorridor(point, segment)).toBe(false);
    expect(isWithinCorridor(point, segment, 4)).toBe(true);
  });

  it('point au-delà de l’extrémité → distance au sommet le plus proche', () => {
    const expectedKm = 0.15 * DEG_TO_RAD * EARTH_RADIUS_KM * Math.cos(48 * DEG_TO_RAD);
    const distance = distanceToCorridorKm({ lat: 48, lng: 2.2 }, segment);
    expect(distance).toBeCloseTo(expectedKm, 2);
  });

  it('polyligne vide → distance infinie, jamais dans le corridor', () => {
    expect(distanceToCorridorKm({ lat: 48, lng: 2 }, [])).toBe(Number.POSITIVE_INFINITY);
    expect(isWithinCorridor({ lat: 48, lng: 2 }, [])).toBe(false);
  });
});

describe('buildTrailRawInput', () => {
  it('contient nom, ref, réseau, distance, durée, difficulté et « randonnée »', () => {
    const raw = buildTrailRawInput(BASE_TRAIL, {
      difficulty: 'hard',
      durationHours: 4.5,
      elevationGain: 650,
      terrainType: 'montagne',
    });

    expect(raw).toContain('Tour du Lac Blanc');
    expect(raw).toContain('GR5');
    expect(raw).toContain('réseau GR');
    expect(raw).toMatch(/randonnée/i);
    expect(raw).toContain('12,4 km');
    expect(raw).toContain('4,5 h');
    expect(raw).toMatch(/difficulté\s*:\s*difficile/i);
    expect(raw).toContain('650 m');
    expect(raw).toContain('montagne');
  });

  it('n’invente aucune valeur quand meta=null (pas de durée ni de difficulté)', () => {
    const raw = buildTrailRawInput(BASE_TRAIL, null);

    expect(raw).toContain('Tour du Lac Blanc');
    expect(raw).toContain('12,4 km');
    expect(raw).not.toMatch(/dur[ée]e/i);
    expect(raw).not.toMatch(/difficult[é]/i);
    expect(raw).not.toMatch(/dénivelé/i);
  });

  it('omet la distance quand elle est absente (jamais inventée)', () => {
    const raw = buildTrailRawInput({ ...BASE_TRAIL, distanceKm: null }, null);
    expect(raw).not.toMatch(/\d+([.,]\d+)?\s*km/i);
  });

  it('omet ref et réseau quand ils sont absents', () => {
    const raw = buildTrailRawInput(
      { id: 7, name: 'Sentier Brut', geom: { type: 'LineString', coordinates: [] } },
      null
    );

    expect(raw).toContain('Sentier Brut');
    expect(raw).not.toMatch(/réseau/i);
  });
});
