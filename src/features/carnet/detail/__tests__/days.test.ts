import { describe, expect, it } from 'vitest';
import { haversineDistanceKm } from '@/features/explorer-osm/domain/geometry';
import { buildDays, buildSummary } from '../days';
import type { HikeSessionRow, MomentRow } from '../types';

const START = '2026-04-24';

function session(overrides: Partial<HikeSessionRow> = {}): HikeSessionRow {
  return {
    id: 'h1',
    carnet_id: 'c1',
    distance_km: null,
    elevation_gain_m: null,
    duration_seconds: null,
    started_at: null,
    positions_geojson: null,
    ...overrides,
  };
}

function line(coordinates: Array<[number, number]>) {
  return { type: 'LineString', coordinates };
}

function timed(points: Array<{ lat: number; lng: number; timestamp: string; elevationM?: number }>) {
  return points;
}

function moment(overrides: Partial<MomentRow> = {}): MomentRow {
  return {
    id: 'm1',
    jour_numero: 1,
    heure: null,
    citation: null,
    lieu: null,
    image_url: null,
    ...overrides,
  };
}

/** Distance d'un relevé, segment par segment : la même règle que la dérivation. */
function runKm(coordinates: Array<[number, number]>): number {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    total += haversineDistanceKm(coordinates[index - 1], coordinates[index]);
  }
  return total;
}

