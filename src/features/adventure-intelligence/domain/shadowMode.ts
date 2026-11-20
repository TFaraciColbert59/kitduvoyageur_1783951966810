/**
 * A9 & Lot P6 — Shadow mode, seuils collectifs D-13 & preuve de rollback (moteur pur).
 *
 * A9 (rétrocompatible) :
 * - Compare une valeur `primary` et une valeur `shadow` sans aucun effet utilisateur :
 *   `deltaPct = (shadow − primary) / |primary| × 100`, accord si l'écart absolu
 *   reste dans la tolérance (15 % par défaut).
 *
 * Extension Lot P6 :
 * - Enregistrement des flags `effort_score_v1_shadow` et `group_prediction_v2_shadow`
 *   (`EFFORT_SHADOW_FLAGS` / `ALL_SHADOW_FLAGS`), sans casser `SHADOW_FLAGS` (A9).
 * - Contrôle explicite des seuils collectifs DECISIONS D-13 :
 *   `MIN_DISTINCT_USERS = 5`, `MIN_PUBLISH_CONFIDENCE = 0.5`.
 * - Résolution déterministe du rollout (`resolveEffortShadowRollout`) prouvant le
 *   rollback instantané et non destructif dès que `effort_score_v1_shadow = false`.
 */

export const SHADOW_FLAGS = [
  'performance_profile_v2_shadow',
  'route_prediction_v2_shadow',
  'collective_intelligence_shadow',
  'terrain_auto_detection_shadow',
] as const;

export type ShadowFlag = (typeof SHADOW_FLAGS)[number];

/** Flags shadow du chantier effort-engine-v1 (Lot P3/P6, tous à false par défaut). */
export const EFFORT_SHADOW_FLAGS = [
  'effort_score_v1_shadow',
  'group_prediction_v2_shadow',
] as const;

export type EffortShadowFlag = (typeof EFFORT_SHADOW_FLAGS)[number];

export const ALL_SHADOW_FLAGS = [...SHADOW_FLAGS, ...EFFORT_SHADOW_FLAGS] as const;
export type AnyShadowFlag = (typeof ALL_SHADOW_FLAGS)[number];

/** Tolérance d'accord par défaut, en pourcentage. */
export const DEFAULT_SHADOW_TOLERANCE_PCT = 15;

/** Seuils collectifs normatifs (DECISIONS D-13) : publication collective interdite en dessous. */
export const MIN_DISTINCT_USERS = 5;
export const MIN_PUBLISH_CONFIDENCE = 0.5;

export interface ShadowComparison {
  primary: number | null;
  shadow: number | null;
  deltaPct: number | null;
  agreement: boolean;
}

export interface ShadowSummary {
  count: number;
  agreementRate: number;
  medianDeltaPct: number | null;
}

export interface ShadowComparisonInput {
  primary: number | null;
  shadow: number | null;
  tolerancePct?: number;
}

