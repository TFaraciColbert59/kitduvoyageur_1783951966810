import { describe, expect, it } from 'vitest';
import {
  buildEventFlyer,
  buildWeeklyClubLeaderboard,
  canAppearInPublicClubSearch,
  cancelEventRegistration,
  changeMemberRole,
  computeClubChallengeSummary,
  computeEventAttendanceStats,
  createClubAnnouncement,
  createClubChallenge,
  createClubChannel,
  createClubWithFounder,
  createInviteLink,
  detachActivityFromEvent,
  detectGroupActivities,
  evaluateClubVerificationBadge,
  evaluateProAthleteBadge,
  filterVisibleClubs,
  getValidatedRaceRegistrationUrl,
  inviteFriendToRecordedActivity,
  joinChallenge,
  listChannelMessagesForViewer,
  matchActivityToClubEvent,
  moderateChannelMessage,
  muteClubMember,
  normalizeClubPrivacy,
  postChannelMessage,
  publishEventRouteRevision,
  recordActivityInChallenge,
  redeemInviteLink,
  registerForClubEvent,
  removeOrBanClubMember,
  reportChannelMessage,
  requestOrJoinClub,
  reviewJoinRequest,
  revokeInviteLink,
  searchClubEvents,
  syncParticipantRouteRevision,
  updateEventOrganization,
  updateRecordedActivityInvite,
  type ActivityEventMatch,
  type Club,
  type ClubActivityInput,
  type ClubEvent,
  type ClubMember,
  type EventRegistration,
  type S619BlockRelation,
  type ViewerPrivacyContext,
} from '../index';

