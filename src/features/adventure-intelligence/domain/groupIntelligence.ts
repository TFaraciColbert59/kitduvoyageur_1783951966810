/**
 * A8 & Lot P5 — Intelligence de groupe V1 & V2 (moteur pur).
 *
 * V1 (rétrocompatible A8) :
 * - Dimensionnement par le membre dimensionnant, difficulté par membre (fatigue A3),
 *   risque de séparation, pauses et redistribution plafonnée à `MAX_GEAR_TRANSFER_KG`.
 *
 * V2 (Lot P5 — Moteur de groupe bioénergétique & sécurité préventive) :
 * 1. Surface de capacité individuelle `v_ik = min(v_energetic, v_tech, v_grip, v_visibility)`
 *    (prior Wood 2023 / Campbell + résidu Kalman + plafond LCDA / Péronnet 1991).
 * 2. Deux modes explicites :
 *    - Mode A (`"compact"`) : `v_grp = min_i(v_ik) * g(N)` avec `g(N) = 1 - 0.03 * Math.min(N - 1, 7)`.
 *    - Mode B (`"regroupement"`) : `T_troncon = max_i(t_ik)`, `wait_i = T_troncon - t_ik`
 *      transmis au module thermique froid IREQ / CoWEDA (repos `65 W/m²` + isolant humide `×0.5..0.7`).
 * 3. Pauses superposées & récupération asymétrique `D_j = max_i(A_ij + R_ij)` avec prior
 *    ATP 3-21.18 (`10 min/h` au lieu de `5 min/h`).
 * 4. Files d'attente max-plus sur passages techniques (`sac_scale >= T3` ou `isBottleneck`) :
 *    `A_ij = Math.max(A_{i,j-1} + T_libre_ij, A_{i-1,j} + h_ij)`.
 * 5. Monte Carlo déterministe (PRNG à graine fixe, 2 000 tirages vectorisés `< 1000 ms`
 *    pour `6 membres × 300 segments × 2 000 tirages`) : P10/P50/P90, probabilité de dépassement
 *    du crépuscule topographique MNT, heure limite de demi-tour, matrice goulot vitesse vs
 *    goulot physiologique, pénalité d'hétérogénéité.
 * 6. Redistribution min-max du portage sous consentement `group_simulation` avec phrase d'action.
 * 7. Confidentialité stricte validée par `PublicGroupPredictionSchema` (zéro donnée biométrique
 *    ni vitesse individuelle nominative).
 */
import {
  EFFORT_SCORE_VERSION,
  computeEffortScore,
  computeSnapshotHashSync,
  computeThermalCapacityFactor,
} from './effortScore';
import { makeConfidence } from './confidence';
import { computeFatigue } from './fatigue';
import { resolveIndividualSegmentSpeedMs } from './paceResolver';
import { ATP_DEFAULT_PAUSE_MINUTES_PER_HOUR } from './performanceProfile';
import { STRATEGY_SPEED_FACTORS } from './prediction';
import {
  PublicGroupPredictionSchema,
  type EffortSegmentInput,
  type GroupConsentedMemberInput,
  type GroupDisciplineMode,
  type GroupPredictionInput,
  type GroupPredictionOutput,
  type PrivateMemberGroupPrediction,
  type PublicGroupPrediction,
} from '../schemas/effort.schema';

export type GroupMemberRole = 'owner' | 'member' | 'guest';
export type GroupExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type GroupStrategy = 'comfort' | 'recommended' | 'fast';

export interface GroupMemberInput {
  memberId: string;
  displayName: string;
  role: GroupMemberRole;
  flatSpeedKmH: number | null;
  ascentSpeedMPerHour: number | null;
  descentSpeedMPerHour: number | null;
  packWeightKg: number | null;
  maxCarryKg: number | null;
  experienceLevel: GroupExperienceLevel;
  limitations?: string[];
  isChild?: boolean;
}

export interface GroupSegment {
  segmentId: number;
  distanceM: number;
  gainM: number;
  lossM: number;
}

export interface GroupPlan {
  memberPacesKmH: { memberId: string; paceKmH: number }[];
  groupPaceKmH: number;
  limitingMemberId: string | null;
  limitingReason: string | null;
  perMemberDifficulty: { memberId: string; difficulty: number }[];
  groupDifficulty: number;
  pauseEveryMinutes: number;
  separationRisk: { level: 'low' | 'medium' | 'high'; spreadKmH: number; reasons: string[] };
  gearRedistribution: {
    fromMemberId: string;
    toMemberId: string;
    weightKg: number;
    reason: string;
  }[];
}

export interface GroupPlanOptions {
  strategy?: GroupStrategy;
}

/** Vitesses de repli d'un membre sans mesure déclarée. */
export const DEFAULT_MEMBER_FLAT_SPEED_KMH = 4;
export const DEFAULT_MEMBER_ASCENT_SPEED_M_PER_HOUR = 300;
export const DEFAULT_MEMBER_DESCENT_SPEED_M_PER_HOUR = 500;

/** Un enfant avance prudemment : facteur appliqué à toutes ses vitesses. */
export const CHILD_SPEED_FACTOR = 0.85;
/** Pente moyenne de descente (%) à partir de laquelle la descente est technique. */
export const TECHNICAL_DESCENT_GRADE_PCT = 12;
/** Majoration du temps de descente technique (adulte / enfant). */
export const TECHNICAL_DESCENT_FACTOR = 1.25;
export const CHILD_TECHNICAL_DESCENT_FACTOR = 1.4;

/** Facteurs appliqués aux seules vitesses de repli selon le niveau déclaré. */
export const EXPERIENCE_SPEED_FACTORS: Record<GroupExperienceLevel, number> = {
  beginner: 0.9,
  intermediate: 1,
  advanced: 1.08,
};

/** Seuils d'écart d'allure (km/h) pour qualifier la séparation. */
export const SEPARATION_SPREAD_MEDIUM_KMH = 1.5;
export const SEPARATION_SPREAD_HIGH_KMH = 2.5;
/** Tailles de groupe à partir desquelles la dispersion est plus probable. */
export const GROUP_SIZE_RISK_THRESHOLD = 6;
export const LARGE_GROUP_RISK_THRESHOLD = 9;
/** Points de risque ajoutés par la présence d'un enfant. */
export const CHILD_SEPARATION_RISK_POINTS = 3;

/** Plafond de transfert de portage par membre receveur (kg). */
export const MAX_GEAR_TRANSFER_KG = 5;

/** Pause de référence, resserrée quand la difficulté groupe monte. */
export const BASE_PAUSE_EVERY_MINUTES = 60;
export const HARD_PAUSE_EVERY_MINUTES = 40;
export const MODERATE_PAUSE_EVERY_MINUTES = 50;
export const MIN_PAUSE_EVERY_MINUTES = 20;
export const MAX_PAUSE_EVERY_MINUTES = 90;

/** Prior de pauses ATP 3-21.18 : 10 min/h au lieu de 5 min/h. */
export const ATP_PAUSE_PRIOR_MIN_PER_HOUR = ATP_DEFAULT_PAUSE_MINUTES_PER_HOUR;

