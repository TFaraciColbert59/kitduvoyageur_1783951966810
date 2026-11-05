import { describe, expect, it } from 'vitest';
import {
  QualityGovernor,
  SAMPLE_WINDOW_FRAMES,
} from '../scene/quality';

describe('QualityGovernor (Lot L5-2 / C-19 / D-24)', () => {
  it('C-19 : dégrade automatiquement dans l ordre exact DPR 2 -> DPR 1.5 -> sans ombres -> sans post -> LOD bas -> Liste', () => {
    const gov = new QualityGovernor();

    // Palier 0 : HIGH
    expect(gov.getProfile()).toMatchObject({
      tier: 'HIGH',
      maxDpr: 2.0,
      shadowsEnabled: true,
      postProcessingEnabled: true,
      lod: 'high',
      degradedToList: false,
    });
    expect(gov.resolveEffectiveDpr(3)).toBe(2.0);

    const feedSlowWindow = () => {
      let last = gov.getProfile();
      for (let i = 0; i < SAMPLE_WINDOW_FRAMES; i++) {
        last = gov.recordFrameTime(45).profile; // ~22 FPS (p95 > 34 ms)
      }
      return last;
    };

    // Palier 1 : DPR plafonné à 1.5
    expect(feedSlowWindow()).toMatchObject({
      tier: 'DPR_1_5',
      maxDpr: 1.5,
      shadowsEnabled: true,
      postProcessingEnabled: true,
      lod: 'high',
      degradedToList: false,
    });
    expect(gov.resolveEffectiveDpr(3)).toBe(1.5);

    // Palier 2 : Ombres désactivées
    expect(feedSlowWindow()).toMatchObject({
      tier: 'NO_SHADOWS',
      maxDpr: 1.5,
      shadowsEnabled: false,
      postProcessingEnabled: true,
      lod: 'high',
      degradedToList: false,
    });

    // Palier 3 : Post-traitement désactivé
    expect(feedSlowWindow()).toMatchObject({
      tier: 'NO_POST',
      maxDpr: 1.5,
      shadowsEnabled: false,
      postProcessingEnabled: false,
      lod: 'high',
      degradedToList: false,
    });

    // Palier 4 : LOD inférieur
    expect(feedSlowWindow()).toMatchObject({
      tier: 'LOW_LOD',
      maxDpr: 1.5,
      shadowsEnabled: false,
      postProcessingEnabled: false,
      lod: 'low',
      degradedToList: false,
    });

    // Palier 5 : Bascule DEGRADED -> Mode Liste
    expect(feedSlowWindow()).toMatchObject({
      tier: 'DEGRADED',
      degradedToList: true,
    });
  });

  it('D-24 : coupe l ambiance en tout premier sur batterie faible (<= 20 % hors charge) sans dégrader immédiatement la 3D', () => {
    const gov = new QualityGovernor();
    expect(gov.getProfile().ambienceEnabled).toBe(true);
    expect(gov.getProfile().tier).toBe('HIGH');

    const lowBatteryProfile = gov.setBatteryStatus({ level: 0.18, charging: false });
    expect(lowBatteryProfile.ambienceEnabled).toBe(false);
    expect(lowBatteryProfile.tier).toBe('HIGH');
    expect(lowBatteryProfile.degradedToList).toBe(false);

    // Rebranché sur secteur : l'ambiance redevient autorisée au palier HIGH
    const chargingProfile = gov.setBatteryStatus({ level: 0.18, charging: true });
    expect(chargingProfile.ambienceEnabled).toBe(true);
  });
});
