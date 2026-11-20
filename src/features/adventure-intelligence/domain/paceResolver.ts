/**
 * A3 & Lot P5 — Résolution d'allure : profil → générique → standard + Surface de capacité V2 (moteur pur).
 *
 * Cascade A3 rétrocompatible :
 * - `profile` : flag actif + profil non froid + confiance ≥ 0.5 ;
 * - `generic` : des données de profil existent (même froides/incertaines) ;
 * - `standard` : aucun profil, allure historique 15 min/km.
 *
 * Extension Lot P5 (Surface de capacité individuelle) :
 * - Prior populationnel Wood (2023) / Campbell (2019) + résidu de Kalman personnel `theta`.
 * - `v_ik = min(v_energetic, v_tech, v_grip, v_visibility)` où `v_energetic` est plafonnée
 *   par la puissance aérobie soutenable en hypoxie :
 *   `M_LCDA(v) <= alpha_sust * P_VO2max * fHyp(z)` (briques LCDA / Péronnet 1991 de `effortScore.ts`).
 */
import {
  COLD_CONFIDENCE,
  MEDIUM_CONFIDENCE_THRESHOLD,
  type Confidence,
} from './confidence';
import {
  IEA_REFERENCE_VO2MAX_ML_KG_MIN,
  IEA_REFERENCE_WEIGHT_KG,
  VO2_TO_WATTS_FACTOR,
  computeBackpackLoadFactor,
  computeLcdaGradeTerm,
  computePeronnetHypoxiaFactor,
  computeRestingMetabolicRateWkg,
  computeThermalCapacityFactor,
  resolveSurfaceEta,
} from './effortScore';
import type { PerformanceProfile } from '../schemas/performance.schema';

/** Allure standard historique (15 min/km) — défaut rétrocompatible. */
export const STANDARD_PACE_MIN_PER_KM = 15;
/** Allure générique (population) utilisée quand un profil existe mais reste froid. */
export const GENERIC_PACE_MIN_PER_KM = 13.5;

/** Majoration de pente : min/km par 100 m de D+ par km. */
export const PROFILE_ASCENT_MIN_PER_100M_PER_KM = 1;
export const GENERIC_ASCENT_MIN_PER_100M_PER_KM = 0.8;
/** Majoration d'une descente technique (surface rocheuse/raide). */
export const TECHNICAL_DESCENT_MIN_PER_KM = 0.4;

const TECHNICAL_DESCENT_SURFACES = [
  'rock',
  'scree',
  'stone',
  'boulder',
  'steps',
  'via',
  'cable',
] as const;

export interface ResolvedPace {
  paceMinPerKm: number;
  source: 'profile' | 'generic' | 'standard';
  personalized: boolean;
  confidence: Confidence;
}

