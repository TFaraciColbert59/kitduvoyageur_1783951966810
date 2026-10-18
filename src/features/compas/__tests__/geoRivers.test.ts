import { describe, expect, it } from 'vitest';
import {
  buildGeoRiversQuery,
  normalizeRiverName,
  parseGeoRivers,
  pickRiver,
  riverExtent,
  type GeoRiverRow,
} from '../engine/geoRivers';

const el = (
  type: 'relation' | 'way',
  id: number,
  tags: Record<string, string>,
  bounds: Record<string, number> | null = { minlat: 44.0, minlon: 2.5, maxlat: 44.4, maxlon: 3.6 },
  center: Record<string, number> | null = { lat: 44.2, lon: 3.0 }
) => ({
  type,
  id,
  tags,
  ...(bounds ? { bounds } : {}),
  ...(center ? { center } : {}),
});

describe('normalizeRiverName', () => {
  it('retire l’article : « Le Tarn » et « Tarn » sont la même rivière', () => {
    expect(normalizeRiverName('Le Tarn')).toBe('tarn');
    expect(normalizeRiverName('Tarn')).toBe('tarn');
    expect(normalizeRiverName("L'Ardèche")).toBe('ardeche');
    expect(normalizeRiverName('la Dordogne')).toBe('dordogne');
  });
  it('« Río Colorado » et « Colorado River » se rangent sous le même nom', () => {
    expect(normalizeRiverName('Río Colorado')).toBe('colorado');
    expect(normalizeRiverName('Colorado River')).toBe('colorado');
    expect(normalizeRiverName('Rio Colorado')).toBe('colorado');
  });
  it('reconnaît « Fluss », « Fleuve », « Rivière », « Torrente », « Gave » (et le « de » qui suit)', () => {
    expect(normalizeRiverName('Rhein')).toBe('rhein');
    expect(normalizeRiverName('Fluss Rhein')).toBe('rhein');
    expect(normalizeRiverName('Rhein Fluss')).toBe('rhein');
    expect(normalizeRiverName('Fleuve Saint-Laurent')).toBe('saint laurent');
    expect(normalizeRiverName('Rivière des Prairies')).toBe('prairies');
    expect(normalizeRiverName('Torrente Sesia')).toBe('sesia');
    expect(normalizeRiverName('Gave de Pau')).toBe('pau');
    expect(normalizeRiverName('River Thames')).toBe('thames');
  });
  it('un mot générique seul n’est pas un nom ; le vide non plus', () => {
    expect(normalizeRiverName('River')).toBeNull();
    expect(normalizeRiverName('la rivière')).toBeNull();
    expect(normalizeRiverName('   ')).toBeNull();
    expect(normalizeRiverName(undefined)).toBeNull();
  });
  it('ne prend pas « Riviera » pour « rivière »', () => {
    expect(normalizeRiverName('Riviera')).toBe('riviera');
  });
});

describe('buildGeoRiversQuery', () => {
  it('demande les relations de rivière et les tronçons pagayables de la tuile, avec centre et emprise', () => {
    const q = buildGeoRiversQuery([2, 44, 3, 45]);
    const bb = '(44.0000,2.0000,45.0000,3.0000)';
    expect(q).toContain('[out:json]');
    expect(q).toContain(`rel["waterway"="river"]${bb};`);
    expect(q).toContain(`way["waterway"="river"]["canoe"]${bb};`);
    expect(q).toContain(`way["waterway"="river"]["whitewater"]${bb};`);
    expect(q).toContain('out center bb tags;');
  });
});

