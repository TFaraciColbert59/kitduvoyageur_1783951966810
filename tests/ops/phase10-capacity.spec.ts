import { describe, it, expect } from 'vitest';
import {
  CAPACITY_PROFILES,
  MIX_WEIGHTS,
  evaluateCapacityRun,
  isRepresentative,
  pickWorkload,
  planCapacityRun,
} from '../../scripts/ops/phase10_capacity.mjs';

const HEALTHY_SUMMARY = {
  count: 5000,
  p95Ms: 142,
  errors: 0,
  status5xx: 0,
};

describe('Phase 10 — capacité locale (TEST-P10-CAP)', () => {
  it('TEST-P10-CAP-01: profils 100/1 000/10 000 versionnés, 10k explicitement non représentatif', () => {
    expect(Object.keys(CAPACITY_PROFILES)).toEqual(['100', '1000', '10000']);
    expect(CAPACITY_PROFILES[100].representative).toBe(true);
    expect(CAPACITY_PROFILES[1000].representative).toBe(true);
    expect(CAPACITY_PROFILES[10000].representative).toBe(false);
    expect(CAPACITY_PROFILES[10000].note).toContain('item humain');
    expect(isRepresentative(1000)).toBe(true);
    expect(isRepresentative(10000)).toBe(false);
  });

  it('TEST-P10-CAP-02: planification bornée + profil 10k refusé sans opt-in explicite', () => {
    const plan = planCapacityRun(1000, { durationSeconds: 5, concurrency: 12 });
    expect(plan).toMatchObject({
      users: 1000,
      representative: true,
      concurrency: 12,
      durationSeconds: 5,
    });

    expect(() => planCapacityRun(10000)).toThrow(/item humain/i);
    const exploratory = planCapacityRun(10000, { allow10k: true });
    expect(exploratory.representative).toBe(false);
    expect(exploratory.requestedConcurrency).toBe(200);
    expect(exploratory.concurrency).toBe(50);
    expect(exploratory.concurrencyCapped).toBe(true);
    expect(planCapacityRun(1000).concurrencyCapped).toBe(false);
    expect(() => planCapacityRun(42)).toThrow(/profil inconnu/);
  });

  it('TEST-P10-CAP-03: charge mixte déterministe (5 plan / 3 proximité / 2 flags)', () => {
    const sequence = Array.from({ length: 10 }, (_, index) => pickWorkload(index));
    expect(sequence.filter((kind) => kind === 'plan_read')).toHaveLength(5);
    expect(sequence.filter((kind) => kind === 'proximity')).toHaveLength(3);
    expect(sequence.filter((kind) => kind === 'feature_flags')).toHaveLength(2);
    expect(pickWorkload(10)).toBe(pickWorkload(0));
    expect(MIX_WEIGHTS.map((item) => item.kind)).toContain('plan_read');
  });

  it('TEST-P10-CAP-04: évaluation locale — pass sous seuils, fail au-dessus', () => {
    const profile = planCapacityRun(100);
    expect(evaluateCapacityRun(profile, HEALTHY_SUMMARY).verdict).toBe('pass');

    const slow = evaluateCapacityRun(profile, { ...HEALTHY_SUMMARY, p95Ms: 301 });
    expect(slow.verdict).toBe('fail');
    expect(slow.failures[0]).toContain('p95 301 ms > 300 ms');

    const errors = evaluateCapacityRun(profile, { ...HEALTHY_SUMMARY, errors: 2 });
    expect(errors.verdict).toBe('fail');

    const small = evaluateCapacityRun(profile, { ...HEALTHY_SUMMARY, count: 10 });
    expect(small.verdict).toBe('inconclusive');
  });

  it('TEST-P10-CAP-05: 10 000 ⇒ inconclusive même si les chiffres paraissent bons (jamais un PASS)', () => {
    const profile = planCapacityRun(10000, { allow10k: true });
    const evaluation = evaluateCapacityRun(profile, HEALTHY_SUMMARY);

    expect(evaluation.verdict).toBe('inconclusive');
    expect(evaluation.reasons.join(' ')).toContain('item humain');
    expect(evaluation.reasons.join(' ')).toContain('plafonnée');
    expect(evaluation.failures).toEqual([]);
  });
});
