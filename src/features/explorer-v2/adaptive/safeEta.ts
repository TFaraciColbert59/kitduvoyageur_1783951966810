/**
 * Estimateur d'horaire sécuritaire (Safe ETA) pour Explorer v2.
 *
 * S'appuie sur le moteur canonique `estimateSortiePerformance` de
 * `sortiePerformanceEngine.ts` (Tobler · Minetti · Naismith-Langmuir · SAC · Pandolf)
 * puis applique :
 *   1. Atténuation de la pénalité hypoxique selon l'acclimatation 21 j
 *   2. Multiplicateur surface / cotation technique SAC (T1..T6)
 *   3. Multiplicateur météo / vent sur crête / stress thermique
 *   4. Ralentissement lié à la fatigue (Readiness & DOMS)
 *   5. Élargissement d'incertitude P90 hors ligne (+8 %)
 *   6. Heure limite de demi-tour avant le crépuscule civil (NOAA 100 % hors ligne)
 */

import {
  estimateSortiePerformance,
  formatPreciseDurationFr,
} from '@/features/community/v2/create/sortie/sortiePerformanceEngine';
import {
  computeEffectiveRidgeWind,
  computeOfflineDaylight,
  computeThermalStress,
  estimateHydrationLiters,
} from './environment';
import type {
  SafeEtaFlag,
  SafeEtaInput,
  SafeEtaResult,
  TechnicalGrade,
  TechnicalSurface,
} from './types';

const MS_PER_HOUR = 3_600_000;
const MS_PER_MIN = 60_000;

const SURFACE_MULTIPLIER: Record<TechnicalSurface, number> = {
  paved: 0.96,
  gravel: 1.0,
  trail: 1.03,
  mud: 1.12,
  rocky_alpine: 1.15,
  scree: 1.24,
  snow: 1.28,
  ice: 1.35,
};

