/**
 * Lot G02 — projections d'affichage des écrans clubs.
 *
 * Ce module est volontairement pur (aucun React, aucun accès réseau) :
 * il transforme le contrat `@/features/clubs` en libellés, états et
 * valeurs prêtes à rendre. Les composants ne recalculent jamais une règle
 * métier (capacité, rôle, opt-out, confidentialité) : ils la lisent ici.
 */

import type {
  ChallengeMetric,
  ClubChannelKind,
  ClubMember,
  ClubPrivacy,
  ClubRole,
  EventFormat,
  EventRegistration,
  InviteLink,
  InviteTargetKind,
  MembershipStatus,
  ChallengeScope,
} from '@/features/clubs';

export const PRIVACY_LABELS: Record<ClubPrivacy, string> = {
  open: 'Ouvert',
  closed: 'Sur validation',
  secret: 'Sur invitation',
};

export const PRIVACY_HINTS: Record<ClubPrivacy, string> = {
  open: 'Tout le monde peut rejoindre et voir les sorties publiques.',
  closed: 'Les demandes sont validées par un administrateur.',
  secret: 'Invisible hors membres : seule une invitation permet d’entrer.',
};

export const ROLE_LABELS: Record<ClubRole, string> = {
  admin: 'Administrateur',
  moderator: 'Modérateur',
  member: 'Membre',
};

export const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatus, string> = {
  active: 'Actif',
  pending: 'En attente',
  removed: 'Retiré',
  banned: 'Banni',
};

export const EVENT_FORMAT_LABELS: Record<EventFormat, string> = {
  social_ride: 'Sortie conviviale',
  training: 'Entraînement',
  race: 'Course',
  trail_outing: 'Sortie trail',
  indoor: 'En salle',
};

export const METRIC_LABELS: Record<ChallengeMetric, string> = {
  distance_m: 'Distance',
  duration_s: 'Durée',
  elevation_gain_m: 'Dénivelé',
  activities_count: 'Sorties',
};

export const METRIC_UNITS: Record<ChallengeMetric, string> = {
  distance_m: 'km',
  duration_s: 'h',
  elevation_gain_m: 'm',
  activities_count: 'sorties',
};

export const CHANNEL_KIND_LABELS: Record<ClubChannelKind, string> = {
  general: 'Général',
  announcements: 'Annonces',
  events: 'Sorties',
  custom: 'Salon',
};

export const INVITE_KIND_LABELS: Record<InviteTargetKind, string> = {
  club: 'Invitation au club',
  event: 'Invitation à une sortie',
  recorded_activity: 'Partage d’une trace',
};

export const SCOPE_LABELS: Record<ChallengeScope, string> = {
  individual: 'Défi individuel',
  club: 'Défi de club',
};

export function roleLabel(role: ClubRole): string {
  return ROLE_LABELS[role] ?? ROLE_LABELS.member;
}

export function privacyLabel(privacy: ClubPrivacy): string {
  return PRIVACY_LABELS[privacy] ?? PRIVACY_LABELS.secret;
}

export function isClubManager(member: ClubMember | null | undefined): boolean {
  return Boolean(member && member.status === 'active' && (member.role === 'admin' || member.role === 'moderator'));
}

export function isClubAdmin(member: ClubMember | null | undefined): boolean {
  return Boolean(member && member.status === 'active' && member.role === 'admin');
}

/** Nombre de secondes → « 4 h 12 » ou « 42 min ». */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} s`;
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/** Mètres → « 12,4 km » (ou « 850 m » sous le kilomètre). */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '0 km';
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: km < 100 ? 1 : 0 }).format(km)} km`;
}

export function formatElevation(meters: number): string {
  const value = Math.max(0, Math.round(meters));
  return `${new Intl.NumberFormat('fr-FR').format(value)} m D+`;
}

export function formatMetricValue(metric: ChallengeMetric, value: number): string {
  switch (metric) {
    case 'distance_m':
      return formatDistance(value);
    case 'duration_s':
      return formatDuration(value);
    case 'elevation_gain_m':
      return formatElevation(value);
    case 'activities_count':
      return `${new Intl.NumberFormat('fr-FR').format(Math.max(0, Math.round(value)))} ${value > 1 ? 'sorties' : 'sortie'}`;
  }
}

export function formatEventDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date à confirmer';
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Paris',
  }).format(date);
}

export function formatEventTimeRange(startsAt: string, endsAt: string | null | undefined): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return 'Horaire à confirmer';
  const time = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
  if (!endsAt) return time.format(start);
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return time.format(start);
  return `${time.format(start)} – ${time.format(end)}`;
}

export function formatDayMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Europe/Paris',
  })
    .format(date)
    .replace('.', '');
}

export interface EventCapacityView {
  registered: number;
  waitlist: number;
  remaining: number | null;
  isFull: boolean;
  waitlistOpen: boolean;
}

export interface EventCounts {
  registered: number;
  waitlist: number;
}

