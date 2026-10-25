import { describe, it, expect } from 'vitest';
import { SECTORS } from '@/app/carte-3d/Carte3D';

describe('Carte 3D — Stack Hybride LKDV IGN 3D', () => {
  it('définit les 3 secteurs canoniques avec coordonnées et sentiers valides', () => {
    expect(SECTORS.TMB_CHAMONIX).toBeDefined();
    expect(SECTORS.MONT_SAINT_MICHEL).toBeDefined();
    expect(SECTORS.GR20_BAVELLA).toBeDefined();

    // Massif du Mont-Blanc
    expect(SECTORS.TMB_CHAMONIX.center).toEqual([6.775, 45.873]);
    expect(SECTORS.TMB_CHAMONIX.baseEle).toBe(1490);
    expect(SECTORS.TMB_CHAMONIX.trail.length).toBeGreaterThanOrEqual(5);

    // Mont-Saint-Michel
    expect(SECTORS.MONT_SAINT_MICHEL.center).toEqual([-1.5114, 48.636]);
    expect(SECTORS.MONT_SAINT_MICHEL.baseEle).toBe(15);
    expect(SECTORS.MONT_SAINT_MICHEL.trail.length).toBeGreaterThanOrEqual(4);

    // Corse Bavella
    expect(SECTORS.GR20_BAVELLA.center).toEqual([9.225, 41.7955]);
    expect(SECTORS.GR20_BAVELLA.baseEle).toBe(1218);
    expect(SECTORS.GR20_BAVELLA.trail.length).toBeGreaterThanOrEqual(4);
  });

  it('valide la cohérence altimétrique et de distance des sentiers', () => {
    Object.values(SECTORS).forEach((sec) => {
      expect(sec.totalDistKm).toBeGreaterThan(0);
      sec.trail.forEach((point) => {
        expect(point.lng).toBeTypeOf('number');
        expect(point.lat).toBeTypeOf('number');
        expect(point.ele).toBeTypeOf('number');
        expect(point.dist).toBeTypeOf('number');
        expect(point.slope).toBeTypeOf('number');
      });
    });
  });
});
