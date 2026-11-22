import { describe, expect, it } from 'vitest';
import { describePoiProvenance, isCyclingSport, layerAvailability, layersForSport, poisForLayer } from '../mapLayers';
import type { RouteCorridorPoi } from '../routeAnalysis';

function poi(over: Partial<RouteCorridorPoi>): RouteCorridorPoi {
  return { id: 'p', name: 'X', category: 'other', rawCategory: 'poi', lat: 45, lon: 6, altitudeM: null, distanceToTrackM: 40, details: null, source: 'OpenStreetMap', ...over };
}

describe('mapLayers · calques selon le sport (2.7)', () => {
  it('rando : eau et abris ; vélo : ateliers et eau', () => {
    expect(layersForSport('marche').map((l) => l.id)).toEqual(['water', 'shelter']);
    for (const s of ['route', 'gravel', 'vtt', 'enduro'] as const) {
      expect(isCyclingSport(s)).toBe(true);
      expect(layersForSport(s).map((l) => l.id)).toEqual(['bike_workshop', 'water']);
    }
  });

  it('filtre les points réels par calque', () => {
    const pois = [
      poi({ id: '1', category: 'water' }),
      poi({ id: '2', category: 'shelter' }),
      poi({ id: '3', category: 'access', rawCategory: 'bike_repair', source: 'Services Vélo' }),
      poi({ id: '4', category: 'access', rawCategory: 'bike_shop' }),
    ];
    const [bike, water] = layersForSport('vtt');
    expect(poisForLayer(pois, bike).map((p) => p.id)).toEqual(['3', '4']);
    expect(poisForLayer(pois, water).map((p) => p.id)).toEqual(['1']);
  });

  it('dit calque indisponible, vide ou prêt, sans combler', () => {
    expect(layerAvailability({ loading: true, loadedAt: null, sources: [], count: 0 })).toBe('loading');
    expect(layerAvailability({ loading: false, loadedAt: null, sources: [], count: 0 })).toBe('unavailable');
    expect(layerAvailability({ loading: false, loadedAt: 'x', sources: [], count: 0 })).toBe('unavailable');
    expect(layerAvailability({ loading: false, loadedAt: 'x', sources: ['OSM'], count: 0 })).toBe('empty');
    expect(layerAvailability({ loading: false, loadedAt: 'x', sources: ['OSM'], count: 3 })).toBe('ready');
  });

  it('chaque point dit sa source et la date du relevé, ou dit qu’elle est inconnue', () => {
    expect(describePoiProvenance({ source: 'OpenStreetMap' }, '2026-11-22T10:00:00.000Z').text).toMatch(/OpenStreetMap · relevé le 22 novembre 2026/);
    expect(describePoiProvenance({ source: '' }, null).text).toBe('Source : inconnue · date de relevé inconnue');
  });
});
