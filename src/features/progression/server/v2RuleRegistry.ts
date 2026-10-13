import 'server-only';
import { z } from 'zod';
import draftRegistry from '../../../../docs/progression/2.0/rules-registry.json';
import {
  PROGRESSION_V2_ACTION_IDS,
  parseProgressionBusinessDate,
  type ProgressionV2ActionId,
  type ProgressionV2RuleSelection,
} from '../domain/v2Contract';

const date = z.string().refine(value => parseProgressionBusinessDate(value) !== null, 'Expected a real UTC ISO business timestamp');
const count = z.number().int().min(1).max(10000);
const weight = z.number().int().min(0).max(100);
const version = z.string().regex(/^2\.\d+(?:\.\d+)?$/);
const legacyKeys: Partial<Record<ProgressionV2ActionId, string>> = {
  hike_session_processed: 'hike_session:<session_id>', trail_prepared: 'trail_prep:<user_id>:<route_id>',
  kit_field_report: 'kit_report:<session_id>', place_review: 'place_review:<user_id>:<place_id>',
  carnet_published: 'carnet:<carnet_id>', checklist_completed: 'checklist:<trip_id>', trip_completed: 'trip:<trip_id>',
};
const sharedCaps: Partial<Record<ProgressionV2ActionId, string>> = {
  hike_session_processed: 'activity_completed', activity_completed: 'activity_completed',
  trail_prepared: 'adventure_prepared', compass_prepared: 'adventure_prepared',
  loan_borrower_returned: 'loan_returned', loan_lender_returned: 'loan_returned',
};
const ruleSchema = z.looseObject({
  id: z.enum(PROGRESSION_V2_ACTION_IDS), version,
  effective_from: date.nullable(), effective_until: date.nullable(), enabled: z.boolean(),
  label: z.string().trim().min(1), family: z.enum(['terrain', 'preparation', 'partage', 'entraide']),
  xp: z.looseObject({ min: z.number().int().min(1).max(150), max: z.number().int().min(1).max(150), unit: z.literal('xp') }),
  skill_weights_percent: z.strictObject({ explorer: weight, preparer: weight, partager: weight, entraider: weight }),
  count_caps: z.object({ day: z.number().int().min(1).max(3), week: z.number().int().min(1).max(8), season: z.number().int().min(1).max(48) }), cap_group: z.string().min(1),
  claim_groups: z.array(z.string().min(1)).min(1), proof_requirements: z.string().trim().min(1),
  activation_conditions: z.array(z.string().min(1)).min(1),
  idempotency: z.object({ scope: z.literal('user_id + canonical_business_source'), includes_rule_version: z.literal(false), legacy_key: z.string().nullable() }),
}).superRefine((rule, context) => {
  const fail = (message: string) => context.addIssue({ code: 'custom', message });
  if (rule.xp.min > rule.xp.max) fail('XP minimum exceeds maximum');
  if (Object.values(rule.skill_weights_percent).reduce((sum, value) => sum + value, 0) !== 100) fail('Skill weights must total 100');
  if (rule.count_caps.day > rule.count_caps.week || rule.count_caps.week > rule.count_caps.season) fail('Count caps must be ordered day/week/season');
  if (rule.cap_group !== (sharedCaps[rule.id] ?? rule.id)) fail('Incorrect shared quota scope');
  if (rule.idempotency.legacy_key !== (legacyKeys[rule.id] ?? null)) fail('Historical idempotency key differs');
  if (!rule.activation_conditions.includes('server_proof_verified')) fail('Server proof activation condition missing');
  if (rule.effective_until !== null && (rule.effective_from === null || Date.parse(rule.effective_until) <= Date.parse(rule.effective_from))) fail('Rule window must be a nonempty half-open interval');
  if (rule.enabled && rule.effective_from === null) fail('Enabled rule needs a published effect date');
});
const familyCap = z.object({ week: count, season: count });
function fingerprint(value: unknown): string | undefined {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item !== null && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, normalize(child)]));
    }
    return item;
  };
  return JSON.stringify(normalize(value));
}

