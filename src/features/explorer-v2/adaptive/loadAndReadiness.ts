/**
 * Moteur de charge d'entraînement, récupération et disponibilité (Readiness)
 * pour Explorer v2.
 *
 * Hiérarchie de charge à 4 niveaux :
 *   1. Puissance mesurée (TSS via NP / FTP)
 *   2. Effort relatif cardio (zones FC)
 *   3. sRPE (Foster : RPE 1..10 × durée)
 *   4. Kilomètre-Effort mécanique GPS (via `sortiePerformanceEngine.ts`)
 *
 * Garanties :
 *   - Zéro donnée inventée : en absence d'historique et de biométrie fraîche,
 *     retourne `status: 'cold_start'` avec `score: null` et `band: null`.
 *   - Amortissement bayésien de Bühlmann sur le ratio ACWR (7 j / 28 j) pour
 *     éviter les faux pics en démarrage à froid.
 *   - Plafonnement strict de sécurité si douleur de rééducation déclarée.
 */

import {
  computeRouteDifficulty,
  type SortieActivityKind,
} from '@/features/community/v2/create/sortie/sortiePerformanceEngine';
import type { Sport } from '../state/types';
import type {
  AcwrMetrics,
  AcwrZone,
  AdaptiveCalibrationStatus,
  AltitudeAcclimatization,
  BiometricWellnessSnapshot,
  ExplorerReadiness,
  ReadinessBand,
  ReadinessInput,
  SessionLoadResult,
  SessionRecord,
} from './types';

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function pos(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0;
  return value;
}

export function mapSportToSortieActivity(sport: Sport | SortieActivityKind): SortieActivityKind {
  switch (sport) {
    case 'trail':
    case 'course':
      return 'trail';
    case 'velo':
      return 'velo';
    case 'ski':
      return 'ski';
    case 'escalade':
      return 'escalade';
    case 'rando':
    case 'famille':
    case 'bivouac':
      return 'rando';
    case 'kayak':
    case 'autre':
    default:
      return 'autre';
  }
}

/**
 * Calcule la charge d'entraînement normalisée (échelle homogène type TSS)
 * ainsi que la charge excentrique de descente (DOMS) d'une séance.
 */
