import { describe, it, expect } from 'vitest';
import {
  getPoiColor,
  getZoomTier,
  getViewportLimit,
  MAP_COLORS,
  SIMPLIFY_TOLERANCE,
  ZOOM_TIERS,
} from '@/components/map/engine/mapTheme';

describe('ATLAS — paliers de zoom (mapTheme)', () => {
  it('classe chaque zoom dans le bon palier', () => {
    expect(getZoomTier(0)).toBe('world');
    expect(getZoomTier(3)).toBe('world');
    expect(getZoomTier(4)).toBe('continent');
    expect(getZoomTier(7)).toBe('continent');
    expect(getZoomTier(8)).toBe('region');
    expect(getZoomTier(13)).toBe('region');
    expect(getZoomTier(14)).toBe('local');
    expect(getZoomTier(18)).toBe('local');
  });

  it('applique les budgets LOD du chantier (300/150/60/0)', () => {
    expect(getViewportLimit(15)).toBe(300);
    expect(getViewportLimit(10)).toBe(150);
    expect(getViewportLimit(5)).toBe(60);
    expect(getViewportLimit(2)).toBe(0);
  });

  it('retombe sur le palier monde pour un zoom non fini', () => {
    expect(getZoomTier(Number.NaN)).toBe('world');
    expect(getZoomTier(-1)).toBe('world');
  });

  it('expose des tolérances de simplification croissantes vers le monde', () => {
    expect(SIMPLIFY_TOLERANCE.local).toBeLessThan(SIMPLIFY_TOLERANCE.region);
    expect(SIMPLIFY_TOLERANCE.region).toBeLessThan(SIMPLIFY_TOLERANCE.continent);
    expect(SIMPLIFY_TOLERANCE.continent).toBeLessThan(SIMPLIFY_TOLERANCE.world);
  });

  it('garde les bornes de paliers cohérentes', () => {
    expect(ZOOM_TIERS.LOCAL_MIN).toBe(ZOOM_TIERS.REGION_MAX + 1);
  });

  it('colore les POI avec la palette DS, fallback tertiaire inclus', () => {
    expect(getPoiColor('refuge')).toBe(MAP_COLORS.ink);
    expect(getPoiColor('summit')).toBe(MAP_COLORS.warn);
    expect(getPoiColor('water')).toBe(MAP_COLORS.info);
    expect(getPoiColor('camping')).toBe(MAP_COLORS.sage);
    expect(getPoiColor(null)).toBe(MAP_COLORS.inkTertiary);
    expect(getPoiColor('inconnu')).toBe(MAP_COLORS.inkTertiary);
    const banned = ['#E4501C', '#0B1F17', '#2D5A3D', '#22c55e', '#f97316', '#ef4444'];
    expect(banned).not.toContain(getPoiColor('refuge'));
  });
});
