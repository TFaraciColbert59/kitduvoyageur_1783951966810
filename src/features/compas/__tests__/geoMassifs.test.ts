import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GEO_MASSIF_CODES,
  collectGeoMassifs,
  massifPlace,
  normalizeMassifName,
  parseGeonamesLine,
  pickMassif,
  type GeoMassifRow,
} from '../engine/geoMassifs';

/**
 * Fixture au FORMAT de GeoNames (19 colonnes séparées par des tabulations, comme allCountries.txt
 * ou FR.txt). Les identifiants (9000001…) et les coordonnées sont fabriqués pour le parseur : ce ne
 * sont pas des lignes réelles de GeoNames.
 */
const FIXTURE = readFileSync(join(__dirname, 'fixtures', 'geonames-massifs.txt'), 'utf8')
  .split('\n')
  .filter(Boolean);
const lineOf = (id: string) => FIXTURE.find((l) => l.startsWith(`${id}\t`)) as string;

const row = (over: Partial<GeoMassifRow>): GeoMassifRow => ({
  geoname_id: 1,
  feature_code: 'MTS',
  name: 'Vosges',
  name_plain: 'vosges',
  country_code: 'FR',
  lat: 48.08,
  lon: 7,
  elevation_m: null,
  ...over,
});

describe('normalizeMassifName', () => {
  it('garde la clé de normalizeAreaName (« Massif de la Chartreuse » → « chartreuse »)', () => {
    expect(normalizeMassifName('Massif de la Chartreuse')).toBe('chartreuse');
    expect(normalizeMassifName('Massif central')).toBe('massif central');
  });
  it('retire une désignation de relief suivie d’une liaison', () => {
    expect(normalizeMassifName('Monts du Cantal')).toBe('cantal');
    expect(normalizeMassifName('Plateau de Millevaches')).toBe('millevaches');
    expect(normalizeMassifName("Presqu'île de Crozon")).toBe('crozon');
    expect(normalizeMassifName('Sierra de Guadarrama')).toBe('guadarrama');
  });
  it('ne touche pas un nom propre sans liaison (« Sierra Nevada », « Montagne Noire »)', () => {
    expect(normalizeMassifName('Sierra Nevada')).toBe('sierra nevada');
    expect(normalizeMassifName('Montagne Noire')).toBe('montagne noire');
  });
  it('retire « Mountains » / « massif » en fin de nom', () => {
    expect(normalizeMassifName('Jura Mountains')).toBe('jura');
    expect(normalizeMassifName('Mont Blanc massif')).toBe('mont blanc');
  });
  it('un nom générique ou sans lettre latine n’a pas de clé', () => {
    expect(normalizeMassifName('Mountains')).toBeNull();
    expect(normalizeMassifName('Les Monts')).toBeNull();
    expect(normalizeMassifName('Кавказ')).toBeNull();
    expect(normalizeMassifName(42)).toBeNull();
  });
});

