/**
 * Moteur biomécanique et statistique d'estimation de durée et de difficulté
 * d'une Sortie (solo à la création, puis évolutif selon la densité statistique
 * de chaque participant inscrit).
 *
 * Combine :
 * 1. Les statistiques personnelles en base de chaque participant :
 *    - `user_performance_profiles` (vitesses plat / montée / descente, modèle de pauses,
 *      courbe de fatigue, réponse au portage, niveau de calibration, score de confiance,
 *      `sample_count`)
 *    - `hike_sessions` (historique de sorties GPS enregistrées : nombre de sorties,
 *      km cumulés, D+ cumulé, vitesse médiane observée)
 *    - `trip_member_profiles` (profil terrain membre : vitesses, poids du sac, capacité max,
 *      niveau d'expérience)
 *    - `user_profiles` (niveau d'expérience global)
 * 2. Les modèles scientifiques de référence en locomotion de montagne :
 *    - Fonction exponentielle de Tobler (1993) sur la pente moyenne
 *    - Coût métabolique en pente de Minetti et al. (2002) (freinage excentrique en descente raide)
 *    - Règle de Naismith (1892) + corrections de descente de Langmuir (1984)
 *    - Combinaison harmonisée Club Alpin Suisse / DIN 33466 (temps horizontal + vertical)
 *    - Équation de portage de Pandolf / Givoni-Goldman (1977) (poids du kit / sac à dos)
 *    - Déclin hypoxique de la VO2max en altitude (ACSM / Bassett & Howley, > 1 500 m)
 *    - Facteur d'endurance non-linéaire de Tranter & fatigue cumulée multi-jours
 * 3. L'agrégation collective par densité statistique (crédibilité bayésienne de Bühlmann) :
 *    - À la création (1 participant = l'organisateur), le temps dépend du profil de l'organisateur
 *      pondéré par sa densité statistique.
 *    - Plus des participants rejoignent la sortie, plus la densité de statistiques de chacun
 *      (`sample_count`, sorties GPS, confiance) déplace le temps collectif (cohésion d'allure
 *      autour du membre limitant pondéré par sa crédibilité + friction de groupe).
 */

export type SortieActivityKind = 'rando' | 'trail' | 'ski' | 'velo' | 'escalade' | 'autre';
export type SortieDifficultyLevel = 'tres_facile' | 'facile' | 'moyen' | 'difficile' | 'expert';

export interface ParticipantPerformanceStats {
  userId: string;
  /** Vitesse à plat apprise (km/h) depuis `user_performance_profiles` ou `trip_member_profiles`. */
  flatSpeedKmh?: number | null;
  /** Vitesse ascensionnelle apprise (m D+/h). */
  ascentSpeedMPerH?: number | null;
  /** Vitesse de descente apprise (m D-/h). */
  descentSpeedMPerH?: number | null;
  /** Poids de sac habituel ou déclaré (kg). */
  packWeightKg?: number | null;
  /** Capacité maximale de portage confortable (kg). */
  maxCarryKg?: number | null;
  /** Niveau d'expérience déclaré (`beginner`, `intermediate`, `advanced`, `expert`). */
  experienceLevel?: string | null;
  /** Niveau de calibration du profil terrain (`cold`, `calibration`, `personalization`, `contextualization`). */
  calibrationLevel?: string | null;
  /** Score de confiance [0..1] du profil terrain (`user_performance_profiles.confidence.score`). */
  confidenceScore?: number | null;
  /** Nombre d'échantillons GPS du profil terrain (`user_performance_profiles.sample_count`). */
  sampleCount?: number | null;
  /** Nombre de sorties GPS enregistrées dans `hike_sessions`. */
  recordedOutingsCount?: number | null;
  /** Distance totale cumulée sur les sorties enregistrées (km). */
  totalRecordedKm?: number | null;
  /** D+ total cumulé sur les sorties enregistrées (m). */
  totalRecordedDplusM?: number | null;
  /** Vitesse équivalente à plat observée sur les sorties enregistrées (km/h). */
  observedFlatSpeedKmh?: number | null;
  /** Vitesse ascensionnelle observée sur les sorties enregistrées (m/h). */
  observedAscentSpeedMPerH?: number | null;
  /** Modèle de pauses personnel (min par heure de marche). */
  pauseMinutesPerHour?: number | null;
  /** Modèle de pauses personnel (min par 100 m de D+). */
  pauseMinutesPer100mDplus?: number | null;
  /** Niveau de progression du compte (`user_profiles.level`). */
  userLevel?: number | null;
  /** Enfant dans le groupe (allure prudente). */
  isChild?: boolean;
}