/** Reviewed references are server-owned immutable releases, never client input. */
export type ProgressionV2EconomyReferences = Readonly<Record<string, typeof draftRegistry>>;
const reviewedReferences: ProgressionV2EconomyReferences = { '2.0': draftRegistry };
function schemaFor(references: ProgressionV2EconomyReferences) {
return z.looseObject({
  schema_version: z.literal(1), version, status: z.enum(['draft_closed', 'published', 'retired']), effective_from: date.nullable(),
  rules: z.array(ruleSchema).length(PROGRESSION_V2_ACTION_IDS.length),
  levels: z.array(z.object({ level: z.number().int(), minimum_lifetime_xp: z.number().int().nonnegative() })).length(10),
  family_xp_caps: z.object({ terrain: familyCap, preparation: familyCap, partage: familyCap, entraide: familyCap }),
  skill_allocation: z.looseObject({ method: z.literal('largest_remainder'), tie_break: z.tuple([z.literal('explorer'), z.literal('preparer'), z.literal('partager'), z.literal('entraider')]), single_total_gain: z.literal(true), historical_allocations_unchanged: z.literal(true) }),
  business_time: z.looseObject({ immutable: z.literal(true), day_timezone: z.literal('UTC'), week: z.literal('ISO_UTC'), season_weeks: z.literal(8), interval: z.literal('[start,end)'), grace_days: z.literal(14), after_season_freeze: z.literal('verified_lifetime_only'), rule_selection: z.literal('business_effective_at'), idempotency_before_caps: z.literal(true) }),
  cap_policy: z.looseObject({ award: z.literal('all_or_nothing'), carry_forward: z.literal(false), concurrent_user_lock_required: z.literal(true), count_scope: z.literal('user_id + cap_group'), family_scope: z.literal('user_id + action_family') }),
  zero_xp_policy: z.looseObject({ xp_to_money_conversion: z.literal(false), essential_features_require_xp: z.literal(false), private_progression: z.literal(true), additional_xp_for_badge_mission_stamp_league: z.literal(false) }),
  commercial: z.looseObject({ enabled: z.literal(false), effective_from: z.null(), historical_rights_preserved: z.literal(true) }),
  competition: z.looseObject({ local_1km_enabled: z.literal(false), league_enabled: z.literal(false), demo_participants_excluded: z.literal(true) }),
}).superRefine((registry, context) => {
  const fail = (message: string) => context.addIssue({ code: 'custom', message });
  if (new Set(registry.rules.map(rule => rule.id)).size !== PROGRESSION_V2_ACTION_IDS.length) fail('Missing or duplicate economic action');
  const thresholds = [0, 100, 300, 700, 1500, 3000, 5500, 9000, 14000, 20000];
  if (registry.levels.some((level, index) => level.level !== index + 1 || level.minimum_lifetime_xp !== thresholds[index])) fail('Historical ten thresholds must be preserved');
  if (registry.status === 'draft_closed' && (registry.effective_from !== null || registry.rules.some(rule => rule.enabled || rule.effective_from !== null || rule.effective_until !== null))) fail('Draft must remain closed and undated');
  if (registry.status !== 'draft_closed' && registry.effective_from === null) fail('Published history requires effect date');
  const reference = references[registry.version];
  if (!reference || reference.version !== registry.version) {
    fail('No reviewed immutable economy reference for this version');
    return;
  }
  for (const rule of registry.rules) {
    const approved = reference.rules.find(candidate => candidate.id === rule.id);
    if (!approved || rule.xp.min !== approved.xp.min || rule.xp.max !== approved.xp.max || rule.family !== approved.family) fail('Amounts/family differ from the reviewed economy reference');
    if (approved && (
      fingerprint(rule.xp) !== fingerprint(approved.xp) ||
      fingerprint(rule.claim_groups) !== fingerprint(approved.claim_groups) ||
      rule.proof_requirements !== approved.proof_requirements ||
      fingerprint(rule.activation_conditions) !== fingerprint(approved.activation_conditions)
    )) fail('Formula, claims or proof contract differs from this reviewed version');

    if (approved && (Object.entries(rule.skill_weights_percent).some(([skill, value]) => value !== approved.skill_weights_percent[skill as keyof typeof approved.skill_weights_percent]) || Object.entries(rule.count_caps).some(([period, value]) => value !== approved.count_caps[period as keyof typeof approved.count_caps]))) fail('Allocation/count caps differ from the reviewed economy reference');
    if (rule.version !== registry.version) fail('Rule version differs from registry');
    if (rule.effective_from !== null && registry.effective_from !== null && Date.parse(rule.effective_from) < Date.parse(registry.effective_from)) fail('Rule predates registry publication');
    const variant = registry.rules.find(candidate => candidate.id !== rule.id && candidate.cap_group === rule.cap_group);
    if (variant && JSON.stringify(variant.count_caps) !== JSON.stringify(rule.count_caps)) fail('Quota variants must have identical count caps');
  }
  for (const [family, cap] of Object.entries(registry.family_xp_caps)) {
    const approved = reference.family_xp_caps[family as keyof typeof reference.family_xp_caps];
    if (cap.week !== approved.week || cap.season !== approved.season) fail('Family XP caps differ from the reviewed economy reference');
  }
  for (const cap of Object.values(registry.family_xp_caps)) if (cap.week > cap.season) fail('Family seasonal cap is below weekly cap');
});

}
export const progressionV2RegistrySchema = schemaFor(reviewedReferences);

