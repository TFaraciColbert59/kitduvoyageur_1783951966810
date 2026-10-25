import { describe, it, expect } from 'vitest';
import {
  calculateBearing,
  lerp,
  lerpAngleDeg,
  calculateDynamicPitch,
  SECTORS,
} from '@/app/carte-3d/Carte3D';

describe('Carte 3D — Cinematic Camera Engine Math & 3-DOF Dynamic Tracking', () => {
  it('lerp : effectue une interpolation linéaire exacte', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.5)).toBe(15);
    expect(lerp(100, 200, 0.25)).toBe(125);
  });

  it('lerpAngleDeg : effectue une interpolation angulaire sur le chemin le plus court (évite les sauts 359° -> 0°)', () => {
    // Cas classique
    expect(lerpAngleDeg(10, 30, 0.5)).toBe(20);

    // Franchissement du méridien nord (350° vers 10°) : chemin le plus court = +20°
    const midCross = lerpAngleDeg(350, 10, 0.5);
    expect(midCross).toBe(0); // 350 + 10 = 360 = 0°

    // Cas inverse (10° vers 350°) : chemin le plus court = -20°
    const midBack = lerpAngleDeg(10, 350, 0.5);
    expect(midBack).toBe(0);

    // 180° à l'opposé
    const step = lerpAngleDeg(0, 90, 0.2);
    expect(step).toBeCloseTo(18, 1);
  });

  it('calculateBearing : calcule le cap trigonométrique précis en degrés', () => {
    // Plein Est : même latitude, longitude croissante
    const east = calculateBearing(45.0, 6.0, 45.0, 7.0);
    expect(east).toBeCloseTo(90, 0);

    // Plein Nord : latitude croissante, même longitude
    const north = calculateBearing(45.0, 6.0, 46.0, 6.0);
    expect(north).toBeCloseTo(0, 0);

    // Plein Ouest : longitude décroissante
    const west = calculateBearing(45.0, 7.0, 45.0, 6.0);
    expect(west).toBeCloseTo(270, 0);

    // Plein Sud : latitude décroissante
    const south = calculateBearing(46.0, 6.0, 45.0, 6.0);
    expect(south).toBeCloseTo(180, 0);
  });

  it('calculateDynamicPitch : ajuste dynamiquement l’assiette (3-DOF) selon la pente du sentier', () => {
    const basePitch = 68;

    // Pente plate (0%) : conserve le pitch de base
    expect(calculateDynamicPitch(basePitch, 0)).toBe(basePitch);

    // Montée raide (+20%) : la caméra penche vers l'avant pour cadrer la montée
    const uphillPitch = calculateDynamicPitch(basePitch, 20);
    expect(uphillPitch).toBeGreaterThan(basePitch);
    expect(uphillPitch).toBe(68 + Math.min(10, 20 * 0.35)); // 68 + 7 = 75°

    // Descente (-20%) : la caméra relève son champ de vision pour ouvrir l'horizon
    const downhillPitch = calculateDynamicPitch(basePitch, -20);
    expect(downhillPitch).toBeLessThan(basePitch);
    expect(downhillPitch).toBe(68 - Math.min(12, 20 * 0.35)); // 68 - 7 = 61°

    // Clamping de sécurité (ne dépasse pas 84° ni en dessous de 45°)
    expect(calculateDynamicPitch(80, 50)).toBeLessThanOrEqual(84);
    expect(calculateDynamicPitch(50, -50)).toBeGreaterThanOrEqual(45);
  });

  it('les coordonnées des sentiers permettent des calculs de cap valides sur tous les secteurs', () => {
    Object.values(SECTORS).forEach((sector) => {
      for (let i = 0; i < sector.trail.length - 1; i++) {
        const p1 = sector.trail[i];
        const p2 = sector.trail[i + 1];
        const b = calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(360);
      }
    });
  });
});
