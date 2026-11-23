export interface NaismithParams {
  /** Vitesse à plat, km/h. */
  readonly speedKmh: number;
  /** Montée par heure, m de D+/h. */
  readonly ascentMPerHour: number;
}

export const DEFAULT_NAISMITH: NaismithParams = { speedKmh: 4, ascentMPerHour: 600 };

export function naismithMethod(params: NaismithParams = DEFAULT_NAISMITH): string {
  return `Naismith ${params.speedKmh} km/h + ${params.ascentMPerHour} m/h`;
}

export interface PaceEstimate {
  /** `null` si la distance est inconnue. */
  readonly minutes: number | null;
  /** Vrai quand le D+ est inconnu : la durée ne compte alors que la distance (minimum). */
  readonly isLowerBound: boolean;
  readonly method: string;
}

/** Durée de marche selon Naismith. D+ inconnu : minimum, annoncé comme tel, jamais un D+ supposé nul. */
export function naismithDuration(
  distanceKm: number | null | undefined,
  ascentM: number | null | undefined,
  params: NaismithParams = DEFAULT_NAISMITH,
): PaceEstimate {
  const base = naismithMethod(params);
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm < 0 || params.speedKmh <= 0) {
    return { minutes: null, isLowerBound: false, method: `${base} (distance inconnue)` };
  }
  const flat = (distanceKm / params.speedKmh) * 60;
  if (ascentM == null || !Number.isFinite(ascentM) || params.ascentMPerHour <= 0) {
    return { minutes: Math.round(flat), isLowerBound: true, method: `${base} (D+ inconnu : distance seule, durée minimale)` };
  }
  const climb = (Math.max(0, ascentM) / params.ascentMPerHour) * 60;
  return { minutes: Math.round(flat + climb), isLowerBound: false, method: base };
}

export interface PaceMember {
  readonly id: string;
  readonly name?: string;
  readonly speedKmh?: number | null;
  readonly ascentMPerHour?: number | null;
  /** `profile` : allure apprise des sorties terminées (profil de performance, 10.8) ; absent : déclarée ou saisie. */
  readonly origin?: 'profile';
  /** Nombre de sorties derrière une allure apprise (pour le dire à l'écran). */
  readonly sampleCount?: number;
}

export interface GroupPace {
  readonly params: NaismithParams;
  /** Vrai quand l'allure retenue vient d'un profil appris des sorties (et non d'une saisie ni du défaut). */
  readonly fromProfile: boolean;
  readonly slowestMemberId: string | null;
  /** Membres dont l'allure n'est pas renseignée : leur allure n'est pas devinée. */
  readonly unknownMemberIds: readonly string[];
  readonly basis: 'slowest_member' | 'default';
  readonly method: string;
}

/** L'allure du groupe est celle du plus lent (vitesse et montée prises séparément). */
export function groupPace(members: readonly PaceMember[], defaults: NaismithParams = DEFAULT_NAISMITH): GroupPace {
  const valid = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
  const unknown = members.filter((m) => !valid(m.speedKmh) && !valid(m.ascentMPerHour)).map((m) => m.id);
  const speeds = members.filter((m) => valid(m.speedKmh));
  const ascents = members.filter((m) => valid(m.ascentMPerHour));
  if (speeds.length === 0 && ascents.length === 0) {
    return {
      params: defaults,
      fromProfile: false,
      slowestMemberId: null,
      unknownMemberIds: unknown,
      basis: 'default',
      method: `${naismithMethod(defaults)} (allures des membres non renseignées)`,
    };
  }
  let slowest: PaceMember | null = null;
  for (const m of speeds) {
    if (!slowest || (m.speedKmh as number) < (slowest.speedKmh as number)) slowest = m;
  }
  const speed = speeds.length ? Math.min(...speeds.map((m) => m.speedKmh as number)) : defaults.speedKmh;
  const climb = ascents.length ? Math.min(...ascents.map((m) => m.ascentMPerHour as number)) : defaults.ascentMPerHour;
  const params = { speedKmh: speed, ascentMPerHour: climb };
  const slowestId = slowest?.id ?? ascents[0]?.id ?? null;
  const limiting = members.find((m) => m.id === slowestId);
  // L'allure vient du profil appris seulement si c'est lui qui fixe la vitesse retenue.
  const fromProfile = limiting?.origin === 'profile';
  const standardClimb = fromProfile && ascents.length === 0 ? ' (montée : valeur standard)' : '';
  return {
    params,
    fromProfile,
    slowestMemberId: slowestId,
    unknownMemberIds: unknown,
    basis: 'slowest_member',
    method: `${naismithMethod(params)}${standardClimb}, allure du plus lent${fromProfile ? ', d’après tes sorties' : ''}`,
  };
}
