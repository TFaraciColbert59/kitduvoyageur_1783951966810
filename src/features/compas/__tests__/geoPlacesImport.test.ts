import { describe, expect, it } from 'vitest';
import {
  createGeoPlaceCollector,
  geoPlaceKind,
  parseGeoPlaceDumpLine,
  parseGeoPlaceTsvLine,
} from '../engine/geoPlacesImport';

/** Une ligne de dump GeoNames (19 colonnes), champs remplaçables. */
function dump(over: Partial<Record<number, string>> = {}): string {
  const c = [
    '2967421', // 0 geonameid
    'Villard-de-Lans', // 1 name
    'Villard-de-Lans', // 2 asciiname
    'Vilar de Lans', // 3 alternatenames
    '45.071310', // 4 lat
    '5.553920', // 5 lon
    'P', // 6 class
    'PPL', // 7 code
    'FR', // 8 cc
    '', // 9 cc2
    '84', // 10 admin1
    '38', // 11 admin2
    '', // 12
    '', // 13
    '4096', // 14 population
    '1050', // 15 elevation
    '1043', // 16 dem
    'Europe/Paris', // 17 timezone
    '2024-01-01', // 18 modif
  ];
  for (const [k, v] of Object.entries(over)) c[Number(k)] = v as string;
  return c.join('\t');
}

describe('geoPlaceKind (règle du lot E)', () => {
  it('capitale ou 100 000 : city ; 10 000 : town ; 200 ou chef-lieu : village ; sinon hamlet', () => {
    expect(geoPlaceKind('PPLC', 10)).toBe('city');
    expect(geoPlaceKind('PPL', 100_000)).toBe('city');
    expect(geoPlaceKind('PPL', 10_000)).toBe('town');
    expect(geoPlaceKind('PPL', 200)).toBe('village');
    expect(geoPlaceKind('PPLA3', 0)).toBe('village');
    expect(geoPlaceKind('PPLG', 0)).toBe('village');
    expect(geoPlaceKind('PPL', 199)).toBe('hamlet');
  });
});

describe('parseGeoPlaceDumpLine', () => {
  it('lit un lieu habité comme prep_geo_places.py', () => {
    expect(parseGeoPlaceDumpLine(dump())).toEqual({
      row: {
        geoname_id: 2967421,
        name: 'Villard-de-Lans',
        kind: 'village',
        country_code: 'FR',
        admin1: '84',
        lat: 45.07131,
        lon: 5.55392,
        ele_m: 1050,
        population: 4096,
        timezone: 'Europe/Paris',
      },
    });
  });
  it('altitude : déclarée, sinon le modèle de terrain sauf -9999, bornée', () => {
    expect(parseGeoPlaceDumpLine(dump({ 15: '' })).row?.ele_m).toBe(1043);
    expect(parseGeoPlaceDumpLine(dump({ 15: '', 16: '-9999' })).row?.ele_m).toBeNull();
    expect(parseGeoPlaceDumpLine(dump({ 15: '9500' })).row?.ele_m).toBeNull();
    expect(parseGeoPlaceDumpLine(dump({ 15: '12.9' })).row?.ele_m).toBe(12);
  });
  it('écarte hors classe P, codes exclus, ligne courte, nom vide, pays absent, nombres illisibles', () => {
    expect(parseGeoPlaceDumpLine(dump({ 6: 'T' })).drop).toBe('hors_classe');
    for (const code of ['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH', 'PPLCD'])
      expect(parseGeoPlaceDumpLine(dump({ 7: code })).drop).toBe('hors_classe');
    expect(parseGeoPlaceDumpLine('1\tx').drop).toBe('malforme');
    expect(parseGeoPlaceDumpLine(dump({ 4: '' })).drop).toBe('malforme');
    expect(parseGeoPlaceDumpLine(dump({ 5: '200' })).drop).toBe('malforme');
    expect(parseGeoPlaceDumpLine(dump({ 14: '1.5' })).drop).toBe('malforme');
    expect(parseGeoPlaceDumpLine(dump({ 1: '  ' })).drop).toBe('sans_nom');
    expect(parseGeoPlaceDumpLine(dump({ 8: '' })).drop).toBe('sans_pays');
  });
  it('population vide : 0 ; champs tronqués comme avant (admin1 20, fuseau 40)', () => {
    const r = parseGeoPlaceDumpLine(dump({ 14: '', 10: 'x'.repeat(30), 17: 'y'.repeat(50) })).row;
    expect(r?.population).toBe(0);
    expect(r?.kind).toBe('hamlet');
    expect(r?.admin1).toHaveLength(20);
    expect(r?.timezone).toHaveLength(40);
  });
});

describe('parseGeoPlaceTsvLine (ancien chemin : TSV préparé)', () => {
  it('relit une ligne du TSV', () => {
    const line = ['2967421', 'Villard-de-Lans', 'village', 'FR', '84', '45.07131', '5.55392', '1050', '4096', 'Europe/Paris'].join('\t');
    expect(parseGeoPlaceTsvLine(line).row).toMatchObject({ geoname_id: 2967421, kind: 'village', ele_m: 1050 });
    expect(parseGeoPlaceTsvLine(line.replace('village', 'refuge')).drop).toBe('hors_classe');
    expect(parseGeoPlaceTsvLine('x').drop).toBe('malforme');
  });
});

describe('createGeoPlaceCollector', () => {
  it('le dernier dump lu l’emporte pour un même identifiant (comme le dict Python)', () => {
    const c = createGeoPlaceCollector();
    c.add(dump({ 14: '100' }));
    c.add(dump({ 14: '4096' }));
    c.add(dump({ 0: '5', 6: 'T' }));
    const res = c.result();
    expect(res.lines).toBe(3);
    expect(res.replaced).toBe(1);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].population).toBe(4096);
    expect(res.dropped).toEqual({ hors_classe: 1 });
  });
});