export interface DayRouteMetrics {
  dayNumber: number;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM?: number | null;
}

export interface SortieRouteInput {
  activity: SortieActivityKind;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM?: number | null;
  maxAltitudeM?: number | null;
  meanAltitudeM?: number | null;
  nbJours?: number | null;
  /** Poids du kit rattaché ou du sac estimé (kg). */
  packWeightKg?: number | null;
  /** Découpage optionnel par jour si le tracé est réparti sur J1..JN. */
  daysMetrics?: ReadonlyArray<DayRouteMetrics>;
}

export interface ParticipantResolvedMetrics {
  userId: string;
  /** Densité statistique individuelle [0.08 .. 0.98]. */
  statDensity: number;
  /** Nombre total d'observations/sorties terrain de ce participant. */
  observationsCount: number;
  effectiveFlatSpeedKmh: number;
  effectiveAscentSpeedMPerH: number;
  effectiveDescentSpeedMPerH: number;
  individualDurationHours: number;
  individualMovingHours: number;
  individualPauseMinutes: number;
}

export interface SortiePerformanceEstimate {
  /** Durée totale P50 en heures décimales (temps de marche + pauses physiologiques). */
  durationHoursP50: number;
  /** Durée totale P90 (marge météo / aléas / fatigue / groupe) en heures décimales. */
  durationHoursP90: number;
  /** Temps de déplacement actif hors pauses (heures). */
  movingHours: number;
  /** Temps de pauses physiologiques et de regroupement (minutes). */
  pauseMinutes: number;
  /** Chaîne formatée principale pour le champ `duration` (ex: "4 h 30" ou "2 j · 9 h 45"). */
  formattedDuration: string;
  /** Fourchette P50–P90 lisible (ex: "4 h 30 – 5 h 05"). */
  formattedRange: string;
  /** Niveau de difficulté recommandé sur l'échelle à 5 niveaux. */
  recommendedLevel: SortieDifficultyLevel;
  /** Kilomètre-Effort journalier équivalent (FFRP / Club Alpin). */
  effortScoreKe: number;
  /** Indice IBP international d'effort physique (0..250+). */
  ibpIndex: number;
  /** Vitesse horizontale effective du groupe (km/h). */
  effectiveFlatSpeedKmh: number;
  /** Vitesse ascensionnelle effective du groupe (m/h). */
  effectiveAscentSpeedMPerH: number;
  /** Vitesse de descente effective du groupe (m/h). */
  effectiveDescentSpeedMPerH: number;
  /** Nombre de participants intégrés dans l'estimation. */
  participantCount: number;
  /** Densité statistique collective [0..1] et en pourcentage [0..100]. */
  collectiveStatDensity: number;
  collectiveStatDensityPct: number;
  /** Nombre cumulé de sorties/échantillons terrain analysés sur l'ensemble des inscrits. */
  totalAnalyzedOutings: number;
  /** Variation de durée induite par les participants par rapport au créateur seul (en minutes). */
  groupDeltaMinutes: number;
  /** Facteurs détaillés pour l'explicabilité dans l'interface. */
  factors: {
    modelLabel: string;
    altitudePenaltyPct: number;
    packPenaltyPct: number;
    fatiguePenaltyPct: number;
    groupCohesionPenaltyPct: number;
    perDayHoursP50: number[];
    perDayFormatted: string[];
  };
}

interface ActivityBaseline {
  flatKmh: number;
  ascentMPerH: number;
  descentMPerH: number;
  keDistanceDivisor: number;
  keAscentDivisor: number;
  pauseMinPerHour: number;
  pauseMinPer100m: number;
}

/**
 * Référentiel biomécanique par activité (littérature Tobler / Minetti / SAC / FFRP).
 */
