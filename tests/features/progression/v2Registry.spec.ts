import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEVEL_TIERS, validateAndDistributeSkillPoints } from '../../../src/features/progression/domain/rules';
// The verification CLI is also a pure, read-only module for adversarial checks.
import { parseEconomy, parseLegacyProducerKeys, verifyRegistry as verifyRegistryWithHooks } from '../../../scripts/verify/progression-v2-registry.mjs';

const economy = readFileSync('docs/progression/2.0/economie.md', 'utf8');
const producers = readFileSync('src/features/progression/server/awardProducer.ts', 'utf8');
const hooks = readFileSync('src/features/progression/server/producerHooks.ts', 'utf8');
const original = JSON.parse(readFileSync('docs/progression/2.0/rules-registry.json', 'utf8'));
const ruleCases: Array<{ id: string; index: number }> = original.rules.map((rule: { id: string }, index: number) => ({ id: rule.id, index }));
const verifyRegistry = (registry: typeof original, markdown: string, producerSource: string) => verifyRegistryWithHooks(registry, markdown, producerSource, hooks);

describe('Progression 2.0 closed registry, against the authoritative economy', () => {
  it('verifies all economic actions, proof requirements, allocations, caps and existing IDs', () => {
    expect(parseEconomy(economy).actions).toHaveLength(29);
    expect(verifyRegistry(original, economy, producers)).toEqual([]);
    expect(original.levels.map((tier: { minimum_lifetime_xp: number }) => tier.minimum_lifetime_xp)).toEqual(LEVEL_TIERS.map(tier => tier.minPoints));
  });

  it('detects an amount changed in the authoritative document itself', () => {
    const changed = economy.replace('| Clôturer une itinérance réellement accomplie | 45 |', '| Clôturer une itinérance réellement accomplie | 46 |');
    expect(changed).not.toEqual(economy);
    expect(verifyRegistry(original, changed, producers)).toContain('trip_completed: XP amount differs from economy');
  });

  it.each(ruleCases)('rejects amount, weight, count, proof or activation drift for $id', ({ index }) => {
    for (const field of ['amount', 'weights', 'caps', 'proof', 'enabled', 'effective_from']) {
      const changed = structuredClone(original);
      const rule = changed.rules[index];
      if (field === 'amount') rule.xp.max += 1;
      if (field === 'weights') rule.skill_weights_percent.explorer += 1;
      if (field === 'caps') rule.count_caps.week += 1;
      if (field === 'proof') rule.proof_requirements = 'client says completed';
      if (field === 'enabled') rule.enabled = true;
      if (field === 'effective_from') rule.effective_from = '2026-10-10T00:00:00Z';
      expect(verifyRegistry(changed, economy, producers).length, `${rule.id}/${field}`).toBeGreaterThan(0);
    }
  });

  it('rejects missing actions, renamed legacy producers and variant quota escape', () => {
    const missing = structuredClone(original);
    missing.rules.pop();
    expect(verifyRegistry(missing, economy, producers).length).toBeGreaterThan(0);
    for (const id of ['hike_session_processed', 'compass_prepared', 'loan_lender_returned']) {
      const changed = structuredClone(original);
      changed.rules.find((rule: { id: string }) => rule.id === id).cap_group = 'new_independent_quota';
      expect(verifyRegistry(changed, economy, producers).length).toBeGreaterThan(0);
    }
    const renamed = structuredClone(original);
    renamed.rules[0].id = 'new_hike_action';
    expect(verifyRegistry(renamed, economy, producers)).toContain('Existing producer ID missing: hike_session_processed');
  });

  it.each(Object.entries(parseLegacyProducerKeys(hooks)))('rejects exact legacy key drift for %s', (id, expectedKey) => {
    const changed = structuredClone(original);
    const rule = changed.rules.find((candidate: { id: string }) => candidate.id === id);
    expect(rule.idempotency.legacy_key).toBe(expectedKey);
    rule.idempotency.legacy_key = `${expectedKey}:v2`;
    expect(verifyRegistry(changed, economy, producers)).toContain(`Legacy key mismatch: ${id}; expected ${expectedKey}`);
  });

  it('rejects removing the user from a place-review source key in registry or actual hooks', () => {
    const changed = structuredClone(original);
    changed.rules.find((rule: { id: string }) => rule.id === 'place_review').idempotency.legacy_key = 'place_review:<place_id>';
    expect(verifyRegistry(changed, economy, producers)).toContain('Legacy key mismatch: place_review; expected place_review:<user_id>:<place_id>');
    const changedHooks = hooks.replace('sourceId: `${userId}:${placeId}`', 'sourceId: placeId');
    expect(changedHooks).not.toBe(hooks);
    expect(verifyRegistryWithHooks(original, economy, producers, changedHooks)).toContain('Producer hook legacy key drift: place_review; expected place_review:<user_id>:<place_id>');
  });

  it('rejects duration bonus, whole-gain cap or unfunded/public activation drift', () => {
    for (const mutate of [
      (r: typeof original) => { r.rules[0].xp.formula.novelty.xp = 21; },
      (r: typeof original) => { r.cap_policy.award = 'truncate'; },
      (r: typeof original) => { r.commercial.enabled = true; },
      (r: typeof original) => { r.competition.local_1km_enabled = true; },
      (r: typeof original) => { r.business_time.immutable = false; },
      (r: typeof original) => { r.rules[0].idempotency.includes_rule_version = true; },
      (r: typeof original) => { r.commercial.contribution_share_awards.answer_accepted = 6; },
      (r: typeof original) => { r.commercial.new_voucher_proposals[0].value_cents = 300; },
      (r: typeof original) => { r.rules.find((rule: { id: string }) => rule.id === 'loan_borrower_returned').minimum_loan_hours = 0; },
      (r: typeof original) => { r.rules.find((rule: { id: string }) => rule.id === 'accessibility_report_accepted').claim_groups = ['independent_report']; },
    ]) {
      const changed = structuredClone(original);
      mutate(changed);
      expect(verifyRegistry(changed, economy, producers).length).toBeGreaterThan(0);
    }
  });

  it('every proposed integer gain distributes exactly once with the existing TS allocator', () => {
    for (const rule of original.rules) {
      const weights = Object.fromEntries(Object.entries(rule.skill_weights_percent).map(([key, value]) => [key, Number(value) / 100])) as Parameters<typeof validateAndDistributeSkillPoints>[1];
      for (let xp = rule.xp.min; xp <= rule.xp.max; xp++) {
        const allocation = validateAndDistributeSkillPoints(xp, weights);
        expect(Object.values(allocation).every(Number.isInteger)).toBe(true);
        expect(Object.values(allocation).reduce((sum, value) => sum + value, 0)).toBe(xp);
      }
    }
    // Mathematical remainder ties are a separate T09 TS/SQL obligation.
    // The historic floating-point allocator is not certified here.
  });
});