function isUsableNumber(value: number | null): value is number {
  return value != null && Number.isFinite(value);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Compare `primary` et `shadow` : `deltaPct` signé (null dès qu'une des deux
 * valeurs manque ou que `primary === 0`), `agreement` évalué sur l'écart
 * absolu non arrondi. Aucune écriture, aucun état partagé.
 */
export function compareShadow(input: ShadowComparisonInput): ShadowComparison {
  const { primary, shadow } = input;
  const tolerancePct =
    input.tolerancePct == null || !Number.isFinite(input.tolerancePct) || input.tolerancePct < 0
      ? DEFAULT_SHADOW_TOLERANCE_PCT
      : input.tolerancePct;

  if (!isUsableNumber(primary) || !isUsableNumber(shadow)) {
    return { primary, shadow, deltaPct: null, agreement: false };
  }

  if (primary === 0) {
    return shadow === 0
      ? { primary, shadow, deltaPct: 0, agreement: true }
      : { primary, shadow, deltaPct: null, agreement: false };
  }

  const deltaPct = ((shadow - primary) / Math.abs(primary)) * 100;
  return {
    primary,
    shadow,
    deltaPct: round(deltaPct, 2),
    agreement: Math.abs(deltaPct) <= tolerancePct,
  };
}

/**
 * Résume une série de comparaisons : `count` = total (deltas nuls inclus,
 * comptés comme désaccords), `agreementRate` = part en accord, et
 * `medianDeltaPct` = médiane des deltas non nuls (`null` si aucun delta).
 */
export function summarizeShadow(comparisons: ShadowComparison[]): ShadowSummary {
  const count = comparisons.length;
  if (count === 0) return { count: 0, agreementRate: 0, medianDeltaPct: null };

  let agreements = 0;
  const deltas: number[] = [];
  for (const comparison of comparisons) {
    if (comparison.agreement) agreements += 1;
    if (comparison.deltaPct != null && Number.isFinite(comparison.deltaPct)) {
      deltas.push(comparison.deltaPct);
    }
  }

  return {
    count,
    agreementRate: round(agreements / count, 4),
    medianDeltaPct: deltas.length > 0 ? round(median(deltas), 2) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOT P6 — CONTRÔLE D-13 & PREUVE DE ROLLBACK NON DESTRUCTIF
// ─────────────────────────────────────────────────────────────────────────────

export interface CollectivePublishGateInput {
  distinctUsers: number;
  confidenceScore: number;
}

export interface CollectivePublishGateResult {
  allowed: boolean;
  reasons: string[];
}

/**
 * Garde-fou normatif DECISIONS D-13 :
 * Exige au moins `MIN_DISTINCT_USERS = 5` utilisateurs distincts ET une confiance
 * d'agrégat `>= MIN_PUBLISH_CONFIDENCE = 0.5` avant toute publication collective.
 */
export function evaluateCollectivePublishGate(
  input: CollectivePublishGateInput
): CollectivePublishGateResult {
  const reasons: string[] = [];
  const users = Number.isFinite(input.distinctUsers) ? Math.trunc(input.distinctUsers) : 0;
  const conf = Number.isFinite(input.confidenceScore) ? input.confidenceScore : 0;

  if (users < MIN_DISTINCT_USERS) {
    reasons.push(
      `Nombre d'utilisateurs distincts insuffisant (${users} < ${MIN_DISTINCT_USERS}, règle D-13).`
    );
  }
  if (conf < MIN_PUBLISH_CONFIDENCE) {
    reasons.push(
      `Score de confiance insuffisant (${conf.toFixed(2)} < ${MIN_PUBLISH_CONFIDENCE}, règle D-13).`
    );
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

export interface EffortRolloutState {
  activePrimaryEngine: 'a3-legacy';
  effortShadowEnabled: boolean;
  groupV2ShadowEnabled: boolean;
  writesEffortShadowRows: boolean;
  requiresDestructiveMigrationForRollback: false;
  rollbackMode: 'flag_off_instant_noop' | 'shadow_active_primary_unchanged';
}

/**
 * Résout l'état de rollout d'`effort-score-v1` à partir des feature flags :
 * - Quand `effort_score_v1_shadow === false` (ou absent) : aucun calcul shadow n'est écrit,
 *   l'utilisateur reste sur le moteur primaire `a3-legacy` sans aucune migration destructive.
 * - Quand `effort_score_v1_shadow === true` : le calcul tourne exclusivement en shadow
 *   (`activePrimaryEngine` reste `'a3-legacy'`, aucun impact utilisateur).
 */
export function resolveEffortShadowRollout(
  flags: Partial<Record<AnyShadowFlag | string, boolean>> | null | undefined
): EffortRolloutState {
  const effortShadowEnabled = flags?.effort_score_v1_shadow === true;
  const groupV2ShadowEnabled = flags?.group_prediction_v2_shadow === true;

  return {
    activePrimaryEngine: 'a3-legacy',
    effortShadowEnabled,
    groupV2ShadowEnabled,
    writesEffortShadowRows: effortShadowEnabled,
    requiresDestructiveMigrationForRollback: false,
    rollbackMode: effortShadowEnabled
      ? 'shadow_active_primary_unchanged'
      : 'flag_off_instant_noop',
  };
}
