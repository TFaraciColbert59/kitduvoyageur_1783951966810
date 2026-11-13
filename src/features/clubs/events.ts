import { canViewClubEvent, isActiveMember } from './privacy';
import type {
  Club,
  ClubEvent,
  ClubMember,
  ClubResult,
  EventAttendanceRecord,
  EventAttendanceStats,
  EventFlyer,
  EventRegistration,
  EventSearchQuery,
  PaceGroup,
  ViewerPrivacyContext,
} from './types';

function isValidHttpUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * K5.21 — Inscription à une sortie de club avec réservation cohérente des places.
 * - Un club `closed` ou `secret` exige une adhésion active (ou une invitation valide).
 * - Si `maxParticipants` est atteint : bascule en `waitlist` si autorisé, sinon `CAPACITY_FULL`.
 * - Aucun doublon d'inscription pour un même utilisateur.
 */
export function registerForClubEvent(params: {
  event: ClubEvent;
  club: Club;
  userId: string;
  memberships: readonly ClubMember[];
  registrations: readonly EventRegistration[];
  paceGroupId?: string | null;
  invitedByUserId?: string | null;
  inviteId?: string | null;
  hasValidInvite?: boolean;
  nowIso: string;
}): ClubResult<{ registration: EventRegistration; registrations: EventRegistration[] }> {
  const { event, club, userId, memberships, registrations } = params;

  const member = memberships.find((m) => m.clubId === club.id && m.userId === userId);
  if (member?.status === 'banned') {
    return { ok: false, error: 'FORBIDDEN', message: 'Utilisateur banni du club.' };
  }

  const isMember = isActiveMember(member);
  const canJoinViaClub = club.privacy === 'open' || isMember || Boolean(params.hasValidInvite);
  if (!canJoinViaClub) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Adhésion ou invitation requise pour rejoindre cette sortie.',
    };
  }

  if (
    params.paceGroupId &&
    !event.paceGroups.some((pg) => pg.id === params.paceGroupId)
  ) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      message: 'Groupe d’allure introuvable sur cet événement.',
    };
  }

  const existing = registrations.find(
    (r) => r.eventId === event.id && r.userId === userId && r.status !== 'cancelled',
  );
  if (existing) {
    return {
      ok: false,
      error: 'CONFLICT',
      message: 'Utilisateur déjà inscrit à cet événement.',
    };
  }

  const activeRegisteredCount = registrations.filter(
    (r) => r.eventId === event.id && r.status === 'registered',
  ).length;

  const isFull =
    event.maxParticipants !== null && activeRegisteredCount >= event.maxParticipants;

  if (isFull && !event.waitlistEnabled) {
    return {
      ok: false,
      error: 'CAPACITY_FULL',
      message: 'Capacité maximale atteinte pour cet événement.',
    };
  }

  const status = isFull ? 'waitlist' : 'registered';
  const registration: EventRegistration = {
    eventId: event.id,
    userId,
    status,
    paceGroupId: params.paceGroupId ?? null,
    invitedByUserId: params.invitedByUserId ?? null,
    inviteId: params.inviteId ?? null,
    registeredAt: params.nowIso,
    updatedAt: params.nowIso,
  };

  const withoutCancelled = registrations.filter(
    (r) => !(r.eventId === event.id && r.userId === userId),
  );

  return {
    ok: true,
    data: {
      registration,
      registrations: [...withoutCancelled, registration],
    },
  };
}

/**
 * K5.21 — Désinscription d'un participant et promotion FIFO de la liste d'attente.
 */
