import { describe, it, expect } from 'vitest';
import {
  collectiveEligibility,
  ELIGIBILITY_REASONS,
  ELIGIBILITY_THRESHOLDS,
  type EligibilityInput,
} from '@/features/adventure-intelligence/domain/collectiveEligibility';

function input(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    consentCollective: true,
    sessionFinished: true,
    gpsQuality: 0.9,
    mapMatchQuality: 0.8,
    plausibleMovement: true,
    passageQuality: 0.7,
    ...overrides,
  };
}

describe('Éligibilité collective — TEST-A4-ELIG', () => {
  it('TEST-A4-ELIG-01: le consentement collectif est requis', () => {
    expect(collectiveEligibility(input({ consentCollective: false }))).toEqual({
      eligible: false,
      reasons: [ELIGIBILITY_REASONS.consent],
    });

    const granted = collectiveEligibility(input());
    expect(granted).toEqual({ eligible: true, reasons: [] });
  });

  it('TEST-A4-ELIG-02: la session doit être terminée', () => {
    expect(collectiveEligibility(input({ sessionFinished: false }))).toEqual({
      eligible: false,
      reasons: [ELIGIBILITY_REASONS.session],
    });
  });

  it('TEST-A4-ELIG-03: qualités GPS, map-matching et passage minimales', () => {
    expect(ELIGIBILITY_THRESHOLDS).toEqual({
      gpsQuality: 0.6,
      mapMatchQuality: 0.6,
      passageQuality: 0.5,
    });

    expect(
      collectiveEligibility(input({ gpsQuality: ELIGIBILITY_THRESHOLDS.gpsQuality - 0.01 })).eligible
    ).toBe(false);
    expect(
      collectiveEligibility(input({ gpsQuality: ELIGIBILITY_THRESHOLDS.gpsQuality })).eligible
    ).toBe(true);

    expect(
      collectiveEligibility(
        input({ mapMatchQuality: ELIGIBILITY_THRESHOLDS.mapMatchQuality - 0.01 })
      ).eligible
    ).toBe(false);
    expect(
      collectiveEligibility(
        input({ mapMatchQuality: ELIGIBILITY_THRESHOLDS.mapMatchQuality })
      ).eligible
    ).toBe(true);

    expect(
      collectiveEligibility(
        input({ passageQuality: ELIGIBILITY_THRESHOLDS.passageQuality - 0.01 })
      ).eligible
    ).toBe(false);
    expect(
      collectiveEligibility(input({ passageQuality: ELIGIBILITY_THRESHOLDS.passageQuality })).eligible
    ).toBe(true);

    // Qualité non finie ⇒ refus prudente.
    expect(collectiveEligibility(input({ gpsQuality: Number.NaN })).eligible).toBe(false);
  });

  it('TEST-A4-ELIG-04: un déplacement non plausible est refusé', () => {
    expect(collectiveEligibility(input({ plausibleMovement: false }))).toEqual({
      eligible: false,
      reasons: [ELIGIBILITY_REASONS.movement],
    });
  });

  it('TEST-A4-ELIG-05: chaque refus produit une raison explicite et ordonnée', () => {
    const result = collectiveEligibility({
      consentCollective: false,
      sessionFinished: false,
      gpsQuality: 0.2,
      mapMatchQuality: 0.1,
      plausibleMovement: false,
      passageQuality: 0.1,
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual([
      ELIGIBILITY_REASONS.consent,
      ELIGIBILITY_REASONS.session,
      ELIGIBILITY_REASONS.gps,
      ELIGIBILITY_REASONS.mapMatch,
      ELIGIBILITY_REASONS.movement,
      ELIGIBILITY_REASONS.passage,
    ]);

    const partial = collectiveEligibility(
      input({ mapMatchQuality: 0.3, passageQuality: 0.2 })
    );
    expect(partial.reasons).toEqual([
      ELIGIBILITY_REASONS.mapMatch,
      ELIGIBILITY_REASONS.passage,
    ]);
  });
});
