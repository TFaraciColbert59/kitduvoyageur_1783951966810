import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseProgressionBusinessDate } from '../../../src/features/progression/domain/v2Contract';
import { readClosedProgressionV2Registry, selectProgressionV2Rule, validateProgressionV2Registry } from '../../../src/features/progression/server/v2RuleRegistry';

const source = JSON.parse(readFileSync('docs/progression/2.0/rules-registry.json', 'utf8'));
const now = new Date('2026-10-20T12:00:00Z');
const reviewed = { '2.0': source, '2.1': { ...structuredClone(source), version: '2.1' } };

function published(version = '2.0', from = '2026-10-11T00:00:00Z', until: string | null = null) {
  const registry = structuredClone(source);
  registry.status = 'published';
  registry.version = version;
  registry.effective_from = from;
  for (const rule of registry.rules) {
    rule.version = version;
    rule.effective_from = from;
    rule.effective_until = until;
    rule.enabled = true;
  }
  return registry;
}

describe('Progression v2 server contract remains separate from legacy attribution', () => {
  it('validates the full supplied registry while keeping it closed and undated', () => {
    const registry = readClosedProgressionV2Registry();
    expect(registry.rules).toHaveLength(29);
    expect(registry.status).toBe('draft_closed');
    expect(registry.rules.every(rule => !rule.enabled && rule.effective_from === null)).toBe(true);
    expect(selectProgressionV2Rule([registry], 'hike_session_processed', '2026-10-10T12:00:00Z', now)).toEqual({ ok: false, reason: 'draft_closed' });
  });

  const invalidCases: Array<{ name: string; mutate: (registry: typeof source) => void }> = [
    { name: 'negative XP', mutate: r => { r.rules[0].xp.min = -1; } },
    { name: 'non-integer XP', mutate: r => { r.rules[0].xp.min = 40.5; } },
    { name: 'excessive XP', mutate: r => { r.rules[0].xp.max = 151; } },
    { name: 'reversed XP bounds', mutate: r => { r.rules[2].xp.min = 46; } },
    { name: 'fractional skill weight', mutate: r => { r.rules[0].skill_weights_percent.explorer = 99.5; } },
    { name: 'skill total differs', mutate: r => { r.rules[0].skill_weights_percent.explorer = 99; } },
    { name: 'unknown family', mutate: r => { r.rules[0].family = 'money'; } },
    { name: 'quota escape', mutate: r => { r.rules[0].cap_group = 'independent_hike'; } },
    { name: 'zero quota', mutate: r => { r.rules[0].count_caps.day = 0; } },
    { name: 'variant count differs', mutate: r => { r.rules[0].count_caps.week = 7; } },
    { name: 'oversized quota', mutate: r => { r.rules[0].count_caps.season = 49; } },
    { name: 'changed economy amount within general bound', mutate: r => { r.rules[2].xp.min = 44; } },
    { name: 'extra skill', mutate: r => { r.rules[0].skill_weights_percent.courage = 0; } },
    { name: 'changed family cap', mutate: r => { r.family_xp_caps.partage.week = 181; } },
    { name: 'altered duration formula', mutate: r => { r.rules[0].xp.formula.tiers[0].xp = 41; } },
    { name: 'altered claim scope', mutate: r => { r.rules[0].claim_groups = ['free-new-view']; } },
    { name: 'missing proof', mutate: r => { r.rules[0].proof_requirements = ' '; } },
    { name: 'missing claims', mutate: r => { r.rules[0].claim_groups = []; } },
    { name: 'legacy key drift', mutate: r => { r.rules[0].idempotency.legacy_key = 'hike:v2'; } },
    { name: 'version in idempotency', mutate: r => { r.rules[0].idempotency.includes_rule_version = true; } },
    { name: 'duplicate action', mutate: r => { r.rules[1].id = r.rules[0].id; } },
    { name: 'lost action', mutate: r => { r.rules.pop(); } },
    { name: 'changed historic level', mutate: r => { r.levels[1].minimum_lifetime_xp = 101; } },
    { name: 'XP conversion', mutate: r => { r.zero_xp_policy.xp_to_money_conversion = true; } },
    { name: 'essential XP permission', mutate: r => { r.zero_xp_policy.essential_features_require_xp = true; } },
    { name: 'new funded claim without finance implementation', mutate: r => { r.commercial.enabled = true; } },
    { name: 'draft activation', mutate: r => { r.rules[0].enabled = true; } },
    { name: 'draft effect date', mutate: r => { r.effective_from = '2026-10-11T00:00:00Z'; } },
    { name: 'mutable date policy', mutate: r => { r.business_time.immutable = false; } },
    { name: 'rule version mismatch', mutate: r => { r.rules[0].version = '2.1'; } },
  ];
  it.each(invalidCases)('rejects invalid runtime configuration: $name', ({ mutate }) => {
    const registry = structuredClone(source);
    mutate(registry);
    expect(() => validateProgressionV2Registry(registry)).toThrow();
  });

  const badDates: unknown[] = [null, undefined, 0, '', 'garbage', '2026-10-11', '2026-02-30T00:00:00Z', '2026-10-11T25:00:00Z', '2026-10-11T00:00:00+02:00', '2026-10-11T00:00:00.1Z'];
  it.each(badDates.map((value, index) => ({ value, index })))('rejects invalid business timestamp $index', ({ value }) => {
    expect(parseProgressionBusinessDate(value)).toBeNull();
    expect(selectProgressionV2Rule([source], 'hike_session_processed', value, now)).toEqual({ ok: false, reason: 'invalid_business_date' });
  });

  it('rejects a future fact and does not replace it with processing time', () => {
    expect(selectProgressionV2Rule([published()], 'hike_session_processed', '2026-10-21T00:00:00Z', now)).toEqual({ ok: false, reason: 'future_business_date' });
    expect(selectProgressionV2Rule([published()], 'hike_session_processed', '2026-10-11T00:00:00Z', new Date('invalid'))).toEqual({ ok: false, reason: 'invalid_business_date' });
  });

  it('uses the exact business date, start inclusive, end exclusive, preserving late version selection', () => {
    const old = published('2.0', '2026-10-11T00:00:00Z', '2026-10-18T00:00:00Z');
    old.status = 'retired';
    const next = published('2.1', '2026-10-18T00:00:00Z');
    expect(selectProgressionV2Rule([old, next], 'trip_completed', '2026-10-10T23:59:59.999Z', now, reviewed)).toEqual({ ok: false, reason: 'no_applicable_version' });
    for (const [effectiveAt, expectedVersion] of [['2026-10-11T00:00:00Z', '2.0'], ['2026-10-17T23:59:59.999Z', '2.0'], ['2026-10-18T00:00:00Z', '2.1']]) {
      const result = selectProgressionV2Rule([next, old], 'trip_completed', effectiveAt, now, reviewed);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.selection.version).toBe(expectedVersion);
        expect(result.selection.business_effective_at).toBe(effectiveAt);
        expect(Object.isFrozen(result.selection)).toBe(true);
      }
    }
    expect(selectProgressionV2Rule([old], 'trip_completed', '2026-10-18T00:00:00Z', now)).toEqual({ ok: false, reason: 'no_applicable_version' });
  });

  it('validates archives against their own reviewed reference after an effective price change', () => {
    const old = published('2.0', '2026-10-11T00:00:00Z', '2026-10-18T00:00:00Z');
    old.status = 'retired';
    const next = published('2.1', '2026-10-18T00:00:00Z');
    next.rules.find((rule: { id: string }) => rule.id === 'trip_completed').xp = { min: 46, max: 46, unit: 'xp' };
    const references = { '2.0': source, '2.1': structuredClone(next) };
    const late = selectProgressionV2Rule([old, next], 'trip_completed', '2026-10-17T12:00:00Z', now, references);
    const recent = selectProgressionV2Rule([old, next], 'trip_completed', '2026-10-18T00:00:00Z', now, references);
    expect(late.ok && late.selection.rule.xp.max).toBe(45);
    expect(recent.ok && recent.selection.rule.xp.max).toBe(46);
    const tampered = structuredClone(old);
    tampered.rules.find((rule: { id: string }) => rule.id === 'trip_completed').xp.min = 44;
    expect(() => validateProgressionV2Registry(tampered, references)).toThrow();
    expect(() => validateProgressionV2Registry(next)).toThrow();
  });

  it('refuses null effect date, invalid calendar publication and empty windows', () => {
    for (const mutate of [
      (r: typeof source) => { r.effective_from = null; },
      (r: typeof source) => { r.rules[0].effective_from = null; },
      (r: typeof source) => { r.rules[0].effective_from = '2026-02-30T00:00:00Z'; },
      (r: typeof source) => { r.rules[0].effective_until = r.rules[0].effective_from; },
      (r: typeof source) => { r.rules[0].effective_from = '2026-10-10T00:00:00Z'; },
    ]) {
      const registry = published();
      mutate(registry);
      expect(() => validateProgressionV2Registry(registry)).toThrow();
    }
  });

  it('keeps individually disabled rules closed and refuses overlapping versions', () => {
    const disabled = published();
    disabled.rules[0].enabled = false;
    expect(selectProgressionV2Rule([disabled], 'hike_session_processed', '2026-10-12T00:00:00Z', now)).toEqual({ ok: false, reason: 'rule_disabled' });
    expect(selectProgressionV2Rule([published(), published('2.1')], 'trip_completed', '2026-10-12T00:00:00Z', now, reviewed)).toEqual({ ok: false, reason: 'ambiguous_versions' });
  });

  it('does not mutate caller registry or fact date and has no historical replay path', () => {
    const registry = published();
    const before = JSON.stringify(registry);
    const result = selectProgressionV2Rule([registry], 'place_review', '2026-10-12T00:00:00.000Z', now);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(registry)).toBe(before);
    expect('award' in result).toBe(false);
    expect('balance' in result).toBe(false);
  });
});
