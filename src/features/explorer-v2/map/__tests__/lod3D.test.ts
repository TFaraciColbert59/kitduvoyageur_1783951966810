import { describe, expect, it } from 'vitest';
import {
  adaptiveCollisionSpacing,
  minZoomFor3DKind,
  resolve3DVisualProfile,
  selectBalanced3DItems,
  subtypeQuotaFor3DKind,
} from '../lod3D';
import type { Floating3DItem } from '../explorerThree3DLayer';

function mk(id: string, kind: Floating3DItem['kind'], selected = false): Floating3DItem {
  return {
    id,
    kind,
    lng: 6.87,
    lat: 45.92,
    selected,
    sourceCategory: 'pin',
  };
}

describe('lod3D — 3-tier LOD modulation, visual hierarchy & per-subtype diversity quotas', () => {
  it('modulates LOD mode, scale hierarchy, ground rings & calm sway by zoom and tier', () => {
    // Wide overview (z=8): peripheral/secondary items drop to lightweight shared beacon
    const wideBus = resolve3DVisualProfile('bus_stop', 8.0, { distCenterNorm: 0.4 });
    expect(wideBus.lodMode).toBe('beacon');
    expect(wideBus.showRing).toBe(false);

    // Local terrain (z=14): Tier 1 summit stands out heroically while Tier 3 bus stays tidy & compact
    const localSummit = resolve3DVisualProfile('summit', 14.0, { distCenterNorm: 0.2 });
    const localBus = resolve3DVisualProfile('bus_stop', 14.0, { distCenterNorm: 0.2 });
    const localBottle = resolve3DVisualProfile('bottle', 14.0, { distCenterNorm: 0.2 });

    expect(localSummit.lodMode).toBe('full');
    expect(localBus.lodMode).toBe('compact');
    expect(localSummit.scaleMultiplier).toBeGreaterThan(localBus.scaleMultiplier);
    expect(localSummit.showRing).toBe(true);
    expect(localBus.showRing).toBe(false);

    // Calm sway on architecture/vehicles, lively turntable on floating collectibles
    expect(localBus.motionStyle).toBe('gentle-sway');
    expect(localSummit.motionStyle).toBe('gentle-sway');
    expect(localBottle.motionStyle).toBe('turntable');

    // Selected entity ALWAYS gets full hero detail + ring regardless of zoom
    const selectedBusWide = resolve3DVisualProfile('bus_stop', 7.5, { selected: true });
    expect(selectedBusWide.lodMode).toBe('full');
    expect(selectedBusWide.showRing).toBe(true);
    expect(selectedBusWide.scaleMultiplier).toBeGreaterThan(1.2);
  });

  it('prevents repetitive street POIs (bus stops, parkings) from crowding out outdoor landmarks', () => {
    const candidates = [
      ...Array.from({ length: 8 }, (_, i) => ({ item: mk(`bus-${i}`, 'bus_stop'), score: i * 0.01 })),
      { item: mk('peak-1', 'summit'), score: 0.2 },
      { item: mk('hut-1', 'refuge'), score: 0.25 },
      { item: mk('camp-1', 'bivouac'), score: 0.3 },
      { item: mk('water-1', 'water'), score: 0.35 },
    ];

    // At regional valley zoom (z=12.4): bus_stop minZoom (13.2) hides bus clutter completely!
    expect(minZoomFor3DKind('bus_stop')).toBeGreaterThan(12.4);
    const valley = selectBalanced3DItems(candidates, { zoom: 12.4, maxTotal: 16 });
    expect(valley.filter((i) => i.kind === 'bus_stop')).toHaveLength(0);
    expect(valley.map((i) => i.id)).toEqual(['peak-1', 'hut-1', 'camp-1', 'water-1']);

    // At street zoom (z=14): bus_stop capped at quota (2) so peak/refuge/camp/water all shine!
    expect(subtypeQuotaFor3DKind('bus_stop', 14)).toBe(2);
    const street = selectBalanced3DItems(candidates, { zoom: 14.0, maxTotal: 16 });
    expect(street.filter((i) => i.kind === 'bus_stop')).toHaveLength(2);
    expect(street.some((i) => i.id === 'peak-1')).toBe(true);
    expect(street.some((i) => i.id === 'hut-1')).toBe(true);
    expect(street.some((i) => i.id === 'camp-1')).toBe(true);
  });

  it('gives wider collision breathing room at mid-zoom than at street zoom', () => {
    const mid = adaptiveCollisionSpacing(9.5);
    const local = adaptiveCollisionSpacing(14.2);
    expect(mid.enterPx).toBeGreaterThan(local.enterPx);
    expect(mid.exitPx).toBeGreaterThan(local.exitPx);
  });
});
