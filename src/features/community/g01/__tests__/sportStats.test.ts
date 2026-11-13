import { describe, expect, it } from 'vitest';
import type { SportKey } from '../contracts';
import {
  computePersonalRecords,
  redactSessionForShare,
  selectSportRecords,
  selectSportStats,
  type SportSessionMetrics,
} from '../sportStats';

const OWNER = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const OTHER_SESSION = '33333333-3333-4333-8333-333333333333';

const session: SportSessionMetrics = {
  id: SESSION,
  ownerId: OWNER,
  sport: 'rando',
  title: 'Tour du lac',
  startedAt: '2026-11-13T08:00:00.000Z',
  distanceKm: 12.4,
  durationSeconds: 7200,
  elevationGainM: 850,
  maxAltitudeM: 2100,
  visibility: 'collective_anonymized',
  coverUrl: null,
};

describe('G01 sport stats — sélection par sport', () => {
  it('donne distance, dénivelé, durée et altitude en randonnée', () => {
    const stats = selectSportStats(session);
    expect(stats.map((stat) => stat.key)).toEqual(['distance', 'elevation', 'duration', 'altitude']);
    expect(stats[0].formatted).toMatch(/12,4/);
    expect(stats[0].unit).toBe('km');
    expect(stats[1].unit).toBe('m D+');
    expect(stats[2].formatted).toBe('2 h');
  });

  it('ajoute l’allure en trail', () => {
    const stats = selectSportStats({ ...session, sport: 'trail' });
    expect(stats.map((stat) => stat.key)).toContain('pace');
    const pace = stats.find((stat) => stat.key === 'pace');
    expect(pace?.unit).toBe('min/km');
    expect(pace?.formatted).toMatch(/^\d+:\d{2}$/);
  });

  it('ajoute la vitesse à vélo', () => {
    const stats = selectSportStats({ ...session, sport: 'velo' });
    const speed = stats.find((stat) => stat.key === 'speed');
    expect(speed?.unit).toBe('km/h');
    expect(speed?.value).toBeCloseTo(6.2, 1);
  });

  it('n’affiche pas de distance en escalade', () => {
    const stats = selectSportStats({ ...session, sport: 'escalade', maxAltitudeM: null });
    expect(stats.map((stat) => stat.key)).toEqual(['duration', 'elevation']);
  });

  it('retourne une liste vide sans donnée exploitable', () => {
    expect(
      selectSportStats({
        ...session,
        distanceKm: null,
        durationSeconds: null,
        elevationGainM: null,
        maxAltitudeM: null,
      })
    ).toEqual([]);
  });

  it('ignore les valeurs non finies et les sports inconnus', () => {
    const stats = selectSportStats({
      ...session,
      sport: 'sport-inconnu' as SportKey,
      distanceKm: Number.NaN,
      elevationGainM: -2,
    });
    expect(stats).toEqual([]);
  });

  it('borne le nombre de chiffres demandé', () => {
    expect(selectSportStats(session, { maxStats: 1 })).toHaveLength(1);
  });
});

describe('G01 sport stats — records', () => {
  const records = [
    {
      id: 'r1',
      sport: 'rando',
      sessionId: SESSION,
      stat: 'distance' as const,
      value: 12.4,
      visibility: 'collective_anonymized',
    },
    {
      id: 'r2',
      sport: 'rando',
      sessionId: SESSION,
      stat: 'elevation' as const,
      value: 850,
      visibility: 'private',
    },
    {
      id: 'r3',
      sport: 'velo',
      sessionId: SESSION,
      stat: 'speed' as const,
      value: 28,
      visibility: 'collective_anonymized',
    },
    {
      id: 'r4',
      sport: 'rando',
      sessionId: OTHER_SESSION,
      stat: 'distance' as const,
      value: 30,
      visibility: 'collective_anonymized',
    },
  ];

  it('ne garde que les records de la séance, du sport et non privés', () => {
    const chips = selectSportRecords(session, records);
    expect(chips).toHaveLength(1);
    expect(chips[0].id).toBe('r1');
    expect(chips[0].formatted).toMatch(/12,4 km/);
  });

  it('ne divulgue jamais un record privé', () => {
    const chips = selectSportRecords(session, records);
    expect(chips.some((chip) => chip.id === 'r2')).toBe(false);
  });

  it('calcule des records personnels par sport sans doublon', () => {
    const computed = computePersonalRecords(
      [
        session,
        { ...session, id: OTHER_SESSION, distanceKm: 30, elevationGainM: 400 },
      ],
      'rando'
    );
    const distance = computed.find((record) => record.stat === 'distance');
    expect(distance?.sessionId).toBe(OTHER_SESSION);
    expect(distance?.value).toBe(30);
    expect(computed.filter((record) => record.stat === 'distance')).toHaveLength(1);
  });
});

describe('G01 sport stats — projection partageable', () => {
  it('ne recopie que la liste blanche et aucune trace', () => {
    const redacted = redactSessionForShare({
      id: SESSION,
      owner_id: OWNER,
      sport: 'rando',
      title: 'Tour du lac',
      distance_km: 12.4,
      positions_timed: [{ lat: 45.1, lng: 6.2 }],
      positions_geojson: { type: 'LineString', coordinates: [[6.2, 45.1]] },
      trace: 'abc',
      lat: 45.1,
      lng: 6.2,
      notes: 'secret',
    });
    expect(redacted).not.toBeNull();
    expect(redacted?.distanceKm).toBe(12.4);
    expect(JSON.stringify(redacted)).not.toMatch(/positions|geojson|trace|lat|lng|notes/);
  });

  it('refuse un identifiant ou un sport invalide', () => {
    expect(redactSessionForShare({ id: 'abc', owner_id: OWNER, sport: 'rando' })).toBeNull();
    expect(redactSessionForShare({ id: SESSION, owner_id: OWNER, sport: 'inconnu' })).toBeNull();
  });
});
