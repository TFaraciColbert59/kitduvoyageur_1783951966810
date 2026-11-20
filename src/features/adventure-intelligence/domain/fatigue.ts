/**
 * A3 & P1 — Fatigue intra-journée sans données de santé (moteur pur).
 *
 * Deux versions supportées :
 * - `'a3-v1'` (défaut, rétrocompatible) : modèle additif simple et explicable
 *   (durée active, D+/D-, technicité, portage, charge récente LKDV, pauses et fatigue déclarée).
 * - `'effort-score-v1'` (Lot P1) : extension multiplicative bioénergétique alignée sur
 *   le noyau LCDA / Hill (`dose` pondérée par les multiplicateurs de charge, terrain,
 *   descente excentrique, thermique, altitude et récupération par pauses).
 *
 * Toute valeur est bornée et le score final est ramené dans [0, 100].
 */
import {
  EFFORT_SCORE_VERSION,
  IEA_REFERENCE_WEIGHT_KG,
  computeBackpackLoadFactor,
  computeHillEffortScore,
} from './effortScore';

export type FatigueModelVersion = 'a3-v1' | typeof EFFORT_SCORE_VERSION;

export interface FatigueInput {
  activeDurationS: number;
  gainM: number;
  lossM: number;
  technicalClass?: number | null;
  packWeightKg?: number | null;
  pausesCount?: number;
  recentLoadS?: number | null;
  declaredFatigue?: number | null;
  /** Version du modèle : `'a3-v1'` (additif par défaut) ou `'effort-score-v1'` (multiplicatif). */
  version?: FatigueModelVersion;
  /** Paramètres optionnels pour le mode multiplicatif `'effort-score-v1'`. */
  weightKg?: number | null;
  terrainEta?: number | null;
  thermalMultiplier?: number | null;
  altitudeMultiplier?: number | null;
  hasPoles?: boolean | null;
}

export interface FatigueComponent {
  label: string;
  value: number;
}

export interface FatigueResult {
  score: number;
  components: FatigueComponent[];
  version?: FatigueModelVersion;
  multiplier?: number;
  rawDose?: number;
}

/** Borne les entrées non finies/négatives pour un modèle robuste. */
function positive(value: number | null | undefined, max: number): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

/**
 * Extension multiplicative bioénergétique (`effort-score-v1`) :
 * Combine multiplicativement la durée active, la charge verticale D+/D- (avec
 * atténuation bâtons -25 % en descente), le facteur de portage LCDA, le terrain $\eta$,
 * la contrainte thermique/altitudinale et la fatigue préalable, puis applique la
 * sigmoïde de Hill 0..100 %.
 */