describe('parseGeonamesLine', () => {
  it('une chaîne (MTS) : nom, clé, code, pays, centre, altitude déclarée', () => {
    expect(parseGeonamesLine(lineOf('9000001'))).toEqual({
      row: {
        geoname_id: 9000001,
        feature_code: 'MTS',
        name: 'Vosges',
        name_plain: 'vosges',
        country_code: 'FR',
        lat: 48.08333,
        lon: 7,
        elevation_m: 1424,
      },
    });
  });
  it('sans altitude déclarée : null (le MNT du point n’est pas l’altitude d’une chaîne)', () => {
    const got = parseGeonamesLine(lineOf('9000002'));
    expect(got.row?.elevation_m).toBeNull();
    expect(got.row?.name_plain).toBe('jura');
  });
  it('MT (une montagne) écartée, sauf si son nom dit massif', () => {
    expect(parseGeonamesLine(lineOf('9000004'))).toEqual({ drop: 'hors_classe' });
    expect(parseGeonamesLine(lineOf('9000005')).row?.name_plain).toBe('mont blanc');
  });
  it('colline, lieu habité, parc : hors classe', () => {
    expect(parseGeonamesLine(lineOf('9000007')).drop).toBe('hors_classe');
    expect(parseGeonamesLine(lineOf('9000008')).drop).toBe('hors_classe');
    expect(parseGeonamesLine(lineOf('9000013')).drop).toBe('hors_classe');
  });
  it('nom sans lettre latine ou générique : sans_nom', () => {
    expect(parseGeonamesLine(lineOf('9000009')).drop).toBe('sans_nom');
    expect(parseGeonamesLine(lineOf('9000010')).drop).toBe('sans_nom');
  });
  it('ligne coupée ou coordonnées hors de la Terre : malforme', () => {
    expect(parseGeonamesLine(lineOf('9000015')).drop).toBe('malforme');
    expect(parseGeonamesLine(lineOf('9000016')).drop).toBe('malforme');
    expect(parseGeonamesLine('').drop).toBe('malforme');
  });
  it('région naturelle (RGN) et presqu’île (PEN) gardées', () => {
    expect(parseGeonamesLine(lineOf('9000006')).row?.feature_code).toBe('RGN');
    expect(parseGeonamesLine(lineOf('9000014')).row?.name).toBe("Presqu'île de Crozon");
  });
  it('les codes retenus sont sobres (ni îles, ni parcs, ni sommets, ni collines isolées)', () => {
    for (const c of ['ISL', 'PRK', 'RESN', 'PK', 'HLL', 'VAL'])
      expect(GEO_MASSIF_CODES).not.toContain(c);
  });
});

describe('collectGeoMassifs', () => {
  it('le fichier entier : lignes gardées, doublons et écartements comptés', () => {
    const got = collectGeoMassifs(FIXTURE);
    expect(got.lines).toBe(17);
    expect(got.rows.map((r) => r.geoname_id)).toEqual([
      9000001, 9000002, 9000003, 9000005, 9000006, 9000011, 9000012, 9000014,
    ]);
    expect(got.dropped).toEqual({ hors_classe: 4, doublon: 1, sans_nom: 2, malforme: 2 });
  });
});

describe('pickMassif', () => {
  const near = { lat: 48.2, lon: 6.4 }; // Épinal, préfecture des Vosges
  it('la chaîne de ce nom à moins de 150 km', () => {
    const vosges = row({});
    expect(pickMassif([vosges], 'Vosges', near)).toBe(vosges);
    expect(pickMassif([vosges], 'les Vosges', near)).toBe(vosges);
  });
  it('trop loin, autre nom, ou région (pas un relief) : null', () => {
    expect(pickMassif([row({ lat: 30, lon: 7 })], 'Vosges', near)).toBeNull();
    expect(pickMassif([row({})], 'Jura', near)).toBeNull();
    expect(pickMassif([row({ feature_code: 'RGN' })], 'Vosges', near)).toBeNull();
  });
  it('MTS avant un plateau homonyme, puis le plus proche, puis le plus petit identifiant', () => {
    const plat = row({ geoname_id: 2, feature_code: 'PLAT', lat: 48.2, lon: 6.4 });
    const mtsFar = row({ geoname_id: 3, lat: 48.9, lon: 7.2 });
    const mtsNear = row({ geoname_id: 4, lat: 48.3, lon: 6.5 });
    expect(pickMassif([plat, mtsFar, mtsNear], 'Vosges', near)).toBe(mtsNear);
    const twin = row({ geoname_id: 1, lat: 48.3, lon: 6.5 });
    expect(pickMassif([mtsNear, twin], 'Vosges', near)).toBe(twin);
  });
});

describe('massifPlace', () => {
  it('un point sans emprise (GeoNames n’en donne pas), lieu naturel, pays connu', () => {
    expect(massifPlace(row({}))).toEqual({
      name: 'Vosges',
      lat: 48.08,
      lon: 7,
      countryCode: 'FR',
      country: null,
      kind: 'mountain_range',
      landmark: true,
      extent: null,
    });
  });
});
