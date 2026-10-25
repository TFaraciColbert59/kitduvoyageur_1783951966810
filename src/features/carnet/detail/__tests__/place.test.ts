import { describe, expect, it } from 'vitest';
import { buildCarnetPlace, countryNameFromIso, placeSegments } from '../place';
import type { CarnetRow } from '../types';

function carnet(overrides: Partial<CarnetRow> = {}): CarnetRow {
  return {
    id: 'c1',
    author_id: null,
    title: 'Carnet',
    destination: null,
    description: null,
    cover_image: null,
    cover_image_alt: null,
    start_date: null,
    end_date: null,
    visibility: 'public',
    verified: null,
    likes_count: null,
    comments_count: null,
    views_count: null,
    distance_km: null,
    denivele_m: null,
    groupe_id: null,
    lieu_depart: null,
    lieu_arrivee: null,
    country_iso: null,
    ...overrides,
  };
}

const TRACE = {
  type: 'LineString',
  coordinates: [
    [6.894707, 45.935757],
    [6.894604, 45.93606],
  ],
};

describe('place — lieu réel de la fiche', () => {
  it('rend un pays depuis le code ISO réel de la colonne', () => {
    const place = buildCarnetPlace(carnet({ country_iso: 'IS', destination: 'Islande' }), null);
    expect(place.country).toBe('Islande');
    expect(place.region).toBeNull();
    expect(place.locality).toBeNull();
    expect(place.lat).toBeNull();
    expect(place.lng).toBeNull();
  });

  it('traduit le code ISO en français sans table locale', () => {
    expect(countryNameFromIso('FR')).toBe('France');
    expect(countryNameFromIso('is')).toBe('Islande');
    expect(countryNameFromIso('ZZ')).toBeNull();
    expect(countryNameFromIso('')).toBeNull();
    expect(countryNameFromIso(null)).toBeNull();
    expect(countryNameFromIso('France')).toBeNull();
  });

  it('retombe sur destination quand country_iso est absent, jamais sur une valeur inventée', () => {
    const place = buildCarnetPlace(carnet({ destination: 'France / Italie / Suisse' }), null);
    expect(place.country).toBe('France / Italie / Suisse');
    expect(place.locality).toBeNull();
  });

  it('prend le lieu de départ, à défaut le lieu d’arrivée, comme locality', () => {
    expect(buildCarnetPlace(carnet({ lieu_depart: ' Landmannalaugar ' }), null).locality).toBe('Landmannalaugar');
    expect(buildCarnetPlace(carnet({ lieu_arrivee: 'Þórsmörk' }), null).locality).toBe('Þórsmörk');
    expect(buildCarnetPlace(carnet({ lieu_depart: '   ' }), null).locality).toBeNull();
  });

  it('lit les coordonnées du premier point réel de la trace, dans l’ordre [lng, lat]', () => {
    const place = buildCarnetPlace(carnet(), TRACE);
    expect(place.lat).toBeCloseTo(45.935757, 6);
    expect(place.lng).toBeCloseTo(6.894707, 6);
  });

  it('ne fabrique aucune coordonnée sans trace', () => {
    const place = buildCarnetPlace(carnet({ destination: 'Islande' }), null);
    expect(place.lat).toBeNull();
    expect(place.lng).toBeNull();
  });

  it('accepte une géométrie GeoJSON enveloppée dans une Feature', () => {
    const feature = { type: 'Feature', geometry: { type: 'LineString', coordinates: [[2.35, 48.85]] } };
    const place = buildCarnetPlace(carnet(), feature);
    expect(place.lat).toBeCloseTo(48.85, 6);
    expect(place.lng).toBeCloseTo(2.35, 6);
  });
});

describe('placeSegments — pays · région · lieu', () => {
  it('ordonne les trois segments et ignore les vides', () => {
    const segments = placeSegments({
      country: 'Islande',
      region: null,
      locality: 'Landmannalaugar',
      lat: null,
      lng: null,
    });
    expect(segments.map((segment) => segment.label)).toEqual(['Islande', 'Landmannalaugar']);
    expect(segments.map((segment) => segment.key)).toEqual(['country', 'locality']);
  });

  it('ne dépasse jamais trois segments et déduplique les libellés', () => {
    const segments = placeSegments({
      country: 'France',
      region: 'France',
      locality: 'Auvergne',
      lat: null,
      lng: null,
    });
    expect(segments).toHaveLength(2);
    expect(segments.map((segment) => segment.label)).toEqual(['France', 'Auvergne']);
  });

  it('garde la destination en repli pour ne pas perdre la ligne de lieu', () => {
    const segments = placeSegments(
      { country: null, region: null, locality: null, lat: null, lng: null },
      'Tour du Mont-Blanc',
    );
    expect(segments).toEqual([{ key: 'locality', label: 'Tour du Mont-Blanc' }]);
    expect(placeSegments(null, null)).toEqual([]);
    expect(placeSegments(null, '   ')).toEqual([]);
  });
});