export function computeSessionLoadUnits(session: SessionRecord): SessionLoadResult {
  const movingS = Math.max(
    0,
    pos(session.movingS) || Math.max(0, (session.endedAtMs - session.startedAtMs) / 1000),
  );
  const movingMin = movingS / 60;
  const distanceKm = pos(session.distanceKm);
  const gainM = pos(session.elevationGainM);
  const lossM =
    session.elevationLossM != null && Number.isFinite(session.elevationLossM) && session.elevationLossM > 0
      ? session.elevationLossM
      : gainM * 0.85;

  const activity = mapSportToSortieActivity(session.sport);
  let effortScoreKe: number | null = null;
  if (distanceKm > 0 || gainM > 0) {
    const diff = computeRouteDifficulty(
      {
        activity,
        distanceKm,
        elevationGainM: gainM,
        elevationLossM: lossM,
        maxAltitudeM: session.maxAltitudeM ?? null,
        packWeightKg: session.packWeightKg ?? null,
      },
      movingS / 3600,
    );
    effortScoreKe = diff.effortScoreKe;
  }

  // Charge excentrique des descentes (Minetti : freinage excentrique accentué > 12 % de pente)
  const descentGrade = distanceKm > 0 ? lossM / (distanceKm * 1000) : 0;
  const sportEccentricMult =
    session.sport === 'trail' || session.sport === 'course'
      ? 1.35
      : session.sport === 'rando' || session.sport === 'bivouac'
        ? 1.0
        : session.sport === 'ski'
          ? 0.9
          : 0.35;
  const steepMult = descentGrade > 0.12 ? 1 + Math.min(1.2, (descentGrade - 0.12) * 5) : 1;
  const packMult = 1 + Math.min(0.4, Math.max(0, pos(session.packWeightKg) - 3) * 0.025);
  const eccentricLoadUnits = round((lossM / 100) * 4.5 * sportEccentricMult * steepMult * packMult, 1);

  // Tier 1 : Puissance mesurée (TSS = (s * NP * IF) / (FTP * 3600) * 100)
  const np = pos(session.normalizedPowerW);
  const ftp = pos(session.ftpW);
  if (np > 0 && ftp > 0 && movingS > 0) {
    const intensityFactor = clamp(np / ftp, 0.2, 2.0);
    const tss = ((movingS * np * intensityFactor) / (ftp * 3600)) * 100;
    return {
      loadUnits: round(clamp(tss, 0, 600), 1),
      tier: 'power_tss',
      eccentricLoadUnits,
      effortScoreKe,
    };
  }

  // Tier 2 : Effort relatif cardio (zones FC)
  const hrEffort = pos(session.hrRelativeEffort);
  if (hrEffort > 0) {
    return {
      loadUnits: round(clamp(hrEffort * 0.5, 0, 600), 1),
      tier: 'hr_relative_effort',
      eccentricLoadUnits,
      effortScoreKe,
    };
  }

  // Tier 3 : sRPE (Foster : RPE 1..10 × minutes)
  if (
    session.rpe != null &&
    Number.isFinite(session.rpe) &&
    session.rpe >= 1 &&
    session.rpe <= 10 &&
    movingMin > 0
  ) {
    const sRpe = session.rpe * movingMin;
    return {
      loadUnits: round(clamp(sRpe * 0.22, 0, 600), 1),
      tier: 'srpe',
      eccentricLoadUnits,
      effortScoreKe,
    };
  }

  // Tier 4 : Charge mécanique GPS via Kilomètre-Effort (`sortiePerformanceEngine.ts`)
  const loadUnits =
    effortScoreKe != null && effortScoreKe > 0
      ? effortScoreKe * 3.8 * packMult
      : movingMin * 0.65;

  return {
    loadUnits: round(clamp(loadUnits, 0, 600), 1),
    tier: 'gps_mechanical_ke',
    eccentricLoadUnits,
    effortScoreKe,
  };
}

function scoreWellnessSnapshot(
  wellness: BiometricWellnessSnapshot | null | undefined,
  nowMs: number,
): number | null {
  if (!wellness) return null;
  const ageHours = (nowMs - wellness.recordedAtMs) / MS_PER_HOUR;
  if (!Number.isFinite(ageHours) || ageHours < -6 || ageHours > 72) return null;

  const components: Array<{ score: number; weight: number }> = [];

  if (wellness.sleepHours != null && Number.isFinite(wellness.sleepHours) && wellness.sleepHours > 0) {
    const sleepScore =
      wellness.sleepHours >= 7.5 && wellness.sleepHours <= 9.5
        ? 95
        : wellness.sleepHours < 7.5
          ? clamp((wellness.sleepHours / 7.5) * 90, 20, 92)
          : clamp(95 - (wellness.sleepHours - 9.5) * 10, 65, 95);
    components.push({ score: sleepScore, weight: 0.28 });
  }

  if (wellness.sleepQuality != null && Number.isFinite(wellness.sleepQuality)) {
    const normalizedQuality =
      wellness.sleepQuality <= 5
        ? clamp(((wellness.sleepQuality - 1) / 4) * 100, 10, 100)
        : clamp(wellness.sleepQuality, 0, 100);
    components.push({ score: normalizedQuality, weight: 0.16 });
  }

  if (
    wellness.hrvMs != null &&
    wellness.baselineHrvMs != null &&
    wellness.hrvMs > 0 &&
    wellness.baselineHrvMs > 0
  ) {
    const ratio = wellness.hrvMs / wellness.baselineHrvMs;
    const hrvScore = clamp(75 + (ratio - 1.0) * 120, 15, 100);
    components.push({ score: hrvScore, weight: 0.26 });
  }

  if (
    wellness.restingHrBpm != null &&
    wellness.baselineRestingHrBpm != null &&
    wellness.restingHrBpm > 25 &&
    wellness.baselineRestingHrBpm > 25
  ) {
    const deltaBpm = wellness.restingHrBpm - wellness.baselineRestingHrBpm;
    // +10 bpm au-dessus de la base signale fatigue/infection potentielle
    const rhrScore = clamp(85 - deltaBpm * 6, 15, 100);
    components.push({ score: rhrScore, weight: 0.16 });
  }

  if (wellness.sorenessLevel != null && Number.isFinite(wellness.sorenessLevel)) {
    const sorenessScore = clamp(100 - wellness.sorenessLevel * 9, 10, 100);
    components.push({ score: sorenessScore, weight: 0.14 });
  }

  if (wellness.subjectiveEnergy != null && Number.isFinite(wellness.subjectiveEnergy)) {
    const energyScore = clamp(((wellness.subjectiveEnergy - 1) / 4) * 90 + 10, 10, 100);
    components.push({ score: energyScore, weight: 0.14 });
  }

  if (components.length === 0) return null;
  const totalWeight = components.reduce((acc, item) => acc + item.weight, 0);
  const weighted = components.reduce((acc, item) => acc + item.score * item.weight, 0) / totalWeight;
  return Math.round(clamp(weighted, 0, 100));
}

