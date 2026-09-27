import { describe, expect, it } from 'vitest';

import {
  getPoiPopupPanCorrection,
  getPoiPopupPanOffset,
} from '../../src/components/map/engine/poiPopupPlacement';

describe('POI — placement du popup Liquid Glass dans la carte mobile', () => {
  it('ramène un popup sorti à gauche et sous le panneau dans la zone visible', () => {
    const correction = getPoiPopupPanCorrection(
      { x: 17, y: 218, width: 368, height: 650 },
      { x: -33, y: 588, width: 290, height: 168 },
      { top: 122, right: 12, bottom: 350, left: 12 }
    );

    const corrected = {
      x: -33 + correction.x,
      y: 588 + correction.y,
      width: 290,
      height: 168,
    };
    const mapRect = { x: 17, y: 218, width: 368, height: 650 };

    expect(corrected.x).toBeGreaterThanOrEqual(mapRect.x + 12);
    expect(corrected.x + corrected.width).toBeLessThanOrEqual(
      mapRect.x + mapRect.width - 12
    );
    expect(corrected.y).toBeGreaterThanOrEqual(mapRect.y + 122);
    expect(corrected.y + corrected.height).toBeLessThanOrEqual(
      mapRect.y + mapRect.height - 350
    );
  });

  it('laisse un popup déjà correctement placé sans déplacer la carte', () => {
    expect(
      getPoiPopupPanCorrection(
        { x: 10, y: 100, width: 400, height: 700 },
        { x: 70, y: 240, width: 280, height: 160 },
        { top: 80, right: 12, bottom: 300, left: 12 }
      )
    ).toEqual({ x: 0, y: 0 });
  });

  it('aligne à gauche un popup plus large que la zone disponible', () => {
    const correction = getPoiPopupPanCorrection(
      { x: 0, y: 0, width: 320, height: 480 },
      { x: 40, y: 100, width: 300, height: 160 },
      { top: 12, right: 12, bottom: 12, left: 12 }
    );

    expect(correction).toEqual({ x: -28, y: 0 });
  });

  it('convertit le déplacement écran en offset MapLibre avec le signe inverse', () => {
    expect(getPoiPopupPanOffset({ x: -40, y: -296.375 })).toEqual({
      x: 40,
      y: 296.375,
    });
  });
});