export interface ResolvePaceInput {
  distanceM: number;
  gainM: number;
  lossM: number;
  surface?: string | null;
  profile?: PerformanceProfile | null;
  confidence?: Confidence | null;
  flagEnabled: boolean;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function isTechnicalDescentSurface(surface: string | null | undefined): boolean {
  if (!surface) return false;
  const key = surface.toLowerCase();
  return TECHNICAL_DESCENT_SURFACES.some((token) => key.includes(token));
}

export function resolvePace(input: ResolvePaceInput): ResolvedPace {
  const profile = input.profile ?? null;
  const confidence = input.confidence ?? profile?.confidence ?? COLD_CONFIDENCE;

  const usableProfile =
    input.flagEnabled &&
    profile !== null &&
    profile.calibrationLevel !== 'cold' &&
    confidence.score >= MEDIUM_CONFIDENCE_THRESHOLD;

  let source: ResolvedPace['source'];
  let basePaceMinPerKm: number;
  let ascentFactor: number;

  if (usableProfile && profile) {
    source = 'profile';
    basePaceMinPerKm =
      profile.flatSpeedKmH > 0 ? 60 / profile.flatSpeedKmH : STANDARD_PACE_MIN_PER_KM;
    ascentFactor = PROFILE_ASCENT_MIN_PER_100M_PER_KM;
  } else if (profile !== null) {
    source = 'generic';
    basePaceMinPerKm = GENERIC_PACE_MIN_PER_KM;
    ascentFactor = GENERIC_ASCENT_MIN_PER_100M_PER_KM;
  } else {
    source = 'standard';
    basePaceMinPerKm = STANDARD_PACE_MIN_PER_KM;
    ascentFactor = GENERIC_ASCENT_MIN_PER_100M_PER_KM;
  }

  const distanceKm = Math.max(0, Number.isFinite(input.distanceM) ? input.distanceM : 0) / 1000;
  const gainM = Math.max(0, Number.isFinite(input.gainM) ? input.gainM : 0);
  const lossM = Math.max(0, Number.isFinite(input.lossM) ? input.lossM : 0);
  const ascentPer100mPerKm = distanceKm > 0 ? gainM / distanceKm / 100 : 0;
  const technicalDescent = lossM > 0 && isTechnicalDescentSurface(input.surface);

  const paceMinPerKm =
    basePaceMinPerKm +
    ascentPer100mPerKm * ascentFactor +
    (technicalDescent ? TECHNICAL_DESCENT_MIN_PER_KM : 0);

  return {
    paceMinPerKm: Math.round(paceMinPerKm * 1000) / 1000,
    source,
    personalized: source === 'profile',
    confidence,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOT P5 — PRIOR WOOD (2023) / CAMPBELL (2019), RÉSIDU KALMAN & SURFACE v_ik
// ─────────────────────────────────────────────────────────────────────────────

/** Vitesse de référence populationnelle Wood (2023) / Campbell (2019) au point optimal (-3.5 %). */
export const WOOD_CAMPBELL_PEAK_SPEED_MS = 1.42;
export const WOOD_CAMPBELL_OPTIMAL_GRADE_DEC = -0.035;
export const DEFAULT_SUSTAINABLE_AEROBIC_FRACTION = 0.62;

/**
 * Prior populationnel de vitesse de marche Wood (2023) / Campbell (2019) en m/s
 * en fonction de la pente `gradePct` (%) et de la surface OSM.
 */
export function computeWoodCampbellPriorSpeedMs(
  gradePct: number,
  surface = 'trail',
  technicalClass = 1
): number {
  const gDec = clamp(gradePct, -80, 80) / 100;
  const delta = gDec - WOOD_CAMPBELL_OPTIMAL_GRADE_DEC;
  const sigma = delta >= 0 ? 0.165 : 0.21;
  const slopeKernel = Math.exp(-0.5 * Math.pow(delta / sigma, 2));
  // Terme Lorentz-Campbell pour les fortes pentes (> 25 %)
  const steepDamping = 1 / (1 + 1.8 * Math.pow(Math.max(0, Math.abs(gDec) - 0.20), 2));

  const { eta } = resolveSurfaceEta(surface, 1.2);
  const surfaceFactor = clamp(1 / Math.pow(eta, 0.55), 0.45, 1.0);
  const techFactor = 1 - 0.06 * Math.max(0, clamp(technicalClass, 1, 5) - 1);

  return clamp(
    WOOD_CAMPBELL_PEAK_SPEED_MS * slopeKernel * steepDamping * surfaceFactor * techFactor,
    0.22,
    2.10
  );
}

/**
 * Poids d'interpolation barycentriques [w_flat, w_ascent, w_descent] sur la pente `gradePct`
 * pour appliquer le vecteur de résidus log-vitesse de Kalman `theta = [theta_flat, theta_up, theta_down]`.
 */
export function computeKalmanBasisWeights(gradePct: number): [number, number, number] {
  const g = clamp(gradePct, -60, 60);
  if (Math.abs(g) <= 3) {
    return [1, 0, 0];
  }
  if (g > 3) {
    const wUp = clamp((g - 3) / 12, 0, 1);
    return [1 - wUp, wUp, 0];
  }
  const wDown = clamp((-g - 3) / 12, 0, 1);
  return [1 - wDown, 0, wDown];
}

/**
 * Applique le résidu personnel de Kalman `theta` (log-vitesse [plat, montée, descente])
 * au prior populationnel Wood (2023) / Campbell (2019).
 */
export function applyKalmanPaceResidual(
  priorSpeedMs: number,
  gradePct: number,
  kalmanTheta?: readonly [number, number, number] | null
): number {
  if (!kalmanTheta || kalmanTheta.length < 3) {
    return clamp(priorSpeedMs, 0.20, 2.20);
  }
  const [wFlat, wUp, wDown] = computeKalmanBasisWeights(gradePct);
  const logResidual = clamp(
    wFlat * kalmanTheta[0] + wUp * kalmanTheta[1] + wDown * kalmanTheta[2],
    -0.65,
    0.55
  );
  return clamp(priorSpeedMs * Math.exp(logResidual), 0.20, 2.20);
}

export interface EnergeticSpeedLimitInput {
  gradePct: number;
  altitudeM?: number;
  tempC?: number;
  surface?: string;
  snowSinkCm?: number;
  wetness?: number;
  weightKg?: number;
  packWeightKg?: number;
  vo2MaxMlKgMin?: number;
  alphaSust?: number;
  carryType?: 'backpack' | 'vest';
}

/**
 * Résout par dichotomie la vitesse maximale `v_energetic` (m/s) telle que :
 * `M_LCDA(v) <= alpha_sust * P_VO2max * fHyp(z) * fTherm`
 * en utilisant les équations LCDA (Looney 2019) et Péronnet (1991) de `effortScore.ts`.
 */
export function solveEnergeticSpeedLimitMs(input: EnergeticSpeedLimitInput): {
  vEnergeticMs: number;
  sustainablePowerW: number;
  pVo2MaxEffW: number;
  mLcdaAtLimitW: number;
} {
  const weightKg = clamp(input.weightKg ?? IEA_REFERENCE_WEIGHT_KG, 20, 300);
  const packWeightKg = clamp(input.packWeightKg ?? 0, 0, 120);
  const vo2Max = clamp(input.vo2MaxMlKgMin ?? IEA_REFERENCE_VO2MAX_ML_KG_MIN, 15, 95);
  const alphaSust = clamp(input.alphaSust ?? DEFAULT_SUSTAINABLE_AEROBIC_FRACTION, 0.30, 0.88);
  const altitudeM = clamp(input.altitudeM ?? 0, -500, 9000);
  const tempC = clamp(input.tempC ?? 15, -60, 60);

  const pVo2MaxSeaW = ((vo2Max * weightKg) / 1000) * VO2_TO_WATTS_FACTOR;
  const fHyp = computePeronnetHypoxiaFactor(altitudeM);
  const { fTherm } = computeThermalCapacityFactor(tempC);
  const pVo2MaxEffW = Math.max(180, pVo2MaxSeaW * fHyp * fTherm);
  const sustainablePowerW = alphaSust * pVo2MaxEffW;

  const mRestWkg = computeRestingMetabolicRateWkg({ weightKg, vo2MaxMlKgMin: vo2Max });
  const loadFactor = computeBackpackLoadFactor(packWeightKg, weightKg, input.carryType ?? 'backpack');

  const evaluateLcdaW = (vMs: number): number => {
    const { eta } = resolveSurfaceEta(input.surface ?? 'trail', vMs, {
      snowSinkCm: input.snowSinkCm ?? 0,
      wetness: input.wetness ?? 0,
    });
    const mGrade = computeLcdaGradeTerm(vMs, input.gradePct);
    const walkTerm = Math.max(0.30, 1.78 * Math.pow(vMs, 0.58) + 0.27 * Math.pow(vMs, 4) + mGrade);
    const mLcdaWkg = mRestWkg + 0.19 + eta * walkTerm * loadFactor;
    return weightKg * mLcdaWkg;
  };

  let low = 0.20;
  let high = 2.15;
  if (evaluateLcdaW(low) >= sustainablePowerW) {
    return {
      vEnergeticMs: low,
      sustainablePowerW,
      pVo2MaxEffW,
      mLcdaAtLimitW: evaluateLcdaW(low),
    };
  }
  if (evaluateLcdaW(high) <= sustainablePowerW) {
    return {
      vEnergeticMs: high,
      sustainablePowerW,
      pVo2MaxEffW,
      mLcdaAtLimitW: evaluateLcdaW(high),
    };
  }

  for (let iter = 0; iter < 14; iter += 1) {
    const mid = 0.5 * (low + high);
    if (evaluateLcdaW(mid) <= sustainablePowerW) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return {
    vEnergeticMs: low,
    sustainablePowerW,
    pVo2MaxEffW,
    mLcdaAtLimitW: evaluateLcdaW(low),
  };
}

export interface IndividualSpeedSurfaceInput extends EnergeticSpeedLimitInput {
  technicalClass?: number;
  sacScale?: 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';
  isNight?: boolean;
  visibilityRatio?: number;
  isChild?: boolean;
  kalmanTheta?: readonly [number, number, number] | null;
  flatSpeedMsOverride?: number;
}

export interface IndividualSpeedSurfaceResult {
  speedMs: number;
  speedKmH: number;
  paceMinPerKm: number;
  vEnergeticMs: number;
  vTechMs: number;
  vGripMs: number;
  vVisibilityMs: number;
  limitingConstraint: 'energetic' | 'tech' | 'grip' | 'visibility';
  aerobicFraction: number;
  pVo2MaxEffW: number;
  mLcdaW: number;
}

function sacScaleToTechClass(
  sacScale?: 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6',
  technicalClass?: number
): number {
  const fromSac =
    sacScale === 'T6' || sacScale === 'T5'
      ? 5
      : sacScale === 'T4'
        ? 4
        : sacScale === 'T3'
          ? 3
          : sacScale === 'T2'
            ? 2
            : 1;
  return Math.max(fromSac, clamp(Math.round(technicalClass ?? 1), 1, 5));
}

/**
 * Calcule la vitesse individuelle effective `v_ik` sur un segment par le minimum
 * des 4 plafonds physiques :
 * `v_ik = min(v_energetic, v_tech, v_grip, v_visibility)`
 */
export function resolveIndividualSegmentSpeedMs(
  input: IndividualSpeedSurfaceInput
): IndividualSpeedSurfaceResult {
  const techClass = sacScaleToTechClass(input.sacScale, input.technicalClass);
  const childFactor = input.isChild ? 0.85 : 1.0;

  // 1. Vitesse cinématique prior Wood/Campbell + résidu Kalman, plafonnée par la capacité aérobie soutenable en hypoxie
  const priorMs = computeWoodCampbellPriorSpeedMs(
    input.gradePct,
    input.surface ?? 'trail',
    techClass
  );
  const personalScale =
    input.flatSpeedMsOverride && input.flatSpeedMsOverride > 0
      ? clamp(input.flatSpeedMsOverride / 1.25, 0.55, 1.55)
      : 1.0;
  const kinematicMs =
    applyKalmanPaceResidual(priorMs, input.gradePct, input.kalmanTheta) *
    personalScale *
    childFactor;

  const energetic = solveEnergeticSpeedLimitMs(input);
  const vEnergeticMs = Math.min(kinematicMs, energetic.vEnergeticMs);

  // 2. Plafond de technicité (v_tech)
  const techCeilingsMs = [1.95, 1.55, 1.12, 0.78, 0.52] as const;
  const steepDescentTechPenalty =
    input.gradePct <= -15 ? (input.isChild ? 0.72 : 0.82) : 1.0;
  const vTechMs = techCeilingsMs[techClass - 1] * steepDescentTechPenalty * childFactor;

  // 3. Plafond d'adhérence sol / neige / boue (v_grip)
  const snowCm = Math.max(0, input.snowSinkCm ?? 0);
  const wetness = clamp(input.wetness ?? 0, 0, 1);
  const surf = (input.surface ?? 'trail').toLowerCase();
  const mudGripFactor =
    surf === 'mud' ? 0.70 - 0.15 * wetness : 1 - 0.12 * wetness;
  const snowGripFactor = snowCm > 0 ? clamp(1 / (1 + 0.025 * snowCm), 0.38, 1.0) : 1.0;
  const descentSlipFactor =
    input.gradePct < -10 && (wetness > 0.3 || surf === 'scree' || surf === 'rock')
      ? 0.82
      : 1.0;
  const vGripMs = clamp(1.85 * mudGripFactor * snowGripFactor * descentSlipFactor, 0.25, 1.95);

  // 4. Plafond de visibilité / obscurité (v_visibility)
  const visRatio = clamp(
    input.visibilityRatio ?? (input.isNight ? 0.72 : 1.0),
    0.35,
    1.0
  );
  const nightTechBrake = input.isNight ? 1 - 0.05 * (techClass - 1) : 1.0;
  const vVisibilityMs =
    visRatio < 1 || input.isNight
      ? clamp(1.50 * visRatio * nightTechBrake, 0.30, 1.85)
      : 2.20;

  const speedMs = Math.max(
    0.18,
    Math.min(vEnergeticMs, vTechMs, vGripMs, vVisibilityMs)
  );

  let limitingConstraint: IndividualSpeedSurfaceResult['limitingConstraint'] = 'energetic';
  if (speedMs === vVisibilityMs && vVisibilityMs < vEnergeticMs) {
    limitingConstraint = 'visibility';
  } else if (speedMs === vGripMs && vGripMs < vEnergeticMs) {
    limitingConstraint = 'grip';
  } else if (speedMs === vTechMs && vTechMs < vEnergeticMs) {
    limitingConstraint = 'tech';
  }

  // Puissance LCDA réelle à la vitesse retenue `speedMs`
  const weightKg = clamp(input.weightKg ?? IEA_REFERENCE_WEIGHT_KG, 20, 300);
  const packWeightKg = clamp(input.packWeightKg ?? 0, 0, 120);
  const mRestWkg = computeRestingMetabolicRateWkg({
    weightKg,
    vo2MaxMlKgMin: input.vo2MaxMlKgMin ?? IEA_REFERENCE_VO2MAX_ML_KG_MIN,
  });
  const loadFactor = computeBackpackLoadFactor(packWeightKg, weightKg, input.carryType ?? 'backpack');
  const { eta } = resolveSurfaceEta(input.surface ?? 'trail', speedMs, {
    snowSinkCm: snowCm,
    wetness,
  });
  const mGrade = computeLcdaGradeTerm(speedMs, input.gradePct);
  const walkTerm = Math.max(0.30, 1.78 * Math.pow(speedMs, 0.58) + 0.27 * Math.pow(speedMs, 4) + mGrade);
  const mLcdaW = weightKg * (mRestWkg + 0.19 + eta * walkTerm * loadFactor);
  const aerobicFraction = clamp(mLcdaW / energetic.pVo2MaxEffW, 0.05, 1.50);

  const speedKmH = speedMs * 3.6;
  const paceMinPerKm = 60 / speedKmH;

  return {
    speedMs,
    speedKmH,
    paceMinPerKm,
    vEnergeticMs,
    vTechMs,
    vGripMs,
    vVisibilityMs,
    limitingConstraint,
    aerobicFraction,
    pVo2MaxEffW: energetic.pVo2MaxEffW,
    mLcdaW,
  };
}