const TECHNICAL_GRADE_MULTIPLIER: Record<TechnicalGrade, number> = {
  T1: 1.0,
  T2: 1.04,
  T3: 1.12,
  T4: 1.22,
  T5: 1.35,
  T6: 1.5,
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function estimateSafeEta(input: SafeEtaInput): SafeEtaResult {
  const nbJours = Math.max(1, Math.round(input.nbJours ?? 1));
  const maxAlt = Math.max(0, input.maxAltitudeM ?? 0);
  const meanAlt = Math.max(0, input.meanAltitudeM ?? (maxAlt > 0 ? maxAlt * 0.78 : 0));

  const base = estimateSortiePerformance(
    {
      activity: input.activity,
      distanceKm: input.distanceKm,
      elevationGainM: input.elevationGainM,
      elevationLossM: input.elevationLossM ?? null,
      maxAltitudeM: maxAlt > 0 ? maxAlt : null,
      meanAltitudeM: meanAlt > 0 ? meanAlt : null,
      nbJours,
      packWeightKg: input.packWeightKg ?? null,
    },
    input.participants ?? [],
  );

  const flags: SafeEtaFlag[] = [];

  // 1. Acclimatation altitude (atténue la pénalité hypoxique déjà incluse dans `base`)
  let altitudeAttenuated = 1.0;
  const acclim = input.readiness?.altitudeAcclimatization;
  if (acclim && maxAlt > 1500) {
    const baseAltMult = 1 + base.factors.altitudePenaltyPct / 100;
    if (maxAlt <= acclim.ceilingM + 500 && baseAltMult > 1 && acclim.attenuationFactor > 0) {
      const overshoot = Math.max(0, maxAlt - acclim.ceilingM);
      const effectiveAtten = acclim.attenuationFactor * (1 - overshoot / 600);
      const reducedAltMult = 1 + (baseAltMult - 1) * (1 - clamp(effectiveAtten, 0, 0.65));
      altitudeAttenuated = round(reducedAltMult / baseAltMult, 3);
    } else if (maxAlt > acclim.ceilingM + 500) {
      flags.push('high_altitude_unacclimatized');
      const excessKm = (maxAlt - (acclim.ceilingM + 500)) / 1000;
      altitudeAttenuated = round(1 + clamp(excessKm * 0.045, 0.02, 0.14), 3);
    }
  }

  // 2. Multiplicateur surface & cotation technique
  const surfMult = input.surface ? SURFACE_MULTIPLIER[input.surface] : 1.0;
  const gradeMult = input.technicalGrade ? TECHNICAL_GRADE_MULTIPLIER[input.technicalGrade] : 1.0;
  const technicalSurface = round(clamp(surfMult * gradeMult, 0.94, 1.85), 3);

  // 3. Multiplicateur météo / vent / stress thermique
  const ridgeWind = computeEffectiveRidgeWind(
    input.weather?.windSpeedKmh ?? 0,
    maxAlt,
    Boolean(input.ridgeExposed),
    input.weather?.windGustKmh ?? null,
  );
  const thermal = computeThermalStress(input.weather, ridgeWind.effectiveWindKmh);

  let windPenalty = 1.0;
  if (ridgeWind.hazardLevel === 'storm') windPenalty = 1.3;
  else if (ridgeWind.hazardLevel === 'gale') windPenalty = 1.18;
  else if (ridgeWind.hazardLevel === 'strong') windPenalty = 1.08;
  else if (ridgeWind.hazardLevel === 'breezy') windPenalty = 1.03;

  const precipMmH = Math.max(0, input.weather?.precipitationMmH ?? 0);
  const precipPenalty = precipMmH >= 6 ? 1.14 : precipMmH >= 2 ? 1.06 : 1.0;

  const visM = input.weather?.visibilityM;
  const visPenalty = visM != null && Number.isFinite(visM) && visM < 150 ? 1.15 : 1.0;

  const weatherWind = round(
    clamp(thermal.speedPenaltyFactor * windPenalty * precipPenalty * visPenalty, 1.0, 1.75),
    3,
  );

  if (
    ridgeWind.hazardLevel === 'gale' ||
    ridgeWind.hazardLevel === 'storm' ||
    input.weather?.thunderstormRisk === 'high' ||
    precipMmH >= 6 ||
    thermal.level === 'cold_extreme' ||
    thermal.level === 'heat_extreme'
  ) {
    flags.push('severe_weather');
  }

  // 4. Ralentissement lié à la fatigue / disponibilité
  let readinessMult = 1.0;
  if (input.readiness && input.readiness.score !== null) {
    if (input.readiness.score < 60) {
      readinessMult += (60 - input.readiness.score) * 0.004;
    }
    if (input.readiness.eccentricDomsScore > 45) {
      readinessMult += (input.readiness.eccentricDomsScore - 45) * 0.0018;
    }
    readinessMult = round(clamp(readinessMult, 1.0, 1.32), 3);
    if (readinessMult >= 1.06) {
      flags.push('fatigue_slowdown');
    }
  }

  // 5. Élargissement P90 en mode hors ligne (+8 %)
  const offlineP90Spread = input.offline ? 1.08 : 1.0;
  if (input.offline) {
    flags.push('offline_uncertainty');
  }

  const combinedP50Factor = altitudeAttenuated * technicalSurface * weatherWind * readinessMult;
  const adjustedDurationHoursP50 = round(base.durationHoursP50 * combinedP50Factor, 2);
  const adjustedDurationHoursP90 = round(
    base.durationHoursP90 * combinedP50Factor * offlineP90Spread,
    2,
  );

  const estimatedArrivalP50Ms = Math.round(
    input.departureAtMs + adjustedDurationHoursP50 * MS_PER_HOUR,
  );
  const estimatedArrivalP90Ms = Math.round(
    input.departureAtMs + adjustedDurationHoursP90 * MS_PER_HOUR,
  );

  // 6. Lumière du jour NOAA hors ligne et heure limite de demi-tour
  const daylight = computeOfflineDaylight(input.lat, input.lng, input.departureAtMs);
  const safetyMarginMs = Math.max(0, input.safetyMarginMinutes ?? 30) * MS_PER_MIN;

  let finishesBeforeCivilDuskP50 = true;
  let finishesBeforeCivilDuskP90 = true;
  let turnaroundAtMs: number | null = null;

  if (daylight.status === 'polar_day' && daylight.civilDuskMs === null) {
    finishesBeforeCivilDuskP50 = true;
    finishesBeforeCivilDuskP90 = true;
    turnaroundAtMs = null;
  } else if (daylight.civilDuskMs !== null) {
    const safeCutoffMs = daylight.civilDuskMs - safetyMarginMs;
    finishesBeforeCivilDuskP50 = estimatedArrivalP50Ms <= daylight.civilDuskMs;
    finishesBeforeCivilDuskP90 = estimatedArrivalP90Ms <= daylight.civilDuskMs;

    // Retour estimé à ~45 % de la durée P90 (descente légèrement plus rapide)
    const returnReserveMs = Math.round(adjustedDurationHoursP90 * 0.45 * MS_PER_HOUR);
    turnaroundAtMs = Math.max(input.departureAtMs, safeCutoffMs - returnReserveMs);

    if (!finishesBeforeCivilDuskP90) {
      flags.push('darkness_risk');
    }
    if (turnaroundAtMs <= input.departureAtMs + 30 * MS_PER_MIN) {
      flags.push('turnaround_imminent');
    }
  } else {
    // Nuit polaire sans crépuscule civil
    finishesBeforeCivilDuskP50 = false;
    finishesBeforeCivilDuskP90 = false;
    turnaroundAtMs = input.departureAtMs;
    flags.push('polar_night');
    flags.push('darkness_risk');
  }

  const hydrationLiters = estimateHydrationLiters({
    durationHours: adjustedDurationHoursP90,
    elevationGainM: input.elevationGainM,
    maxAltitudeM: maxAlt,
    weather: input.weather,
    effectiveWindKmh: ridgeWind.effectiveWindKmh,
  });

  const formattedP50 = formatPreciseDurationFr(adjustedDurationHoursP50, nbJours);
  const p50Short = formatPreciseDurationFr(adjustedDurationHoursP50, 1);
  const p90Short = formatPreciseDurationFr(adjustedDurationHoursP90, 1);
  const formattedRange =
    p50Short && p90Short && p50Short !== p90Short ? `${p50Short} – ${p90Short}` : p50Short;

  return {
    baseDurationHoursP50: base.durationHoursP50,
    baseDurationHoursP90: base.durationHoursP90,
    adjustedDurationHoursP50,
    adjustedDurationHoursP90,
    formattedP50,
    formattedRange,
    estimatedArrivalP50Ms,
    estimatedArrivalP90Ms,
    turnaroundAtMs,
    daylight,
    finishesBeforeCivilDuskP50,
    finishesBeforeCivilDuskP90,
    hydrationLiters,
    recommendedLevel: base.recommendedLevel,
    effortScoreKe: base.effortScoreKe,
    multipliers: {
      altitudeAttenuated,
      technicalSurface,
      weatherWind,
      readiness: readinessMult,
      offlineP90Spread,
    },
    flags,
  };
}