function computeAltitudeAcclimatization(
  sessions: readonly SessionRecord[],
  nowMs: number,
  homeAltitudeM: number | null | undefined,
): AltitudeAcclimatization {
  const baseAlt = Math.max(0, pos(homeAltitudeM));
  const baselineCeiling = Math.max(1800, baseAlt + 600);
  const window21dStart = nowMs - 21 * MS_PER_DAY;

  const highSessions = sessions.filter(
    (s) => s.endedAtMs <= nowMs && s.endedAtMs >= window21dStart && pos(s.maxAltitudeM) > 1500,
  );

  if (highSessions.length === 0) {
    return {
      ceilingM: Math.round(baselineCeiling),
      recentHighAltitudeSessions: 0,
      highestRecentAltitudeM: null,
      attenuationFactor: baseAlt >= 1500 ? round(clamp((baseAlt - 1200) / 3000, 0.05, 0.35), 2) : 0,
    };
  }

  let weightedPeakSum = 0;
  let weightSum = 0;
  let highestRecentAltitudeM = 0;

  for (const s of highSessions) {
    const peak = pos(s.maxAltitudeM);
    if (peak > highestRecentAltitudeM) highestRecentAltitudeM = peak;
    const ageDays = Math.max(0, (nowMs - s.endedAtMs) / MS_PER_DAY);
    const decay = Math.exp(-ageDays / 14);
    const durationWeight = clamp(pos(s.movingS) / 7200, 0.4, 2.0);
    const w = decay * durationWeight;
    weightedPeakSum += peak * w;
    weightSum += w;
  }

  const effectiveExposedAlt = weightSum > 0 ? weightedPeakSum / weightSum : baselineCeiling;
  const exposureCredibility = clamp(weightSum / (weightSum + 1.8), 0, 0.85);
  const gainedCeiling = Math.max(
    baselineCeiling,
    baselineCeiling + exposureCredibility * Math.max(0, effectiveExposedAlt + 250 - baselineCeiling),
  );
  const ceilingM = Math.round(Math.min(5800, gainedCeiling));
  const attenuationFactor = round(clamp(exposureCredibility * 0.72, 0, 0.65), 2);

  return {
    ceilingM,
    recentHighAltitudeSessions: highSessions.length,
    highestRecentAltitudeM: Math.round(highestRecentAltitudeM),
    attenuationFactor,
  };
}

function classifyAcwrZone(dampedRatio: number | null): AcwrZone {
  if (dampedRatio === null) return 'insufficient_data';
  if (dampedRatio < 0.75) return 'undertrained';
  if (dampedRatio <= 1.3) return 'sweet_spot';
  if (dampedRatio <= 1.5) return 'caution';
  return 'spike';
}

