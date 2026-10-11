import { describe, expect, it } from 'vitest';
import { covers, parseCircle, parsePolygon, type CapGeometry } from '../engine/capGeometry';

/**
 * Contours au format CAP des flux Meteoalarm (relu le 2026-10-10) :
 * « lat,lon lat,lon … », premier point répété à la fin.
 */
const CARRE = '46.0,7.0 46.0,8.0 47.0,8.0 47.0,7.0 46.0,7.0';

describe('parsePolygon', () => {
  it('lit « lat,lon » et garde la boîte englobante', () => {
    const ring = parsePolygon(CARRE);
    expect(ring).not.toBeNull();
    expect(ring?.bbox).toEqual([46, 7, 47, 8]);
    expect(ring?.pts).toHaveLength(10);
  });

  it('écarte un contour illisible, trop court ou hors du globe', () => {
    expect(parsePolygon('')).toBeNull();
    expect(parsePolygon('46.0,7.0 46.0,8.0')).toBeNull();
    expect(parsePolygon('a,b c,d e,f g,h')).toBeNull();
    expect(parsePolygon('95.0,7.0 46.0,8.0 47.0,8.0 47.0,7.0')).toBeNull();
    expect(parsePolygon(42 as unknown as string)).toBeNull();
  });
});

describe('parseCircle', () => {
  it('lit « lat,lon rayon » en kilomètres', () => {
    expect(parseCircle('46.5,7.5 10')).toEqual({ lat: 46.5, lon: 7.5, km: 10 });
    expect(parseCircle('46.5,7.5')).toBeNull();
    expect(parseCircle('46.5,7.5 -3')).toBeNull();
  });
});

describe('covers', () => {
  const geo: CapGeometry = { rings: [parsePolygon(CARRE)!], circles: [] };

  it('dedans, dehors, et hors de la boîte englobante', () => {
    expect(covers(geo, 46.5, 7.5)).toBe(true);
    expect(covers(geo, 45.9, 7.5)).toBe(false);
    expect(covers(geo, 46.5, 8.5)).toBe(false);
    // Dans la boîte mais pas dans un triangle : le test de contour tranche.
    const triangle: CapGeometry = {
      rings: [parsePolygon('46.0,7.0 46.0,8.0 47.0,7.0 46.0,7.0')!],
      circles: [],
    };
    expect(covers(triangle, 46.2, 7.2)).toBe(true);
    expect(covers(triangle, 46.9, 7.9)).toBe(false);
  });

  it('un cercle couvre ce qui est à moins de son rayon', () => {
    const disc: CapGeometry = { rings: [], circles: [{ lat: 46.5, lon: 7.5, km: 10 }] };
    expect(covers(disc, 46.52, 7.52)).toBe(true);
    expect(covers(disc, 46.8, 7.5)).toBe(false);
  });

  it('plusieurs contours : un seul suffit', () => {
    const two: CapGeometry = {
      rings: [parsePolygon(CARRE)!, parsePolygon('10.0,10.0 10.0,11.0 11.0,11.0 11.0,10.0')!],
      circles: [],
    };
    expect(covers(two, 10.5, 10.5)).toBe(true);
    expect(covers(two, 30, 30)).toBe(false);
  });
});