export type ValidatedProgressionV2Registry = z.infer<typeof progressionV2RegistrySchema>;

/** Unknown configuration is rejected on the server before any use. No write occurs. */
export function validateProgressionV2Registry(input: unknown, references: ProgressionV2EconomyReferences = reviewedReferences): ValidatedProgressionV2Registry {
  return schemaFor(references).parse(input);
}

export function readClosedProgressionV2Registry(): ValidatedProgressionV2Registry {
  return validateProgressionV2Registry(draftRegistry);
}

export type ProgressionV2SelectionResult =
  | { readonly ok: true; readonly selection: ProgressionV2RuleSelection }
  | { readonly ok: false; readonly reason: 'invalid_business_date' | 'future_business_date' | 'draft_closed' | 'no_applicable_version' | 'rule_disabled' | 'ambiguous_versions' };

/** Select at the original fact date. Processing time never moves a fact to a new rule. */
export function selectProgressionV2Rule(
  inputs: readonly unknown[], action: ProgressionV2ActionId, businessEffectiveAt: unknown,
  now: Date, references: ProgressionV2EconomyReferences = reviewedReferences,
): ProgressionV2SelectionResult {
  const businessTimestamp = parseProgressionBusinessDate(businessEffectiveAt);
  if (businessTimestamp === null || !Number.isFinite(now.getTime())) return { ok: false, reason: 'invalid_business_date' };
  if (businessTimestamp > now.getTime()) return { ok: false, reason: 'future_business_date' };
  const registries = inputs.map(input => validateProgressionV2Registry(input, references));
  const candidates = registries.filter(registry => registry.status !== 'draft_closed').flatMap(registry => registry.rules.filter(rule =>
    rule.id === action && rule.effective_from !== null && businessTimestamp >= Date.parse(rule.effective_from) &&
    (rule.effective_until === null || businessTimestamp < Date.parse(rule.effective_until)),
  ).map(rule => ({ registry, rule })));
  if (candidates.length > 1) return { ok: false, reason: 'ambiguous_versions' };
  const candidate = candidates[0];
  if (!candidate) return { ok: false, reason: registries.length > 0 && registries.every(registry => registry.status === 'draft_closed') ? 'draft_closed' : 'no_applicable_version' };
  if (!candidate.rule.enabled) return { ok: false, reason: 'rule_disabled' };
  return { ok: true, selection: Object.freeze({ version: candidate.registry.version, business_effective_at: businessEffectiveAt as string, rule: candidate.rule }) };
}
