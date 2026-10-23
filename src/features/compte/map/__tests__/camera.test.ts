import { describe, expect, it } from 'vitest';
import { cameraForScale, paddingForViewport } from '../camera';

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
