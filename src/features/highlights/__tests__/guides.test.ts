import { describe, expect, it } from 'vitest';
import {
  buildEditorialGuide,
  publicEditorialCollections,
  searchParkRoutes,
  type GuideSource,
} from '../engine/guides';
import type { PoiRef, RouteRef } from '../types';
import { ANON, OTHER, makeCollection, makeHighlight } from './fixtures';

const route = (overrides: Partial<RouteRef> = {}): RouteRef => ({
  id: 'route-1',
  title: 'Tour des lacs',
  sport: 'hike',
  region: 'Chamonix',
  audience: 'public',
  latitude: 45.92,
  longitude: 6.87,
  updatedAt: '2026-11-01T10:00:00.000Z',
  ...overrides,
});

const poi = (overrides: Partial<PoiRef> = {}): PoiRef => ({
  id: 'poi-1',
  name: 'Lac Blanc',
  category: 'lake',
  region: 'Chamonix',
  audience: 'public',
  latitude: 45.98,
  longitude: 6.9,
  updatedAt: '2026-11-01T10:00:00.000Z',
  ...overrides,
});

const source = (overrides: Partial<GuideSource> = {}): GuideSource => ({
  id: 'guide-1',
  slug: 'lacs-chamonix',
  title: 'Lacs de Chamonix',
  description: 'Une sélection de lacs.',
  theme: 'lacs',
  region: 'Chamonix',
  routes: [route()],
  pois: [poi()],
  highlights: [makeHighlight()],
  ...overrides,
});

describe('K1.11 / K5.17 — guides éditoriaux', () => {
  it('assemble parcours, lieux et highlights publics sur un thème et une région', () => {
    const guide = buildEditorialGuide(source(), OTHER, '2026-11-11T10:00:00.000Z');
    expect(guide.routeCount).toBe(1);
    expect(guide.poiCount).toBe(1);
    expect(guide.highlightCount).toBe(1);
    expect(guide.sections.map((section) => section.id)).toEqual(['routes', 'pois', 'highlights']);
  });

  it('écarte les objets d’une autre région, privés ou non publics', () => {
    const guide = buildEditorialGuide(
      source({
        routes: [
          route(),
          route({ id: 'route-2', region: 'Vercors' }),
          route({ id: 'route-3', audience: 'private' }),
        ],
        pois: [poi(), poi({ id: 'poi-2', region: 'Vercors' })],
        highlights: [makeHighlight(), makeHighlight({ id: 'h2', audience: 'private' })],
      }),
      OTHER,
      '2026-11-11T10:00:00.000Z'
    );
    expect(guide.routeCount).toBe(1);
    expect(guide.poiCount).toBe(1);
    expect(guide.highlightCount).toBe(1);
  });

  it('un highlight masqué ne laisse pas fuir sa position dans un guide', () => {
    const guide = buildEditorialGuide(
      source({
        highlights: [
          makeHighlight({
            id: 'h-hidden',
            privacy: { ...makeHighlight().privacy, hideExactLocation: true },
          }),
        ],
      }),
      ANON
    );
    const serialized = JSON.stringify(guide);
    expect(serialized).not.toContain('45.9237');
    expect(
      guide.sections.find((section) => section.id === 'highlights')?.highlights[0].location
    ).toBeNull();
  });

  it('ne liste que les collections éditoriales publiques', () => {
    const collections = [
      makeCollection({ id: 'editorial', kind: 'editorial', visibility: 'public', title: 'Lacs' }),
      makeCollection({ id: 'personal', kind: 'personal', visibility: 'public', title: 'Perso' }),
      makeCollection({
        id: 'private-editorial',
        kind: 'editorial',
        visibility: 'private',
        title: 'Brouillon',
      }),
    ];
    expect(publicEditorialCollections(collections, OTHER).map((item) => item.id)).toEqual([
      'editorial',
    ]);
  });
});

describe('K1.12 — recherche limitée au périmètre d’un parc', () => {
  const park = {
    id: 'park-1',
    name: 'Massif du Mont-Blanc',
    region: 'Chamonix',
    bbox: [6.7, 45.8, 7.0, 46.0] as [number, number, number, number],
  };

  it('ne retourne que les parcours publics dans la bbox', () => {
    const routes = [
      route(),
      route({
        id: 'outside',
        title: 'Tour du Vercors',
        latitude: 44.9,
        longitude: 5.4,
        region: 'Vercors',
      }),
      route({ id: 'private', audience: 'private' }),
    ];
    expect(searchParkRoutes(park, routes, '').map((item) => item.id)).toEqual(['route-1']);
  });

  it('filtre par requête et accepte un tracé sans latitude centrale', () => {
    const routes = [
      route({
        id: 'geo',
        title: 'Balcon nord',
        latitude: null,
        longitude: null,
        geometry: [{ lat: 45.9, lng: 6.8 }],
      }),
      route({ id: 'other', title: 'Balcon sud' }),
    ];
    expect(searchParkRoutes(park, routes, 'nord').map((item) => item.id)).toEqual(['geo']);
  });

  it('trie par distance au centre du parc', () => {
    const routes = [
      route({ id: 'far', latitude: 45.99, longitude: 6.99 }),
      route({ id: 'near', latitude: 45.86, longitude: 6.86 }),
    ];
    const result = searchParkRoutes(park, routes, '');
    expect(result[0].id).toBe('near');
  });
});
