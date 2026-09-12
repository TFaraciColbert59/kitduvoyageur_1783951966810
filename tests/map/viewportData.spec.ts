import { describe, it, expect } from 'vitest';
import {
  buildPoisRequest,
  buildTrailsRequest,
  roundViewportKey,
  VIEWPORT_POI_LIMITS,
} from '@/components/map/hooks/viewportData';

const LOCAL_VIEWPORT = { minLat: 50.7, maxLat: 50.9, minLng: 2.4, maxLng: 2.9, zoom: 14 };

describe('ATLAS — requêtes viewport (Phase 3)', () => {
  it('ne construit aucune requête pour le palier monde (zoom ≤ 3)', () => {
    const world = { minLat: -85, maxLat: 85, minLng: -180, maxLng: 180, zoom: 2 };
    expect(buildTrailsRequest(world)).toBeNull();
    expect(buildPoisRequest(world)).toBeNull();
  });

  it('construit la requête sentiers avec bbox, zoom et limite LOD locale', () => {
    const request = buildTrailsRequest(LOCAL_VIEWPORT);
    expect(request).not.toBeNull();
    expect(request?.limit).toBe(300);
    const url = new URL(request!.url, 'http://localhost');
    expect(url.pathname).toBe('/api/hikes');
    expect(url.searchParams.get('min_lat')).toBe('50.7');
    expect(url.searchParams.get('max_lat')).toBe('50.9');
    expect(url.searchParams.get('min_lng')).toBe('2.4');
    expect(url.searchParams.get('max_lng')).toBe('2.9');
    expect(url.searchParams.get('zoom')).toBe('14');
    expect(url.searchParams.get('limit')).toBe('300');
  });

  it('applique les limites LOD par palier (région 150 / continent 60)', () => {
    expect(buildTrailsRequest({ ...LOCAL_VIEWPORT, zoom: 10 })?.limit).toBe(150);
    expect(buildTrailsRequest({ ...LOCAL_VIEWPORT, zoom: 5 })?.limit).toBe(60);
  });

  it('construit la requête POI avec le LOD POI existant (150/80/40)', () => {
    expect(buildPoisRequest(LOCAL_VIEWPORT)?.limit).toBe(VIEWPORT_POI_LIMITS.local);
    expect(VIEWPORT_POI_LIMITS.local).toBe(150);
    expect(VIEWPORT_POI_LIMITS.region).toBe(80);
    expect(VIEWPORT_POI_LIMITS.continent).toBe(40);

    const url = new URL(buildPoisRequest({ ...LOCAL_VIEWPORT, zoom: 9 })!.url, 'http://localhost');
    expect(url.pathname).toBe('/api/pois');
    expect(url.searchParams.get('zoom')).toBe('9');
    expect(url.searchParams.get('limit')).toBe('80');
  });

  it('stabilise la clé de viewport (arrondi 3 décimales, zoom entier)', () => {
    const key = roundViewportKey({ minLat: 50.70001, maxLat: 50.89999, minLng: 2.40004, maxLng: 2.89996, zoom: 13.7 });
    expect(key).toBe('50.700,50.900,2.400,2.900,14');
  });
});
