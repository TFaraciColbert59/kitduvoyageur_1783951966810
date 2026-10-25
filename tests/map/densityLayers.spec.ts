import { describe, it, expect } from 'vitest';
import {
  buildCountryDensityFC,
  buildRegionDensityFC,
} from '@/components/map/layers/densityLayers';

describe('ATLAS — couches de densité (paliers continent/région)', () => {
  it('convertit les pays en FeatureCollection de points pondérés', () => {
    const fc = buildCountryDensityFC([
      { iso_a2: 'FR', name: 'France', trail_count: 962, centroid_lat: 46.6, centroid_lng: 2.2 },
      { iso_a2: 'BE', name: 'Belgique', trail_count: 172, centroid_lat: 50.6, centroid_lng: 4.6 },
    ]);
    expect(fc.features).toHaveLength(2);
    const fr = fc.features[0];
    expect(fr.geometry.coordinates).toEqual([2.2, 46.6]);
    expect(fr.properties).toMatchObject({ iso: 'FR', name: 'France', count: 962 });
  });

  it('écarte les lignes invalides (coordonnées nulles/NaN, count ≤ 0)', () => {
    const fc = buildCountryDensityFC([
      { iso_a2: 'XX', name: 'Invalide', trail_count: 10, centroid_lat: Number.NaN, centroid_lng: 2 },
      { iso_a2: 'YY', name: 'Zéro', trail_count: 0, centroid_lat: 1, centroid_lng: 1 },
      { iso_a2: 'FR', name: 'France', trail_count: 5, centroid_lat: 46, centroid_lng: 2 },
    ]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties?.iso).toBe('FR');
  });

  it('convertit les cellules geohash en points pondérés', () => {
    const fc = buildRegionDensityFC([
      { geohash: 'u11bu', trail_count: 65, center_lat: 50.784, center_lng: 2.666 },
      { geohash: 'bad', trail_count: Number.NaN, center_lat: 1, center_lng: 1 },
    ]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry.coordinates).toEqual([2.666, 50.784]);
    expect(fc.features[0].properties).toMatchObject({ geohash: 'u11bu', count: 65 });
  });

  it('retourne des collections vides sans inventer de données', () => {
    expect(buildCountryDensityFC([]).features).toHaveLength(0);
    expect(buildRegionDensityFC([]).features).toHaveLength(0);
  });
});
