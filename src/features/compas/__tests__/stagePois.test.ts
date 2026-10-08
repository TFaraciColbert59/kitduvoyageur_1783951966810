import { describe, expect, it } from 'vitest';
import {
  buildOverpassQuery,
  distinctPlaces,
  mergeStagePois,
  overpassUsable,
  parseOverpass,
  poiCategoryOf,
  STAGE_POI_MAX_PLACES,
} from '../engine/stagePois';
import { poiLabel, type RoutePoi } from '../engine/routePois';

const annecy = { lat: 45.8992, lon: 6.1294 };

describe('Points autour des étapes (OpenStreetMap)', () => {
  it('deux soirs au même village : un seul lieu cherché, au plus 8', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ lat: 45 + i * 0.1, lon: 6 }));
    expect(distinctPlaces([annecy, { lat: 45.9, lon: 6.13 }])).toHaveLength(1);
    expect(distinctPlaces(many)).toHaveLength(STAGE_POI_MAX_PLACES);
    expect(distinctPlaces([{ lat: Number.NaN, lon: 6 }, { lat: 120, lon: 6 }])).toEqual([]);
  });

  it('une requête par lieu, un plafond par catégorie (une ville dense ne noie rien)', () => {
    const q = buildOverpassQuery(annecy);
    expect(q).toContain('[out:json]');
    expect(q).toContain(
      'nwr["amenity"~"^(restaurant|cafe|fast_food|pub|bar|food_court)$"](around:1500,45.8992,6.1294);out center tags 25;'
    );
    expect(q).toContain('"shop"~"^(supermarket');
    expect(q).toContain('"amenity"~"^(pharmacy');
  });

  it('réponse coupée (remarque d’erreur) : inexploitable, jamais prise pour « aucun point »', () => {
    expect(overpassUsable({ elements: [] })).toBe(true);
    expect(
      overpassUsable({ elements: [], remark: 'runtime error: Query timed out in "query" at line 1 after 26 seconds.' })
    ).toBe(false);
    expect(overpassUsable(null)).toBe(false);
    expect(overpassUsable({})).toBe(false);
  });

  it('catégorie lue depuis les étiquettes OSM', () => {
    expect(poiCategoryOf({ amenity: 'restaurant' })).toBe('resto');
    expect(poiCategoryOf({ shop: 'bakery' })).toBe('commerce');
    expect(poiCategoryOf({ amenity: 'pharmacy' })).toBe('sante');
    expect(poiCategoryOf({ natural: 'spring' })).toBe('water');
    expect(poiCategoryOf({ tourism: 'alpine_hut' })).toBe('refuge');
    expect(poiCategoryOf({ railway: 'station' })).toBe('transport');
    expect(poiCategoryOf({ amenity: 'bench' })).toBeNull();
    // Pas de correspondance partielle : « restaurant_supply » n'est pas un resto.
    expect(poiCategoryOf({ shop: 'restaurant_supply' })).toBeNull();
  });

  it('réponse Overpass : nœuds et bâtiments (centre), nom absent gardé absent, plus proches d’abord', () => {
    const pois = parseOverpass(
      {
        elements: [
          { type: 'node', id: 1, lat: 45.9, lon: 6.13, tags: { amenity: 'restaurant', name: 'Le Freti' } },
          { type: 'way', id: 2, center: { lat: 45.901, lon: 6.131 }, tags: { shop: 'supermarket' } },
          { type: 'node', id: 3, lat: 45.95, lon: 6.2, tags: { amenity: 'restaurant', name: 'Loin' } },
          { type: 'node', id: 4, lat: 45.9, lon: 6.13, tags: { amenity: 'bench' } },
          { type: 'node', id: 5, tags: { amenity: 'cafe' } },
        ],
      },
      [annecy]
    );
    expect(pois.map((p) => p.id)).toEqual([1, 2, 3]);
    expect(pois[1]).toMatchObject({ name: null, category: 'commerce' });
    expect(poiLabel(pois[1])).toBe('Commerce');
    expect(pois[0].distanceM).toBeLessThan(pois[2].distanceM);
  });

  it('au plus 6 par catégorie et par étape ; doublons (même nom, < 60 m) retirés', () => {
    const elements = Array.from({ length: 10 }, (_, i) => ({
      type: 'node',
      id: 100 + i,
      lat: 45.8992 + i * 0.0005,
      lon: 6.1294,
      tags: { amenity: 'cafe', name: `Café ${i}` },
    }));
    elements.push({ type: 'way', id: 999, lat: 45.8992, lon: 6.1294, tags: { amenity: 'cafe', name: 'Café 0' } });
    const pois = parseOverpass({ elements }, [annecy]);
    expect(pois).toHaveLength(6);
    expect(pois.filter((p) => p.name === 'Café 0')).toHaveLength(1);
  });

  it('réponse illisible : aucun point, jamais d’erreur', () => {
    expect(parseOverpass(null, [annecy])).toEqual([]);
    expect(parseOverpass({ elements: 'x' }, [annecy])).toEqual([]);
    expect(parseOverpass({ elements: [] }, [])).toEqual([]);
  });

  it('mêlés aux points du tracé sans doublon, en points de carte', () => {
    const route: RoutePoi[] = [
      { id: 7, name: 'Source', category: 'water', lat: 45.9, lon: 6.13, distanceM: 10, elevationM: null },
    ];
    const stage: RoutePoi[] = [
      { id: 8, name: 'Fontaine', category: 'water', lat: 45.90001, lon: 6.13001, distanceM: 5, elevationM: null },
      { id: 9, name: 'Le Freti', category: 'resto', lat: 45.9, lon: 6.13, distanceM: 5, elevationM: null },
    ];
    const merged = mergeStagePois(route, [], stage, poiLabel);
    expect(merged.routePois.map((p) => p.id)).toEqual([7, 9]);
    expect(merged.points).toEqual([
      { id: 'o-9', lat: 45.9, lon: 6.13, label: 'Le Freti', category: 'resto', kind: 'poi' },
    ]);
  });
});
