/**
 * A9 — Shadow mode (moteur pur).
 *
 * Compare une valeur `primary` et une valeur `shadow` sans aucun effet
 * utilisateur : `deltaPct = (shadow − primary) / |primary| × 100`, accord si
 * l'écart absolu reste dans la tolérance (15 % par défaut). Une donnée
 * manquante donne `deltaPct: null` et `agreement: false`.
 *
 * Les flags `*_shadow` sont exposés pour le rollout (9.5) ; ce module ne lit
 * ni n'écrit aucun flag.
 */

export const SHADOW_FLAGS = [
  'performance_profile_v2_shadow',
  'route_prediction_v2_shadow',
  'collective_intelligence_shadow',
  'terrain_auto_detection_shadow',
] as const;

export type ShadowFlag = (typeof SHADOW_FLAGS)[number];

/** Tolérance d'accord par défaut, en pourcentage. */
export const DEFAULT_SHADOW_TOLERANCE_PCT = 15;

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
