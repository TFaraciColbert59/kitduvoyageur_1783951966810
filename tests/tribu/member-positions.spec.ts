import { describe, it, expect } from 'vitest';
import {
  buildMemberPositionsGeoJSON,
  isValidLatLng,
} from '@/features/tribu/lib/memberPositions';

describe('buildMemberPositionsGeoJSON', () => {
  it('construit des features [lng, lat] avec nom et userId', () => {
    const result = buildMemberPositionsGeoJSON([
      { userId: 'u1', name: 'Zoé', lat: 45.1, lng: 6.1 },
    ]);
    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
    expect(result.features[0].geometry.coordinates).toEqual([6.1, 45.1]);
    expect(result.features[0].properties).toEqual({ userId: 'u1', name: 'Zoé' });
  });

  it('filtre les coordonnées invalides sans exception', () => {
    const result = buildMemberPositionsGeoJSON([
      { userId: 'ok', name: 'A', lat: 45, lng: 6 },
      { userId: 'bad-lat', name: 'B', lat: 999, lng: 6 },
      { userId: 'bad-nan', name: 'C', lat: Number.NaN, lng: 6 },
      { userId: 'bad-lng', name: 'D', lat: 45, lng: -200 },
    ]);
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.userId).toBe('ok');
  });

  it('gère null et undefined', () => {
    expect(buildMemberPositionsGeoJSON(null).features).toHaveLength(0);
    expect(buildMemberPositionsGeoJSON(undefined).features).toHaveLength(0);
  });

  it('isValidLatLng borne les valeurs', () => {
    expect(isValidLatLng(45, 6)).toBe(true);
    expect(isValidLatLng(-90, 180)).toBe(true);
    expect(isValidLatLng(90.1, 6)).toBe(false);
    expect(isValidLatLng(45, '6')).toBe(false);
  });
});