describe('buildDays — un jour par date réelle', () => {
  it('fusionne deux sorties le même jour, triées chronologiquement, sans pont entre elles', () => {
    const matin: Array<[number, number]> = [
      [6.86, 45.83],
      [6.87, 45.84],
    ];
    const apresMidi: Array<[number, number]> = [
      [6.9, 45.85],
      [6.91, 45.86],
    ];

    const days = buildDays({
      moments: [],
      startDate: START,
      sessions: [
        session({ id: 'apres-midi', started_at: '2026-04-25T14:00:00Z', positions_geojson: line(apresMidi) }),
        session({ id: 'matin', started_at: '2026-04-25T06:00:00Z', positions_geojson: line(matin) }),
      ],
    });

    expect(days).toHaveLength(1);
    expect(days[0].index).toBe(2);
    expect(days[0].date).toBe('2026-04-25');
    expect(days[0].points).toHaveLength(4);
    /* Tri chronologique : le relevé du matin d'abord, quel que soit l'ordre reçu. */
    expect(days[0].points.map((point) => point.at)).toEqual([
      '2026-04-25T06:00:00Z',
      '2026-04-25T06:00:00Z',
      '2026-04-25T14:00:00Z',
      '2026-04-25T14:00:00Z',
    ]);
    /* Distance = somme des segments des deux relevés, jamais le saut de l'un à l'autre. */
    const expected = runKm(matin) + runKm(apresMidi);
    expect(days[0].distanceKm).toBeCloseTo(expected, 9);
    const ponte = expected + haversineDistanceKm(matin[1], apresMidi[0]);
    expect(days[0].distanceKm).toBeLessThan(ponte);
  });

  it('somme les durées des sorties du jour, et rien si aucune ne la donne', () => {
    const days = buildDays({
      moments: [],
      startDate: START,
      sessions: [
        session({ id: 'a', started_at: '2026-04-25T06:00:00Z', duration_seconds: 3600, positions_geojson: line([[6.86, 45.83], [6.87, 45.84]]) }),
        session({ id: 'b', started_at: '2026-04-25T14:00:00Z', duration_seconds: 1800, positions_geojson: line([[6.9, 45.85], [6.91, 45.86]]) }),
      ],
    });
    expect(days[0].durationS).toBe(5400);

    const sansDuree = buildDays({
      moments: [],
      startDate: START,
      sessions: [session({ id: 'c', started_at: '2026-04-25T06:00:00Z', positions_geojson: line([[6.86, 45.83], [6.87, 45.84]]) })],
    });
    expect(sansDuree[0].durationS).toBeNull();
  });

  it('prend le D+ des altitudes réelles, et rien quand elles manquent', () => {
    const days = buildDays({
      moments: [],
      startDate: START,
      sessions: [
        session({
          id: 'a',
          started_at: '2026-04-25T06:00:00Z',
          positions_timed: timed([
            { lat: 45.83, lng: 6.86, timestamp: '2026-04-25T06:00:00Z', elevationM: 1000 },
            { lat: 45.84, lng: 6.87, timestamp: '2026-04-25T06:30:00Z', elevationM: 1100 },
            { lat: 45.85, lng: 6.88, timestamp: '2026-04-25T07:00:00Z', elevationM: 1050 },
          ]),
        }),
      ],
    });
    /* 1000 → 1100 → 1050 : seuls les 100 m de montée comptent. */
    expect(days[0].elevationM).toBe(100);

    const sansAltitude = buildDays({
      moments: [],
      startDate: START,
      sessions: [session({ id: 'b', started_at: '2026-04-25T06:00:00Z', positions_geojson: line([[6.86, 45.83], [6.87, 45.84]]) })],
    });
    expect(sansAltitude[0].elevationM).toBeNull();
  });

  it('prend le D+ du jour sur elevation_gain_m des sorties, sans inventer', () => {
    const days = buildDays({
      moments: [],
      startDate: START,
      sessions: [
        session({
          id: 'matin',
          started_at: '2026-04-24T06:00:00Z',
          elevation_gain_m: 620,
          positions_geojson: line([[6.86, 45.83], [6.87, 45.84]]),
        }),
        session({
          id: 'apres-midi',
          started_at: '2026-04-24T14:00:00Z',
          /* Colonne `numeric` : le relevé peut arriver en texte. */
          elevation_gain_m: '180',
          positions_geojson: line([[6.9, 45.85], [6.91, 45.86]]),
        }),
      ],
    });

    expect(days).toHaveLength(1);
    expect(days[0].elevationM).toBe(800);
  });

  it('sépare le D+ des sorties jour par jour, chacune sur son jour de départ', () => {
    const days = buildDays({
      moments: [],
      startDate: START,
      sessions: [
        session({ id: 'j1', started_at: '2026-04-24T06:00:00Z', elevation_gain_m: 420, positions_geojson: line([[6.86, 45.83], [6.87, 45.84]]) }),
        session({ id: 'j2', started_at: '2026-04-25T06:00:00Z', elevation_gain_m: 260, positions_geojson: line([[6.9, 45.85], [6.91, 45.86]]) }),
      ],
    });

    expect(days.map((day) => day.index)).toEqual([1, 2]);
    expect(days.map((day) => day.elevationM)).toEqual([420, 260]);
  });

  it('retombe sur les altitudes des points quand aucune sortie ne donne de gain', () => {
    const days = buildDays({
      moments: [],
      startDate: START,
      sessions: [
        session({
          id: 'a',
          started_at: '2026-04-25T06:00:00Z',
          elevation_gain_m: 0,
          positions_timed: timed([
            { lat: 45.83, lng: 6.86, timestamp: '2026-04-25T06:00:00Z', elevationM: 1000 },
            { lat: 45.84, lng: 6.87, timestamp: '2026-04-25T06:30:00Z', elevationM: 1150 },
          ]),
        }),
      ],
    });

    /* Un gain nul n'est pas une source : les 150 m réels des points comptent. */
    expect(days[0].elevationM).toBe(150);
  });

  it('garde le D+ à null sans gain de sortie ni altitude de point', () => {
    const sansGain = buildDays({
      moments: [],
      startDate: START,
      sessions: [
        session({
          id: 'a',
          started_at: '2026-04-25T06:00:00Z',
          elevation_gain_m: 0,
          positions_timed: timed([
            { lat: 45.83, lng: 6.86, timestamp: '2026-04-25T06:00:00Z' },
            { lat: 45.84, lng: 6.87, timestamp: '2026-04-25T06:30:00Z' },
          ]),
        }),
      ],
    });
    expect(sansGain[0].elevationM).toBeNull();

    const sansSource = buildDays({
      moments: [],
      startDate: START,
      sessions: [session({ id: 'b', started_at: '2026-04-25T06:00:00Z', positions_geojson: line([[6.86, 45.83], [6.87, 45.84]]) })],
    });
    expect(sansSource[0].elevationM).toBeNull();
  });

  it('garde un jour sans GPS quand il porte des moments : aucune valeur inventée', () => {
    const days = buildDays({
      moments: [
        moment({ id: 'm1', jour_numero: 3, citation: 'Bivouac au col.', lieu: 'Col de la Seigne', image_url: 'https://cdn.test/1.jpg' }),
      ],
      startDate: START,
      sessions: [],
    });

    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      index: 3,
      date: '2026-04-26',
      distanceKm: null,
      elevationM: null,
      durationS: null,
      points: [],
    });
    expect(days[0].moments.map((entry) => entry.id)).toEqual(['m1']);
    expect(days[0].moments[0].place).toBe('Col de la Seigne');
  });
});

