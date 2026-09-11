import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SHADOW_TOLERANCE_PCT,
  SHADOW_FLAGS,
  compareShadow,
  summarizeShadow,
  type ShadowComparison,
} from '@/features/adventure-intelligence/domain/shadowMode';

describe('A9 — shadow mode (TEST-A9-SH)', () => {
  it('TEST-A9-SH-01: l’accord dépend de la tolérance, 15 % par défaut', () => {
    expect(DEFAULT_SHADOW_TOLERANCE_PCT).toBe(15);

    const within = compareShadow({ primary: 100, shadow: 114 });
    expect(within.deltaPct).toBeCloseTo(14, 5);
    expect(within.agreement).toBe(true);

    const beyond = compareShadow({ primary: 100, shadow: 116 });
    expect(beyond.deltaPct).toBeCloseTo(16, 5);
    expect(beyond.agreement).toBe(false);

    const widened = compareShadow({ primary: 100, shadow: 116, tolerancePct: 20 });
    expect(widened.agreement).toBe(true);

    const negative = compareShadow({ primary: 100, shadow: 80 });
    expect(negative.deltaPct).toBeCloseTo(-20, 5);
    expect(negative.agreement).toBe(false);

    const negativeWidened = compareShadow({ primary: 100, shadow: 80, tolerancePct: 25 });
    expect(negativeWidened.agreement).toBe(true);

    expect(SHADOW_FLAGS).toEqual([
      'performance_profile_v2_shadow',
      'route_prediction_v2_shadow',
      'collective_intelligence_shadow',
      'terrain_auto_detection_shadow',
    ]);
  });

  it('TEST-A9-SH-02: une donnée manquante donne un delta null et aucun accord', () => {
    const missingShadow = compareShadow({ primary: 100, shadow: null });
    expect(missingShadow).toEqual({
      primary: 100,
      shadow: null,
      deltaPct: null,
      agreement: false,
    });

    const missingPrimary = compareShadow({ primary: null, shadow: 90 });
    expect(missingPrimary).toEqual({
      primary: null,
      shadow: 90,
      deltaPct: null,
      agreement: false,
    });

    const bothMissing = compareShadow({ primary: null, shadow: null });
    expect(bothMissing).toEqual({
      primary: null,
      shadow: null,
      deltaPct: null,
      agreement: false,
    });
  });

  it('TEST-A9-SH-03: le résumé calcule le taux d’accord et la médiane des deltas non nuls', () => {
    const comparisons: ShadowComparison[] = [
      compareShadow({ primary: 100, shadow: 105 }),
      compareShadow({ primary: 100, shadow: 90 }),
      compareShadow({ primary: 100, shadow: 130 }),
      compareShadow({ primary: null, shadow: 50 }),
      compareShadow({ primary: 40, shadow: null }),
    ];

    const summary = summarizeShadow(comparisons);
    expect(summary.count).toBe(5);
    expect(summary.agreementRate).toBeCloseTo(2 / 5, 5);
    expect(summary.medianDeltaPct).toBeCloseTo(5, 5);

    const empty = summarizeShadow([]);
    expect(empty.count).toBe(0);
    expect(empty.agreementRate).toBe(0);
    expect(empty.medianDeltaPct).toBeNull();
    expect(Number.isNaN(empty.agreementRate)).toBe(false);
  });

  it('TEST-A9-SH-04: la comparaison est pure et ne modifie jamais ses entrées', () => {
    const input = Object.freeze({ primary: 100, shadow: 112 });
    const first = compareShadow(input);
    expect(first).toEqual({ primary: 100, shadow: 112, deltaPct: 12, agreement: true });
    expect(input).toEqual({ primary: 100, shadow: 112 });

    const comparisons = Object.freeze([
      Object.freeze(compareShadow({ primary: 100, shadow: 110 })),
      Object.freeze(compareShadow({ primary: 80, shadow: 100 })),
    ]);
    const snapshot = JSON.stringify(comparisons);
    const summary = summarizeShadow([...comparisons]);
    expect(summary.count).toBe(2);
    expect(summary.agreementRate).toBeCloseTo(0.5, 5);
    expect(JSON.stringify(comparisons)).toBe(snapshot);

    const second = compareShadow(input);
    expect(second).toEqual(first);
  });
});
