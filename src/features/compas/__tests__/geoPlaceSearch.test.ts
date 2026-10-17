import { describe, expect, it } from 'vitest';
import {
  isCountryName,
  pickReferentialPlace,
  placeSearchKey,
  referentialPlaceToCompas,
  type GeoPlaceSearchRow,
} from '../engine/geoPlaceSearch';

/** Choix d'un lieu saisi dans le référentiel `geo_places` (plan 3.1 et 1.3) : sûr, sinon rien. */
const row = (
  id: number,
  name: string,
  population: number,
  extra: Partial<GeoPlaceSearchRow> = {}
): GeoPlaceSearchRow => ({
  geoname_id: id,
  name,
  kind:
    population >= 100_000
      ? 'city'
      : population >= 10_000
        ? 'town'
        : population >= 200
          ? 'village'
          : 'hamlet',
  country_code: 'FR',
  lat: 45,
  lon: 5.5,
  ele_m: null,
  population,
  ...extra,
});

describe('placeSearchKey', () => {
  it('sans accents, casse, ponctuation ni ligature', () => {
    expect(placeSearchKey('  Villard-de-Lans ')).toBe('villard de lans');
    expect(placeSearchKey("L'Alpe d’Huez")).toBe('l alpe d huez');
    expect(placeSearchKey('Œuilly')).toBe('oeuilly');
    expect(placeSearchKey('Москва')).toBe('');
  });
});

describe('isCountryName', () => {
  it('un pays, en français ou en anglais : jamais lu comme sa capitale homonyme', () => {
    expect(isCountryName('Panama')).toBe(true);
    expect(isCountryName('luxembourg')).toBe(true);
    expect(isCountryName('Singapour')).toBe(true);
    expect(isCountryName('Singapore')).toBe(true);
    expect(isCountryName('Grenoble')).toBe(false);
  });
});

describe('pickReferentialPlace', () => {
  it('nom composé exact et unique : le village', () => {
    const v = row(3027453, 'Villard-de-Lans', 4096);
    expect(pickReferentialPlace([v], 'villard de lans')).toEqual(v);
  });
  it('grande ville au nom exact, homonymes bien plus petits : la grande ville', () => {
    const rome = row(3169070, 'Rome', 2_318_895, { country_code: 'IT' });
    const georgia = row(4219762, 'Rome', 36_303, { country_code: 'US' });
    expect(pickReferentialPlace([rome, georgia], 'Rome')).toEqual(rome);
  });
  it('homonymes de taille voisine : ambigu, rien', () => {
    const a = row(1, 'Florence', 349_296, { country_code: 'IT' });
    const b = row(2, 'Florence', 40_000, { country_code: 'US' });
    expect(pickReferentialPlace([a, b], 'Florence')).toBeNull();
    expect(
      pickReferentialPlace([row(3, 'Les Mées', 0), row(4, 'Les Mées', 0)], 'Les Mées')
    ).toBeNull();
  });
  it('un seul mot et moins de 100 000 habitants : rien (« Bretagne », « Bali », « Vienne »)', () => {
    expect(pickReferentialPlace([row(5, 'Bretagne', 205)], 'Bretagne')).toBeNull();
    expect(
      pickReferentialPlace([row(6, 'Bali', 17_000, { country_code: 'IN' })], 'Bali')
    ).toBeNull();
    expect(pickReferentialPlace([row(7, 'Vienne', 29_000)], 'Vienne')).toBeNull();
  });
  it('nom composé mais lieu-dit presque vide : rien', () => {
    expect(pickReferentialPlace([row(8, 'Mont-Blanc', 0)], 'Mont Blanc')).toBeNull();
  });
  it('un pays : rien, même si une ville porte son nom', () => {
    expect(
      pickReferentialPlace([row(9, 'Panamá', 408_168, { country_code: 'PA' })], 'Panama')
    ).toBeNull();
  });
  it('préfixe : seulement pour un nom composé, une ville d’au moins 10 000 habitants qui domine', () => {
    const bourg = row(10, 'Bourg-en-Bresse', 41_000);
    expect(pickReferentialPlace([bourg], 'Bourg en')).toEqual(bourg);
    // Un seul mot : jamais par préfixe (« Chamonix » reste à la carte, comme avant).
    expect(pickReferentialPlace([row(11, 'Chamonix-Mont-Blanc', 8_900)], 'Chamonix')).toBeNull();
    // Village par préfixe : rien (« Grand Canyon » → « Grand Canyon Village »).
    expect(
      pickReferentialPlace(
        [row(12, 'Grand Canyon Village', 2_004, { country_code: 'US' })],
        'Grand Canyon'
      )
    ).toBeNull();
  });
  it('un nom exact trouvé mais refusé : pas de repli sur un préfixe', () => {
    const rows = [
      row(13, 'Saint Martin', 0),
      row(14, 'Saint Martin', 0),
      row(15, 'Saint Martin du Var', 30_000),
    ];
    expect(pickReferentialPlace(rows, 'Saint Martin')).toBeNull();
  });
  it('requête trop courte, lignes inexploitables ou vides : rien', () => {
    expect(pickReferentialPlace([row(16, 'Ay', 4_000)], 'Ay')).toBeNull();
    expect(pickReferentialPlace([], 'Villard de Lans')).toBeNull();
    expect(
      pickReferentialPlace(
        [row(17, 'Villard-de-Lans', 4096, { lat: Number.NaN })],
        'Villard de Lans'
      )
    ).toBeNull();
    expect(
      pickReferentialPlace([row(18, 'Villard-de-Lans', 4096, { kind: 'peak' })], 'Villard de Lans')
    ).toBeNull();
  });
});

describe('referentialPlaceToCompas', () => {
  it('même forme qu’un lieu habité de la carte, sans emprise ni étiquette OSM inventées', () => {
    const p = referentialPlaceToCompas(
      row(3027453, 'Villard-de-Lans', 4096, { lat: 45.07, lon: 5.55 })
    );
    expect(p).toEqual({
      name: 'Villard-de-Lans',
      lat: 45.07,
      lon: 5.55,
      countryCode: 'FR',
      country: 'France',
      kind: 'village',
      settlement: true,
      settlementRank: 3,
      extent: null,
    });
    expect(
      referentialPlaceToCompas(row(1, 'Rome', 2_318_895, { country_code: 'IT' })).settlementRank
    ).toBe(5);
  });
});
