/**
 * A8 — Intelligence de groupe (moteur pur).
 *
 * Le groupe est dimensionné par son **membre dimensionnant** (le plus lent,
 * pondéré descente technique et enfants), jamais par une moyenne. La
 * difficulté est calculée membre par membre via le moteur de fatigue A3,
 * le risque de séparation combine écart d'allure et composition du groupe,
 * et la redistribution du portage excessif est plafonnée.
 *
 * Privacy (ADR-AI-003) : `projectGroupPlanPublic` ne contient ni identité,
 * ni vitesse individuelle, ni aucune donnée de santé. Aucune I/O.
 */
import { computeFatigue } from './fatigue';
import { STRATEGY_SPEED_FACTORS } from './prediction';

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
 * Construit le plan collectif : allure du membre dimensionnant, difficultés
 * par membre (moteur A3), risque de séparation, pauses et redistribution.
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

/**
 * Projection publique d'un plan de groupe : uniquement les éléments
 * partageables. Aucune identité, aucune vitesse individuelle, aucune
 * donnée de santé ne franchit cette frontière normative.
 */
export function projectGroupPlanPublic(plan: GroupPlan): {
  groupPaceKmH: number;
  groupDifficulty: number;
  limitingReason: string | null;
  separationRisk: { level: string; reasons: string[] };
  memberCount: number;
} {
  return {
    groupPaceKmH: plan.groupPaceKmH,
    groupDifficulty: plan.groupDifficulty,
    limitingReason: plan.limitingReason,
    separationRisk: {
      level: plan.separationRisk.level,
      reasons: [...plan.separationRisk.reasons],
    },
    memberCount: plan.memberPacesKmH.length,
  };
}
