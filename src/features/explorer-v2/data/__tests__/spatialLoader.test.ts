import { describe, expect, it } from 'vitest';
import {
  categoryPriorityBonus,
  expandBounds,
  isBoundsCovered,
  lod3DBudgetForZoom,
  mergeSpatialPois,
  mergeSpatialRoutes,
  quantizePlaceQuery,
  zoomBucketFor,
} from '../spatialLoader';
import type { PoiItem } from '../hooks';

function makePoi(id: string, lon: number, lat: number, name = id): PoiItem {
  return {
    id,
    kind: 'water',
    subtype: 'drinking_water',
    name,
    lat,
    lon,
    ele_m: null,
    potable: true,
    capacity: null,
  };
}

describe('spatialLoader — adaptive spatial grid, buffer coverage, cache ring & LOD', () => {
  it('quantizes micro-pans into identical spatial cache keys by zoom band', () => {
    expect(zoomBucketFor(3.2)).toBe(4);
    expect(zoomBucketFor(13.1)).toBe(14);
    expect(zoomBucketFor(14.8)).toBe(14);

    // Moving ~200m inside Chamonix at z=13.5 stays on the exact same spatial cell key!
    const a = quantizePlaceQuery(45.9231, 6.8691, 13.5);
    const b = quantizePlaceQuery(45.9242, 6.8703, 13.8);
    expect(a.key).toBe(b.key);

    // Moving ~2 km advances cleanly to a new cell
    const c = quantizePlaceQuery(45.944, 6.895, 13.5);
    expect(c.key).not.toBe(a.key);
  });

  it('over-fetches 1.45x buffer bounds and suppresses redundant refetches while covered', () => {
    const view = { south: 45.9, west: 6.8, north: 45.96, east: 6.92 };
    const expanded = expandBounds(view, 1.45);
    expect(expanded.south).toBeLessThan(view.south);
    expect(expanded.north).toBeGreaterThan(view.north);
    expect(expanded.west).toBeLessThan(view.west);
    expect(expanded.east).toBeGreaterThan(view.east);

    const loaded = { ...expanded, zoomBucket: 12 };
    // Gentle pan staying inside the 1.45x buffer -> still covered (0 network call!)
    const gentlePan = { south: 45.908, west: 6.81, north: 45.968, east: 6.93 };
    expect(isBoundsCovered(gentlePan, loaded, 12)).toBe(true);

    // Far pan outside buffer -> needs fresh fetch
    const farPan = { south: 45.9, west: 7.05, north: 45.96, east: 7.17 };
    expect(isBoundsCovered(farPan, loaded, 12)).toBe(false);

    // Deep zoom-in (>3.5x smaller span) -> refreshes for local detail
    const deepZoom = { south: 45.925, west: 6.855, north: 45.932, east: 6.868 };
    expect(isBoundsCovered(deepZoom, loaded, 14)).toBe(false);
  });

  it('merges POIs and routes in a Spatial Cache Ring without wiping existing items on pan', () => {
    const prev = [
      makePoi('p-near', 6.87, 45.92, 'Old Name'),
      makePoi('p-mid', 6.88, 45.93),
      makePoi('p-far', 8.5, 47.2),
    ];
    const incoming = [
      makePoi('p-near', 6.87, 45.92, 'Fresh Name'),
      makePoi('p-new', 6.871, 45.921),
    ];

    const merged = mergeSpatialPois(prev, incoming, [6.87, 45.92], 3);
    expect(merged).toHaveLength(3);
    expect(merged.find((p) => p.id === 'p-near')?.name).toBe('Fresh Name');
    expect(merged.some((p) => p.id === 'p-mid')).toBe(true);
    expect(merged.some((p) => p.id === 'p-new')).toBe(true);
    // Farthest POI evicted cleanly
    expect(merged.some((p) => p.id === 'p-far')).toBe(false);

    // Empty incoming preserves cached items
    expect(mergeSpatialPois(prev, [], [6.87, 45.92], 10)).toHaveLength(3);

    const mergedRoutes = mergeSpatialRoutes(
      [
        { id: 1, name: 'GR5 old' },
        { id: 2, name: 'Tour du Mont-Blanc' },
      ],
      [
        { id: 1, name: 'GR5 fresh' },
        { id: 3, name: 'Petit Balcon Nord' },
      ],
      3,
    );
    expect(mergedRoutes.map((r) => r.id)).toEqual([1, 3, 2]);
    expect(mergedRoutes[0]?.name).toBe('GR5 fresh');
  });

  it('adapts 3D LOD budget by zoom scale and prioritizes the active drawer category', () => {
    const world = lod3DBudgetForZoom(3.5);
    expect(world.maxItems).toBe(8);
    expect(world.allowKind('parking', false)).toBe(false);
    expect(world.allowKind('parking', true)).toBe(true);
    expect(world.allowKind('bottle', false)).toBe(true);

    const regional = lod3DBudgetForZoom(8.5);
    expect(regional.maxItems).toBe(16);
    expect(regional.allowKind('summit', false)).toBe(true);
    expect(regional.allowKind('parking', false)).toBe(false);

    const local = lod3DBudgetForZoom(13.2);
    expect(local.maxItems).toBe(32);
    expect(local.allowKind('parking', false)).toBe(true);
    expect(local.allowKind('bus_stop', false)).toBe(true);

    expect(categoryPriorityBonus('pokedex_bird', 'pokedex')).toBeGreaterThan(
      categoryPriorityBonus('bus_stop', 'pokedex'),
    );
    expect(categoryPriorityBonus('bottle', 'community')).toBeGreaterThan(
      categoryPriorityBonus('water', 'community'),
    );
    expect(categoryPriorityBonus('rescue', 'safety')).toBeGreaterThan(
      categoryPriorityBonus('village', 'safety'),
    );
  });
});
