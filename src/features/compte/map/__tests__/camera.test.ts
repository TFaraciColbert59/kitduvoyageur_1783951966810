import { describe, expect, it } from 'vitest';
import { cameraForScale, fitIntentForMode, paddingForViewport } from '../camera';

describe('cameraForScale', () => {
  it('globe : pitch 0', () => {
    expect(cameraForScale('globe', { lng: 6.8, lat: 45.9 }).pitch).toBe(0);
  });
  it('massif : pitch 30', () => {
    expect(cameraForScale('massif', { lng: 6.8, lat: 45.9 }).pitch).toBe(30);
  });
  it('sentier : pitch 55', () => {
    expect(cameraForScale('sentier', { lng: 6.8, lat: 45.9 }).pitch).toBe(55);
  });
});

describe('paddingForViewport', () => {
  it('ajoute la barre du bas et la capsule', () => {
    expect(
      paddingForViewport({ width: 430, height: 335 }, { sheetOpen: false, mapbig: false })
    ).toEqual({ top: 64, bottom: 76, left: 16, right: 16 });
  });
  it('plein écran : tient compte du haut et de la barre', () => {
    expect(
      paddingForViewport({ width: 430, height: 932 }, { sheetOpen: false, mapbig: true })
    ).toEqual({ top: 100, bottom: 84, left: 16, right: 16 });
  });
});

describe('fitIntentForMode', () => {
  const data = {
    tracks: [
      { id: 'latest', bounds: [6.8, 45.9, 6.9, 46.0] },
      { id: 'older', bounds: [-1, 42, 0, 43] },
    ],
    massifs: [],
    carnets: [],
    pois: [],
    stats: { outings: 2, km: 20, dplus: 1000, massifs: 0, countries: 1 },
    bounds: [-1, 42, 6.9, 46],
    truncated: false,
    generatedAt: 'x',
  } as never;

  it('overview ouvre sur la sortie la plus récente', () => {
    expect(fitIntentForMode('overview', data, null)).toEqual({
      bounds: [6.8, 45.9, 6.9, 46.0],
      maxZoom: 13,
    });
  });

  it('prêts ne cadrent rien', () => {
    expect(fitIntentForMode('prets', data, null)).toBeNull();
  });
});