export const ACTIVITY_BASELINES: Record<SortieActivityKind, ActivityBaseline> = {
  rando: {
    flatKmh: 4.2,
    ascentMPerH: 350,
    descentMPerH: 520,
    keDistanceDivisor: 1.0,
    keAscentDivisor: 100,
    pauseMinPerHour: 5,
    pauseMinPer100m: 1.8,
  },
  trail: {
    flatKmh: 8.2,
    ascentMPerH: 620,
    descentMPerH: 880,
    keDistanceDivisor: 1.25,
    keAscentDivisor: 115,
    pauseMinPerHour: 2.5,
    pauseMinPer100m: 0.8,
  },
  ski: {
    flatKmh: 3.8,
    ascentMPerH: 380,
    descentMPerH: 1350,
    keDistanceDivisor: 1.05,
    keAscentDivisor: 100,
    pauseMinPerHour: 6,
    pauseMinPer100m: 2.2,
  },
  velo: {
    flatKmh: 16.5,
    ascentMPerH: 550,
    descentMPerH: 2100,
    keDistanceDivisor: 2.8,
    keAscentDivisor: 120,
    pauseMinPerHour: 4,
    pauseMinPer100m: 1.2,
  },
  escalade: {
    flatKmh: 3.2,
    ascentMPerH: 260,
    descentMPerH: 400,
    keDistanceDivisor: 0.8,
    keAscentDivisor: 80,
    pauseMinPerHour: 8,
    pauseMinPer100m: 2.5,
  },
  autre: {
    flatKmh: 4.0,
    ascentMPerH: 340,
    descentMPerH: 500,
    keDistanceDivisor: 1.0,
    keAscentDivisor: 100,
    pauseMinPerHour: 5,
    pauseMinPer100m: 1.8,
  },
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function pos(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0;
  return value;
}

function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function experienceMultiplier(rawLevel: string | null | undefined, userLevel?: number | null): number {
  const norm = (rawLevel ?? '').trim().toLowerCase();
  let base = 1.0;
  if (norm === 'beginner' || norm === 'debut' || norm === 'debutant') base = 0.88;
  else if (norm === 'advanced' || norm === 'aguerri' || norm === 'avance') base = 1.1;
  else if (norm === 'expert') base = 1.18;
  else if (norm === 'intermediate' || norm === 'regulier' || norm === 'intermediaire') base = 1.02;

  const lvl = pos(userLevel);
  const levelBonus = lvl > 1 ? Math.min(0.05, (lvl - 1) * 0.0025) : 0;
  return base + levelBonus;
}

function calibrationConfidenceScore(
  calibrationLevel: string | null | undefined,
  explicitConfidence?: number | null,
): number {
  if (explicitConfidence != null && Number.isFinite(explicitConfidence) && explicitConfidence > 0) {
    return clamp(explicitConfidence, 0.05, 0.99);
  }
  const norm = (calibrationLevel ?? '').trim().toLowerCase();
  if (norm === 'contextualization') return 0.92;
  if (norm === 'personalization') return 0.78;
  if (norm === 'calibration') return 0.52;
  return 0.14;
}

/**
 * Calcule la densité statistique [0.08 .. 0.98] d'un participant selon la formule
 * de crédibilité empirique de Bühlmann :
 * - volume d'observations terrain (`sampleCount` + `recordedOutingsCount`, demi-saturation K = 5)
 * - niveau de confiance du profil (`confidenceScore` / `calibrationLevel`)
 * - complétude des métriques biomécaniques connues.
 */
export function computeParticipantStatDensity(stats?: ParticipantPerformanceStats | null): {
  density: number;
  observationsCount: number;
} {
  if (!stats) return { density: 0.08, observationsCount: 0 };

  const samples = Math.max(0, Math.round(pos(stats.sampleCount)));
  const outings = Math.max(0, Math.round(pos(stats.recordedOutingsCount)));
  const observationsCount = Math.max(samples, outings) + Math.min(samples, outings) * 0.5;
  const sampleCredibility = observationsCount / (observationsCount + 5);

  const conf = calibrationConfidenceScore(stats.calibrationLevel, stats.confidenceScore);

  let knownFields = 0;
  if (pos(stats.flatSpeedKmh) > 0 || pos(stats.observedFlatSpeedKmh) > 0) knownFields += 1;
  if (pos(stats.ascentSpeedMPerH) > 0 || pos(stats.observedAscentSpeedMPerH) > 0) knownFields += 1;
  if (pos(stats.descentSpeedMPerH) > 0) knownFields += 1;
  if (pos(stats.packWeightKg) > 0 || pos(stats.maxCarryKg) > 0) knownFields += 1;
  if (stats.experienceLevel && stats.experienceLevel.trim().length > 0) knownFields += 1;
  const completeness = knownFields / 5;

  if (observationsCount === 0 && knownFields === 0) {
    return { density: 0.08, observationsCount: 0 };
  }

  const rawDensity = 0.55 * sampleCredibility + 0.25 * conf + 0.2 * completeness;
  return {
    density: round(clamp(rawDensity, 0.08, 0.98), 3),
    observationsCount: Math.round(observationsCount),
  };
}

/**
 * Formate une durée en heures décimales au format français lisible (« 4 h 30 », « 45 min »).
 * Arrondit au pas de 5 minutes pour refléter la précision fine des statistiques.
 */
export function formatPreciseDurationFr(hours: number, nbJours = 1): string {
  if (!Number.isFinite(hours) || hours <= 0) return '';
  const totalMin = Math.max(15, Math.round((hours * 60) / 5) * 5);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const timePart =
    h === 0 ? `${m} min` : m > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  if (nbJours > 1) {
    return `${nbJours} j · ${timePart}`;
  }
  return timePart;
}

/**
 * Calcule le facteur de correction de descente de Langmuir & Minetti :
 * - pente douce (5 % à 16 %) : descente fluide (gain de temps léger)
 * - pente raide (> 18 %) : freinage excentrique quadriceps (pénalité Minetti 2002).
 */
function langmuirDescentFactor(descentGrade: number, isChild = false): number {
  if (descentGrade <= 0) return 1.0;
  if (descentGrade >= 0.24) return isChild ? 1.48 : 1.32;
  if (descentGrade >= 0.17) return isChild ? 1.3 : 1.18;
  if (descentGrade >= 0.05 && descentGrade <= 0.14) return isChild ? 1.0 : 0.92;
  return 1.0;
}

/**
 * Calcule les vitesses effectives et la durée individuelle d'un participant sur la route.
 */
export function resolveParticipantMetrics(
  stats: ParticipantPerformanceStats | null | undefined,
  route: SortieRouteInput,
): {
  resolved: ParticipantResolvedMetrics;
  altitudePenaltyPct: number;
  packPenaltyPct: number;
  fatiguePenaltyPct: number;
} {
  const activity = route.activity in ACTIVITY_BASELINES ? route.activity : 'rando';
  const baseline = ACTIVITY_BASELINES[activity];
  const { density, observationsCount } = computeParticipantStatDensity(stats);
  const expMult = experienceMultiplier(stats?.experienceLevel, stats?.userLevel);
  const childMult = stats?.isChild ? 0.85 : 1.0;

  const priorFlat = baseline.flatKmh * expMult * childMult;
  const priorAscent = baseline.ascentMPerH * expMult * childMult;
  const priorDescent = baseline.descentMPerH * expMult * childMult;

  // Les profils appris en base sont étalonnés sur la marche ('hiking', base 4.2 km/h / 350 m/h).
  // On transpose le ratio athlétique de l'utilisateur vers l'activité de la sortie.
  const hikingBase = ACTIVITY_BASELINES.rando;
  const rawFlat = pos(stats?.flatSpeedKmh) || pos(stats?.observedFlatSpeedKmh);
  const rawAscent = pos(stats?.ascentSpeedMPerH) || pos(stats?.observedAscentSpeedMPerH);
  const rawDescent = pos(stats?.descentSpeedMPerH);

  const obsFlat =
    rawFlat > 0
      ? clamp((rawFlat / hikingBase.flatKmh) * baseline.flatKmh, baseline.flatKmh * 0.55, baseline.flatKmh * 1.65)
      : priorFlat;
  const obsAscent =
    rawAscent > 0
      ? clamp(
          (rawAscent / hikingBase.ascentMPerH) * baseline.ascentMPerH,
          baseline.ascentMPerH * 0.5,
          baseline.ascentMPerH * 1.8,
        )
      : priorAscent;
  const obsDescent =
    rawDescent > 0
      ? clamp(
          (rawDescent / hikingBase.descentMPerH) * baseline.descentMPerH,
          baseline.descentMPerH * 0.55,
          baseline.descentMPerH * 1.75,
        )
      : priorDescent;

  // Rétrécissement bayésien (Bühlmann) pondéré par la densité statistique du participant
  const effectiveFlatSpeedKmh = round((density * obsFlat + (1 - density) * priorFlat) * childMult, 2);
  const effectiveAscentSpeedMPerH = Math.round(
    (density * obsAscent + (1 - density) * priorAscent) * childMult,
  );
  const effectiveDescentSpeedMPerH = Math.round(
    (density * obsDescent + (1 - density) * priorDescent) * childMult,
  );

  const km = pos(route.distanceKm);
  const gainM = pos(route.elevationGainM);
  const lossM = route.elevationLossM != null && route.elevationLossM > 0 ? pos(route.elevationLossM) : gainM * 0.9;
  const nbJours = Math.max(1, Math.round(pos(route.nbJours) || 1));

  // Pente moyenne de montée et de descente
  const ascentGrade = km > 0 ? gainM / (km * 1000) : 0;
  const descentGrade = km > 0 ? lossM / (km * 1000) : 0;

  // Modulation exponentielle de Tobler sur l'allure horizontale
  const toblerMod = clamp(Math.exp(-1.65 * Math.max(0, ascentGrade - 0.04)), 0.58, 1.08);
  const horizontalHours = km > 0 ? km / (effectiveFlatSpeedKmh * toblerMod) : 0;

  // Composante ascensionnelle (Naismith + coût métabolique Minetti sur pente très raide > 18 %)
  const steepAscentPenalty = 1 + 0.35 * Math.max(0, ascentGrade - 0.18);
  const ascentHours = gainM > 0 ? (gainM / effectiveAscentSpeedMPerH) * steepAscentPenalty : 0;

  // Composante de descente (Langmuir + freinage excentrique Minetti)
  const descentHours =
    lossM > 0
      ? (lossM / effectiveDescentSpeedMPerH) * langmuirDescentFactor(descentGrade, Boolean(stats?.isChild))
      : 0;

  // Formule harmonisée Club Alpin Suisse (SAC / DIN 33466) combinant horizontal et vertical
  const verticalComponent = ascentHours + 0.52 * descentHours;
  const sacMovingHours =
    Math.max(horizontalHours, verticalComponent) + 0.52 * Math.min(horizontalHours, verticalComponent);

  // 1. Pénalité de portage (Pandolf / Givoni-Goldman)
  const packKg = pos(route.packWeightKg) || pos(stats?.packWeightKg);
  const maxCarryKg = pos(stats?.maxCarryKg) || 14;
  const excessPackKg = Math.max(0, packKg - 3);
  const overloadKg = Math.max(0, packKg - maxCarryKg);
  const packMultiplier = 1 + 0.011 * excessPackKg + 0.016 * overloadKg;
  const packPenaltyPct = round((packMultiplier - 1) * 100, 1);

  // 2. Pénalité hypoxique d'altitude (ACSM : -6.3 % de VO2max par 1 000 m au-dessus de 1 500 m)
  const maxAlt = pos(route.maxAltitudeM);
  const meanAlt = pos(route.meanAltitudeM) || (maxAlt > 0 ? maxAlt * 0.78 : 0);
  const altitudeMultiplier =
    meanAlt > 1500 ? clamp(1 + 0.063 * ((meanAlt - 1500) / 1000), 1, 1.24) : 1;
  const altitudePenaltyPct = round((altitudeMultiplier - 1) * 100, 1);

  // 3. Facteur d'endurance non-linéaire de Tranter & fatigue multi-jours
  const dailyMovingHours = sacMovingHours / nbJours;
  const tranterDailyMultiplier =
    dailyMovingHours > 4.0
      ? clamp(1 + (0.024 / Math.sqrt(expMult)) * Math.pow(dailyMovingHours - 4.0, 1.15), 1, 1.22)
      : 1;
  const multiDayMultiplier = nbJours > 1 ? 1 + 0.022 * Math.min(6, nbJours - 1) : 1;
  const fatigueMultiplier = tranterDailyMultiplier * multiDayMultiplier;
  const fatiguePenaltyPct = round((fatigueMultiplier - 1) * 100, 1);

  const individualMovingHours =
    sacMovingHours * packMultiplier * altitudeMultiplier * fatigueMultiplier;

  // 4. Modèle de pauses physiologiques (hydratation, nutrition, lecture de carte)
  const pauseMinPerH =
    stats?.pauseMinutesPerHour != null && Number.isFinite(stats.pauseMinutesPerHour)
      ? clamp(stats.pauseMinutesPerHour, 0, 20)
      : baseline.pauseMinPerHour;
  const pauseMinPer100m =
    stats?.pauseMinutesPer100mDplus != null && Number.isFinite(stats.pauseMinutesPer100mDplus)
      ? clamp(stats.pauseMinutesPer100mDplus, 0, 10)
      : baseline.pauseMinPer100m;
  const individualPauseMinutes =
    individualMovingHours > 0.4
      ? Math.round(pauseMinPerH * individualMovingHours + pauseMinPer100m * (gainM / 100))
      : 0;

  const individualDurationHours = individualMovingHours + individualPauseMinutes / 60;

  return {
    resolved: {
      userId: stats?.userId ?? 'solo',
      statDensity: density,
      observationsCount,
      effectiveFlatSpeedKmh,
      effectiveAscentSpeedMPerH,
      effectiveDescentSpeedMPerH,
      individualDurationHours,
      individualMovingHours,
      individualPauseMinutes,
    },
    altitudePenaltyPct,
    packPenaltyPct,
    fatiguePenaltyPct,
  };
}

/**
 * Calcule automatiquement le niveau de difficulté (1..5), le Kilomètre-Effort journalier
 * et l'indice IBP international à partir des caractéristiques de l'itinéraire et du groupe.
 */
export function computeRouteDifficulty(
  route: SortieRouteInput,
  groupMovingHours = 0,
): {
  recommendedLevel: SortieDifficultyLevel;
  effortScoreKe: number;
  ibpIndex: number;
} {
  const activity = route.activity in ACTIVITY_BASELINES ? route.activity : 'rando';
  const baseline = ACTIVITY_BASELINES[activity];
  const km = pos(route.distanceKm);
  const gainM = pos(route.elevationGainM);
  const lossM = route.elevationLossM != null && route.elevationLossM > 0 ? pos(route.elevationLossM) : gainM * 0.85;
  const nbJours = Math.max(1, Math.round(pos(route.nbJours) || 1));

  const dailyKm = km / nbJours;
  const dailyGainM = gainM / nbJours;
  const dailyLossM = lossM / nbJours;

  // Kilomètre-Effort journalier (FFRP / Club Alpin) adapté à l'activité
  let ke =
    dailyKm / baseline.keDistanceDivisor +
    dailyGainM / baseline.keAscentDivisor +
    dailyLossM / (baseline.keAscentDivisor * 3.2);

  // Pénalité de raideur moyenne (pente > 12 %)
  const meanGrade = dailyKm > 0 ? dailyGainM / (dailyKm * 1000) : 0;
  if (meanGrade > 0.12) {
    ke += Math.min(6, (meanGrade - 0.12) * 32);
  }

  // Pénalité d'altitude alpine (> 2 200 m)
  const maxAlt = pos(route.maxAltitudeM);
  if (maxAlt > 2200) {
    ke += Math.min(7, (maxAlt - 2200) / 300);
  }

  // Engagement multi-jours
  if (nbJours > 1) {
    ke *= 1 + 0.045 * Math.min(6, nbJours - 1);
  }

  const effortScoreKe = round(ke, 1);
  const ibpIndex = Math.max(
    0,
    Math.round(effortScoreKe * 3.4 + (meanGrade > 0.1 ? meanGrade * 75 : 0)),
  );

  const dailyHours = groupMovingHours > 0 ? groupMovingHours / nbJours : 0;
  let recommendedLevel: SortieDifficultyLevel = 'moyen';

  if (effortScoreKe < 8 && dailyGainM < 300 && maxAlt < 2200 && dailyHours < 2.5) {
    recommendedLevel = 'tres_facile';
  } else if (effortScoreKe < 14.5 && dailyGainM <= 550 && maxAlt < 2500) {
    recommendedLevel = 'facile';
  } else if (effortScoreKe < 24 && dailyGainM <= 1000 && maxAlt < 3000) {
    recommendedLevel = 'moyen';
  } else if (effortScoreKe < 34 && dailyGainM <= 1550 && maxAlt < 3400) {
    recommendedLevel = 'difficile';
  } else {
    recommendedLevel = 'expert';
  }

  return { recommendedLevel, effortScoreKe, ibpIndex };
}

/**
 * Calcule l'estimation complète de la Sortie (durée P50/P90, difficulté, vitesses,
 * densité statistique collective et répartition par jour).
 *
 * - À la création (`participants` contient l'organisateur seul ou est vide) :
 *   le temps dépend du profil de l'organisateur pondéré par sa densité statistique.
 * - Lorsque d'autres participants s'inscrivent (`participants.length >= 2`) :
 *   la densité statistique de chaque participant déplace dynamiquement la durée estimée.
 */
export function estimateSortiePerformance(
  route: SortieRouteInput,
  participants: ReadonlyArray<ParticipantPerformanceStats | null | undefined> = [],
): SortiePerformanceEstimate {
  const km = pos(route.distanceKm);
  const gainM = pos(route.elevationGainM);
  const nbJours = Math.max(1, Math.round(pos(route.nbJours) || 1));

  const validParticipants =
    participants.filter((p): p is ParticipantPerformanceStats => Boolean(p)) ?? [];
  const effectiveList: Array<ParticipantPerformanceStats | null> =
    validParticipants.length > 0 ? validParticipants : [null];

  const resolvedList = effectiveList.map((member) => resolveParticipantMetrics(member, route));
  const creatorSolo = resolvedList[0]!;

  if (km <= 0 && gainM <= 0) {
    const diff = computeRouteDifficulty(route, 0);
    return {
      durationHoursP50: 0,
      durationHoursP90: 0,
      movingHours: 0,
      pauseMinutes: 0,
      formattedDuration: '',
      formattedRange: '',
      recommendedLevel: diff.recommendedLevel,
      effortScoreKe: 0,
      ibpIndex: 0,
      effectiveFlatSpeedKmh: creatorSolo.resolved.effectiveFlatSpeedKmh,
      effectiveAscentSpeedMPerH: creatorSolo.resolved.effectiveAscentSpeedMPerH,
      effectiveDescentSpeedMPerH: creatorSolo.resolved.effectiveDescentSpeedMPerH,
      participantCount: effectiveList.length,
      collectiveStatDensity: creatorSolo.resolved.statDensity,
      collectiveStatDensityPct: Math.round(creatorSolo.resolved.statDensity * 100),
      totalAnalyzedOutings: resolvedList.reduce((acc, r) => acc + r.resolved.observationsCount, 0),
      groupDeltaMinutes: 0,
      factors: {
        modelLabel: 'Tobler · Minetti · Naismith-Langmuir · SAC',
        altitudePenaltyPct: creatorSolo.altitudePenaltyPct,
        packPenaltyPct: creatorSolo.packPenaltyPct,
        fatiguePenaltyPct: creatorSolo.fatiguePenaltyPct,
        groupCohesionPenaltyPct: 0,
        perDayHoursP50: [],
        perDayFormatted: [],
      },
    };
  }

  const N = resolvedList.length;
  const totalDensityWeight = resolvedList.reduce((sum, item) => sum + item.resolved.statDensity, 0);

  // Moyenne pondérée par la densité statistique de chaque participant
  const densityWeightedDuration =
    totalDensityWeight > 0
      ? resolvedList.reduce(
          (sum, item) => sum + item.resolved.statDensity * item.resolved.individualDurationHours,
          0,
        ) / totalDensityWeight
      : creatorSolo.resolved.individualDurationHours;

  const densityWeightedMoving =
    totalDensityWeight > 0
      ? resolvedList.reduce(
          (sum, item) => sum + item.resolved.statDensity * item.resolved.individualMovingHours,
          0,
        ) / totalDensityWeight
      : creatorSolo.resolved.individualMovingHours;

  const densityWeightedFlatSpeed =
    totalDensityWeight > 0
      ? resolvedList.reduce(
          (sum, item) => sum + item.resolved.statDensity * item.resolved.effectiveFlatSpeedKmh,
          0,
        ) / totalDensityWeight
      : creatorSolo.resolved.effectiveFlatSpeedKmh;

  const densityWeightedAscentSpeed =
    totalDensityWeight > 0
      ? resolvedList.reduce(
          (sum, item) => sum + item.resolved.statDensity * item.resolved.effectiveAscentSpeedMPerH,
          0,
        ) / totalDensityWeight
      : creatorSolo.resolved.effectiveAscentSpeedMPerH;

  const densityWeightedDescentSpeed =
    totalDensityWeight > 0
      ? resolvedList.reduce(
          (sum, item) => sum + item.resolved.statDensity * item.resolved.effectiveDescentSpeedMPerH,
          0,
        ) / totalDensityWeight
      : creatorSolo.resolved.effectiveDescentSpeedMPerH;

  let durationHoursP50 = densityWeightedDuration;
  let movingHours = densityWeightedMoving;
  let groupCohesionPenaltyPct = 0;

  if (N > 1) {
    // Membre dimensionnant ancré par la racine de sa densité statistique :
    // un marcheur plus lent avec un fort historique terrain ancre l'allure du groupe.
    const credibleLimitingDuration = Math.max(
      ...resolvedList.map(({ resolved }) => {
        const delta = resolved.individualDurationHours - densityWeightedDuration;
        return densityWeightedDuration + Math.sqrt(resolved.statDensity) * delta;
      }),
    );

    const alphaCohesion = Math.min(0.65, 0.35 + 0.06 * (N - 1));
    const cohesionDuration =
      (1 - alphaCohesion) * densityWeightedDuration + alphaCohesion * credibleLimitingDuration;

    const durations = resolvedList.map((r) => r.resolved.individualDurationHours);
    const spreadRel =
      (Math.max(...durations) - Math.min(...durations)) / Math.max(0.5, densityWeightedDuration);

    // Friction de groupe (regroupements aux intersections + dispersion d'allure)
    const groupFriction = 1 + 0.012 * Math.log(N) + 0.03 * Math.min(1.2, spreadRel);
    durationHoursP50 = cohesionDuration * groupFriction;
    movingHours = densityWeightedMoving * (durationHoursP50 / Math.max(0.1, densityWeightedDuration));
    groupCohesionPenaltyPct = round(
      ((durationHoursP50 - densityWeightedDuration) / Math.max(0.1, densityWeightedDuration)) * 100,
      1,
    );
  }

  const totalAnalyzedOutings = resolvedList.reduce(
    (sum, item) => sum + item.resolved.observationsCount,
    0,
  );
  const weightedDensityMean =
    totalDensityWeight > 0
      ? resolvedList.reduce((sum, item) => sum + item.resolved.statDensity ** 2, 0) /
        totalDensityWeight
      : creatorSolo.resolved.statDensity;
  const collectiveStatDensity = round(
    clamp(weightedDensityMean + 0.038 * Math.log(1 + totalAnalyzedOutings), 0.08, 0.99),
    3,
  );

  // Facteur d'incertitude P90 : diminue à mesure que la densité statistique collective augmente
  const uncertaintyMultiplier = 1.06 + 0.22 * (1 - collectiveStatDensity);
  const durationHoursP90 = durationHoursP50 * uncertaintyMultiplier;

  const pauseMinutes = Math.max(0, Math.round((durationHoursP50 - movingHours * 0.88) * 60));
  const formattedDuration = formatPreciseDurationFr(durationHoursP50, nbJours);
  const p50TimeOnly = formatPreciseDurationFr(durationHoursP50, 1);
  const p90TimeOnly = formatPreciseDurationFr(durationHoursP90, 1);
  const formattedRange =
    p50TimeOnly && p90TimeOnly && p50TimeOnly !== p90TimeOnly
      ? `${p50TimeOnly} – ${p90TimeOnly}`
      : p50TimeOnly;

  const diff = computeRouteDifficulty(route, movingHours);
  const groupDeltaMinutes =
    N > 1
      ? Math.round((durationHoursP50 - creatorSolo.resolved.individualDurationHours) * 60)
      : 0;

  // Répartition par jour si `daysMetrics` est fourni ou sur `nbJours`
  const perDayHoursP50: number[] = [];
  if (route.daysMetrics && route.daysMetrics.length > 1) {
    const dayRaw = route.daysMetrics.map((d) => {
      const sub = estimateSortiePerformance(
        {
          ...route,
          distanceKm: d.distanceKm,
          elevationGainM: d.elevationGainM,
          elevationLossM: d.elevationLossM,
          nbJours: 1,
          daysMetrics: undefined,
        },
        participants,
      );
      return sub.durationHoursP50;
    });
    const sumDays = dayRaw.reduce((a, b) => a + b, 0);
    for (const h of dayRaw) {
      perDayHoursP50.push(round(sumDays > 0 ? (h / sumDays) * durationHoursP50 : durationHoursP50 / nbJours, 2));
    }
  } else if (nbJours > 1) {
    for (let i = 0; i < nbJours; i += 1) {
      perDayHoursP50.push(round(durationHoursP50 / nbJours, 2));
    }
  } else {
    perDayHoursP50.push(round(durationHoursP50, 2));
  }

  return {
    durationHoursP50: round(durationHoursP50, 2),
    durationHoursP90: round(durationHoursP90, 2),
    movingHours: round(movingHours, 2),
    pauseMinutes,
    formattedDuration,
    formattedRange,
    recommendedLevel: diff.recommendedLevel,
    effortScoreKe: diff.effortScoreKe,
    ibpIndex: diff.ibpIndex,
    effectiveFlatSpeedKmh: round(densityWeightedFlatSpeed, 2),
    effectiveAscentSpeedMPerH: Math.round(densityWeightedAscentSpeed),
    effectiveDescentSpeedMPerH: Math.round(densityWeightedDescentSpeed),
    participantCount: N,
    collectiveStatDensity,
    collectiveStatDensityPct: Math.round(collectiveStatDensity * 100),
    totalAnalyzedOutings,
    groupDeltaMinutes,
    factors: {
      modelLabel:
        totalAnalyzedOutings > 0
          ? 'Profil Terrain BDD + Tobler · Minetti · Naismith-Langmuir · SAC'
          : 'Tobler · Minetti · Naismith-Langmuir · SAC (DIN 33466)',
      altitudePenaltyPct: creatorSolo.altitudePenaltyPct,
      packPenaltyPct: creatorSolo.packPenaltyPct,
      fatiguePenaltyPct: creatorSolo.fatiguePenaltyPct,
      groupCohesionPenaltyPct,
      perDayHoursP50,
      perDayFormatted: perDayHoursP50.map((h) => formatPreciseDurationFr(h, 1)),
    },
  };
}