describe('buildDays — carnets sans date et carnets vides', () => {
  it('dérive les jours des jour_numero des moments, sans date inventée', () => {
    const days = buildDays({
      moments: [moment({ id: 'm1', jour_numero: 2 }), moment({ id: 'm2', jour_numero: 4 })],
      sessions: [],
      startDate: null,
    });

    expect(days.map((day) => day.index)).toEqual([2, 4]);
    expect(days.map((day) => day.date)).toEqual([null, null]);
    expect(days.map((day) => day.moments.map((entry) => entry.id))).toEqual([['m1'], ['m2']]);
  });

  it('date les points d’un carnet sans date avec la date réelle du point', () => {
    const days = buildDays({
      moments: [],
      startDate: null,
      sessions: [session({ id: 'a', started_at: '2026-04-25T06:00:00Z', positions_geojson: line([[6.86, 45.83], [6.87, 45.84]]) })],
    });

    expect(days).toHaveLength(1);
    expect(days[0].index).toBe(1);
    expect(days[0].date).toBe('2026-04-25');
  });

  it('ne crée aucun jour pour un carnet vide', () => {
    const days = buildDays({ moments: [], sessions: [], startDate: START });
    expect(days).toEqual([]);
    expect(buildSummary(days)).toEqual({ distanceKm: null, elevationM: null, days: 0, moments: 0 });
  });

  it('écarte les points qu’aucune heure réelle ne date', () => {
    const days = buildDays({
      moments: [],
      startDate: START,
      sessions: [session({ id: 'a', started_at: null, positions_geojson: line([[6.86, 45.83], [6.87, 45.84]]) })],
    });
    expect(days).toEqual([]);
  });
});

describe('buildSummary — totaux réels du carnet', () => {
  it('somme exactement les jours, leurs moments et leurs distances', () => {
    const days = buildDays({
      startDate: START,
      moments: [
        moment({ id: 'm1', jour_numero: 1 }),
        moment({ id: 'm2', jour_numero: 1 }),
        moment({ id: 'm3', jour_numero: 3 }),
      ],
      sessions: [
        session({ id: 'j1', started_at: '2026-04-24T06:00:00Z', positions_geojson: line([[6.86, 45.83], [6.87, 45.84]]), duration_seconds: 3600 }),
        session({
          id: 'j3',
          started_at: '2026-04-26T06:00:00Z',
          positions_timed: timed([
            { lat: 45.9, lng: 6.95, timestamp: '2026-04-26T06:00:00Z', elevationM: 1200 },
            { lat: 45.91, lng: 6.96, timestamp: '2026-04-26T06:30:00Z', elevationM: 1450 },
          ]),
        }),
      ],
    });

    const summary = buildSummary(days);
    expect(summary.days).toBe(days.length);
    expect(summary.moments).toBe(3);
    expect(summary.distanceKm).toBeCloseTo(
      days.reduce((total, day) => total + (day.distanceKm ?? 0), 0),
      9,
    );
    expect(summary.elevationM).toBe(250);
    expect(days.map((day) => day.index)).toEqual([1, 3]);
    expect(days[0].date).toBe('2026-04-24');
    expect(days[1].date).toBe('2026-04-26');
    expect(days[0].durationS).toBe(3600);
  });
});