export function computeMultiplicativeFatigue(
  input: FatigueInput
): FatigueResult & {
  version: typeof EFFORT_SCORE_VERSION;
  multiplier: number;
  rawDose: number;
} {
  const hours = positive(input.activeDurationS, 48 * 3600) / 3600;
  const gain = positive(input.gainM, 15000);
  const loss = positive(input.lossM, 15000);
  const technicalClass = positive(input.technicalClass, 5);
  const packWeight = positive(input.packWeightKg, 70);
  const weightKg = Math.max(20, positive(input.weightKg ?? IEA_REFERENCE_WEIGHT_KG, 300));
  const recentLoadHours = positive(input.recentLoadS, 48 * 3600) / 3600;
  const declaredFatigue = positive(input.declaredFatigue, 10);
  const pausesCount = positive(input.pausesCount, 100);

  const loadMult = computeBackpackLoadFactor(packWeight, weightKg, 'backpack');
  const terrainMult = Math.max(1, positive(input.terrainEta ?? 1, 5));
  const techMult = 1 + 0.04 * technicalClass;
  const thermalMult = Math.max(1, positive(input.thermalMultiplier ?? 1, 3));
  const altitudeMult = Math.max(1, positive(input.altitudeMultiplier ?? 1, 3));
  const polesFactor = input.hasPoles ? 0.75 : 1.0;

  const ascentEquivHours = gain / 450;
  const descentEquivHours = (loss / 750) * polesFactor * (1 + packWeight / weightKg);
  const effectiveWorkHours = hours + ascentEquivHours + descentEquivHours;

  const priorFatigueMult = 1 + 0.03 * declaredFatigue + 0.025 * Math.min(12, recentLoadHours);
  const pauseRecoveryMult = Math.max(0.82, 1 - 0.018 * Math.min(10, pausesCount));

  const combinedMultiplier =
    loadMult *
    terrainMult *
    techMult *
    thermalMult *
    altitudeMult *
    priorFatigueMult *
    pauseRecoveryMult;

  const baseIntensityRatio = 0.48;
  const rawDose =
    effectiveWorkHours > 0
      ? 100 *
        Math.pow((baseIntensityRatio * combinedMultiplier) / 0.70, 2) *
        effectiveWorkHours
      : 0;

  const hillScore = computeHillEffortScore(rawDose);
  const score = Math.round(hillScore * 100) / 100;

  const components: FatigueComponent[] = [
    { label: 'Durée active', value: Math.round(hours * 10 * 100) / 100 },
    { label: 'Dénivelé positif', value: Math.round(ascentEquivHours * 12 * 100) / 100 },
    { label: 'Dénivelé négatif', value: Math.round(descentEquivHours * 10 * 100) / 100 },
    { label: 'Technicité', value: Math.round((techMult - 1) * 100 * 100) / 100 },
    { label: 'Portage', value: Math.round((loadMult - 1) * 100 * 100) / 100 },
    { label: 'Charge récente', value: Math.round(recentLoadHours * 2.5 * 100) / 100 },
    { label: 'Fatigue déclarée', value: Math.round(declaredFatigue * 3 * 100) / 100 },
    { label: 'Pauses', value: -Math.round((1 - pauseRecoveryMult) * 100 * 100) / 100 },
  ];

  return {
    score,
    components,
    version: EFFORT_SCORE_VERSION,
    multiplier: Math.round(combinedMultiplier * 10000) / 10000,
    rawDose,
  };
}

/**
 * Calcule un score de fatigue 0..100 (0 = frais, 100 = épuisé).
 * - Par défaut (`version: 'a3-v1'` ou omise) : modèle additif A3 100 % rétrocompatible.
 * - Si `version === 'effort-score-v1'` : modèle multiplicatif bioénergétique Lot P1.
 */
export function computeFatigue(input: FatigueInput): FatigueResult {
  if (input.version === EFFORT_SCORE_VERSION) {
    return computeMultiplicativeFatigue(input);
  }

  const hours = positive(input.activeDurationS, 24 * 3600) / 3600;
  const gain = positive(input.gainM, 10000);
  const loss = positive(input.lossM, 10000);
  const technicalClass = positive(input.technicalClass, 5);
  const packWeight = positive(input.packWeightKg, 50);
  const recentLoadHours = positive(input.recentLoadS, 24 * 3600) / 3600;
  const declaredFatigue = positive(input.declaredFatigue, 10);
  const pausesCount = positive(input.pausesCount, 100);

  const components: FatigueComponent[] = [
    { label: 'Durée active', value: Math.min(35, hours * 7) },
    { label: 'Dénivelé positif', value: Math.min(25, gain / 50) },
    { label: 'Dénivelé négatif', value: Math.min(15, loss / 100) },
    { label: 'Technicité', value: Math.min(15, technicalClass * 3) },
    { label: 'Portage', value: Math.min(10, packWeight) },
    { label: 'Charge récente', value: Math.min(10, recentLoadHours * 2) },
    { label: 'Fatigue déclarée', value: Math.min(20, declaredFatigue * 2) },
    { label: 'Pauses', value: -Math.min(10, pausesCount * 2.5) },
  ];

  const raw = components.reduce((sum, component) => sum + component.value, 0);
  const score = Math.min(100, Math.max(0, raw));

  return {
    score: Math.round(score * 100) / 100,
    components,
  };
}