/** Nombre de tirages Monte Carlo par défaut (Lot P5). */
export const DEFAULT_MONTE_CARLO_DRAWS = 2000;
/** Écart-type du choc météo partagé par tout le groupe ($\sigma \approx 0.05$). */
export const SHARED_WEATHER_SHOCK_SIGMA = 0.05;
/** Métabolisme de repos lors d'une attente au point de regroupement (65 W/m²). */
export const REGROUP_WAITING_METABOLIC_WM2 = 65;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function positive(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0;
  return value;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

interface RouteInfo {
  totalDistanceM: number;
  totalGainM: number;
  totalLossM: number;
  technicalClass: number;
}

function routeInfo(segments: GroupSegment[]): RouteInfo {
  let totalDistanceM = 0;
  let totalGainM = 0;
  let totalLossM = 0;
  let technicalClass = 0;

  for (const segment of segments) {
    const distanceM = positive(segment.distanceM);
    const gainM = positive(segment.gainM);
    const lossM = positive(segment.lossM);
    totalDistanceM += distanceM;
    totalGainM += gainM;
    totalLossM += lossM;

    if (distanceM > 0) {
      const descentGradePct = (lossM / distanceM) * 100;
      const ascentGradePct = (gainM / distanceM) * 100;
      if (descentGradePct >= 20) technicalClass = Math.max(technicalClass, 4);
      else if (descentGradePct >= TECHNICAL_DESCENT_GRADE_PCT) {
        technicalClass = Math.max(technicalClass, 3);
      } else if (descentGradePct >= 8) technicalClass = Math.max(technicalClass, 2);
      if (ascentGradePct >= 35) technicalClass = Math.max(technicalClass, 3);
      else if (ascentGradePct >= 25) technicalClass = Math.max(technicalClass, 2);
    }
  }

  return { totalDistanceM, totalGainM, totalLossM, technicalClass };
}

interface EffectiveSpeeds {
  flatSpeedKmH: number;
  ascentSpeedMPerHour: number;
  descentSpeedMPerHour: number;
}

function effectiveSpeeds(member: GroupMemberInput): EffectiveSpeeds {
  const experienceFactor = EXPERIENCE_SPEED_FACTORS[member.experienceLevel] ?? 1;
  const childFactor = member.isChild === true ? CHILD_SPEED_FACTOR : 1;

  return {
    flatSpeedKmH:
      (positive(member.flatSpeedKmH) || DEFAULT_MEMBER_FLAT_SPEED_KMH * experienceFactor) *
      childFactor,
    ascentSpeedMPerHour:
      (positive(member.ascentSpeedMPerHour) ||
        DEFAULT_MEMBER_ASCENT_SPEED_M_PER_HOUR * experienceFactor) * childFactor,
    descentSpeedMPerHour:
      (positive(member.descentSpeedMPerHour) ||
        DEFAULT_MEMBER_DESCENT_SPEED_M_PER_HOUR * experienceFactor) * childFactor,
  };
}

interface MemberMetrics {
  member: GroupMemberInput;
  speedKmH: number;
  paceMinPerKm: number;
  durationS: number;
}

function memberMetrics(
  member: GroupMemberInput,
  segments: GroupSegment[],
  strategy: GroupStrategy
): MemberMetrics {
  const speeds = effectiveSpeeds(member);
  let hours = 0;
  let totalDistanceM = 0;

  for (const segment of segments) {
    const distanceM = positive(segment.distanceM);
    const gainM = positive(segment.gainM);
    const lossM = positive(segment.lossM);
    totalDistanceM += distanceM;
    hours += distanceM / 1000 / speeds.flatSpeedKmH;
    hours += gainM / speeds.ascentSpeedMPerHour;

    const descentGradePct = distanceM > 0 ? (lossM / distanceM) * 100 : 0;
    const technical = descentGradePct >= TECHNICAL_DESCENT_GRADE_PCT;
    const descentFactor = technical
      ? member.isChild === true
        ? CHILD_TECHNICAL_DESCENT_FACTOR
        : TECHNICAL_DESCENT_FACTOR
      : 1;
    hours += (lossM / speeds.descentSpeedMPerHour) * descentFactor;
  }

  const speedFactor = STRATEGY_SPEED_FACTORS[strategy] ?? 1;
  const durationHours = hours / speedFactor;
  const durationS = Math.max(1, Math.round(durationHours * 3600));
  const totalDistanceKm = totalDistanceM / 1000;

  const speedKmH =
    durationHours > 0 && totalDistanceKm > 0 ? totalDistanceKm / durationHours : speeds.flatSpeedKmH;
  const paceMinPerKm =
    durationHours > 0 && totalDistanceKm > 0
      ? (durationHours * 60) / totalDistanceKm
      : 60 / speeds.flatSpeedKmH;

  return { member, speedKmH, paceMinPerKm, durationS };
}

function memberDifficulty(metrics: MemberMetrics, route: RouteInfo): number {
  const fatigue = computeFatigue({
    activeDurationS: metrics.durationS,
    gainM: route.totalGainM,
    lossM: route.totalLossM,
    technicalClass: route.technicalClass,
    packWeightKg: metrics.member.packWeightKg,
  });
  return clamp(Math.round(fatigue.score), 0, 100);
}

function buildLimitingReason(member: GroupMemberInput, route: RouteInfo): string {
  const reasons = ['Allure la plus lente du groupe'];
  if (member.isChild === true) reasons.push('enfant — allure prudente appliquée');
  if (member.experienceLevel === 'beginner') reasons.push('niveau débutant');
  if (
    member.packWeightKg != null &&
    member.maxCarryKg != null &&
    member.packWeightKg > member.maxCarryKg
  ) {
    reasons.push('portage excédentaire à redistribuer');
  }
  if (route.technicalClass >= 3) reasons.push('descente technique pénalisante');
  return reasons.join(' ; ');
}

function buildSeparationRisk(
  metrics: MemberMetrics[],
  members: GroupMemberInput[]
): GroupPlan['separationRisk'] {
  const speeds = metrics.map((entry) => entry.speedKmH);
  const fastest = Math.max(...speeds);
  const slowest = Math.min(...speeds);
  const spreadKmH = round(Math.max(0, fastest - slowest), 2);

  let points = 1;
  if (spreadKmH >= SEPARATION_SPREAD_HIGH_KMH) points = 7;
  else if (spreadKmH >= SEPARATION_SPREAD_MEDIUM_KMH) points = 5;
  else if (spreadKmH >= 0.8) points = 3;

  if (members.length >= LARGE_GROUP_RISK_THRESHOLD) points += 4;
  else if (members.length >= GROUP_SIZE_RISK_THRESHOLD) points += 2;

  const hasChild = members.some((member) => member.isChild === true);
  if (hasChild) points += CHILD_SEPARATION_RISK_POINTS;

  const reasons = [
    `Écart d'allure de ${spreadKmH.toFixed(2)} km/h entre le plus rapide et le plus lent.`,
  ];
  if (members.length >= GROUP_SIZE_RISK_THRESHOLD) {
    reasons.push(`Groupe de ${members.length} membres — dispersion plus probable.`);
  }
  if (hasChild) {
    reasons.push('Enfant dans le groupe — encadrement renforcé recommandé.');
  }

  const level: GroupPlan['separationRisk']['level'] =
    points >= 7 ? 'high' : points >= 4 ? 'medium' : 'low';

  return { level, spreadKmH, reasons };
}

function buildGearRedistribution(
  members: GroupMemberInput[],
  limiting: MemberMetrics | null
): GroupPlan['gearRedistribution'] {
  if (limiting === null) return [];
  const packWeightKg = limiting.member.packWeightKg;
  const maxCarryKg = limiting.member.maxCarryKg;
  if (packWeightKg == null || maxCarryKg == null) return [];
  if (!Number.isFinite(packWeightKg) || !Number.isFinite(maxCarryKg)) return [];

  let remaining = packWeightKg - maxCarryKg;
  if (!(remaining > 0)) return [];

  const recipients = members
    .filter(
      (member) =>
        member.memberId !== limiting.member.memberId &&
        member.isChild !== true &&
        member.packWeightKg != null &&
        member.maxCarryKg != null &&
        Number.isFinite(member.packWeightKg) &&
        Number.isFinite(member.maxCarryKg)
    )
    .map((member) => ({
      member,
      margin: (member.maxCarryKg as number) - (member.packWeightKg as number),
    }))
    .filter((entry) => entry.margin > 0)
    .sort((a, b) => b.margin - a.margin);

  const transfers: GroupPlan['gearRedistribution'] = [];
  for (const recipient of recipients) {
    if (remaining <= 0) break;
    const amount = Math.min(remaining, recipient.margin, MAX_GEAR_TRANSFER_KG);
    if (!(amount > 0)) continue;
    transfers.push({
      fromMemberId: limiting.member.memberId,
      toMemberId: recipient.member.memberId,
      weightKg: round(amount, 2),
      reason: 'Allègement du membre limitant pour préserver l’allure collective.',
    });
    remaining -= amount;
  }

  return transfers;
}

function pauseEveryMinutesFor(
  groupDifficulty: number,
  members: GroupMemberInput[],
  strategy: GroupStrategy
): number {
  let minutes = BASE_PAUSE_EVERY_MINUTES;
  if (groupDifficulty >= 75) minutes = HARD_PAUSE_EVERY_MINUTES;
  else if (groupDifficulty >= 60) minutes = MODERATE_PAUSE_EVERY_MINUTES;
  if (members.some((member) => member.isChild === true)) minutes -= 10;
  if (strategy === 'comfort') minutes -= 10;
  else if (strategy === 'fast') minutes += 10;
  return clamp(minutes, MIN_PAUSE_EVERY_MINUTES, MAX_PAUSE_EVERY_MINUTES);
}

/**
 * Construit le plan collectif V1 (rétrocompatible A8) : allure du membre
 * dimensionnant, difficultés par membre (moteur A3), risque de séparation,
 * pauses et redistribution.
 */
export function buildGroupPlan(
  members: GroupMemberInput[],
  segments: GroupSegment[],
  options: GroupPlanOptions = {}
): GroupPlan {
  const strategy = options.strategy ?? 'recommended';
  const route = routeInfo(segments);
  const metrics = members.map((member) => memberMetrics(member, segments, strategy));

  if (metrics.length === 0) {
    return {
      memberPacesKmH: [],
      groupPaceKmH: 0,
      limitingMemberId: null,
      limitingReason: null,
      perMemberDifficulty: [],
      groupDifficulty: 0,
      pauseEveryMinutes: pauseEveryMinutesFor(0, members, strategy),
      separationRisk: {
        level: 'low',
        spreadKmH: 0,
        reasons: ['Aucun membre — risque de séparation non applicable.'],
      },
      gearRedistribution: [],
    };
  }

  const limiting = metrics.reduce((slowest, entry) =>
    entry.speedKmH < slowest.speedKmH ? entry : slowest
  );

  const perMemberDifficulty = metrics.map((entry) => ({
    memberId: entry.member.memberId,
    difficulty: memberDifficulty(entry, route),
  }));
  const groupDifficulty = Math.max(...perMemberDifficulty.map((entry) => entry.difficulty));

  return {
    memberPacesKmH: metrics.map((entry) => ({
      memberId: entry.member.memberId,
      paceKmH: round(entry.speedKmH, 3),
    })),
    groupPaceKmH: round(limiting.speedKmH, 3),
    limitingMemberId: limiting.member.memberId,
    limitingReason: buildLimitingReason(limiting.member, route),
    perMemberDifficulty,
    groupDifficulty,
    pauseEveryMinutes: pauseEveryMinutesFor(groupDifficulty, members, strategy),
    separationRisk: buildSeparationRisk(metrics, members),
    gearRedistribution: buildGearRedistribution(members, limiting),
  };
}

export interface LegacyPublicGroupPlan {
  groupPaceKmH: number;
  groupDifficulty: number;
  limitingReason: string | null;
  separationRisk: { level: string; reasons: string[] };
  memberCount: number;
}

/**
 * Projection publique d'un plan de groupe (ADR-AI-003) :
 * - Si appelé avec un `GroupPlan` V1 (A8), retourne exactement les 5 champs publics historiques.
 * - Si appelé avec un `GroupPredictionOutput` / `GroupPredictionV2Output` / `PublicGroupPrediction` V2,
 *   valide et retourne la projection publique stricte (`PublicGroupPredictionSchema.parse(...)`).
 */
export function projectGroupPlanPublic(plan: GroupPlan): LegacyPublicGroupPlan;
export function projectGroupPlanPublic(
  plan: GroupPredictionOutput | GroupPredictionV2Output | PublicGroupPrediction
): PublicGroupPrediction;
export function projectGroupPlanPublic(
  plan: GroupPlan | GroupPredictionOutput | GroupPredictionV2Output | PublicGroupPrediction
): LegacyPublicGroupPlan | PublicGroupPrediction {
  if ('publicProjection' in plan && plan.publicProjection) {
    return PublicGroupPredictionSchema.parse(plan.publicProjection);
  }
  if ('collectiveIea' in plan && 'groupEtaInterval' in plan) {
    return PublicGroupPredictionSchema.parse(plan);
  }
  const legacy = plan as GroupPlan;
  return {
    groupPaceKmH: legacy.groupPaceKmH,
    groupDifficulty: legacy.groupDifficulty,
    limitingReason: legacy.limitingReason,
    separationRisk: {
      level: legacy.separationRisk.level,
      reasons: [...legacy.separationRisk.reasons],
    },
    memberCount: legacy.memberPacesKmH.length,
  };
}

/** Alias explicite typé pour la projection publique V2 validée par `PublicGroupPredictionSchema`. */
export function projectGroupPredictionPublic(
  output: GroupPredictionOutput | GroupPredictionV2Output | PublicGroupPrediction
): PublicGroupPrediction {
  if ('publicProjection' in output && output.publicProjection) {
    return PublicGroupPredictionSchema.parse(output.publicProjection);
  }
  return PublicGroupPredictionSchema.parse(output);
}

// ─────────────────────────────────────────────────────────────────────────────
// LOT P5 — MOTEUR DE GROUPE V2 : COMPACT vs REGROUPEMENT, MAX-PLUS, MONTE CARLO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Facteur de friction de taille de groupe en Mode A (`"compact"`) :
 * `g(N) = 1 - 0.03 * Math.min(N - 1, 7)`
 */
export function computeCompactGroupFrictionFactor(memberCount: number): number {
  const n = Math.max(1, Math.trunc(memberCount));
  return 1 - 0.03 * Math.min(n - 1, 7);
}

export interface RegroupWaitingColdAlert {
  triggered: boolean;
  maxWaitS: number;
  restingMetabolicWm2: number;
  wetInsulationDegradationFactor: number;
  effectiveClo: number;
  requiredIreqClo: number;
  cowedaCoolingMarginMin: number;
  message: string;
}

/**
 * Module thermique froid IREQ / CoWEDA pendant l'attente au point de regroupement (Mode B) :
 * - Métabolisme de repos `65 W/m²`
 * - Isolation vestimentaire humide dégradée d'un facteur `×0.5` à `×0.7` selon la sudation amont
 * - Génère une alerte préventive de terrain sans aucun langage de diagnostic médical.
 */
export function evaluateRegroupWaitingColdAlert(input: {
  waitDurationS: number;
  tempC: number;
  windMs: number;
  upstreamAerobicFraction: number;
  dryClothingClo?: number;
}): RegroupWaitingColdAlert {
  const waitS = Math.max(0, input.waitDurationS);
  const upstreamStrain = clamp(input.upstreamAerobicFraction, 0, 1);

  // Dégradation de l'isolation par l'humidité de sudation amont : bornée dans [0.50, 0.70]
  const wetInsulationDegradationFactor = Number(
    clamp(0.70 - 0.20 * upstreamStrain, 0.50, 0.70).toFixed(3)
  );
  const dryClo = clamp(input.dryClothingClo ?? (input.tempC < 5 ? 1.8 : 1.0), 0.3, 4.5);
  const effectiveClo = Number((dryClo * wetInsulationDegradationFactor).toFixed(3));

  const thermal = computeThermalCapacityFactor(input.tempC, input.windMs);
  // À l'arrêt (65 W/m² au lieu de ~220 W/m² en marche), l'IREQ statique est majoré
  const requiredIreqClo = Number(
    clamp((18 - thermal.wctC) * 0.145, 0.4, 5.0).toFixed(3)
  );

  const cloDeficit = Math.max(0, requiredIreqClo - effectiveClo);
  // Constante de refroidissement CoWEDA en minutes avant inconfort thermique marqué
  const cowedaCoolingMarginMin = Number(
    clamp(cloDeficit > 0 ? 18 / (1 + 1.4 * cloDeficit) : 45, 3, 60).toFixed(1)
  );

  const waitMin = waitS / 60;
  const triggered =
    waitS >= 180 && (cloDeficit >= 0.35 || (thermal.wctC <= 5 && waitMin >= cowedaCoolingMarginMin * 0.5));

  const message = triggered
    ? `Vigilance refroidissement d’attente (${Math.round(waitMin)} min à 65 W/m², isolant humide ×${wetInsulationDegradationFactor.toFixed(2)}, IREQ ${requiredIreqClo.toFixed(1)} clo) — enfiler coupe-vent et couche sèche dès l’arrêt.`
    : 'Équilibre thermique d’attente satisfaisant au point de regroupement.';

  return {
    triggered,
    maxWaitS: Math.round(waitS),
    restingMetabolicWm2: REGROUP_WAITING_METABOLIC_WM2,
    wetInsulationDegradationFactor,
    effectiveClo,
    requiredIreqClo,
    cowedaCoolingMarginMin,
    message,
  };
}

/**
 * Pause superposée et récupération asymétrique au point de regroupement $j$ :
 * `D_j = max_i(A_ij + R_ij)`
 * Le membre le plus lent arrivant en dernier ($A_{\max,j}$) conserve un besoin
 * de récupération minimal compressible mais strictement positif ($R_{i^*,j} > 0$).
 */
export function computeAsymmetricSuperposedDepartureS(
  arrivalTimesS: ReadonlyArray<number>,
  requiredRecoveriesS: ReadonlyArray<number>
): {
  departureTimeS: number;
  lastArrivalTimeS: number;
  effectiveWaitPerMemberS: number[];
  netStopDurationS: number;
} {
  if (arrivalTimesS.length === 0) {
    return {
      departureTimeS: 0,
      lastArrivalTimeS: 0,
      effectiveWaitPerMemberS: [],
      netStopDurationS: 0,
    };
  }
  let lastArrivalTimeS = 0;
  let departureTimeS = 0;
  for (let i = 0; i < arrivalTimesS.length; i += 1) {
    const a = Math.max(0, arrivalTimesS[i]);
    const r = Math.max(30, requiredRecoveriesS[i] ?? 60);
    if (a > lastArrivalTimeS) lastArrivalTimeS = a;
    if (a + r > departureTimeS) departureTimeS = a + r;
  }
  const effectiveWaitPerMemberS = arrivalTimesS.map((a) =>
    Math.max(0, departureTimeS - Math.max(0, a))
  );
  return {
    departureTimeS,
    lastArrivalTimeS,
    effectiveWaitPerMemberS,
    netStopDurationS: Math.max(0, departureTimeS - lastArrivalTimeS),
  };
}

/**
 * File d'attente max-plus sur un passage technique (`sac_scale >= T3` ou `isBottleneck`) :
 * `A_{i,j} = Math.max(A_{i,j-1} + T_{libre,i,j}, A_{i-1,j} + h_{i,j})`
 */
export function simulateMaxPlusBottleneckStep(
  prevArrivalsS: ReadonlyArray<number>,
  freeTraversalTimesS: ReadonlyArray<number>,
  headwayS: number
): {
  exitTimesS: number[];
  queuingDelaysS: number[];
} {
  const n = prevArrivalsS.length;
  if (n === 0) return { exitTimesS: [], queuingDelaysS: [] };

  // Ordre de passage selon l'instant d'arrivée à l'entrée du passage technique
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => prevArrivalsS[a] - prevArrivalsS[b] || a - b
  );

  const exitTimesS = new Array<number>(n).fill(0);
  const queuingDelaysS = new Array<number>(n).fill(0);
  const h = Math.max(0, headwayS);

  let prevExit = Number.NEGATIVE_INFINITY;
  for (let rank = 0; rank < n; rank += 1) {
    const memberIdx = order[rank];
    const freeExit = prevArrivalsS[memberIdx] + Math.max(1, freeTraversalTimesS[memberIdx]);
    const constrainedExit = rank === 0 ? freeExit : Math.max(freeExit, prevExit + h);
    exitTimesS[memberIdx] = constrainedExit;
    queuingDelaysS[memberIdx] = Math.max(0, constrainedExit - freeExit);
    prevExit = constrainedExit;
  }

  return { exitTimesS, queuingDelaysS };
}

