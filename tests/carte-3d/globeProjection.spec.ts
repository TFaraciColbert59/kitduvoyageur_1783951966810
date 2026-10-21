import { describe, it, expect, vi } from 'vitest';
import {
  GLOBE_PROJECTION_CONFIG,
  GLOBE_ZOOM_BOUNDS,
  GLOBE_SKY_CONFIG,
  SCALE_PRESETS,
  getScaleTier,
  clampGlobeZoom,
  flyToScalePreset,
  type ScalePreset,
} from '@/features/carte-3d/lib/globeProjection';

describe('Carte 3D — Globe Projection & Continuous Zoom Engine', () => {
  it('définit la configuration de projection globe native MapLibre', () => {
    expect(GLOBE_PROJECTION_CONFIG).toEqual({ type: 'globe' });
  });

  it('définit les bornes de zoom continu de 0.8 à 19.5', () => {
    expect(GLOBE_ZOOM_BOUNDS.minZoom).toBe(0.8);
    expect(GLOBE_ZOOM_BOUNDS.maxZoom).toBe(19.5);
  });

  it('clampGlobeZoom : borne strictement le zoom entre minZoom et maxZoom', () => {
    expect(clampGlobeZoom(0.2)).toBe(0.8);
    expect(clampGlobeZoom(0.8)).toBe(0.8);
    expect(clampGlobeZoom(5.5)).toBe(5.5);
    expect(clampGlobeZoom(19.5)).toBe(19.5);
    expect(clampGlobeZoom(22.0)).toBe(19.5);
  });

  it('getScaleTier : résout les paliers d échelle (orbite, massif, sentier)', () => {
    expect(getScaleTier(0.8)).toBe('orbite');
    expect(getScaleTier(1.6)).toBe('orbite');
    expect(getScaleTier(3.9)).toBe('orbite');

    expect(getScaleTier(4.0)).toBe('massif');
    expect(getScaleTier(8.5)).toBe('massif');
    expect(getScaleTier(11.4)).toBe('massif');

    expect(getScaleTier(11.5)).toBe('sentier');
    expect(getScaleTier(14.5)).toBe('sentier');
    expect(getScaleTier(19.5)).toBe('sentier');
  });

  it('SCALE_PRESETS : contient les 3 presets d échelle Liquid Glass', () => {
    const presets: ScalePreset[] = ['ORBITE', 'MASSIF', 'SENTIER'];
    presets.forEach((p) => {
      expect(SCALE_PRESETS[p]).toBeDefined();
      expect(typeof SCALE_PRESETS[p].zoom).toBe('number');
      expect(typeof SCALE_PRESETS[p].pitch).toBe('number');
      expect(typeof SCALE_PRESETS[p].label).toBe('string');
    });

    expect(SCALE_PRESETS.ORBITE.zoom).toBeLessThan(4);
    expect(SCALE_PRESETS.ORBITE.pitch).toBe(0);

    expect(SCALE_PRESETS.MASSIF.zoom).toBeGreaterThanOrEqual(4);
    expect(SCALE_PRESETS.MASSIF.zoom).toBeLessThan(12);

    expect(SCALE_PRESETS.SENTIER.zoom).toBeGreaterThanOrEqual(12);
    expect(SCALE_PRESETS.SENTIER.pitch).toBeGreaterThanOrEqual(60);
  });

  it('GLOBE_SKY_CONFIG : inclut atmosphere-blend pour le ciel spatial', () => {
    expect(GLOBE_SKY_CONFIG['atmosphere-blend']).toBeGreaterThanOrEqual(0.7);
    expect(GLOBE_SKY_CONFIG['sky-color']).toBeDefined();
  });

  it('flyToScalePreset : appelle map.flyTo avec les paramètres cinématiques fluides', () => {
    const mockMap = {
      flyTo: vi.fn(),
    };

    flyToScalePreset(mockMap as any, 'ORBITE');
    expect(mockMap.flyTo).toHaveBeenCalledTimes(1);
    expect(mockMap.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: SCALE_PRESETS.ORBITE.zoom,
        pitch: SCALE_PRESETS.ORBITE.pitch,
        essential: true,
      })
    );

    flyToScalePreset(mockMap as any, 'SENTIER', [6.775, 45.873]);
    expect(mockMap.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [6.775, 45.873],
        zoom: SCALE_PRESETS.SENTIER.zoom,
        pitch: SCALE_PRESETS.SENTIER.pitch,
      })
    );
  });
});
