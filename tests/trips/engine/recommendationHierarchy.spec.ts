import { describe, it, expect } from 'vitest';
import { generateTripContextualKit } from '@/features/trips/engine/contextualKitEngine';

describe('Sous-phase 1.5 (D7) — Hiérarchie des recommandations (TDD)', () => {
  it('TEST-HIERARCHY-01: Plafond dur — Maximum 2 recommandations vitales / safety_critical par voyage', () => {
    // Voyage extrême en haute montagne et hiver avec 0 items dans le sac
    const analysis = generateTripContextualKit({
      countryCode: 'FR',
      durationDays: 10,
      seasonMonth: 1, // Janvier (hiver)
      elevationProfile: {
        maxM: 3800,
        minM: 1000,
        gainM: 5000,
        source: 'stages',
        confidence: 'high',
      },
      currentItems: [],
    });

    // Invariant D7 : JAMAIS plus de 2 recommandations vitales
    expect(analysis.vitalGaps.length).toBeLessThanOrEqual(2);
    expect(analysis.vitalGaps.length).toBeGreaterThan(0);
  });

  it('TEST-HIERARCHY-02: Voyage plaine été -> 0 safety_critical si équipement de base sécurisé, ou <= 2 maximum', () => {
    const analysis = generateTripContextualKit({
      countryCode: 'FR',
      durationDays: 2,
      seasonMonth: 7, // Juillet (été doux)
      elevationProfile: {
        maxM: 300,
        minM: 50,
        gainM: 200,
        source: 'stages',
        confidence: 'high',
      },
      currentItems: [],
    });

    // En plaine l'été, le plafond de 2 est scrupuleusement respecté
    expect(analysis.vitalGaps.length).toBeLessThanOrEqual(2);
  });

  it('TEST-HIERARCHY-03: Justification obligatoire non vide pour toute recommandation vitale', () => {
    const analysis = generateTripContextualKit({
      countryCode: 'NP',
      durationDays: 14,
      seasonMonth: 11,
      elevationProfile: {
        maxM: 5416,
        minM: 1200,
        gainM: 9000,
        source: 'stages',
        confidence: 'high',
      },
      currentItems: [],
    });

    for (const rec of analysis.vitalGaps) {
      expect(rec.reason).toBeDefined();
      expect(rec.reason.trim().length).toBeGreaterThan(10);
    }
  });
});