/** PRNG déterministe Mulberry32 + transformation de Box-Muller pour les tests à graine fixe. */
export function createSeededNormalGenerator(seed = 42): () => number {
  let state = seed >>> 0;
  const nextUniform = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let spare: number | null = null;
  return (): number => {
    if (spare !== null) {
      const val = spare;
      spare = null;
      return val;
    }
    const u1 = Math.max(1e-12, nextUniform());
    const u2 = nextUniform();
    const radius = Math.sqrt(-2 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    spare = radius * Math.sin(theta);
    return radius * Math.cos(theta);
  };
}

export interface GroupSegmentV2Input extends EffortSegmentInput {
  sacScale?: 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';
  isBottleneck?: boolean;
  headwayS?: number;
}

export interface GroupMemberV2Input extends GroupConsentedMemberInput {
  kalmanTheta?: readonly [number, number, number] | null;
  groupSimulationConsented?: boolean;
  dryClothingClo?: number;
}

export interface GroupPredictionV2Options {
  seed?: number;
  monteCarloDraws?: number;
  demHorizonElevationDeg?: number;
  groupSimulationConsented?: boolean;
}

export interface BottleneckMatrixEntry {
  segmentId: number;
  speedBottleneckMemberId: string;
  physiologicalBottleneckMemberId: string;
  minSpeedMs: number;
  maxAerobicFraction: number;
}

export interface GroupPredictionV2Output extends GroupPredictionOutput {
  mode: GroupDisciplineMode;
  twilightOverrunProbability: number;
  turnaroundTimeIso: string;
  coolingAlert: RegroupWaitingColdAlert;
  bottleneckMatrix: {
    overallSpeedBottleneckMemberId: string;
    overallPhysiologicalBottleneckMemberId: string;
    speedAndPhysiologicalDiverge: boolean;
    perSegment: BottleneckMatrixEntry[];
  };
  heterogeneityPenalty: {
    speedSpreadMs: number;
    aerobicSpread: number;
    penaltyPct: number;
    extraWaitS: number;
  };
  gearRedistributionActionPhrase: string;
  gearTransfersPrivate: {
    fromMemberId: string;
    toMemberId: string;
    weightKg: number;
    timeSavedMinutes: number;
    safetyMarginGainPct: number;
  }[];
  monteCarloDraws: number;
}

function quantileSorted(sorted: Float64Array, q: number): number {
  if (sorted.length === 0) return 0;
  const pos = clamp(q, 0, 1) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(sorted.length - 1, lo + 1);
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/**
 * Exécute la prédiction collective complète V2 (Mode Compact vs Mode Regroupement,
 * files d'attente max-plus, pauses superposées ATP 10 min/h, refroidissement IREQ/CoWEDA,
 * Monte Carlo 2 000 tirages vectorisés `< 1000 ms`, redistribution min-max et projection publique RGPD).
 */
export function simulateGroupPredictionV2(
  input: Omit<GroupPredictionInput, 'members' | 'segments'> & {
    members: GroupMemberV2Input[];
    segments: GroupSegmentV2Input[];
  },
  options: GroupPredictionV2Options = {}
): GroupPredictionV2Output {
  const N = input.members.length;
  const M = input.segments.length;
  const draws = Math.max(100, options.monteCarloDraws ?? DEFAULT_MONTE_CARLO_DRAWS);
  const seed = options.seed ?? 42;
  const mode = input.mode;
  const compactFriction = computeCompactGroupFrictionFactor(N);
  const strategyFactor = STRATEGY_SPEED_FACTORS[input.context.strategy ?? 'recommended'] ?? 1;

  // 1. Pré-calcul déterministe O(N * M) hors de la boucle Monte Carlo
  const freeTimeMatrixS = new Float64Array(N * M);
  const speedMatrixMs = new Float64Array(N * M);
  const aerobicMatrix = new Float64Array(N * M);
  const isBottleneckSeg = new Uint8Array(M);
  const isRegroupSeg = new Uint8Array(M);
  const segHeadwayS = new Float64Array(M);

  let totalDistanceM = 0;
  let maxTechnicite = 1;

  const perSegmentBottlenecks: BottleneckMatrixEntry[] = [];
  const memberTotalFreeTimeS = new Float64Array(N);
  const memberMeanAerobic = new Float64Array(N);

  for (let k = 0; k < M; k += 1) {
    const seg = input.segments[k];
    const distM = Math.max(1, seg.distanceM);
    totalDistanceM += distM;

    const techClass = clamp(
      Math.max(
        seg.technicalClass ?? 1,
        seg.sacScale === 'T5' || seg.sacScale === 'T6'
          ? 5
          : seg.sacScale === 'T4'
            ? 4
            : seg.sacScale === 'T3'
              ? 3
              : seg.sacScale === 'T2'
                ? 2
                : 1
      ),
      1,
      5
    );
    if (techClass > maxTechnicite) maxTechnicite = techClass;

    const bottleneck =
      seg.isBottleneck === true ||
      techClass >= 3 ||
      seg.sacScale === 'T3' ||
      seg.sacScale === 'T4' ||
      seg.sacScale === 'T5' ||
      seg.sacScale === 'T6';
    isBottleneckSeg[k] = bottleneck ? 1 : 0;
    isRegroupSeg[k] = seg.isRegroupPoint || k === M - 1 ? 1 : 0;
    segHeadwayS[k] = bottleneck ? (seg.headwayS ?? 12 + 8 * (techClass - 2)) : 0;

    let minSpeedMs = Number.POSITIVE_INFINITY;
    let speedLimitIdx = 0;
    let maxAero = -1;
    let physioLimitIdx = 0;

    for (let i = 0; i < N; i += 1) {
      const member = input.members[i];
      const surfaceRes = resolveIndividualSegmentSpeedMs({
        gradePct: seg.gradePct,
        altitudeM: seg.altitudeM,
        tempC: input.context.weather.tempC,
        surface: seg.surface || input.context.ground.surface,
        snowSinkCm: Math.max(seg.snowSinkCm ?? 0, input.context.ground.snowSinkCm ?? 0),
        wetness: input.context.ground.wetness,
        weightKg: member.physiology.weightKg,
        packWeightKg: member.pack.packWeightKg,
        vo2MaxMlKgMin: member.physiology.vo2MaxMlKgMin,
        technicalClass: techClass,
        sacScale: seg.sacScale,
        isChild: member.isChild,
        kalmanTheta: member.kalmanTheta ?? null,
        flatSpeedMsOverride: member.flatSpeedMs,
      });

      const vMs = Math.max(0.18, surfaceRes.speedMs * strategyFactor);
      speedMatrixMs[i * M + k] = vMs;

      if (vMs < minSpeedMs) {
        minSpeedMs = vMs;
        speedLimitIdx = i;
      }
    }

    for (let i = 0; i < N; i += 1) {
      const member = input.members[i];
      const vIndividual = speedMatrixMs[i * M + k];
      // En mode compact, le groupe marche à min_i(v_ik) * g(N)
      const vActual = mode === 'compact' ? minSpeedMs * compactFriction : vIndividual;
      const tFreeS = distM / Math.max(0.15, vActual);
      freeTimeMatrixS[i * M + k] = tFreeS;
      memberTotalFreeTimeS[i] += distM / Math.max(0.15, vIndividual);

      // Fraction aérobie à la vitesse effective vActual
      const vo2 = member.physiology.vo2MaxMlKgMin ?? 48;
      const pVo2Sea = ((vo2 * member.physiology.weightKg) / 1000) * 335;
      const loadRatio = member.pack.packWeightKg / member.physiology.weightKg;
      const approxPowerW =
        (member.physiology.weightKg + member.pack.packWeightKg) *
        (1.44 + 2.4 * vActual + Math.max(0, seg.gradePct) * 0.16 * vActual) *
        (1 + 0.8 * loadRatio);
      const aeroFrac = clamp(approxPowerW / Math.max(200, pVo2Sea), 0.08, 1.35);
      aerobicMatrix[i * M + k] = aeroFrac;
      memberMeanAerobic[i] += aeroFrac * distM;

      if (aeroFrac > maxAero) {
        maxAero = aeroFrac;
        physioLimitIdx = i;
      }
    }

    perSegmentBottlenecks.push({
      segmentId: seg.segmentId,
      speedBottleneckMemberId: input.members[speedLimitIdx].memberId,
      physiologicalBottleneckMemberId: input.members[physioLimitIdx].memberId,
      minSpeedMs: Number(minSpeedMs.toFixed(3)),
      maxAerobicFraction: Number(maxAero.toFixed(3)),
    });
  }

  for (let i = 0; i < N; i += 1) {
    memberMeanAerobic[i] = memberMeanAerobic[i] / Math.max(1, totalDistanceM);
  }

  // Goulot vitesse global vs goulot physiologique global
  let overallSpeedIdx = 0;
  let overallPhysioIdx = 0;
  for (let i = 1; i < N; i += 1) {
    if (memberTotalFreeTimeS[i] > memberTotalFreeTimeS[overallSpeedIdx]) {
      overallSpeedIdx = i;
    }
    if (memberMeanAerobic[i] > memberMeanAerobic[overallPhysioIdx]) {
      overallPhysioIdx = i;
    }
  }

  // 2. Simulation déterministe d'une trajectoire de référence (pour décomposer les attentes, files max-plus et pauses superposées)
  const memberArrivalS = new Float64Array(N);
  const memberWaitTotalS = new Float64Array(N);
  let maxSingleWaitS = 0;
  let maxWaitUpstreamAero = 0.5;
  let stageMovingAccumulatorS = 0;

  for (let k = 0; k < M; k += 1) {
    const h = segHeadwayS[k];
    if (isBottleneckSeg[k] === 1 && h > 0) {
      // File d'attente max-plus sur passage technique
      const prevArr = Array.from(memberArrivalS);
      const freeT = Array.from({ length: N }, (_, i) => freeTimeMatrixS[i * M + k]);
      const { exitTimesS } = simulateMaxPlusBottleneckStep(prevArr, freeT, h);
      for (let i = 0; i < N; i += 1) {
        memberArrivalS[i] = exitTimesS[i];
      }
    } else {
      for (let i = 0; i < N; i += 1) {
        memberArrivalS[i] += freeTimeMatrixS[i * M + k];
      }
    }

    let maxSegT = 0;
    for (let i = 0; i < N; i += 1) {
      if (freeTimeMatrixS[i * M + k] > maxSegT) maxSegT = freeTimeMatrixS[i * M + k];
    }
    stageMovingAccumulatorS += maxSegT;

    if (mode === 'regroupement' && isRegroupSeg[k] === 1) {
      // Pause superposée ATP 3-21.18 (10 min/h = 600 s par heure de marche) + récupération asymétrique
      const baseStagePauseS = Math.max(
        input.context.regroupPauseMinS ?? 180,
        (stageMovingAccumulatorS / 3600) * (ATP_PAUSE_PRIOR_MIN_PER_HOUR * 60)
      );

      let stageLastArrival = 0;
      let stageFirstArrival = Number.POSITIVE_INFINITY;
      for (let i = 0; i < N; i += 1) {
        if (memberArrivalS[i] > stageLastArrival) stageLastArrival = memberArrivalS[i];
        if (memberArrivalS[i] < stageFirstArrival) stageFirstArrival = memberArrivalS[i];
      }

      const stageSpreadWait = Math.max(0, stageLastArrival - stageFirstArrival);
      if (stageSpreadWait > maxSingleWaitS) {
        maxSingleWaitS = stageSpreadWait;
        maxWaitUpstreamAero = Math.max(...Array.from(memberMeanAerobic));
      }

      const requiredRecov = Array.from({ length: N }, (_, i) => {
        // Récupération asymétrique : même le dernier arrivé a besoin d'au moins 45 % de la pause nominale
        const personalStrainFactor = 0.45 + 0.55 * clamp(aerobicMatrix[i * M + k], 0.2, 1.0);
        return Math.max(60, baseStagePauseS * personalStrainFactor);
      });

      const superposed = computeAsymmetricSuperposedDepartureS(
        Array.from(memberArrivalS),
        requiredRecov
      );

      for (let i = 0; i < N; i += 1) {
        const waitBeforeLast = Math.max(0, stageLastArrival - memberArrivalS[i]);
        memberWaitTotalS[i] += waitBeforeLast;
        memberArrivalS[i] = superposed.departureTimeS;
      }
      stageMovingAccumulatorS = 0;
    } else if (mode === 'compact' && isRegroupSeg[k] === 1) {
      // En mode compact, pause collective ATP 10 min/h sans attente différentielle inter-membres
      const pauseS = (stageMovingAccumulatorS / 3600) * (ATP_PAUSE_PRIOR_MIN_PER_HOUR * 60);
      for (let i = 0; i < N; i += 1) {
        memberArrivalS[i] += pauseS;
      }
      stageMovingAccumulatorS = 0;
    }
  }

  const deterministicTotalDurationS = Math.max(...Array.from(memberArrivalS));
  const regroupWaitTotalS =
    mode === 'regroupement' ? Math.max(...Array.from(memberWaitTotalS)) : 0;

  // Pré-agrégation en étapes (checkpoints) pour que les 2 000 tirages Monte Carlo s'exécutent en < 25 ms
  interface CondensedStage {
    memberBaseTimeS: Float64Array;
    headwayTotalS: number;
    pauseBaseS: number;
  }
  const stages: CondensedStage[] = [];
  let curStageTimes = new Float64Array(N);
  let curHeadway = 0;
  let curMovingRef = 0;

  for (let k = 0; k < M; k += 1) {
    let maxK = 0;
    for (let i = 0; i < N; i += 1) {
      const t = freeTimeMatrixS[i * M + k];
      curStageTimes[i] += t;
      if (t > maxK) maxK = t;
    }
    curMovingRef += maxK;
    if (isBottleneckSeg[k] === 1) {
      curHeadway += segHeadwayS[k];
    }
    if (isRegroupSeg[k] === 1) {
      const pauseBaseS =
        mode === 'regroupement'
          ? Math.max(
              input.context.regroupPauseMinS ?? 180,
              (curMovingRef / 3600) * (ATP_PAUSE_PRIOR_MIN_PER_HOUR * 60) * 0.55
            )
          : (curMovingRef / 3600) * (ATP_PAUSE_PRIOR_MIN_PER_HOUR * 60);
      stages.push({
        memberBaseTimeS: curStageTimes,
        headwayTotalS: curHeadway,
        pauseBaseS,
      });
      curStageTimes = new Float64Array(N);
      curHeadway = 0;
      curMovingRef = 0;
    }
  }

  // 3. Simulation Monte Carlo vectorisée (2 000 tirages à graine fixe)
  const randNormal = createSeededNormalGenerator(seed);
  const drawGroupDurationsS = new Float64Array(draws);
  const memberDrawDurations = Array.from({ length: N }, () => new Float64Array(draws));
  const memberSigma = new Float64Array(N);
  for (let i = 0; i < N; i += 1) {
    const lvl = input.members[i].dataLevel ?? 'socle';
    memberSigma[i] = lvl === 'complet' ? 0.045 : lvl === 'cardio' ? 0.065 : 0.09;
  }

  const departureMs = Date.parse(input.departureTime);
  const rawTwilightMs = Date.parse(input.twilightTime);
  // Masque d'horizon MNT : chaque degré d'élévation d'horizon avance le crépuscule d'environ 4 minutes (240 s)
  const horizonAdvanceMs = Math.max(0, options.demHorizonElevationDeg ?? 0) * 240_000;
  const effectiveTwilightMs = rawTwilightMs - horizonAdvanceMs;
  const availableDaylightS = Math.max(0, (effectiveTwilightMs - departureMs) / 1000);

  let twilightOverrunCount = 0;
  const memberShocks = new Float64Array(N);
  const numStages = stages.length;

  for (let d = 0; d < draws; d += 1) {
    const weatherZ = randNormal();
    const sharedWeatherShock = Math.exp(SHARED_WEATHER_SHOCK_SIGMA * weatherZ);

    let minMemberShock = Number.POSITIVE_INFINITY;
    for (let i = 0; i < N; i += 1) {
      const mShock = Math.exp(memberSigma[i] * randNormal());
      memberShocks[i] = mShock;
      if (mShock < minMemberShock) minMemberShock = mShock;
    }

    let groupElapsedS = 0;
    for (let s = 0; s < numStages; s += 1) {
      const st = stages[s];
      const baseArr = st.memberBaseTimeS;
      let maxStageMemberS = 0;
      for (let i = 0; i < N; i += 1) {
        const tMember = baseArr[i] * sharedWeatherShock * memberShocks[i];
        if (tMember > maxStageMemberS) maxStageMemberS = tMember;
      }
      const queueDelayS = st.headwayTotalS * Math.max(0, N - 1) * sharedWeatherShock;
      groupElapsedS += maxStageMemberS + queueDelayS + st.pauseBaseS;
    }

    drawGroupDurationsS[d] = groupElapsedS;
    if (groupElapsedS > availableDaylightS) {
      twilightOverrunCount += 1;
    }

    for (let i = 0; i < N; i += 1) {
      const personalScale =
        mode === 'compact' ? 1.0 : clamp(memberShocks[i] / Math.max(0.5, minMemberShock), 0.75, 1.15);
      memberDrawDurations[i][d] = groupElapsedS * personalScale;
    }
  }

  const sortedGroupDurations = new Float64Array(drawGroupDurationsS).sort();
  const durP10 = Math.max(1, quantileSorted(sortedGroupDurations, 0.10));
  const durP50 = Math.max(durP10, quantileSorted(sortedGroupDurations, 0.50));
  const durP90 = Math.max(durP50, quantileSorted(sortedGroupDurations, 0.90));

  const etaP10Iso = new Date(departureMs + durP10 * 1000).toISOString();
  const etaP50Iso = new Date(departureMs + durP50 * 1000).toISOString();
  const etaP90Iso = new Date(departureMs + durP90 * 1000).toISOString();

  // Marges avant crépuscule signées : p90 <= p50 <= p10 (la marge décroît quand la durée augmente)
  const twilightMarginS = {
    p10: Math.round(availableDaylightS - durP10),
    p50: Math.round(availableDaylightS - durP50),
    p90: Math.round(availableDaylightS - durP90),
  };

  const twilightOverrunProbability = Number((twilightOverrunCount / draws).toFixed(4));
  const overtakesTwilightRisk =
    twilightOverrunProbability >= 0.20 || twilightMarginS.p90 < 0;

  // Heure limite de demi-tour sécuritaire (mi-parcours P90 avant crépuscule topographique)
  const turnaroundOffsetS = Math.max(
    1800,
    availableDaylightS - 0.55 * durP90
  );
  const turnaroundTimeIso = new Date(departureMs + turnaroundOffsetS * 1000).toISOString();

  // 4. Alerte refroidissement d'attente IREQ / CoWEDA
  const coolingAlert = evaluateRegroupWaitingColdAlert({
    waitDurationS: mode === 'regroupement' ? Math.max(maxSingleWaitS, regroupWaitTotalS / Math.max(1, numStages)) : 0,
    tempC: input.context.weather.tempC,
    windMs: input.context.weather.windMs,
    upstreamAerobicFraction: maxWaitUpstreamAero,
  });

  // 5. Optimisation min-max de redistribution du sac sous consentement `group_simulation`
  const redistributionAllowed = options.groupSimulationConsented !== false;
  const gearTransfersPrivate: GroupPredictionV2Output['gearTransfersPrivate'] = [];
  const loadDeltasByMember = new Float64Array(N);

  if (redistributionAllowed && N >= 2) {
    // Le membre à soulager en priorité est le goulot physiologique (ou le goulot vitesse s'il porte un sac)
    const bottleneckIdx =
      input.members[overallPhysioIdx].pack.packWeightKg > 2
        ? overallPhysioIdx
        : overallSpeedIdx;
    const donor = input.members[bottleneckIdx];
    const donorMaxComfortKg =
      donor.maxCarryKg ?? Math.min(10, 0.14 * donor.physiology.weightKg);
    let transferableExcessKg = Math.max(
      0,
      donor.pack.packWeightKg - Math.min(donorMaxComfortKg, donor.pack.packWeightKg * 0.65)
    );

    if (transferableExcessKg >= 0.5) {
      const receivers = input.members
        .map((m, idx) => ({ m, idx }))
        .filter(
          ({ m, idx }) =>
            idx !== bottleneckIdx &&
            !m.isChild &&
            m.groupSimulationConsented !== false &&
            m.pack.packWeightKg < (m.maxCarryKg ?? 0.24 * m.physiology.weightKg)
        )
        .sort((a, b) => memberMeanAerobic[a.idx] - memberMeanAerobic[b.idx]);

      for (const { m: receiver, idx: recIdx } of receivers) {
        if (transferableExcessKg <= 0.2) break;
        const receiverCap =
          (receiver.maxCarryKg ?? 0.24 * receiver.physiology.weightKg) -
          receiver.pack.packWeightKg;
        const transferKg = round(
          Math.min(transferableExcessKg, receiverCap, MAX_GEAR_TRANSFER_KG),
          1
        );
        if (transferKg < 0.3) continue;

        const timeSavedMinutes = Math.max(
          2,
          Math.round((transferKg / donor.physiology.weightKg) * (durP50 / 60) * 0.85)
        );
        const safetyMarginGainPct = Math.max(
          2,
          Math.round(((timeSavedMinutes * 60) / Math.max(1800, durP50)) * 100 * 1.4)
        );

        gearTransfersPrivate.push({
          fromMemberId: donor.memberId,
          toMemberId: receiver.memberId,
          weightKg: transferKg,
          timeSavedMinutes,
          safetyMarginGainPct,
        });
        loadDeltasByMember[bottleneckIdx] -= transferKg;
        loadDeltasByMember[recIdx] += transferKg;
        transferableExcessKg -= transferKg;
      }
    }
  }

  const totalTransferredKg = round(
    gearTransfersPrivate.reduce((acc, t) => acc + t.weightKg, 0),
    1
  );
  const totalTimeSavedMin = gearTransfersPrivate.reduce(
    (acc, t) => acc + t.timeSavedMinutes,
    0
  );
  const totalMarginGainPct = gearTransfersPrivate.reduce(
    (acc, t) => acc + t.safetyMarginGainPct,
    0
  );
  const maxPerReceiverKg =
    gearTransfersPrivate.length > 0
      ? Math.max(...gearTransfersPrivate.map((t) => t.weightKg))
      : 0;

  const gearRedistributionActionPhrase =
    totalTransferredKg > 0
      ? `Déplacer ${totalTransferredKg.toFixed(1).replace('.', ',')} kg : arrivée −${totalTimeSavedMin} min, marge sécurité +${totalMarginGainPct} %`
      : 'Aucun transfert requis : répartition du portage équilibrée';

  // 6. Sorties privées par membre (`privateByMember`)
  const privateByMember: PrivateMemberGroupPrediction[] = input.members.map(
    (member, i) => {
      const sortedMemberDraws = new Float64Array(memberDrawDurations[i]).sort();
      const mP10 = Math.max(1, quantileSorted(sortedMemberDraws, 0.10));
      const mP50 = Math.max(mP10, quantileSorted(sortedMemberDraws, 0.50));
      const mP90 = Math.max(mP50, quantileSorted(sortedMemberDraws, 0.90));

      const memberSegments: EffortSegmentInput[] = input.segments.map((seg, k) => {
        const dtS = Math.max(1, freeTimeMatrixS[i * M + k]);
        const vMs = seg.distanceM / dtS;
        return {
          ...seg,
          durationS: dtS,
          speedMs: vMs,
          outOfDomain: vMs < 0.45 || vMs > 1.97,
        };
      });

      const effortScore = computeEffortScore({
        segments: memberSegments,
        weather: input.context.weather,
        ground: input.context.ground,
        pack: member.pack,
        physiology: member.physiology,
        observations: member.observations,
        dataLevel: member.dataLevel,
        snapshot: input.context.snapshot,
        evidence: [
          {
            value: input.context.weather.tempC,
            unit: '°C',
            source: 'group-context-weather',
            kind: 'measured',
            quality: 0.85,
            capturedAt: input.departureTime,
            modelVersion: EFFORT_SCORE_VERSION,
          },
        ],
      });

      return {
        memberId: member.memberId,
        effortScore,
        durationIntervalS: { p10: mP10, p50: mP50, p90: mP90 },
        etaInterval: {
          p10: new Date(departureMs + mP10 * 1000).toISOString(),
          p50: new Date(departureMs + mP50 * 1000).toISOString(),
          p90: new Date(departureMs + mP90 * 1000).toISOString(),
        },
        waitDurationS: Math.round(memberWaitTotalS[i]),
        recommendedLoadDeltaKg: round(loadDeltasByMember[i], 2),
      };
    }
  );

  // 7. Pénalité d'hétérogénéité & risque de séparation
  const memberSpeedsMs = Array.from(
    { length: N },
    (_, i) => totalDistanceM / Math.max(1, memberTotalFreeTimeS[i])
  );
  const speedSpreadMs =
    N > 1 ? Math.max(...memberSpeedsMs) - Math.min(...memberSpeedsMs) : 0;
  const aerobicSpread =
    N > 1
      ? Math.max(...Array.from(memberMeanAerobic)) -
        Math.min(...Array.from(memberMeanAerobic))
      : 0;
  const bestFreeTimeS = Math.min(...Array.from(memberTotalFreeTimeS));
  const penaltyPct =
    bestFreeTimeS > 0
      ? round(
          Math.max(0, ((deterministicTotalDurationS - bestFreeTimeS) / bestFreeTimeS) * 100),
          2
        )
      : 0;

  const sepLevel: 'low' | 'medium' | 'high' =
    speedSpreadMs * 3.6 >= SEPARATION_SPREAD_HIGH_KMH || N >= LARGE_GROUP_RISK_THRESHOLD
      ? 'high'
      : speedSpreadMs * 3.6 >= SEPARATION_SPREAD_MEDIUM_KMH || N >= GROUP_SIZE_RISK_THRESHOLD
        ? 'medium'
        : 'low';

  const sepReasons: string[] = [
    `Dispersion d’allure collective de ${(speedSpreadMs * 3.6).toFixed(2)} km/h en mode ${mode}.`,
  ];
  if (coolingAlert.triggered) {
    sepReasons.push(coolingAlert.message);
  }
  if (totalTransferredKg > 0) {
    sepReasons.push(gearRedistributionActionPhrase);
  }

  // 8. Construction de la projection publique garantie sans fuite biométrique (`PublicGroupPredictionSchema`)
  const collectiveIea = clamp(
    Math.max(...privateByMember.map((m) => m.effortScore.iea)),
    0,
    100
  );
  const worstRisk = privateByMember.reduce(
    (acc, m) => (m.effortScore.risque.score > acc.score ? m.effortScore.risque : acc),
    privateByMember[0].effortScore.risque
  );
  const collectiveRisque = {
    ...worstRisk,
    factors: coolingAlert.triggered
      ? [...new Set([...worstRisk.factors, coolingAlert.message])]
      : [...worstRisk.factors],
  };

  const groupPaceMs = Math.max(0.15, totalDistanceM / Math.max(1, durP50));
  const pauseEveryMinutes = Math.round(60 / (ATP_PAUSE_PRIOR_MIN_PER_HOUR / 10)); // 60 min (10 min/h ATP 3-21.18)
  const snapshotHash = computeSnapshotHashSync(input.context.snapshot);
  const confidence = makeConfidence({
    score: 0.78,
    sampleCount: M,
    method: `${EFFORT_SCORE_VERSION}:group-${mode}-mc${draws}`,
    reasons: [
      `Simulation collective ${mode} (${N} membres, ${M} segments, ${draws} tirages Monte Carlo)`,
    ],
  });

  const publicProjectionCandidate: PublicGroupPrediction = {
    mode,
    memberCount: N,
    groupPaceMs,
    totalDurationIntervalS: { p10: durP10, p50: durP50, p90: durP90 },
    groupEtaInterval: { p10: etaP10Iso, p50: etaP50Iso, p90: etaP90Iso },
    regroupWaitTotalS: Math.round(regroupWaitTotalS),
    twilightMarginS,
    overtakesTwilightRisk,
    collectiveIea,
    collectiveTechnicite: maxTechnicite,
    collectiveRisque,
    separationRisk: {
      level: sepLevel,
      reasons: sepReasons,
    },
    pauseEveryMinutes,
    gearRedistributionSummary: {
      transfers: gearTransfersPrivate.length,
      totalWeightKg: totalTransferredKg,
      maxPerReceiverKg,
    },
    snapshotHash,
    confidence,
    evidence: [
      {
        value: groupPaceMs,
        unit: 'm/s',
        source: 'group-intelligence-v2-monte-carlo',
        kind: 'derived',
        quality: 0.82,
        capturedAt: input.departureTime,
        modelVersion: EFFORT_SCORE_VERSION,
      },
    ],
    warnings: coolingAlert.triggered
      ? [
          {
            code: 'extreme_wind_chill',
            message: coolingAlert.message,
            severity: 'warning',
          },
        ]
      : [],
  };

  // Garde-fou normatif : validation stricte via PublicGroupPredictionSchema
  const publicProjection = PublicGroupPredictionSchema.parse(publicProjectionCandidate);

  const overallSpeedBottleneckMemberId = input.members[overallSpeedIdx].memberId;
  const overallPhysiologicalBottleneckMemberId = input.members[overallPhysioIdx].memberId;

  return {
    mode,
    privateByMember,
    publicProjection,
    twilightOverrunProbability,
    turnaroundTimeIso,
    coolingAlert,
    bottleneckMatrix: {
      overallSpeedBottleneckMemberId,
      overallPhysiologicalBottleneckMemberId,
      speedAndPhysiologicalDiverge:
        overallSpeedBottleneckMemberId !== overallPhysiologicalBottleneckMemberId,
      perSegment: perSegmentBottlenecks,
    },
    heterogeneityPenalty: {
      speedSpreadMs: Number(speedSpreadMs.toFixed(4)),
      aerobicSpread: Number(aerobicSpread.toFixed(4)),
      penaltyPct,
      extraWaitS: Math.round(regroupWaitTotalS),
    },
    gearRedistributionActionPhrase,
    gearTransfersPrivate,
    monteCarloDraws: draws,
  };
}