const NOW = '2026-11-13T10:00:00.000Z';

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'club-1',
    slug: 'trail-alpes',
    name: 'Trail Alpes',
    description: 'Sorties trail et montagne',
    primarySport: 'trail',
    sports: ['trail', 'running'],
    privacy: 'open',
    zoneLabel: 'Grenoble',
    coverImage: null,
    rules: null,
    joinQuestions: [],
    verification: {
      status: 'verified',
      verifiedAt: '2026-01-01T00:00:00.000Z',
      badgeLabel: 'Club officiel',
      eligibleSports: ['trail'],
    },
    createdBy: 'u-admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeMember(overrides: Partial<ClubMember> = {}): ClubMember {
  return {
    clubId: 'club-1',
    userId: 'u-member',
    displayName: 'Alice',
    avatarUrl: null,
    role: 'member',
    status: 'active',
    joinedAt: '2026-02-01T00:00:00.000Z',
    leaderboardOptIn: true,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<ClubEvent> = {}): ClubEvent {
  return {
    id: 'evt-1',
    clubId: 'club-1',
    coHostClubIds: [],
    title: 'Sortie Belledonne',
    description: 'Boucle matinale',
    sport: 'trail',
    format: 'trail_outing',
    startsAt: '2026-11-15T08:00:00.000Z',
    endsAt: '2026-11-15T11:00:00.000Z',
    locationLabel: 'Grenoble · Belledonne',
    meetingPoint: 'Parking Chamrousse',
    lat: 45.112,
    lng: 5.875,
    visibility: 'public',
    maxParticipants: 2,
    waitlistEnabled: true,
    paceGroups: [{ id: 'pg-1', label: 'Allure modérée', targetPaceLabel: '6:00/km' }],
    registrationUrl: null,
    routeId: 'route-1',
    routeRevision: 1,
    createdBy: 'u-admin',
    createdAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('G02 Clubs — Adhésion, rôles, confidentialité & invitations', () => {
  it('normalise les alias de visibilité en mode fail-closed', () => {
    expect(normalizeClubPrivacy('public')).toBe('open');
    expect(normalizeClubPrivacy('private')).toBe('closed');
    expect(normalizeClubPrivacy('invite_only')).toBe('secret');
    expect(normalizeClubPrivacy('unknown_value')).toBe('secret');
  });

  it('crée un club avec fondateur admin et gère open / closed / secret', () => {
    const created = createClubWithFounder({
      id: 'c-new',
      slug: 'cyclos-lyon',
      name: 'Cyclos Lyon',
      description: 'Club route',
      primarySport: 'cycling',
      privacy: 'invite_only',
      creatorUserId: 'u1',
      creatorDisplayName: 'Lucas',
      nowIso: NOW,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.club.privacy).toBe('secret');
    expect(created.data.founderMember.role).toBe('admin');

    // Un club secret refuse toute adhésion directe sans invitation
    const joinSecret = requestOrJoinClub({
      club: created.data.club,
      userId: 'u2',
      displayName: 'Bob',
      existingMemberships: [created.data.founderMember],
      requestId: 'req-1',
      nowIso: NOW,
    });
    expect(joinSecret.ok).toBe(false);
    if (!joinSecret.ok) expect(joinSecret.error).toBe('FORBIDDEN');

    // Un club closed crée une demande d'adhésion puis approbation par admin
    const closedClub = makeClub({ id: 'c-closed', privacy: 'closed' });
    const reqRes = requestOrJoinClub({
      club: closedClub,
      userId: 'u2',
      displayName: 'Bob',
      existingMemberships: [],
      requestId: 'req-2',
      nowIso: NOW,
    });
    expect(reqRes.ok).toBe(true);
    if (!reqRes.ok || !reqRes.data.joinRequest) return;
    expect(reqRes.data.joinRequest.status).toBe('pending');

    const admin = makeMember({ clubId: 'c-closed', userId: 'u-admin', role: 'admin' });
    const approved = reviewJoinRequest({
      request: reqRes.data.joinRequest,
      actorMember: admin,
      approve: true,
      nowIso: NOW,
    });
    expect(approved.ok).toBe(true);
    if (approved.ok) {
      expect(approved.data.newMember?.status).toBe('active');
    }
  });

  it('interdit strictement toute auto-promotion de rôle et protège le dernier admin', () => {
    const admin = makeMember({ userId: 'u-admin', role: 'admin' });
    const mod = makeMember({ userId: 'u-mod', role: 'moderator' });
    const member = makeMember({ userId: 'u-mem', role: 'member' });
    const memberships = [admin, mod, member];

    const selfPromoMember = changeMemberRole({
      clubId: 'club-1',
      actorUserId: 'u-mem',
      targetUserId: 'u-mem',
      newRole: 'admin',
      memberships,
    });
    expect(selfPromoMember.ok).toBe(false);
    if (!selfPromoMember.ok) expect(selfPromoMember.error).toBe('SELF_PROMOTION_FORBIDDEN');

    const selfPromoMod = changeMemberRole({
      clubId: 'club-1',
      actorUserId: 'u-mod',
      targetUserId: 'u-mod',
      newRole: 'admin',
      memberships,
    });
    expect(selfPromoMod.ok).toBe(false);
    if (!selfPromoMod.ok) expect(selfPromoMod.error).toBe('SELF_PROMOTION_FORBIDDEN');

    const modPromotesOther = changeMemberRole({
      clubId: 'club-1',
      actorUserId: 'u-mod',
      targetUserId: 'u-mem',
      newRole: 'admin',
      memberships,
    });
    expect(modPromotesOther.ok).toBe(false);
    if (!modPromotesOther.ok) expect(modPromotesOther.error).toBe('FORBIDDEN');

    const demoteLastAdmin = changeMemberRole({
      clubId: 'club-1',
      actorUserId: 'u-admin',
      targetUserId: 'u-admin',
      newRole: 'member',
      memberships,
    });
    expect(demoteLastAdmin.ok).toBe(false);
    if (!demoteLastAdmin.ok) expect(demoteLastAdmin.error).toBe('LAST_ADMIN_PROTECTED');

    const leaveLastAdmin = removeOrBanClubMember({
      clubId: 'club-1',
      actorUserId: 'u-admin',
      targetUserId: 'u-admin',
      mode: 'leave',
      memberships,
    });
    expect(leaveLastAdmin.ok).toBe(false);
    if (!leaveLastAdmin.ok) expect(leaveLastAdmin.error).toBe('LAST_ADMIN_PROTECTED');
  });

  it('ne fait jamais fuiter un club privé/secret ni un utilisateur bloqué S6.19 en recherche publique', () => {
    const openClub = makeClub({ id: 'c-open', privacy: 'open', createdBy: 'u-open' });
    const secretClub = makeClub({ id: 'c-secret', privacy: 'secret', createdBy: 'u-secret' });
    const blockedOpenClub = makeClub({ id: 'c-blocked', privacy: 'open', createdBy: 'u-blocked' });

    const blocks: S619BlockRelation[] = [
      { blockerId: 'u-viewer', blockedId: 'u-blocked', createdAt: NOW },
    ];
    const ctx: ViewerPrivacyContext = { viewerId: 'u-viewer', blocks };

    expect(canAppearInPublicClubSearch(secretClub, ctx, [])).toBe(false);
    expect(canAppearInPublicClubSearch(blockedOpenClub, ctx, [])).toBe(false);
    expect(canAppearInPublicClubSearch(openClub, ctx, [])).toBe(true);

    const visiblePublic = filterVisibleClubs([openClub, secretClub, blockedOpenClub], ctx, [], {
      publicSearchOnly: true,
    });
    expect(visiblePublic.map((c) => c.id)).toEqual(['c-open']);

    // Un membre actif du club secret le voit dans sa liste personnelle
    const secretMember = makeMember({ clubId: 'c-secret', userId: 'u-viewer' });
    const visiblePersonal = filterVisibleClubs([openClub, secretClub], ctx, [secretMember]);
    expect(visiblePersonal.map((c) => c.id)).toEqual(['c-open', 'c-secret']);
  });

  it('K5.22 & S5.19 — génère lien/QR, empêche double consommation, expiration, révocation et blocage', () => {
    const admin = makeMember({ userId: 'u-admin', role: 'admin' });
    const inviteRes = createInviteLink({
      id: 'inv-1',
      token: 'tok-abc',
      kind: 'event',
      targetId: 'evt-1',
      clubId: 'club-1',
      actorUserId: 'u-admin',
      memberships: [admin],
      baseUrl: 'https://lkdv.app',
      expiresAt: '2026-11-20T00:00:00.000Z',
      maxUses: 1,
      nowIso: NOW,
    });
    expect(inviteRes.ok).toBe(true);
    if (!inviteRes.ok) return;
    expect(inviteRes.data.qrPayload).toContain('lkdv://invite/event/evt-1');

    // Première consommation OK
    const first = redeemInviteLink({
      invite: inviteRes.data,
      redeemerUserId: 'u-guest-1',
      memberships: [admin],
      privacyContext: { viewerId: 'u-guest-1' },
      nowIso: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // Deuxième consommation sur invitation à usage unique refusée
    const second = redeemInviteLink({
      invite: first.data,
      redeemerUserId: 'u-guest-2',
      memberships: [admin],
      privacyContext: { viewerId: 'u-guest-2' },
      nowIso: NOW,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe('INVITE_EXHAUSTED');

    // Invitation expirée
    const expired = redeemInviteLink({
      invite: inviteRes.data,
      redeemerUserId: 'u-guest-2',
      memberships: [admin],
      privacyContext: { viewerId: 'u-guest-2' },
      nowIso: '2026-11-21T00:00:00.000Z',
    });
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.error).toBe('INVITE_EXPIRED');

    // Invitation révoquée
    const revoked = revokeInviteLink({
      invite: inviteRes.data,
      actorUserId: 'u-admin',
      memberships: [admin],
      nowIso: NOW,
    });
    expect(revoked.ok).toBe(true);
    if (revoked.ok) {
      const redeemRevoked = redeemInviteLink({
        invite: revoked.data,
        redeemerUserId: 'u-guest-2',
        memberships: [admin],
        privacyContext: { viewerId: 'u-guest-2' },
        nowIso: NOW,
      });
      expect(redeemRevoked.ok).toBe(false);
      if (!redeemRevoked.ok) expect(redeemRevoked.error).toBe('INVITE_REVOKED');
    }

    // S5.19 — Inviter un ami sur une activité enregistrée
    const actInv = inviteFriendToRecordedActivity({
      id: 'ainv-1',
      activityId: 'act-100',
      ownerUserId: 'u-admin',
      inviteeUserId: 'u-friend',
      privacyContext: { viewerId: 'u-admin' },
      existingInvites: [],
      nowIso: NOW,
    });
    expect(actInv.ok).toBe(true);
    if (actInv.ok) {
      const accepted = updateRecordedActivityInvite({
        invite: actInv.data,
        actorUserId: 'u-friend',
        action: 'accept',
        privacyContext: { viewerId: 'u-friend' },
        nowIso: NOW,
      });
      expect(accepted.ok).toBe(true);
      if (accepted.ok) expect(accepted.data.status).toBe('accepted');
    }
  });
});

describe('G02 Clubs — Salons S5.07, badges S5.10, événements K5.21/K5.23/S5.13..S5.16', () => {
  it('S5.07 & S5.10 — salons modérés, mute, signalement et badges vérifiés', () => {
    const admin = makeMember({ userId: 'u-admin', role: 'admin' });
    const member = makeMember({
      userId: 'u-mem',
      role: 'member',
      isProAthlete: true,
      verifiedSports: ['trail'],
    });
    const club = makeClub();

    expect(
      evaluateClubVerificationBadge({ club, sportContext: 'trail', isAuthorizedContext: true })
        .visible,
    ).toBe(true);
    expect(
      evaluateClubVerificationBadge({ club, sportContext: 'cycling', isAuthorizedContext: true })
        .visible,
    ).toBe(false);
    expect(
      evaluateProAthleteBadge({
        member,
        sportContext: 'trail',
        viewerContext: { viewerId: 'u-admin' },
      }).visible,
    ).toBe(true);

    const ann = createClubAnnouncement({
      id: 'ann-1',
      clubId: 'club-1',
      actorMember: admin,
      title: 'Sortie dimanche',
      body: 'RDV 8h',
      nowIso: NOW,
    });
    expect(ann.ok).toBe(true);

    const ch = createClubChannel({
      id: 'ch-ann',
      clubId: 'club-1',
      name: 'Annonces',
      kind: 'announcements',
      actorMember: admin,
      nowIso: NOW,
    });
    expect(ch.ok).toBe(true);
    if (!ch.ok) return;

    // Membre ne peut pas poster dans un salon annonces en lecture seule
    const deniedPost = postChannelMessage({
      id: 'msg-1',
      channel: ch.data,
      actorMember: member,
      body: 'Bonjour',
      nowIso: NOW,
    });
    expect(deniedPost.ok).toBe(false);

    const genCh = createClubChannel({
      id: 'ch-gen',
      clubId: 'club-1',
      name: 'Général',
      kind: 'general',
      actorMember: admin,
      nowIso: NOW,
    });
    expect(genCh.ok).toBe(true);
    if (!genCh.ok) return;

    const msgRes = postChannelMessage({
      id: 'msg-2',
      channel: genCh.data,
      actorMember: member,
      body: 'Qui roule ?',
      nowIso: NOW,
    });
    expect(msgRes.ok).toBe(true);
    if (!msgRes.ok) return;

    const rep = reportChannelMessage({
      id: 'rep-1',
      message: msgRes.data,
      reporterMember: admin,
      reason: 'Hors sujet',
      nowIso: NOW,
    });
    expect(rep.ok).toBe(true);

    const hidden = moderateChannelMessage({
      message: msgRes.data,
      actorMember: admin,
      action: 'hide',
      nowIso: NOW,
    });
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;

    const visibleMsgs = listChannelMessagesForViewer({
      channel: genCh.data,
      messages: [hidden.data],
      viewerContext: { viewerId: 'u-mem' },
      memberships: [admin, member],
    });
    expect(visibleMsgs.ok).toBe(true);
    if (visibleMsgs.ok) expect(visibleMsgs.data).toHaveLength(0);

    const muted = muteClubMember({
      clubId: 'club-1',
      actorMember: admin,
      targetMember: member,
      mutedUntilIso: '2026-11-14T10:00:00.000Z',
    });
    expect(muted.ok).toBe(true);
    if (muted.ok) {
      const mutedPost = postChannelMessage({
        id: 'msg-3',
        channel: genCh.data,
        actorMember: muted.data,
        body: 'Test mute',
        nowIso: NOW,
      });
      expect(mutedPost.ok).toBe(false);
    }
  });

  it('K5.21 & K5.23 — places atomiques, liste d’attente, synchronisation de tracé et révocation', () => {
    const club = makeClub();
    const event = makeEvent({ maxParticipants: 1, waitlistEnabled: true });
    const m1 = makeMember({ userId: 'u1' });
    const m2 = makeMember({ userId: 'u2' });
    const admin = makeMember({ userId: 'u-admin', role: 'admin' });

    const r1 = registerForClubEvent({
      event,
      club,
      userId: 'u1',
      memberships: [admin, m1, m2],
      registrations: [],
      nowIso: NOW,
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.data.registration.status).toBe('registered');

    // Deuxième inscription pour la dernière place -> liste d'attente
    const r2 = registerForClubEvent({
      event,
      club,
      userId: 'u2',
      memberships: [admin, m1, m2],
      registrations: r1.data.registrations,
      nowIso: '2026-11-13T10:01:00.000Z',
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.data.registration.status).toBe('waitlist');

    // Publication d'une révision de tracé K5.23
    const rev = publishEventRouteRevision({
      event,
      actorMember: admin,
      routeId: 'route-1',
      checksum: 'sha256-v2',
      distanceM: 18500,
      elevationGainM: 950,
      requiresParticipantDecision: true,
      nowIso: NOW,
    });
    expect(rev.ok).toBe(true);
    if (!rev.ok) return;

    const syncU1 = syncParticipantRouteRevision({
      event: rev.data.event,
      club,
      snapshot: rev.data.snapshot,
      participantUserId: 'u1',
      currentSync: undefined,
      memberships: [admin, m1, m2],
      registrations: r2.data.registrations,
      nowIso: NOW,
    });
    expect(syncU1.ok).toBe(true);
    if (syncU1.ok) {
      expect(syncU1.data.lastSyncedRevision).toBe(2);
      expect(syncU1.data.decisionRequired).toBe(true);
    }

    // Désinscription de u1 -> u2 promu automatiquement et u1 perd l'accès aux révisions suivantes
    const cancel = cancelEventRegistration({
      event: rev.data.event,
      userId: 'u1',
      registrations: r2.data.registrations,
      nowIso: '2026-11-13T10:05:00.000Z',
    });
    expect(cancel.ok).toBe(true);
    if (!cancel.ok) return;
    expect(cancel.data.promotedUserId).toBe('u2');

    const syncU1AfterCancel = syncParticipantRouteRevision({
      event: rev.data.event,
      club,
      snapshot: rev.data.snapshot,
      participantUserId: 'u1',
      currentSync: syncU1.ok ? syncU1.data : undefined,
      memberships: [admin, m1, m2],
      registrations: cancel.data.registrations,
      nowIso: NOW,
    });
    expect(syncU1AfterCancel.ok).toBe(false);
    if (!syncU1AfterCancel.ok) expect(syncU1AfterCancel.error).toBe('FORBIDDEN');
  });

  it('S5.13..S5.16 — flyers, recherche fail-closed, lien course et stats organisateur', () => {
    const publicClub = makeClub({ id: 'c-pub', privacy: 'open' });
    const secretClub = makeClub({ id: 'c-sec', privacy: 'secret', name: 'Secret Club' });
    const admin = makeMember({ clubId: 'c-pub', userId: 'u-admin', role: 'admin' });
    const member = makeMember({ clubId: 'c-pub', userId: 'u-mem', role: 'member' });

    const raceEvent = makeEvent({
      id: 'evt-race',
      clubId: 'c-pub',
      title: 'Marathon du Mont-Blanc',
      format: 'race',
      sport: 'trail',
      locationLabel: 'Chamonix',
      registrationUrl: 'https://inscription.montblanc.example/register',
    });
    const secretEvent = makeEvent({
      id: 'evt-secret',
      clubId: 'c-sec',
      title: 'Sortie secrète Chamonix',
      format: 'race',
      sport: 'trail',
      locationLabel: 'Chamonix',
    });

    const orgUpdated = updateEventOrganization({
      event: raceEvent,
      actorMember: admin,
      coHostClubIds: ['c-partner'],
    });
    expect(orgUpdated.ok).toBe(true);

    const flyer = buildEventFlyer({
      event: orgUpdated.ok ? orgUpdated.data : raceEvent,
      hostClub: publicClub,
      shareUrl: 'https://lkdv.app/events/evt-race',
    });
    expect(flyer.ok).toBe(true);
    if (flyer.ok) expect(flyer.data.qrPayload).toContain('lkdv://event/evt-race');

    expect(getValidatedRaceRegistrationUrl(raceEvent)).toBe(
      'https://inscription.montblanc.example/register',
    );
    expect(
      getValidatedRaceRegistrationUrl({ ...raceEvent, registrationUrl: 'javascript:alert(1)' }),
    ).toBeNull();

    const found = searchClubEvents({
      events: [raceEvent, secretEvent],
      clubsById: { 'c-pub': publicClub, 'c-sec': secretClub },
      memberships: [admin, member],
      viewerContext: { viewerId: 'u-mem' },
      query: { location: 'chamonix', racesOnly: true },
    });
    expect(found.map((e) => e.id)).toEqual(['evt-race']);

    // Stats présence S5.14 : refusées à un simple membre, autorisées à l'admin, consentement requis
    const regs: EventRegistration[] = [
      {
        eventId: 'evt-race',
        userId: 'u-mem',
        status: 'registered',
        paceGroupId: null,
        registeredAt: NOW,
        updatedAt: NOW,
      },
    ];
    const deniedStats = computeEventAttendanceStats({
      event: raceEvent,
      actorMember: member,
      registrations: regs,
      attendanceRecords: [],
    });
    expect(deniedStats.ok).toBe(false);

    const okStats = computeEventAttendanceStats({
      event: raceEvent,
      actorMember: admin,
      registrations: regs,
      attendanceRecords: [
        {
          eventId: 'evt-race',
          userId: 'u-mem',
          activityId: 'a1',
          consentGranted: true,
          activityVisibility: 'club_only',
          matchedAt: NOW,
        },
        {
          eventId: 'evt-race',
          userId: 'u-other',
          activityId: 'a2',
          consentGranted: false,
          activityVisibility: 'private',
          matchedAt: NOW,
        },
      ],
    });
    expect(okStats.ok).toBe(true);
    if (okStats.ok) {
      expect(okStats.data.confirmedAttendeesCount).toBe(1);
      expect(okStats.data.consentedActivityIds).toEqual(['a1']);
    }
  });
});

describe('G02 Clubs — Appariement S5.17/S5.18, Défis & Classements P01/S6.19 (S5.11)', () => {
  it('S5.17 & S5.18 — appariement événement idempotent + retrait manuel + détection groupe P01/S6.19', () => {
    const event = makeEvent();
    const regs: EventRegistration[] = [
      {
        eventId: 'evt-1',
        userId: 'u1',
        status: 'registered',
        paceGroupId: null,
        registeredAt: NOW,
        updatedAt: NOW,
      },
    ];
    const act1: ClubActivityInput = {
      id: 'act-1',
      userId: 'u1',
      sport: 'trail',
      isIndoor: false,
      startsAt: '2026-11-15T08:10:00.000Z',
      endsAt: '2026-11-15T10:30:00.000Z',
      distanceM: 15000,
      durationS: 8400,
      elevationGainM: 800,
      startLat: 45.113,
      startLng: 5.876,
      visibility: 'public',
    };

    const m1 = matchActivityToClubEvent({
      matchId: 'm-1',
      activity: act1,
      event,
      registrations: regs,
      existingMatches: [],
      nowIso: NOW,
    });
    expect(m1.ok).toBe(true);
    if (!m1.ok) return;

    // Rejeu idempotent
    const replay = matchActivityToClubEvent({
      matchId: 'm-2',
      activity: act1,
      event,
      registrations: regs,
      existingMatches: [m1.data],
      nowIso: NOW,
    });
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.data.id).toBe('m-1');

    // Retrait manuel respecté lors d'un nouveau rejeu
    const detached = detachActivityFromEvent({
      match: m1.data,
      actorUserId: 'u1',
      nowIso: NOW,
    });
    expect(detached.ok).toBe(true);
    if (detached.ok) {
      const afterDetach = matchActivityToClubEvent({
        matchId: 'm-3',
        activity: act1,
        event,
        registrations: regs,
        existingMatches: [detached.data as ActivityEventMatch],
        nowIso: NOW,
      });
      expect(afterDetach.ok).toBe(false);
    }

    // S5.18 — Détection de groupe : u1 & u2 ensemble, u3 bloqué S6.19, u4 privé
    const act2: ClubActivityInput = { ...act1, id: 'act-2', userId: 'u2' };
    const act3Blocked: ClubActivityInput = { ...act1, id: 'act-3', userId: 'u3' };
    const act4Private: ClubActivityInput = {
      ...act1,
      id: 'act-4',
      userId: 'u4',
      visibility: 'private',
    };
    const blocks: S619BlockRelation[] = [
      { blockerId: 'u1', blockedId: 'u3', createdAt: NOW },
    ];

    const clusters = detectGroupActivities({
      activities: [act1, act2, act3Blocked, act4Private],
      blocks,
    });
    expect(clusters).toHaveLength(1);
    expect(clusters[0].participantUserIds).toEqual(['u1', 'u2']);
  });

  it('Défis individuels & de club — progression idempotente et attribution de badge', () => {
    const admin = makeMember({ userId: 'u-admin', role: 'admin' });
    const member = makeMember({ userId: 'u-mem', role: 'member' });

    const chRes = createClubChallenge({
      id: 'chal-1',
      clubId: 'club-1',
      scope: 'individual',
      title: '100 km en novembre',
      description: 'Cumuler 100 km',
      sport: 'trail',
      metric: 'distance_m',
      targetValue: 10_000,
      startsAt: '2026-11-01T00:00:00.000Z',
      endsAt: '2026-11-30T23:59:59.000Z',
      badgeTitle: 'Finisher 10k',
      badgeIcon: 'medal',
      actorUserId: 'u-admin',
      memberships: [admin, member],
    });
    expect(chRes.ok).toBe(true);
    if (!chRes.ok) return;

    const joined = joinChallenge({
      challenge: chRes.data,
      userId: 'u-mem',
      memberships: [admin, member],
      existingProgress: [],
    });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const act: ClubActivityInput = {
      id: 'act-c1',
      userId: 'u-mem',
      sport: 'trail',
      isIndoor: false,
      startsAt: '2026-11-10T09:00:00.000Z',
      endsAt: '2026-11-10T10:00:00.000Z',
      distanceM: 12_000,
      durationS: 3600,
      elevationGainM: 300,
      visibility: 'club_only',
    };

    const p1 = recordActivityInChallenge({
      challenge: chRes.data,
      participant: joined.data,
      activity: act,
      nowIso: NOW,
    });
    expect(p1.ok).toBe(true);
    if (!p1.ok) return;
    expect(p1.data.badge?.title).toBe('Finisher 10k');
    expect(p1.data.completedAt).toBe(NOW);

    // Rejeu idempotent de la même activité
    const p1Replay = recordActivityInChallenge({
      challenge: chRes.data,
      participant: p1.data,
      activity: act,
      nowIso: NOW,
    });
    expect(p1Replay.ok).toBe(true);
    if (p1Replay.ok) expect(p1Replay.data.currentValue).toBe(12_000);

    const summary = computeClubChallengeSummary({
      challenge: chRes.data,
      participants: [p1.data],
      nowIso: NOW,
    });
    expect(summary.isCompleted).toBe(true);
    expect(summary.progressPct).toBe(100);
  });

  it('S5.11 — classements hebdomadaires filtrés selon P01 et blocages S6.19', () => {
    const club = makeClub({ privacy: 'open' });
    const viewer = makeMember({ userId: 'u-viewer', displayName: 'Viewer' });
    const alice = makeMember({ userId: 'u-alice', displayName: 'Alice' });
    const bobBlocked = makeMember({ userId: 'u-bob', displayName: 'Bob' });
    const carolOptOut = makeMember({
      userId: 'u-carol',
      displayName: 'Carol',
      leaderboardOptIn: false,
    });
    const daveFriend = makeMember({ userId: 'u-dave', displayName: 'Dave' });

    const activities: ClubActivityInput[] = [
      {
        id: 'a-alice-pub',
        userId: 'u-alice',
        sport: 'trail',
        isIndoor: false,
        startsAt: '2026-11-11T09:00:00.000Z',
        endsAt: '2026-11-11T10:00:00.000Z',
        distanceM: 10_000,
        durationS: 3600,
        elevationGainM: 400,
        visibility: 'club_only',
      },
      {
        id: 'a-alice-priv',
        userId: 'u-alice',
        sport: 'trail',
        isIndoor: false,
        startsAt: '2026-11-12T09:00:00.000Z',
        endsAt: '2026-11-12T10:00:00.000Z',
        distanceM: 50_000,
        durationS: 18000,
        elevationGainM: 2000,
        visibility: 'private',
      },
      {
        id: 'a-bob',
        userId: 'u-bob',
        sport: 'trail',
        isIndoor: false,
        startsAt: '2026-11-11T09:00:00.000Z',
        endsAt: '2026-11-11T10:00:00.000Z',
        distanceM: 30_000,
        durationS: 9000,
        elevationGainM: 1200,
        visibility: 'public',
      },
      {
        id: 'a-carol',
        userId: 'u-carol',
        sport: 'trail',
        isIndoor: false,
        startsAt: '2026-11-11T09:00:00.000Z',
        endsAt: '2026-11-11T10:00:00.000Z',
        distanceM: 20_000,
        durationS: 7200,
        elevationGainM: 800,
        visibility: 'public',
      },
      {
        id: 'a-dave-friends',
        userId: 'u-dave',
        sport: 'trail',
        isIndoor: false,
        startsAt: '2026-11-11T09:00:00.000Z',
        endsAt: '2026-11-11T10:00:00.000Z',
        distanceM: 15_000,
        durationS: 5400,
        elevationGainM: 600,
        visibility: 'friends',
      },
    ];

    const lb = buildWeeklyClubLeaderboard({
      club,
      memberships: [viewer, alice, bobBlocked, carolOptOut, daveFriend],
      activities,
      viewerContext: {
        viewerId: 'u-viewer',
        friendIds: ['u-dave'],
        blocks: [{ blockerId: 'u-bob', blockedId: 'u-viewer', createdAt: NOW }],
      },
      weekStartIso: '2026-11-09T00:00:00.000Z',
      weekEndIso: '2026-11-16T00:00:00.000Z',
      sport: 'trail',
      metric: 'distance_m',
    });

    expect(lb.ok).toBe(true);
    if (!lb.ok) return;
    // Bob (bloqué S6.19) et Carol (opt-out) sont exclus ; l'activité privée d'Alice ne compte pas
    expect(lb.data.excludedCount).toBe(2);
    expect(lb.data.entries.map((e) => [e.userId, e.totalDistanceM])).toEqual([
      ['u-dave', 15_000],
      ['u-alice', 10_000],
    ]);

    // Un club secret refuse le classement à un non-membre
    const secretLb = buildWeeklyClubLeaderboard({
      club: makeClub({ id: 'c-sec', privacy: 'secret' }),
      memberships: [],
      activities,
      viewerContext: { viewerId: 'u-outsider' },
      weekStartIso: '2026-11-09T00:00:00.000Z',
      weekEndIso: '2026-11-16T00:00:00.000Z',
      sport: 'trail',
      metric: 'distance_m',
    });
    expect(secretLb.ok).toBe(false);
    if (!secretLb.ok) expect(secretLb.error).toBe('PRIVACY_RESTRICTED');
  });
});
