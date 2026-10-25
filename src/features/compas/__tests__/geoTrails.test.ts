import { describe, expect, it } from 'vitest';
import {
  buildGeoTrailsQuery,
  normalizeTrailRef,
  parseGeoTrails,
  pickTrail,
  trailRefIn,
  type GeoTrailRow,
} from '../engine/geoTrails';

const rel = (
  id: number,
  tags: Record<string, string>,
  bounds = { minlat: 48.0, minlon: -5.0, maxlat: 48.9, maxlon: -2.0 },
  center = { lat: 48.4, lon: -3.5 }
) => ({
  type: 'relation',
  id,
  tags,
  bounds,
  center,
});

describe('normalizeTrailRef', () => {
  it('range les écritures d’une même référence sous une seule clé', () => {
    expect(normalizeTrailRef('GR 34')).toBe('GR34');
    expect(normalizeTrailRef('gr-34')).toBe('GR34');
    expect(normalizeTrailRef(' GR34a ')).toBe('GR34A');
    expect(normalizeTrailRef('GR® 20')).toBe('GR20');
  });
  it('garde les références non numériques lisibles et refuse le vide', () => {
    expect(normalizeTrailRef('TMB')).toBe('TMB');
    expect(normalizeTrailRef('E 5')).toBe('E5');
    expect(normalizeTrailRef('')).toBeNull();
    expect(normalizeTrailRef('   ')).toBeNull();
    expect(normalizeTrailRef(undefined)).toBeNull();
  });
  it('refuse une référence démesurée (pas un code de sentier)', () => {
    expect(normalizeTrailRef('x'.repeat(40))).toBeNull();
  });
});

describe('trailRefIn', () => {
  it('lit un code de sentier dans une phrase, sans liste de sentiers', () => {
    expect(trailRefIn('le GR34 en 8 jours')).toBe('GR34');
    expect(trailRefIn('sur le gr 20 en septembre')).toBe('GR20');
    expect(trailRefIn('GR 5A cet été')).toBe('GR5A');
    expect(trailRefIn('HRP en juillet')).toBe('HRP');
  });
  it('ne prend pas un mot ordinaire pour un sentier', () => {
    expect(trailRefIn('un week-end à Grenoble')).toBeNull();
    expect(trailRefIn('gr')).toBeNull();
    expect(trailRefIn('3 jours dans le Vercors')).toBeNull();
  });
});

describe('buildGeoTrailsQuery', () => {
  it('demande les itinéraires de randonnée nationaux et internationaux de la tuile, avec emprise et centre', () => {
    const q = buildGeoTrailsQuery([-5, 48, -4, 49]);
    expect(q).toContain('[out:json]');
    expect(q).toContain(
      'rel["route"="hiking"]["network"~"^(iwn|nwn)$"](48.0000,-5.0000,49.0000,-4.0000)'
    );
    expect(q).toContain('out center bb tags;');
  });
});

describe('parseGeoTrails', () => {
  it('lit une relation : référence normalisée, nom, emprise et centre arrondis', () => {
    const { rows, elements } = parseGeoTrails({
      elements: [
        rel(1, {
          route: 'hiking',
          network: 'nwn',
          ref: 'GR 34',
          name: 'GR 34 : Sentier des douaniers',
        }),
      ],
    });
    expect(elements).toBe(1);
    expect(rows).toEqual([
      {
        osm_id: 'r1',
        ref: 'GR34',
        name: 'GR 34 : Sentier des douaniers',
        network: 'nwn',
        lat: 48.4,
        lon: -3.5,
        west: -5,
        south: 48,
        east: -2,
        north: 48.9,
      },
    ]);
  });
  it('écarte et compte ce qui n’est pas un sentier utilisable', () => {
    const { rows, dropped } = parseGeoTrails({
      elements: [
        rel(1, { route: 'hiking', network: 'nwn', ref: 'GR34' }),
        rel(1, { route: 'hiking', network: 'nwn', ref: 'GR34' }),
        rel(2, { route: 'hiking', network: 'nwn' }),
        rel(3, { route: 'hiking', network: 'nwn', ref: 'GR9', disused: 'yes' }),
        { type: 'relation', id: 4, tags: { route: 'hiking', network: 'nwn', ref: 'GR7' } },
        rel(5, { route: 'hiking', network: 'lwn', ref: 'PR1' }),
        rel(6, { route: 'bicycle', network: 'nwn', ref: 'V40' }),
      ],
    });
    expect(rows.map((r) => r.osm_id)).toEqual(['r1']);
    expect(dropped).toEqual({
      doublon: 1,
      sans_reference_ni_nom: 1,
      abandonne: 1,
      sans_emprise: 1,
      hors_reseau: 1,
      pas_rando: 1,
    });
  });
  it('garde un sentier sans référence mais nommé (Kungsleden), la référence reste null', () => {
    const { rows } = parseGeoTrails({
      elements: [rel(7, { route: 'hiking', network: 'nwn', name: 'Kungsleden' })],
    });
    expect(rows[0]).toMatchObject({ osm_id: 'r7', ref: null, name: 'Kungsleden' });
  });
  it('ne devine rien : un nom commun n’est pas un nom', () => {
    const { rows } = parseGeoTrails({
      elements: [rel(8, { route: 'hiking', network: 'iwn', ref: 'E5', name: 'sentier' })],
    });
    expect(rows[0].name).toBeNull();
  });
  it('sans centre (Overpass n’honore qu’un des deux, `bb`), le milieu de l’emprise en tient lieu', () => {
    const { rows } = parseGeoTrails({
      elements: [
        {
          type: 'relation',
          id: 9,
          tags: { route: 'hiking', network: 'nwn', ref: 'GR 9' },
          bounds: { minlat: 45, minlon: 5, maxlat: 46, maxlon: 6 },
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ osm_id: 'r9', lat: 45.5, lon: 5.5, west: 5, east: 6 });
  });
  it('rend un résultat vide pour une réponse sans éléments', () => {
    expect(parseGeoTrails(null)).toEqual({ rows: [], dropped: {}, elements: 0 });
    expect(parseGeoTrails({})).toEqual({ rows: [], dropped: {}, elements: 0 });
  });
});

describe('pickTrail', () => {
  const row = (
    osm_id: string,
    ref: string | null,
    west: number,
    east: number,
    name: string | null = null
  ): GeoTrailRow => ({
    osm_id,
    ref,
    name,
    network: 'nwn',
    lat: 47,
    lon: (west + east) / 2,
    west,
    south: 46,
    east,
    north: 48,
  });
  it('prend, parmi les variantes d’une même référence, la plus étendue (le tracé entier)', () => {
    const picked = pickTrail(
      [row('r1', 'GR5', 5, 5.5), row('r2', 'GR5', 4, 7), row('r3', 'GR5', 6, 6.2)],
      'GR5'
    );
    expect(picked?.osm_id).toBe('r2');
  });
  it('ne rend rien si aucune ligne n’a cette référence exacte (GR5 n’est pas GR50)', () => {
    expect(pickTrail([row('r1', 'GR50', 5, 6)], 'GR5')).toBeNull();
    expect(pickTrail([], 'GR5')).toBeNull();
  });
  it('à emprise égale, le résultat est stable (identifiant le plus petit)', () => {
    expect(pickTrail([row('r9', 'GR1', 1, 2), row('r2', 'GR1', 1, 2)], 'GR1')?.osm_id).toBe('r2');
  });
});