describe('parseGeoRivers', () => {
  it('lit une relation nommée : nom, nom de recherche, centre et emprise arrondis', () => {
    const { rows, elements } = parseGeoRivers({
      elements: [el('relation', 1, { waterway: 'river', type: 'waterway', name: 'Le Tarn' })],
    });
    expect(elements).toBe(1);
    expect(rows).toEqual([
      {
        osm_id: 'r1',
        name: 'Le Tarn',
        name_plain: 'tarn',
        alt_plain: [],
        canoe: null,
        whitewater_grade: null,
        length_km: null,
        lat: 44.2,
        lon: 3,
        west: 2.5,
        south: 44,
        east: 3.6,
        north: 44.4,
      },
    ]);
  });
  it('garde les autres noms (« Rhin » pour « Rhein ») pour la recherche', () => {
    const { rows } = parseGeoRivers({
      elements: [
        el('relation', 2, {
          waterway: 'river',
          name: 'Rhein',
          'name:fr': 'Rhin',
          'name:en': 'Rhine',
          'name:de': 'Rhein',
        }),
      ],
    });
    expect(rows[0].name_plain).toBe('rhein');
    expect(rows[0].alt_plain).toEqual(['rhin', 'rhine']);
  });
  it('lit l’accès en canoë et la difficulté d’un tronçon', () => {
    const { rows } = parseGeoRivers({
      elements: [
        el('way', 10, {
          waterway: 'river',
          name: 'Gave de Pau',
          canoe: 'yes',
          'whitewater:section_grade': '3',
        }),
        el('way', 11, { waterway: 'river', name: 'Ubaye', whitewater: 'section', rapids: 'IV' }),
        el('way', 12, {
          waterway: 'river',
          name: 'Verdon',
          canoe: 'portage',
          'whitewater:section_grade': '2-4',
        }),
        el('way', 13, { waterway: 'river', name: 'Ain', canoe: 'designated' }),
        el('way', 14, {
          waterway: 'river',
          name: 'Loue',
          canoe: 'yes',
          'whitewater:section_grade': 'facile',
        }),
      ],
    });
    expect(rows.map((r) => [r.osm_id, r.canoe, r.whitewater_grade])).toEqual([
      ['w10', 'yes', 3],
      ['w11', null, 4],
      ['w12', 'portage', 4],
      ['w13', 'yes', null],
      ['w14', 'yes', null],
    ]);
  });
  it('écarte et compte : sans nom, sans emprise, doublon, canoë interdit, tronçon sans pagaie, pas une rivière', () => {
    const { rows, dropped } = parseGeoRivers({
      elements: [
        el('relation', 1, { waterway: 'river', name: 'Tarn' }),
        el('relation', 1, { waterway: 'river', name: 'Tarn' }),
        el('relation', 2, { waterway: 'river' }),
        el('relation', 3, { waterway: 'river', name: 'Rivière' }),
        el('relation', 4, { waterway: 'river', name: 'Lot' }, null),
        el('way', 5, { waterway: 'river', name: 'Aveyron', canoe: 'no' }),
        el('way', 6, { waterway: 'river', name: 'Viaur' }),
        el('way', 7, { waterway: 'canal', name: 'Canal du Midi', canoe: 'yes' }),
        { ...el('way', 8, { waterway: 'river', name: 'Cère', canoe: 'yes' }), type: 'node' },
      ],
    });
    expect(rows.map((r) => r.osm_id)).toEqual(['r1']);
    expect(dropped).toEqual({
      doublon: 1,
      sans_nom: 2,
      sans_emprise: 1,
      canoe_interdit: 1,
      sans_pagaie: 1,
      pas_riviere: 2,
    });
  });
  it('ne devine pas la longueur depuis l’emprise ; lit seulement une longueur déclarée en km', () => {
    const { rows } = parseGeoRivers({
      elements: [
        el('relation', 1, { waterway: 'river', name: 'Tarn' }),
        el('relation', 2, { waterway: 'river', name: 'Lot', distance: '485' }),
        el('relation', 3, { waterway: 'river', name: 'Aude', distance: 'longue' }),
      ],
    });
    expect(rows.map((r) => r.length_km)).toEqual([null, 485, null]);
  });
  it('rend un résultat vide pour une réponse sans éléments', () => {
    expect(parseGeoRivers(null)).toEqual({ rows: [], dropped: {}, elements: 0 });
    expect(parseGeoRivers({})).toEqual({ rows: [], dropped: {}, elements: 0 });
  });
});

describe('pickRiver', () => {
  const row = (
    osm_id: string,
    name: string,
    west: number,
    east: number,
    alt_plain: string[] = []
  ): GeoRiverRow => ({
    osm_id,
    name,
    name_plain: normalizeRiverName(name) as string,
    alt_plain,
    canoe: null,
    whitewater_grade: null,
    length_km: null,
    lat: 44,
    lon: (west + east) / 2,
    west,
    south: 43,
    east,
    north: 45,
  });
  it('retrouve « Colorado River » quand on demande « Río Colorado »', () => {
    expect(pickRiver([row('r1', 'Colorado River', -115, -105)], 'Río Colorado')?.osm_id).toBe('r1');
  });
  it('retrouve le Rhin par son nom français', () => {
    expect(pickRiver([row('r2', 'Rhein', 6, 9, ['rhin', 'rhine'])], 'le Rhin')?.osm_id).toBe('r2');
  });
  it('préfère la rivière entière (relation) à un tronçon, puis la plus étendue', () => {
    const rows = [row('w1', 'Tarn', 1, 5), row('r9', 'Le Tarn', 2, 3.6), row('r3', 'Tarn', 2, 3)];
    expect(pickRiver(rows, 'Tarn')?.osm_id).toBe('r9');
  });
  it('près d’un point, préfère la rivière dont l’emprise le contient', () => {
    const rows = [row('r1', 'Río Colorado', -70, -62), row('r2', 'Colorado River', -115, -105)];
    expect(pickRiver(rows, 'Colorado', { lat: 44, lon: -110 })?.osm_id).toBe('r2');
    expect(pickRiver(rows, 'Colorado', { lat: 44, lon: -65 })?.osm_id).toBe('r1');
  });
  it('ne rend rien sans nom exact (« Lot » n’est pas « Lot-et-Garonne »)', () => {
    expect(pickRiver([row('r1', 'Lot et Garonne', 0, 1)], 'Lot')).toBeNull();
    expect(pickRiver([], 'Lot')).toBeNull();
    expect(pickRiver([row('r1', 'Lot', 0, 1)], 'rivière')).toBeNull();
  });
});

describe('riverExtent', () => {
  it('rend l’emprise dans l’ordre du Compas [ouest, nord, est, sud]', () => {
    const r = parseGeoRivers({ elements: [el('relation', 1, { waterway: 'river', name: 'Tarn' })] })
      .rows[0];
    expect(riverExtent(r)).toEqual([2.5, 44.4, 3.6, 44]);
  });
});