export function cancelEventRegistration(params: {
  event: ClubEvent;
  userId: string;
  registrations: readonly EventRegistration[];
  nowIso: string;
}): ClubResult<{ registrations: EventRegistration[]; promotedUserId: string | null }> {
  const { event, userId, registrations, nowIso } = params;
  const existing = registrations.find(
    (r) => r.eventId === event.id && r.userId === userId && r.status !== 'cancelled',
  );
  if (!existing) {
    return { ok: false, error: 'NOT_FOUND', message: 'Inscription active introuvable.' };
  }

  const wasRegistered = existing.status === 'registered';
  let nextList: EventRegistration[] = registrations.map((r) =>
    r.eventId === event.id && r.userId === userId
      ? { ...r, status: 'cancelled' as const, updatedAt: nowIso }
      : r,
  );

  let promotedUserId: string | null = null;
  if (wasRegistered) {
    const waitlistCandidates = nextList
      .filter((r) => r.eventId === event.id && r.status === 'waitlist')
      .sort((a, b) => Date.parse(a.registeredAt) - Date.parse(b.registeredAt));

    if (waitlistCandidates.length > 0) {
      const first = waitlistCandidates[0];
      promotedUserId = first.userId;
      nextList = nextList.map((r) =>
        r.eventId === event.id && r.userId === first.userId
          ? { ...r, status: 'registered' as const, updatedAt: nowIso }
          : r,
      );
    }
  }

  return { ok: true, data: { registrations: nextList, promotedUserId } };
}

/**
 * S5.13 — Mise à jour des groupes d'allure et des clubs co-organisateurs (admin/modérateur/créateur).
 */
export function updateEventOrganization(params: {
  event: ClubEvent;
  actorMember: ClubMember | undefined;
  paceGroups?: readonly PaceGroup[];
  coHostClubIds?: readonly string[];
}): ClubResult<ClubEvent> {
  const { event, actorMember } = params;
  if (!actorMember || !isActiveMember(actorMember) || actorMember.clubId !== event.clubId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Acteur non membre actif du club.' };
  }
  const canManage =
    actorMember.role === 'admin' ||
    actorMember.role === 'moderator' ||
    actorMember.userId === event.createdBy;
  if (!canManage) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Permissions insuffisantes pour modifier l’organisation de la sortie.',
    };
  }

  const nextCoHosts = params.coHostClubIds
    ? Array.from(new Set(params.coHostClubIds.filter((id) => id && id !== event.clubId)))
    : event.coHostClubIds;

  return {
    ok: true,
    data: {
      ...event,
      paceGroups: params.paceGroups ?? event.paceGroups,
      coHostClubIds: nextCoHosts,
    },
  };
}

/**
 * S5.13 — Génération d'un flyer/affiche partageable pour une sortie de club.
 */
export function buildEventFlyer(params: {
  event: ClubEvent;
  hostClub: Club;
  coHostClubs?: readonly Club[];
  shareUrl: string;
}): ClubResult<EventFlyer> {
  if (!isValidHttpUrl(params.shareUrl)) {
    return { ok: false, error: 'INVALID_INPUT', message: 'URL de partage invalide.' };
  }
  const coHostClubNames = (params.coHostClubs ?? [])
    .filter((c) => params.event.coHostClubIds.includes(c.id))
    .map((c) => c.name);

  return {
    ok: true,
    data: {
      title: params.event.title,
      subtitle: params.hostClub.name,
      dateLabel: params.event.startsAt,
      locationLabel: params.event.locationLabel,
      sport: params.event.sport,
      coHostClubNames,
      shareUrl: params.shareUrl,
      qrPayload: `lkdv://event/${params.event.id}?url=${encodeURIComponent(params.shareUrl)}`,
    },
  };
}

/**
 * S5.15 & S5.16 — Recherche d'événements et de courses (lieu, sport, date, format).
 * Fail-closed : les événements de clubs secrets/privés non autorisés ou d'organisateurs bloqués S6.19
 * ne fuitent jamais dans les résultats.
 */