export function eventCapacityFromCounts(
  event: { maxParticipants: number | null; waitlistEnabled: boolean },
  counts: EventCounts,
): EventCapacityView {
  const registered = Math.max(0, counts.registered);
  const waitlist = Math.max(0, counts.waitlist);
  const remaining =
    event.maxParticipants === null ? null : Math.max(0, event.maxParticipants - registered);
  const isFull = remaining === 0;
  return {
    registered,
    waitlist,
    remaining,
    isFull,
    waitlistOpen: isFull && event.waitlistEnabled,
  };
}

export function eventCapacity(
  event: { id: string; maxParticipants: number | null; waitlistEnabled: boolean },
  registrations: readonly EventRegistration[],
): EventCapacityView {
  const eventRegistrations = registrations.filter((registration) => registration.eventId === event.id);
  return eventCapacityFromCounts(event, {
    registered: eventRegistrations.filter((registration) => registration.status === 'registered').length,
    waitlist: eventRegistrations.filter((registration) => registration.status === 'waitlist').length,
  });
}

export type EventRsvpView = 'registered' | 'waitlist' | 'none';

export function eventRsvpStatus(
  eventId: string,
  userId: string | null | undefined,
  registrations: readonly EventRegistration[],
): EventRsvpView {
  if (!userId) return 'none';
  const mine = registrations.find(
    (registration) =>
      registration.eventId === eventId &&
      registration.userId === userId &&
      registration.status !== 'cancelled',
  );
  if (!mine) return 'none';
  return mine.status === 'waitlist' ? 'waitlist' : 'registered';
}

export type EventTemporalState = 'upcoming' | 'today' | 'past';

export function eventTemporalState(
  startsAt: string,
  endsAt: string | null | undefined,
  nowIso: string,
): EventTemporalState {
  const start = Date.parse(startsAt);
  const end = endsAt ? Date.parse(endsAt) : start;
  const now = Date.parse(nowIso);
  if (!Number.isFinite(start) || !Number.isFinite(now)) return 'upcoming';
  if (Number.isFinite(end) && now > end) return 'past';
  const startDay = new Date(start).toISOString().slice(0, 10);
  const nowDay = new Date(now).toISOString().slice(0, 10);
  if (startDay === nowDay) return 'today';
  return start < now ? 'past' : 'upcoming';
}

export function sortEventsForDisplay<T extends { startsAt: string; id: string }>(events: readonly T[]): T[] {
  return [...events].sort((a, b) => {
    const diff = Date.parse(a.startsAt) - Date.parse(b.startsAt);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
}

export interface ChallengeProgressView {
  pct: number;
  totalLabel: string;
  targetLabel: string;
  remainingLabel: string;
  isCompleted: boolean;
}

export function challengeProgress(
  challenge: {
    metric: ChallengeMetric;
    targetValue: number;
    scope: ChallengeScope;
    id: string;
  },
  totalValue: number,
): ChallengeProgressView {
  const target = Math.max(0, challenge.targetValue);
  const total = Math.max(0, totalValue);
  const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
  return {
    pct,
    totalLabel: formatMetricValue(challenge.metric, total),
    targetLabel: formatMetricValue(challenge.metric, target),
    remainingLabel:
      total >= target ? 'Objectif atteint' : `Reste ${formatMetricValue(challenge.metric, target - total)}`,
    isCompleted: total >= target,
  };
}

export function leaderboardPodium<T extends { rank: number }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => a.rank - b.rank).slice(0, 3);
}

export type InviteAvailability = 'active' | 'revoked' | 'expired' | 'exhausted';

export function inviteAvailability(invite: InviteLink, nowIso: string): InviteAvailability {
  if (invite.revokedAt) return 'revoked';
  if (invite.expiresAt && Date.parse(invite.expiresAt) <= Date.parse(nowIso)) return 'expired';
  if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) return 'exhausted';
  return 'active';
}

export const INVITE_AVAILABILITY_LABELS: Record<InviteAvailability, string> = {
  active: 'Actif',
  revoked: 'Révoqué',
  expired: 'Expiré',
  exhausted: 'Épuisé',
};

export function inviteUsesLabel(invite: InviteLink): string {
  if (invite.maxUses === null) return `${invite.usesCount} utilisation${invite.usesCount > 1 ? 's' : ''}`;
  return `${invite.usesCount} / ${invite.maxUses} utilisations`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function sortMembersForDisplay(members: readonly ClubMember[]): ClubMember[] {
  const rank: Record<ClubRole, number> = { admin: 0, moderator: 1, member: 2 };
  return [...members]
    .filter((member) => member.status === 'active' || member.status === 'pending')
    .sort((a, b) => {
      const byRole = rank[a.role] - rank[b.role];
      if (byRole !== 0) return byRole;
      return a.displayName.localeCompare(b.displayName, 'fr');
    });
}

export function channelKindLabel(kind: ClubChannelKind): string {
  return CHANNEL_KIND_LABELS[kind] ?? CHANNEL_KIND_LABELS.custom;
}

export function inviteKindLabel(kind: InviteTargetKind): string {
  return INVITE_KIND_LABELS[kind] ?? INVITE_KIND_LABELS.club;
}

export function scopeLabel(scope: ChallengeScope): string {
  return SCOPE_LABELS[scope] ?? SCOPE_LABELS.individual;
}