/**
 * Calcule l'état de préparation adaptatif Explorer (Readiness 0–100, ACWR EWMA,
 * dette 96 h + DOMS excentrique, acclimatation altitude 21 j, plafond douleur).
 */
export function computeExplorerReadiness(
  input: ReadinessInput,
  nowMs: number,
): ExplorerReadiness {
  const window28dStart = nowMs - 28 * MS_PER_DAY;
  const window96hStart = nowMs - 96 * MS_PER_HOUR;
  const window72hStart = nowMs - 72 * MS_PER_HOUR;

  const validSessions28d = input.sessions.filter(
    (s) => Number.isFinite(s.endedAtMs) && s.endedAtMs <= nowMs && s.endedAtMs >= window28dStart,
  );

  const wellnessScore = scoreWellnessSnapshot(input.wellness, nowMs);
  const altitudeAcclimatization = computeAltitudeAcclimatization(
    input.sessions,
    nowMs,
    input.homeAltitudeM,
  );

  // Douleur rééducation active (snapshot bien-être frais ou séance < 72 h)
  const painCandidates: number[] = [];
  if (
    input.wellness?.rehabPainLevel != null &&
    Number.isFinite(input.wellness.rehabPainLevel) &&
    (nowMs - input.wellness.recordedAtMs) / MS_PER_HOUR <= 72
  ) {
    painCandidates.push(clamp(input.wellness.rehabPainLevel, 0, 10));
  }
  for (const s of validSessions28d) {
    if (
      s.endedAtMs >= window72hStart &&
      s.rehabPainLevel != null &&
      Number.isFinite(s.rehabPainLevel)
    ) {
      painCandidates.push(clamp(s.rehabPainLevel, 0, 10));
    }
  }
  const activeRehabPainLevel =
    painCandidates.length > 0 ? Math.max(...painCandidates) : null;

  // Zéro mock : sans séance 28 j ni biométrie fraîche ni douleur déclarée -> cold_start
  if (validSessions28d.length === 0 && wellnessScore === null && activeRehabPainLevel === null) {
    return {
      status: 'cold_start',
      score: null,
      band: null,
      confidence: 0,
      acwr: {
        acuteLoad7d: 0,
        chronicLoad28d: 0,
        rawRatio: null,
        dampedRatio: null,
        credibilityWeight: 0,
        zone: 'insufficient_data',
      },
      recoveryDebt96h: 0,
      eccentricDomsScore: 0,
      wellnessScore: null,
      rehabPainCapApplied: false,
      activeRehabPainLevel: null,
      altitudeAcclimatization,
      aerobicEnduranceIndex: null,
      daysWithData: 0,
      sessionCount28d: 0,
      summaryFr:
        'Calibration initiale requise : aucune sortie récente ni mesure de récupération enregistrée.',
      computedAtMs: nowMs,
    };
  }

  // Remplissage des 28 seaux journaliers (d = 0 -> il y a 27 jours, d = 27 -> aujourd'hui)
  const dailyLoads = new Array<number>(28).fill(0);
  const activeDayIndices = new Set<number>();
  let totalMovingHours28d = 0;
  let totalGainM28d = 0;
  let recoveryDebtRaw = 0;
  let eccentricDomsRaw = 0;

  for (const session of validSessions28d) {
    const loadRes = computeSessionLoadUnits(session);
    const daysAgo = Math.floor((nowMs - session.endedAtMs) / MS_PER_DAY);
    const bucketIdx = clamp(27 - daysAgo, 0, 27);
    dailyLoads[bucketIdx] += loadRes.loadUnits;
    activeDayIndices.add(bucketIdx);

    totalMovingHours28d += pos(session.movingS) / 3600;
    totalGainM28d += pos(session.elevationGainM);

    if (session.endedAtMs >= window96hStart) {
      const ageHours = Math.max(0, (nowMs - session.endedAtMs) / MS_PER_HOUR);
      // Décroissance métabolique exponentielle (demi-vie ~26 h)
      recoveryDebtRaw += loadRes.loadUnits * Math.exp(-ageHours / 36);
      // Courbe DOMS excentrique (pic entre 18 h et 48 h après la descente)
      const domsKernel = Math.exp(-Math.pow((ageHours - 28) / 36, 2));
      eccentricDomsRaw += loadRes.eccentricLoadUnits * domsKernel;
    }
  }

  const daysWithData = activeDayIndices.size;
  const oldestBucket = daysWithData > 0 ? Math.min(...activeDayIndices) : 27;
  const observedSpanDays = daysWithData > 0 ? 28 - oldestBucket : 0;

  // EWMA ACWR (Williams et al. 2017) : lambda_a = 2/(7+1), lambda_c = 2/(28+1)
  const lambdaAcute = 2 / (7 + 1);
  const lambdaChronic = 2 / (28 + 1);
  let ewmaAcute = 0;
  let ewmaChronic = 0;

  if (daysWithData > 0) {
    // Amorçage sur la charge quotidienne moyenne observée dans l'historique disponible
    // afin d'éviter un ratio artificiellement explosif si l'historique démarre à J-5
    const sumEarly = dailyLoads
      .slice(oldestBucket, Math.min(28, oldestBucket + 7))
      .reduce((a, b) => a + b, 0);
    const earlyDays = Math.max(1, Math.min(7, 28 - oldestBucket));
    const seedLoad = sumEarly / earlyDays;
    ewmaAcute = seedLoad;
    ewmaChronic = seedLoad;

    for (let d = oldestBucket; d < 28; d += 1) {
      const load = dailyLoads[d];
      ewmaAcute = load * lambdaAcute + (1 - lambdaAcute) * ewmaAcute;
      ewmaChronic = load * lambdaChronic + (1 - lambdaChronic) * ewmaChronic;
    }
  }

  // Crédibilité empirique de Bühlmann (demi-saturation K = 6 jours actifs)
  const credibilityWeight = round(daysWithData / (daysWithData + 6), 3);
  const rawRatio = ewmaChronic > 1.5 ? round(ewmaAcute / ewmaChronic, 2) : null;
  const dampedRatio =
    rawRatio !== null
      ? round(credibilityWeight * rawRatio + (1 - credibilityWeight) * 1.0, 2)
      : null;

  const acwr: AcwrMetrics = {
    acuteLoad7d: round(ewmaAcute, 1),
    chronicLoad28d: round(ewmaChronic, 1),
    rawRatio,
    dampedRatio,
    credibilityWeight,
    zone: classifyAcwrZone(dampedRatio),
  };

  // Normalisation de la dette 96 h et du DOMS excentrique en 0..100
  const chronicReference = Math.max(45, ewmaChronic * 2.2);
  const recoveryDebt96h = Math.round(clamp((recoveryDebtRaw / (chronicReference * 2.4)) * 100, 0, 100));
  const eccentricDomsScore = Math.round(clamp((eccentricDomsRaw / 95) * 100, 0, 100));

  // Indice d'endurance aérobie (0..100)
  const aerobicEnduranceIndex =
    validSessions28d.length > 0
      ? Math.round(
          clamp(
            18 +
              Math.min(44, ewmaChronic * 0.72) +
              Math.min(22, totalMovingHours28d * 0.9) +
              Math.min(16, (totalGainM28d / 1000) * 1.8),
            10,
            100,
          ),
        )
      : null;

  // Score de balance ACWR (0..100)
  let acwrScore: number | null = null;
  if (dampedRatio !== null) {
    if (dampedRatio >= 0.8 && dampedRatio <= 1.25) {
      acwrScore = 92;
    } else if (dampedRatio < 0.8) {
      acwrScore = clamp(92 - (0.8 - dampedRatio) * 55, 55, 92);
    } else if (dampedRatio <= 1.5) {
      acwrScore = clamp(92 - (dampedRatio - 1.25) * 130, 52, 92);
    } else {
      acwrScore = clamp(52 - (dampedRatio - 1.5) * 95, 12, 52);
    }
  }

  // Score de fraîcheur neuromusculaire sur 96 h (0..100)
  const freshnessScore =
    validSessions28d.length > 0
      ? clamp(100 - recoveryDebt96h * 0.65 - eccentricDomsScore * 0.35, 10, 100)
      : null;

  // Combinaison pondérée des piliers réellement disponibles
  const scoreParts: Array<{ score: number; weight: number }> = [];
  if (acwrScore !== null) scoreParts.push({ score: acwrScore, weight: 0.35 });
  if (freshnessScore !== null) scoreParts.push({ score: freshnessScore, weight: 0.35 });
  if (wellnessScore !== null) scoreParts.push({ score: wellnessScore, weight: 0.3 });

  let rawScore =
    scoreParts.length > 0
      ? scoreParts.reduce((sum, p) => sum + p.score * p.weight, 0) /
        scoreParts.reduce((sum, p) => sum + p.weight, 0)
      : 65;

  // Plafond de sécurité douleur rééducation
  let rehabPainCapApplied = false;
  if (activeRehabPainLevel !== null) {
    if (activeRehabPainLevel >= 7) {
      rawScore = Math.min(rawScore, 28);
      rehabPainCapApplied = true;
    } else if (activeRehabPainLevel >= 4) {
      rawScore = Math.min(rawScore, 58);
      rehabPainCapApplied = true;
    }
  }

  const score = Math.round(clamp(rawScore, 0, 100));

  let band: ReadinessBand;
  if (rehabPainCapApplied && (activeRehabPainLevel ?? 0) >= 7) {
    band = 'rehab_guarded';
  } else if (score >= 82) {
    band = 'peak';
  } else if (score >= 65) {
    band = 'ready';
  } else if (score >= 45) {
    band = 'moderate';
  } else {
    band = 'recover';
  }

  const status: AdaptiveCalibrationStatus =
    daysWithData >= 7 && observedSpanDays >= 14 ? 'calibrated' : 'partial';

  const confidence = round(
    clamp(
      0.18 +
        credibilityWeight * 0.52 +
        (wellnessScore !== null ? 0.18 : 0) +
        (observedSpanDays >= 14 ? 0.12 : (observedSpanDays / 14) * 0.12),
      0.15,
      0.98,
    ),
    2,
  );

  let summaryFr: string;
  if (band === 'rehab_guarded') {
    summaryFr = `Douleur rééducation élevée (${activeRehabPainLevel}/10) : charge strictement limitée, privilégier le repos ou une mobilité douce.`;
  } else if (acwr.zone === 'spike') {
    summaryFr = `Pic de charge récent (ACWR ${acwr.dampedRatio}) : alléger l’intensité et favoriser la récupération.`;
  } else if (band === 'peak') {
    summaryFr = 'Forme optimale : charge équilibrée et récupération complète pour un objectif engagé.';
  } else if (band === 'ready') {
    summaryFr = 'Bonne disponibilité : tu peux planifier une sortie habituelle en endurance ou dénivelé.';
  } else if (band === 'moderate') {
    summaryFr = 'Fatigue modérée détectée : privilégier une sortie progressive avec marge horaire.';
  } else {
    summaryFr = 'Récupération prioritaire : charge accumulée ou fraîcheur basse sur les dernières 96 h.';
  }

  return {
    status,
    score,
    band,
    confidence,
    acwr,
    recoveryDebt96h,
    eccentricDomsScore,
    wellnessScore,
    rehabPainCapApplied,
    activeRehabPainLevel,
    altitudeAcclimatization,
    aerobicEnduranceIndex,
    daysWithData,
    sessionCount28d: validSessions28d.length,
    summaryFr,
    computedAtMs: nowMs,
  };
}
