import { describe, expect, it } from 'vitest';
import { buildTripGeometry } from '../mapModel';
import { computeMapView, type ViewInput } from '../mapView';

// Projection linéaire simple, assez large pour que tout tienne dans une vue de 400 x 600.
const project = (lat: number, lon: number) => ({ x: 200 + (lon - 5.5) * 1500, y: 300 - (lat - 45.05) * 3000 });
const geometry = buildTripGeometry({
  routeGeojson: null,
  coords: [],
  origin: { lat: 45.0, lon: 5.4, title: 'Sainte-Eulalie-en-Royans' },
  stages: [
    { day: 1, lat: 45.07, lon: 5.45, title: 'Sainte-Eulalie → Rencurel' },
    { day: 2, lat: 45.04, lon: 5.55, title: 'Rencurel → Corrençon' },
  ],
});

function input(over: Partial<ViewInput> = {}): ViewInput {
  return {
    zoom: 11.5,
    size: { width: 400, height: 600 },
    viewport: { south: 44.9, west: 5.3, north: 45.2, east: 5.7 },
    project,
    geometry,
    showSteps: true,
    showNights: true,
    nights: [
      {
        day: 1,
        chosen: { id: 'osm:1', lat: 45.07, lon: 5.452 },
        alternatives: [
          { id: 'osm:2', lat: 45.0702, lon: 5.4522 },
          { id: 'osm:3', lat: 45.0703, lon: 5.4523 },
        ],
      },
    ],
    openDay: 1,
    pois: [
      { id: 'w1', lat: 45.02, lon: 5.5, label: 'Source', category: 'water' },
      { id: 'p1', lat: 45.1, lon: 5.6, label: 'Sommet', category: 'peak' },
      { id: 't1', lat: 45.03, lon: 5.52, label: 'Toilettes', category: 'toilets' },
    ],
    keepPoi: null,
    ...over,
  };
}

describe('computeMapView', () => {
  it('donne le niveau de détail du zoom', () => {
    expect(computeMapView(input({ zoom: 7 })).lod).toBe('low');
    expect(computeMapView(input({ zoom: 10 })).lod).toBe('mid');
    expect(computeMapView(input({ zoom: 12 })).lod).toBe('high');
  });
  it('vue d’ensemble : aucun point utile ni libellé', () => {
    const v = computeMapView(input({ zoom: 7 }));
    expect(v.poiIds).toEqual([]);
    expect(v.labels).toEqual([]);
  });
  it('détail moyen : l’essentiel ; détail fort : tout', () => {
    expect(computeMapView(input({ zoom: 10 })).poiIds.sort()).toEqual(['p1', 'w1']);
    expect(computeMapView(input({ zoom: 12 })).poiIds.sort()).toEqual(['p1', 't1', 'w1']);
  });
  it('place un libellé par pastille visible, sans chevauchement avec les autres pastilles', () => {
    const v = computeMapView(input());
    const ids = v.labels.map((l) => l.id);
    expect(ids).toContain('origin');
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('calque Étapes éteint : ni pastille ni libellé', () => {
    expect(computeMapView(input({ showSteps: false })).labels).toEqual([]);
  });
  it('écarte les nuits possibles superposées du jour ouvert', () => {
    const v = computeMapView(input());
    expect(Object.keys(v.alts).sort()).toEqual(['1:osm:2', '1:osm:3']);
    const moved = Object.values(v.alts).filter((a) => a.offsetX !== 0 || a.offsetY !== 0);
    expect(moved.length).toBeGreaterThan(0);
  });
  it('ne place de nuits possibles que pour le jour ouvert', () => {
    expect(computeMapView(input({ openDay: 2 })).alts).toEqual({});
    expect(computeMapView(input({ openDay: null })).alts).toEqual({});
    expect(computeMapView(input({ showNights: false })).alts).toEqual({});
  });
  it('garde le point dont la bulle est ouverte, même en vue d’ensemble', () => {
    expect(computeMapView(input({ zoom: 7, keepPoi: 'w1' })).poiIds).toEqual(['w1']);
  });
  it('empreinte stable : même entrée, même clé ; entrée différente, clé différente', () => {
    expect(computeMapView(input()).key).toBe(computeMapView(input()).key);
    expect(computeMapView(input()).key).not.toBe(computeMapView(input({ zoom: 7 })).key);
  });
  it('ignore les projections non finies', () => {
    const v = computeMapView(input({ project: () => ({ x: Number.NaN, y: Number.NaN }) }));
    expect(v.labels).toEqual([]);
    expect(v.poiIds).toEqual([]);
  });
  it('sans aucune donnée, rend une vue vide sans erreur', () => {
    const empty = buildTripGeometry({ routeGeojson: null, coords: [], stages: [] });
    const v = computeMapView(input({ geometry: empty, nights: [], pois: [] }));
    expect(v.poiIds).toEqual([]);
    expect(v.labels).toEqual([]);
    expect(v.alts).toEqual({});
  });
});
