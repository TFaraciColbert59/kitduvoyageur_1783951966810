import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeGeoJsonRoutes, parseGpxTrack } from '../../scripts/coverage/normalize';
import { validateRoute, validateRoutes } from '../../scripts/coverage/validateGeo';
import type { NormalizedRoute } from '../../scripts/coverage/types';

const FIXTURES = path.join(__dirname, 'fixtures');

function loadGeoJson(): unknown {
  return JSON.parse(readFileSync(path.join(FIXTURES, 'routes.geojson'), 'utf8'));
}

describe('Phase 4 — normalisation GeoJSON/GPX (étape 3)', () => {
  it('normalise une FeatureCollection en parcours (MultiLineString éclaté)', () => {
    const result = normalizeGeoJsonRoutes(loadGeoJson());
    expect(result.items.length).toBe(3);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.items.map((route) => route.externalId)).toEqual(['r1', 'r2#0', 'r2#1']);
  });

  it('rejette un point hors bornes sans fabriquer de coordonnée', () => {
    const result = normalizeGeoJsonRoutes(loadGeoJson());
    expect(result.errors.some((error) => error.includes('hors bornes'))).toBe(true);
    expect(result.items.every((route) => route.externalId !== 'r3')).toBe(true);
  });

  it('rejette une racine GeoJSON inconnue', () => {
    const result = normalizeGeoJsonRoutes({ type: 'Topology' });
    expect(result.items).toEqual([]);
    expect(result.errors.length).toBe(1);
  });

  it('parse une trace GPX complète (points + altitudes)', () => {
    const gpx = readFileSync(path.join(FIXTURES, 'track.gpx'), 'utf8');
    const result = parseGpxTrack(gpx);
    expect(result.errors).toEqual([]);
    expect(result.items.length).toBe(4);
    expect(result.items[0].ele).toBe(1000);
    expect(result.items[3].ele).toBe(1100);
  });

  it('rejette un flux GPX sans balise racine', () => {
    const result = parseGpxTrack('<xml>pas un gpx</xml>');
    expect(result.items).toEqual([]);
    expect(result.errors.length).toBe(1);
  });

  it('rejette une trace GPX à un seul point', () => {
    const gpx = `<gpx version="1.1"><trkpt lat="45" lon="6"></trkpt></gpx>`;
    const result = parseGpxTrack(gpx);
    expect(result.items.length).toBe(1);
    expect(result.errors.some((error) => error.includes('dégénérée'))).toBe(true);
  });
});

describe('Phase 4 — validation des géométries (étape 4)', () => {
  it('accepte les 3 parcours normalisés du fixture', () => {
    const report = validateRoutes(normalizeGeoJsonRoutes(loadGeoJson()).items);
    expect(report.validRoutes.length).toBe(3);
    expect(report.invalidRoutes.length).toBe(0);
    expect(report.unjustifiedBreaks).toBe(0);
  });

  it('rejette une séquence à moins de 2 points', () => {
    const route: NormalizedRoute = {
      externalId: 'x',
      name: 'x',
      source: 'fixture',
      points: [{ lat: 45, lng: 6 }],
      tags: {},
    };
    const result = validateRoute(route);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('2 points');
  });

  it('signale une rupture injustifiée comme invalide', () => {
    const route: NormalizedRoute = {
      externalId: 'jump',
      name: 'saut',
      source: 'fixture',
      points: [
        { lat: 45, lng: 6 },
        { lat: 46, lng: 7 },
      ],
      tags: {},
    };
    const result = validateRoute(route);
    expect(result.valid).toBe(false);
    expect(result.unjustifiedBreaks).toBe(1);
  });

  it('accepte une rupture justifiée par un tag explicite', () => {
    const route: NormalizedRoute = {
      externalId: 'jump-justified',
      name: 'saut justifié',
      source: 'fixture',
      points: [
        { lat: 45, lng: 6 },
        { lat: 46, lng: 7 },
      ],
      tags: { break_reason: 'ferry' },
    };
    const result = validateRoute(route);
    expect(result.valid).toBe(true);
    expect(result.breaks).toBe(1);
    expect(result.unjustifiedBreaks).toBe(0);
  });

  it('rejette une géométrie à distance nulle', () => {
    const route: NormalizedRoute = {
      externalId: 'same',
      name: 'même point',
      source: 'fixture',
      points: [
        { lat: 45, lng: 6 },
        { lat: 45, lng: 6 },
      ],
      tags: {},
    };
    const result = validateRoute(route);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('distance totale nulle');
  });
});
