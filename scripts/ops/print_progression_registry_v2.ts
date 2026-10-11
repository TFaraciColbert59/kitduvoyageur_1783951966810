/**
 * T05 → T08/T42 — Imprime le registre économique v2 en JSON canonique.
 * Usage : npx tsx scripts/ops/print_progression_registry_v2.ts
 *
 * Le JSON produit est la charge utile destinée à `progression_rules.payload`
 * (publication par migration additive T08) et à la prévisualisation admin
 * (T42). La source unique reste `src/features/progression/domain/registryV2.ts`.
 */
import { PROGRESSION_REGISTRY_V2 } from '../../src/features/progression/domain/registryV2';
import { LEVEL_TIERS } from '../../src/features/progression/domain/rules';

const payload = {
  rules_version: PROGRESSION_REGISTRY_V2.version,
  effective_from: PROGRESSION_REGISTRY_V2.effectiveFrom,
  late_policy: PROGRESSION_REGISTRY_V2.latePolicy,
  grace_days: PROGRESSION_REGISTRY_V2.graceDays,
  season_duration_weeks: PROGRESSION_REGISTRY_V2.seasonDurationWeeks,
  family_caps: PROGRESSION_REGISTRY_V2.familyCaps,
  cap_groups: PROGRESSION_REGISTRY_V2.capGroups,
  skill_milestones: PROGRESSION_REGISTRY_V2.skillMilestones,
  levels: LEVEL_TIERS.map((tier) => ({
    level: tier.level,
    min_points: tier.minPoints,
    title: tier.title,
  })),
  actions: Object.fromEntries(
    PROGRESSION_REGISTRY_V2.actions.map((action) => [action.id, action])
  ),
  non_awarded: PROGRESSION_REGISTRY_V2.nonAwarded,
  commercial: PROGRESSION_REGISTRY_V2.commercial,
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
