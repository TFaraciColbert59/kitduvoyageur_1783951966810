import { describe, it, expect } from 'vitest';
import {
  cohortBucket,
  cohortBucketFromSha256Hex,
  evaluateUserFlag,
  normalizePercentage,
  type FlagCohortConfig,
} from '@/features/adventure-intelligence/domain/flagRollout';

/** SHA-256 de la chaîne « a » (vecteur figé, formulaire SQL identique). */
const SHA256_A = 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb';
/** SHA-256 de la chaîne « utilisateur-a ». */
const SHA256_USER_A = '4ae63cb628c6ef61ac6bb8774d658fdcfe24f526b46bdc55ee58c18a2a455a96';

const USER = 'utilisateur-test';

function config(overrides: Partial<FlagCohortConfig> = {}): FlagCohortConfig {
  return { enabled: true, percentage: 50, allowlist: [], exclusions: [], ...overrides };
}

describe('A11 — cohortes de rollout (TEST-A11-ROLL)', () => {
  it('TEST-A11-ROLL-01: bucket stable et déterministe depuis le SHA-256 de l’utilisateur', async () => {
    expect(cohortBucketFromSha256Hex(SHA256_A)).toBe(10);
    expect(cohortBucketFromSha256Hex(SHA256_USER_A)).toBe(6);
    expect(cohortBucketFromSha256Hex(SHA256_A)).toBe(cohortBucketFromSha256Hex(SHA256_A));
    expect(cohortBucketFromSha256Hex(SHA256_USER_A.toUpperCase())).toBe(6);

    expect(await cohortBucket('a')).toBe(10);
    expect(await cohortBucket('a')).toBe(await cohortBucket('a'));
    expect(await cohortBucket('utilisateur-a')).toBe(6);
    await expect(cohortBucket('')).rejects.toThrow(/userId requis/);
  });

  it('TEST-A11-ROLL-02: bucket toujours dans 0..99, empreinte invalide refusée', () => {
    expect(() => cohortBucketFromSha256Hex('abc')).toThrow(/SHA-256 hex 64/);
    expect(() => cohortBucketFromSha256Hex('z'.repeat(64))).toThrow(/SHA-256 hex 64/);

    for (let value = 0; value < 500; value += 1) {
      const hex = value.toString(16).padStart(64, '0');
      const bucket = cohortBucketFromSha256Hex(hex);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(100);
      expect(Number.isInteger(bucket)).toBe(true);
    }
  });

  it('TEST-A11-ROLL-03: l’allowlist active même à 0 % et prime sur l’exclusion', () => {
    const base = config({ percentage: 0, allowlist: [USER], exclusions: [USER] });
    expect(evaluateUserFlag(base, USER, 99)).toBe(true);
    expect(evaluateUserFlag(base, 'autre', 0)).toBe(false);

    expect(
      evaluateUserFlag(config({ percentage: 100, exclusions: [USER] }), USER, 0)
    ).toBe(false);
  });

  it('TEST-A11-ROLL-04: les exclusions bloquent même à 100 % et bucket 0', () => {
    const excluded = config({ percentage: 100, exclusions: [USER] });
    expect(evaluateUserFlag(excluded, USER, 0)).toBe(false);
    expect(evaluateUserFlag(excluded, 'autre', 99)).toBe(true);
  });

  it('TEST-A11-ROLL-05: bords de pourcentage 0 et 100', () => {
    expect(evaluateUserFlag(config({ percentage: 0 }), USER, 0)).toBe(false);
    expect(evaluateUserFlag(config({ percentage: 100 }), USER, 99)).toBe(true);
    expect(evaluateUserFlag(config({ percentage: 60 }), USER, 59)).toBe(true);
    expect(evaluateUserFlag(config({ percentage: 60 }), USER, 60)).toBe(false);
    expect(evaluateUserFlag(config({ percentage: 60 }), USER, Number.NaN)).toBe(false);

    expect(normalizePercentage(-5)).toBe(0);
    expect(normalizePercentage(150)).toBe(100);
    expect(normalizePercentage(Number.NaN)).toBe(0);
    expect(normalizePercentage(49.9)).toBe(49);
  });

  it('TEST-A11-ROLL-06: flag désactivé ou utilisateur vide ⇒ jamais activé', () => {
    expect(evaluateUserFlag(config({ enabled: false, allowlist: [USER] }), USER, 0)).toBe(false);
    expect(evaluateUserFlag(config({ percentage: 100 }), '', 0)).toBe(false);
    expect(evaluateUserFlag(config({ percentage: 100 }), '   ', 0)).toBe(false);
  });
});