export function searchClubEvents(params: {
  events: readonly ClubEvent[];
  clubsById: ReadonlyMap<string, Club> | Record<string, Club>;
  memberships: readonly ClubMember[];
  viewerContext: ViewerPrivacyContext;
  query: EventSearchQuery;
}): ClubEvent[] {
  const { events, clubsById, memberships, viewerContext, query } = params;
  const getClub = (id: string): Club | undefined =>
    clubsById instanceof Map
      ? clubsById.get(id)
      : (clubsById as Record<string, Club>)[id];

  const textNeedle = query.text?.trim().toLowerCase() ?? '';
  const locationNeedle = query.location?.trim().toLowerCase() ?? '';
  const sportNeedle = query.sport?.trim().toLowerCase() ?? '';
  const fromMs = query.fromIso ? Date.parse(query.fromIso) : null;
  const toMs = query.toIso ? Date.parse(query.toIso) : null;

  return events
    .filter((ev) => {
      const club = getClub(ev.clubId);
      if (!canViewClubEvent(ev, club, viewerContext, memberships)) {
        return false;
      }
      if (query.racesOnly && ev.format !== 'race') {
        return false;
      }
      if (query.format && ev.format !== query.format) {
        return false;
      }
      if (sportNeedle && ev.sport.toLowerCase() !== sportNeedle) {
        return false;
      }
      if (locationNeedle && !ev.locationLabel.toLowerCase().includes(locationNeedle)) {
        return false;
      }
      if (textNeedle) {
        const hay = `${ev.title} ${ev.description ?? ''} ${ev.locationLabel}`.toLowerCase();
        if (!hay.includes(textNeedle)) return false;
      }
      const evStartMs = Date.parse(ev.startsAt);
      if (fromMs !== null && Number.isFinite(fromMs) && evStartMs < fromMs) {
        return false;
      }
      if (toMs !== null && Number.isFinite(toMs) && evStartMs > toMs) {
        return false;
      }
      return true;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/**
 * S5.16 — Extraction sécurisée du lien d'inscription d'une course (aucun schéma non HTTP(S)).
 */
export function getValidatedRaceRegistrationUrl(event: ClubEvent): string | null {
  if (event.format !== 'race') return null;
  return isValidHttpUrl(event.registrationUrl) ? event.registrationUrl : null;
}

/**
 * S5.14 — Statistiques de présence réelle réservées à l'organisateur / admin / modérateur.
 * Ne comptabilise que les activités rattachées avec consentement explicite (`consentGranted === true`).
 */
export function computeEventAttendanceStats(params: {
  event: ClubEvent;
  actorMember: ClubMember | undefined;
  registrations: readonly EventRegistration[];
  attendanceRecords: readonly EventAttendanceRecord[];
}): ClubResult<EventAttendanceStats> {
  const { event, actorMember, registrations, attendanceRecords } = params;
  if (!actorMember || !isActiveMember(actorMember) || actorMember.clubId !== event.clubId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Acteur non membre actif du club.' };
  }
  const isOrganizer =
    actorMember.role === 'admin' ||
    actorMember.role === 'moderator' ||
    actorMember.userId === event.createdBy;
  if (!isOrganizer) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Statistiques réservées aux organisateurs et administrateurs du club.',
    };
  }

  const eventRegs = registrations.filter((r) => r.eventId === event.id);
  const registeredCount = eventRegs.filter((r) => r.status === 'registered').length;
  const waitlistCount = eventRegs.filter((r) => r.status === 'waitlist').length;

  const consented = attendanceRecords.filter(
    (rec) => rec.eventId === event.id && rec.consentGranted === true,
  );
  const uniqueAttendees = new Set(consented.map((c) => c.userId));
  const confirmedAttendeesCount = uniqueAttendees.size;
  const attendanceRate =
    registeredCount > 0 ? Math.min(1, confirmedAttendeesCount / registeredCount) : 0;

  return {
    ok: true,
    data: {
      eventId: event.id,
      registeredCount,
      waitlistCount,
      confirmedAttendeesCount,
      attendanceRate,
      consentedActivityIds: consented.map((c) => c.activityId),
    },
  };
}
