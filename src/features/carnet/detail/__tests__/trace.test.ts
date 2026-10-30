import { describe, expect, it } from 'vitest';
import { pickCarnetTrace } from '../trace';
import type { HikeSessionRow } from '../types';

function session(overrides: Partial<HikeSessionRow> = {}): HikeSessionRow {
  return {
    id: 'h1',
    carnet_id: 'c1',
    distance_km: '12.4',
    elevation_gain_m: '700',
    duration_seconds: 3600,
    started_at: '2026-09-26T06:00:00Z',
    positions_geojson: null,
    ...overrides,
  };
}

const LINE = {
  type: 'LineString',
  coordinates: [
    [6.86, 45.83],
    [6.87, 45.84],
  ],
};

const SHORT = { type: 'LineString', coordinates: [[6.86, 45.83]] };

describe('pickCarnetTrace — trace réellement exposée', () => {
  it('rend la trace de la session la plus récente qui en porte une', () => {
    const sessions = [
      session({ id: 'recent', positions_geojson: null }),
      session({ id: 'avec-trace', positions_geojson: LINE }),
    ];
    expect(pickCarnetTrace(sessions)).toBe(LINE);
  });

  it('garde l’ordre reçu : la première trace l’emporte', () => {
    const second = { type: 'LineString', coordinates: [[7, 46], [7.1, 46.1]] };
    expect(
      pickCarnetTrace([
        session({ id: 'a', positions_geojson: LINE }),
        session({ id: 'b', positions_geojson: second }),
      ]),
    ).toBe(LINE);
  });

  it('ignore une géométrie qui ne fait pas deux points', () => {
    expect(pickCarnetTrace([session({ positions_geojson: SHORT })])).toBeNull();
  });

  it('ignore une valeur qui n’est pas une géométrie', () => {
    expect(pickCarnetTrace([session({ positions_geojson: { foo: 'bar' } })])).toBeNull();
    expect(pickCarnetTrace([session({ positions_geojson: 'abc' })])).toBeNull();
  });

  it('rend null sans session : aucune coordonnée n’est inventée', () => {
    expect(pickCarnetTrace([])).toBeNull();
    expect(pickCarnetTrace([session()])).toBeNull();
  });
});
