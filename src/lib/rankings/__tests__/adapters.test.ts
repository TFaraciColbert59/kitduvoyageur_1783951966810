import { describe, expect, it } from 'vitest';
import {
  buildLegendTargets,
  coerceVisibility,
  mapHikeSessionRow,
  mapProgressionChallengeRow,
  mapProfileRow,
  mapSummitRow,
  parseGpsTrack,
} from '../adapters';

describe('adaptateurs G03 — fail-closed', () => {
  it('transforme toute visibilité inconnue en private', () => {
    expect(coerceVisibility('public')).toBe('public');
    expect(coerceVisibility('followers')).toBe('followers');
    expect(coerceVisibility('collective_anonymized')).toBe('private');
    expect(coerceVisibility(null)).toBe('private');
    expect(coerceVisibility('n_importe_quoi')).toBe('private');
  });

  it('mappe une session réelle sans inventer les métriques absentes', () => {
    const activity = mapHikeSessionRow({
      id: 's1',
      user_id: 'u1',
      route_id: 12,
      started_at: '2026-11-10T08:00:00.000Z',
      distance_km: '12.5',
      duration_seconds: 7200,
      elevation_gain_m: null,
      positions_geojson: null,
      visibility: 'public',
      processing_status: 'processed',
      track_quality: null,
    });

    expect(activity).not.toBeNull();
    expect(activity?.distanceMeters).toBe(12500);
    expect(activity?.durationSec).toBe(7200);
    expect(activity?.elevationGainMeters).toBeNull();
    expect(activity?.routeIds).toEqual(['12']);
    expect(activity?.isValid).toBe(true);
  });

  it('exclut une session failed et marque un signalement', () => {
    const failed = mapHikeSessionRow({
      id: 's2',
      user_id: 'u1',
      route_id: null,
      started_at: '2026-11-10T08:00:00.000Z',
      distance_km: 10,
      duration_seconds: 3600,
      elevation_gain_m: 100,
      positions_geojson: null,
      visibility: 'public',
      processing_status: 'failed',
      track_quality: null,
    });
    expect(failed?.isValid).toBe(false);

    const flagged = mapHikeSessionRow({
      id: 's3',
      user_id: 'u1',
      route_id: null,
      started_at: '2026-11-10T08:00:00.000Z',
      distance_km: 10,
      duration_seconds: 3600,
      elevation_gain_m: 100,
      positions_geojson: null,
      visibility: 'public',
      processing_status: 'processed',
      track_quality: { flagged: true },
    });
    expect(flagged?.isFlagged).toBe(true);
  });

  it('lit une trace GeoJSON sans exposer de coordonnée inventée', () => {
    const track = parseGpsTrack({
      type: 'LineString',
      coordinates: [
        [6.1, 45.1, 1200],
        ['bad', 45.2],
        [6.3, 45.3],
      ],
    });
    expect(track).toEqual([
      { lat: 45.1, lng: 6.1, elevationMeters: 1200, timestamp: undefined },
      { lat: 45.3, lng: 6.3, elevationMeters: null, timestamp: undefined },
    ]);
    expect(parseGpsTrack('{invalide')).toBeNull();
    expect(parseGpsTrack([])).toBeNull();
  });

  it('traite un profil privé comme un refus de paraître', () => {
    const profile = mapProfileRow({
      id: 'u1',
      full_name: 'Alice',
      handle: 'alice',
      avatar_url: null,
      profile_visibility: 'private',
      is_demo: false,
    });
    expect(profile).toMatchObject({
      displayName: 'Alice',
      rankingsOptOut: true,
      localLegendsOptOut: true,
      peerComparisonOptOut: true,
    });
  });

  it('exclut un compte de démonstration des classements réels', () => {
    const profile = mapProfileRow({
      id: 'demo-1',
      full_name: 'Démo',
      handle: 'demo',
      avatar_url: null,
      profile_visibility: 'public',
      is_demo: true,
    });
    expect(profile?.rankingsOptOut).toBe(true);
    expect(profile?.localLegendsOptOut).toBe(true);
  });

  it('mappe un sommet réel et rejette les coordonnées invalides', () => {
    const peak = mapSummitRow({
      id: 'p1',
      name: 'Mont Blanc',
      altitude_m: 4808,
      lat: 45.8326,
      lng: 6.8652,
      region: 'Alpes',
      massif: 'Mont-Blanc',
    });
    expect(peak).toMatchObject({
      id: 'p1',
      name: 'Mont Blanc',
      elevationMeters: 4808,
      region: 'Alpes',
      validationRadiusMeters: 50,
    });
    expect(
      mapSummitRow({
        id: 'p2',
        name: 'Invalide',
        altitude_m: 100,
        lat: 'x',
        lng: 2,
        region: null,
        massif: null,
      })
    ).toBeNull();
  });

  it('ne suit que les défis dont l’unité est mesurable', () => {
    const season = {
      starts_at: '2026-11-01T00:00:00.000Z',
      ends_at: '2026-12-31T23:59:59.999Z',
    };
    const trackable = mapProgressionChallengeRow(
      {
        id: 'chal-1',
        title: '20 km',
        description: 'Courir 20 km',
        points_reward: 50,
        target_progress: 20,
        unit: 'km',
      },
      season
    );
    expect(trackable?.trackable).toBe(true);
    expect(trackable?.rule.criterion).toBe('distance_meters');
    expect(trackable?.rule.targetValue).toBe(20_000);
    expect(trackable?.rule.unit).toBe('m');

    const untrackable = mapProgressionChallengeRow(
      {
        id: 'chal-2',
        title: 'Kit léger',
        description: 'Peser son kit',
        points_reward: 80,
        target_progress: 1,
        unit: 'kit',
      },
      season
    );
    expect(untrackable?.trackable).toBe(false);
  });

  it('nomme les cibles Local Legends sans coordonnées', () => {
    const targets = buildLegendTargets(
      [
        {
          id: 'a1',
          userId: 'u1',
          sport: 'hiking',
          startedAt: '2026-11-10T08:00:00.000Z',
          durationSec: 3600,
          distanceMeters: 10000,
          elevationGainMeters: 100,
          visibility: 'public',
          isValid: true,
          isFlagged: false,
          routeIds: ['12'],
          segmentIds: ['99'],
        },
      ],
      [{ id: 12, name: 'GR 20', ref: 'GR20' }],
      [{ id: 99, name: 'Crête sud' }],
      '2026-08-01T00:00:00.000Z'
    );

    expect(targets).toEqual([
      expect.objectContaining({ targetType: 'route', targetId: '12', name: 'GR 20', effortCount: 1 }),
      expect.objectContaining({ targetType: 'segment', targetId: '99', name: 'Crête sud', effortCount: 1 }),
    ]);
    expect(JSON.stringify(targets)).not.toContain('lat');
    expect(JSON.stringify(targets)).not.toContain('lng');
  });
});
