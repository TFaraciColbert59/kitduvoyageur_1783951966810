import { describe, expect, it } from 'vitest';
import { buildCompteMapPayload } from '../server/loadCompteMap';

describe('buildCompteMapPayload', () => {
  const rows = {
    sessions: [
      {
        id: 's1',
        title: 'Lac Blanc',
        route_id: 7,
        started_at: '2026-09-19T06:00:00Z',
        distance_km: 12.4,
        elevation_gain_m: 860,
        max_altitude_m: 2352,
        positions_geojson: {
          type: 'LineString',
          coordinates: [
            [6.87, 45.92],
            [6.88, 45.93],
            [6.89, 45.94],
          ],
        },
        visibility: 'private',
        kit_id: 'k1',
        carnet_id: 'c1',
        poi_events: [{ label: 'Lac Blanc', lat: 45.94, lng: 6.89 }],
      },
    ],
    statsSessions: [
      {
        id: 's1',
        route_id: 7,
        started_at: '2026-09-19T06:00:00Z',
        distance_km: 12.4,
        elevation_gain_m: 860,
      },
    ],
    routes: [{ id: 7, name: 'Lac Blanc', region: 'Mont-Blanc' }],
    geoMassifs: [
      {
        geoname_id: 1,
        feature_code: 'MTS' as const,
        name: 'Massif du Mont-Blanc',
        name_plain: 'mont blanc',
        country_code: 'FR',
        lat: 45.85,
        lon: 6.86,
        elevation_m: 4808,
      },
    ],
    photoCounts: new Map([['s1', 3]]),
    participantCounts: new Map([['s1', 2]]),
    carnets: [{ id: 'c1', title: 'Lac Blanc', cover_image: null }],
    kitNames: new Map([['k1', 'Kit léger']]),
  };

  it('produit une trace, un massif, un carnet et un POI réels', () => {
    const payload = buildCompteMapPayload(rows);
    expect(payload.tracks).toHaveLength(1);
    expect(payload.tracks[0].title).toBe('Lac Blanc');
    expect(payload.tracks[0].kitName).toBe('Kit léger');
    expect(payload.tracks[0].photosCount).toBe(3);
    expect(payload.tracks[0].participantsCount).toBe(2);
    expect(payload.massifs[0]).toMatchObject({ name: 'Massif du Mont-Blanc', outings: 1 });
    expect(payload.carnets[0]).toMatchObject({ id: 'c1', outingId: 's1' });
    expect(payload.pois[0]).toMatchObject({ label: 'Lac Blanc', outingId: 's1' });
    expect(payload.bounds).not.toBeNull();
  });

  it('n’invente ni massif ni trace sans coordonnées', () => {
    const payload = buildCompteMapPayload({
      ...rows,
      sessions: [{ ...rows.sessions[0], positions_geojson: null, poi_events: [] }],
      routes: [{ id: 7, name: 'Lac Blanc', region: 'Massif inconnu' }],
      geoMassifs: [],
    });
    expect(payload.tracks).toHaveLength(0);
    expect(payload.massifs).toHaveLength(0);
    expect(payload.carnets).toHaveLength(0);
    expect(payload.pois).toHaveLength(0);
  });

  it('signale la troncature au-delà de 80 sorties', () => {
    const payload = buildCompteMapPayload({
      ...rows,
      statsSessions: Array.from({ length: 120 }, (_, index) => ({
        ...rows.statsSessions[0],
        id: `s${index}`,
      })),
    });
    expect(payload.truncated).toBe(true);
  });

  it('compte un massif sur toutes les sorties, même hors des 80 traces', () => {
    const payload = buildCompteMapPayload({
      ...rows,
      sessions: [],
      statsSessions: [
        ...rows.statsSessions,
        { ...rows.statsSessions[0], id: 's2' },
        { ...rows.statsSessions[0], id: 's3' },
      ],
    });
    expect(payload.tracks).toHaveLength(0);
    expect(payload.massifs[0].outings).toBe(3);
  });
});
