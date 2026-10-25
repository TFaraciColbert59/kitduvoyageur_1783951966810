import { describe, it, expect } from 'vitest';
import {
  calculateBayesianRating,
  blurCoordinatesForSensitivity,
} from '@/features/places/engine/placeScoring';
import {
  createPlaceSchema,
  createPlaceReviewSchema,
} from '@/features/places/schemas/place.schema';

describe('Place Scoring Engine (Deterministic Bayesian + Proof of Work)', () => {
  it('returns 0.0 when there are no reviews', () => {
    expect(calculateBayesianRating([])).toBe(0.0);
  });

  it('computes Bayesian average with default prior (C=3, m=3.5) for standard reviews', () => {
    // 1 review of 5 stars: (3 * 3.5 + 5 * 1) / (3 + 1) = (10.5 + 5) / 4 = 15.5 / 4 = 3.875 -> 3.88
    const score = calculateBayesianRating([{ rating: 5, has_field_proof: false }]);
    expect(score).toBe(3.88);
  });

  it('weights certified field proof reviews x2', () => {
    // 1 review of 5 stars with field proof: (3 * 3.5 + 5 * 2) / (3 + 2) = (10.5 + 10) / 5 = 20.5 / 5 = 4.10
    const scoreWithProof = calculateBayesianRating([{ rating: 5, has_field_proof: true }]);
    expect(scoreWithProof).toBe(4.1);

    // Standard review gives 3.88, proof gives 4.10 -> field proof significantly boosts trust
    expect(scoreWithProof).toBeGreaterThan(3.88);
  });

  it('correctly aggregates multiple reviews with mixed proof status', () => {
    // 2 reviews: 5 (proof=true, weight=2) and 3 (proof=false, weight=1)
    // weighted sum = 5*2 + 3*1 = 13. total weight = 3.
    // bayesian = (3 * 3.5 + 13) / (3 + 3) = (10.5 + 13) / 6 = 23.5 / 6 = 3.916... -> 3.92
    const score = calculateBayesianRating([
      { rating: 5, has_field_proof: true },
      { rating: 3, has_field_proof: false },
    ]);
    expect(score).toBe(3.92);
  });

  it('clamps extreme ratings between 1 and 5', () => {
    const clampedHigh = calculateBayesianRating([{ rating: 10 }]);
    const normalFive = calculateBayesianRating([{ rating: 5 }]);
    expect(clampedHigh).toBe(normalFive);

    const clampedLow = calculateBayesianRating([{ rating: -2 }]);
    const normalOne = calculateBayesianRating([{ rating: 1 }]);
    expect(clampedLow).toBe(normalOne);
  });

  it('guarantees ZERO monetary or sponsored terms in scoring (Invariant CI 2)', () => {
    // BayesianRatingInput has no price, tier, sponsored or affiliate fields
    const fnString = calculateBayesianRating.toString();
    expect(fnString).not.toMatch(/price|cost|monet|affiliate|sponsor|paid/i);
  });
});

describe('Ethical GPS Blurring (Physical & Environmental Safety)', () => {
  const montBlancBivouacLat = 45.832621;
  const montBlancBivouacLon = 6.865184;

  it('keeps exact coordinates for standard sensitivity', () => {
    const result = blurCoordinatesForSensitivity(
      montBlancBivouacLat,
      montBlancBivouacLon,
      'standard'
    );
    expect(result.latitude).toBe(montBlancBivouacLat);
    expect(result.longitude).toBe(montBlancBivouacLon);
    expect(result.isBlurred).toBe(false);
    expect(result.blurRadiusMeters).toBe(0);
  });

  it('blurs sensitive places to 2 decimal places (~500m radius)', () => {
    const result = blurCoordinatesForSensitivity(
      montBlancBivouacLat,
      montBlancBivouacLon,
      'sensitive'
    );
    expect(result.latitude).toBe(45.83);
    expect(result.longitude).toBe(6.87);
    expect(result.isBlurred).toBe(true);
    expect(result.blurRadiusMeters).toBe(500);
  });

  it('blurs protected places to 1 decimal place (~5000m radius)', () => {
    const result = blurCoordinatesForSensitivity(
      montBlancBivouacLat,
      montBlancBivouacLon,
      'protected'
    );
    expect(result.latitude).toBe(45.8);
    expect(result.longitude).toBe(6.9);
    expect(result.isBlurred).toBe(true);
    expect(result.blurRadiusMeters).toBe(5000);
  });

  it('bypasses blurring when user is authorized admin/ranger', () => {
    const result = blurCoordinatesForSensitivity(
      montBlancBivouacLat,
      montBlancBivouacLon,
      'protected',
      true
    );
    expect(result.latitude).toBe(montBlancBivouacLat);
    expect(result.longitude).toBe(montBlancBivouacLon);
    expect(result.isBlurred).toBe(false);
  });
});

describe('Places Zod Schemas', () => {
  it('validates a correct place creation payload', () => {
    const valid = createPlaceSchema.safeParse({
      name: 'Refuge des Cosmiques',
      slug: 'refuge-des-cosmiques',
      category: 'refuge',
      country_code: 'FR',
      latitude: 45.8732,
      longitude: 6.8834,
      altitude_m: 3613,
      sensitivity: 'standard',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects invalid category or bad slug', () => {
    const invalidCategory = createPlaceSchema.safeParse({
      name: 'Hôtel Luxe',
      slug: 'hotel-luxe',
      category: 'hotel_resort' as any,
      country_code: 'FR',
      latitude: 45.0,
      longitude: 6.0,
    });
    expect(invalidCategory.success).toBe(false);

    const invalidSlug = createPlaceSchema.safeParse({
      name: 'Test',
      slug: 'Refuge Cosmiques avec Espaces',
      category: 'refuge',
      country_code: 'FR',
      latitude: 45.0,
      longitude: 6.0,
    });
    expect(invalidSlug.success).toBe(false);
  });

  it('validates place reviews with field proof flag', () => {
    const validReview = createPlaceReviewSchema.safeParse({
      place_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      rating: 5,
      comment: 'Superbe accueil des gardiens, eau potable disponible et vue magistrale.',
      has_field_proof: true,
      visit_date: '2026-08-15',
    });
    expect(validReview.success).toBe(true);
  });
});
