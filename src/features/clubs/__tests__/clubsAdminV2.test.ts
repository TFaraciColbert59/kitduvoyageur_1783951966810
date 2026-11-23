import { describe, expect, it } from 'vitest';
import {
  canDelegateCapability,
  canManageTargetRole,
  canViewClubChannel,
  changeMemberRole,
  CLUB_DEFAULT_ROLE_CAPABILITIES,
  CLUB_ROLE_RANK,
  computeEventAttendanceStats,
  createClubAnnouncement,
  createClubChallenge,
  createClubChannel,
  listChannelMessagesForViewer,
  muteClubMember,
  postChannelMessage,
  removeOrBanClubMember,
  resolveClubCapabilities,
  reviewJoinRequest,
  updateEventOrganization,
  type ClubChannel,
  type ClubEvent,
  type ClubMember,
} from '../index';

function mkMember(overrides: Partial<ClubMember> = {}): ClubMember {
  return {
    clubId: 'c-1',
    userId: 'u-1',
    displayName: 'Membre',
    avatarUrl: null,
    role: 'member',
    status: 'active',
    joinedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Club Admin V2 — 5 rôles, rang strict & anti-escalade', () => {
  it('ordonne strictement les 5 rôles canoniques', () => {
    expect(CLUB_ROLE_RANK.founder).toBe(5);
    expect(CLUB_ROLE_RANK.admin).toBe(4);
    expect(CLUB_ROLE_RANK.moderator).toBe(3);
    expect(CLUB_ROLE_RANK.volunteer).toBe(2);
    expect(CLUB_ROLE_RANK.member).toBe(1);
  });

  it('applique la hiérarchie stricte sur canManageTargetRole', () => {
    expect(canManageTargetRole('founder', 'admin', 'moderator')).toBe(true);
    expect(canManageTargetRole('founder', 'volunteer', 'admin')).toBe(true);
    expect(canManageTargetRole('admin', 'admin', 'moderator')).toBe(false);
    expect(canManageTargetRole('admin', 'founder', 'member')).toBe(false);
    expect(canManageTargetRole('admin', 'member', 'admin')).toBe(false);
    expect(canManageTargetRole('admin', 'member', 'volunteer')).toBe(true);
    expect(canManageTargetRole('admin', 'volunteer', 'moderator')).toBe(true);
    expect(canManageTargetRole('moderator', 'volunteer', 'member')).toBe(true);
    expect(canManageTargetRole('moderator', 'moderator', 'member')).toBe(false);
    expect(canManageTargetRole('volunteer', 'member', 'member')).toBe(true);
    expect(canManageTargetRole('member', 'member')).toBe(false);
  });

  it('bloque toute escalade de capacité sur canDelegateCapability', () => {
    const adminCaps = CLUB_DEFAULT_ROLE_CAPABILITIES.admin;

    // Le Fondateur peut déléguer toute capacité sauf souveraineté
    expect(
      canDelegateCapability({
        actorRole: 'founder',
        actorCapabilities: [],
        targetRole: 'admin',
        capability: 'members.manage_roles',
      }),
    ).toBe(true);
    expect(
      canDelegateCapability({
        actorRole: 'founder',
        actorCapabilities: [],
        targetRole: 'admin',
        capability: 'club.delete',
      }),
    ).toBe(false);

    // Un Admin ne peut pas toucher un autre Admin ni le Fondateur
    expect(
      canDelegateCapability({
        actorRole: 'admin',
        actorCapabilities: adminCaps,
        targetRole: 'admin',
        capability: 'budget.view',
      }),
    ).toBe(false);

    // Un Admin peut déléguer une capacité qu'il détient à un Bénévole
    expect(
      canDelegateCapability({
        actorRole: 'admin',
        actorCapabilities: adminCaps,
        targetRole: 'volunteer',
        capability: 'events.create_official',
      }),
    ).toBe(true);

    // Un Admin sans la capacité concernée ne peut pas la déléguer (anti-escalade)
    const restrictedAdminCaps = adminCaps.filter((c) => c !== 'budget.approve_and_manage');
    expect(
      canDelegateCapability({
        actorRole: 'admin',
        actorCapabilities: restrictedAdminCaps,
        targetRole: 'volunteer',
        capability: 'budget.approve_and_manage',
      }),
    ).toBe(false);

    // Un Admin sans permissions.delegate ne peut rien déléguer
    const noDelegateCaps = adminCaps.filter((c) => c !== 'permissions.delegate');
    expect(
      canDelegateCapability({
        actorRole: 'admin',
        actorCapabilities: noDelegateCaps,
        targetRole: 'volunteer',
        capability: 'budget.view',
      }),
    ).toBe(false);
  });

  it('résout les capacités sur 3 niveaux : override > rolePolicy > default', () => {
    // Défaut Bénévole : terrain actif, events.create_official inactif
    const defaultVol = resolveClubCapabilities({ role: 'volunteer' });
    expect(defaultVol).toContain('volunteers.manage_shifts');
    expect(defaultVol).toContain('budget.propose_expense');
    expect(defaultVol).not.toContain('budget.approve_and_manage');
    expect(defaultVol).not.toContain('events.create_official');

    // Niveau 2 : policy club active events.create_official pour tous les Bénévoles
    const policyVol = resolveClubCapabilities({
      role: 'volunteer',
      rolePolicies: [
        { role: 'volunteer', capability: 'events.create_official', allowed: true },
        { role: 'volunteer', capability: 'budget.view', allowed: false },
      ],
    });
    expect(policyVol).toContain('events.create_official');
    expect(policyVol).not.toContain('budget.view');

    // Niveau 3 : surcharge individuelle prime sur la policy club
    const overriddenVol = resolveClubCapabilities({
      role: 'volunteer',
      rolePolicies: [
        { role: 'volunteer', capability: 'events.create_official', allowed: true },
      ],
      memberOverrides: [
        { capability: 'events.create_official', allowed: false },
        { capability: 'challenges.manage', allowed: true },
      ],
    });
    expect(overriddenVol).not.toContain('events.create_official');
    expect(overriddenVol).toContain('challenges.manage');

    // Le Fondateur a toujours 100 % des capacités même si on tente un override false
    const founderCaps = resolveClubCapabilities({
      role: 'founder',
      memberOverrides: [{ capability: 'club.delete', allowed: false }],
    });
    expect(founderCaps).toContain('club.delete');
    expect(founderCaps).toContain('club.transfer_ownership');
  });

  it('protège le fondateur et autorise la promotion vers volunteer', () => {
    const founder = mkMember({ userId: 'u-f', role: 'founder' });
    const admin = mkMember({ userId: 'u-a', role: 'admin' });
    const mem = mkMember({ userId: 'u-m', role: 'member' });

    const promoteVol = changeMemberRole({
      clubId: 'c-1',
      actorUserId: 'u-a',
      targetUserId: 'u-m',
      newRole: 'volunteer',
      memberships: [founder, admin, mem],
    });
    expect(promoteVol.ok).toBe(true);

    const banFounder = removeOrBanClubMember({
      clubId: 'c-1',
      actorUserId: 'u-a',
      targetUserId: 'u-f',
      mode: 'ban',
      memberships: [founder, admin, mem],
    });
    expect(banFounder.ok).toBe(false);

    const founderLeaves = removeOrBanClubMember({
      clubId: 'c-1',
      actorUserId: 'u-f',
      targetUserId: 'u-f',
      mode: 'leave',
      memberships: [founder, admin, mem],
    });
    expect(founderLeaves.ok).toBe(false);

    // Un bénévole ne peut pas bannir ni expulser un membre
    const volunteer = mkMember({ userId: 'u-v', role: 'volunteer' });
    const volunteerBansMember = removeOrBanClubMember({
      clubId: 'c-1',
      actorUserId: 'u-v',
      targetUserId: 'u-m',
      mode: 'ban',
      memberships: [founder, admin, volunteer, mem],
    });
    expect(volunteerBansMember.ok).toBe(false);
  });
});

describe('Club Admin V2 — Salons min_role & correctifs founder', () => {
  it('filtre les salons restreints par rôle et archivés', () => {
    const bureauChannel: ClubChannel = {
      id: 'ch-bureau',
      clubId: 'c-1',
      name: 'bureau-admin',
      kind: 'custom',
      minRole: 'admin',
      readOnlyForMembers: false,
      notificationsEnabledByDefault: true,
      createdBy: 'u-f',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const founder = mkMember({ userId: 'u-f', role: 'founder' });
    const admin = mkMember({ userId: 'u-a', role: 'admin' });
    const volunteer = mkMember({ userId: 'u-v', role: 'volunteer' });
    const member = mkMember({ userId: 'u-m', role: 'member' });

    expect(canViewClubChannel(bureauChannel, founder)).toBe(true);
    expect(canViewClubChannel(bureauChannel, admin)).toBe(true);
    expect(canViewClubChannel(bureauChannel, volunteer)).toBe(false);
    expect(canViewClubChannel(bureauChannel, member)).toBe(false);

    const postAsMember = postChannelMessage({
      id: 'msg-1',
      channel: bureauChannel,
      actorMember: member,
      body: 'Intrusion',
      nowIso: '2026-01-02T00:00:00.000Z',
    });
    expect(postAsMember.ok).toBe(false);

    const listAsVolunteer = listChannelMessagesForViewer({
      channel: bureauChannel,
      messages: [],
      viewerContext: { viewerId: 'u-v' },
      memberships: [founder, admin, volunteer, member],
    });
    expect(listAsVolunteer.ok).toBe(false);
  });

  it('autorise le fondateur partout (demandes, annonces, salons, défis, sorties, mute)', () => {
    const founder = mkMember({ userId: 'u-f', role: 'founder' });
    const volunteer = mkMember({ userId: 'u-v', role: 'volunteer' });
    const now = '2026-06-01T10:00:00.000Z';

    expect(
      reviewJoinRequest({
        request: {
          id: 'req-1',
          clubId: 'c-1',
          userId: 'u-new',
          displayName: 'Bob',
          message: null,
          answers: [],
          status: 'pending',
          createdAt: now,
        },
        actorMember: founder,
        approve: true,
        nowIso: now,
      }).ok,
    ).toBe(true);

    expect(
      createClubAnnouncement({
        id: 'ann-1',
        clubId: 'c-1',
        actorMember: founder,
        title: 'AG annuelle',
        body: 'Samedi 18h',
        nowIso: now,
      }).ok,
    ).toBe(true);

    expect(
      createClubChannel({
        id: 'ch-1',
        clubId: 'c-1',
        name: 'orga-marathon',
        kind: 'custom',
        minRole: 'volunteer',
        actorMember: founder,
        nowIso: now,
      }).ok,
    ).toBe(true);

    expect(
      createClubChallenge({
        id: 'chal-1',
        clubId: 'c-1',
        scope: 'club',
        title: '1000 km',
        description: 'Collectif',
        sport: null,
        metric: 'distance_m',
        targetValue: 1000000,
        startsAt: '2026-06-01T00:00:00.000Z',
        endsAt: '2026-07-01T00:00:00.000Z',
        badgeTitle: '1000 km',
        badgeIcon: '🏔️',
        actorUserId: 'u-f',
        memberships: [founder],
      }).ok,
    ).toBe(true);

    const ev: ClubEvent = {
      id: 'ev-1',
      clubId: 'c-1',
      coHostClubIds: [],
      title: 'Marathon Alpin',
      description: null,
      sport: 'trail',
      format: 'race',
      startsAt: now,
      endsAt: null,
      locationLabel: 'Chamonix',
      meetingPoint: null,
      visibility: 'public',
      maxParticipants: 300,
      waitlistEnabled: true,
      paceGroups: [],
      registrationUrl: null,
      routeId: null,
      routeRevision: 0,
      createdBy: 'u-other',
      createdAt: now,
    };

    expect(
      updateEventOrganization({ event: ev, actorMember: founder, paceGroups: [] }).ok,
    ).toBe(true);

    expect(
      computeEventAttendanceStats({
        event: ev,
        actorMember: volunteer,
        registrations: [],
        attendanceRecords: [],
      }).ok,
    ).toBe(true);

    expect(
      muteClubMember({
        clubId: 'c-1',
        actorMember: founder,
        targetMember: volunteer,
        mutedUntilIso: '2026-06-02T10:00:00.000Z',
      }).ok,
    ).toBe(true);

    expect(
      muteClubMember({
        clubId: 'c-1',
        actorMember: volunteer,
        targetMember: founder,
        mutedUntilIso: '2026-06-02T10:00:00.000Z',
      }).ok,
    ).toBe(false);

    // Délégation par capacité (ex. bénévole autorisé à poster dans annonces, ou salons.post révoqué)
    const openChannel: ClubChannel = {
      id: 'ch-open',
      clubId: 'c-1',
      name: 'general',
      kind: 'general',
      minRole: 'member',
      readOnlyForMembers: false,
      notificationsEnabledByDefault: true,
      createdBy: 'u-f',
      createdAt: now,
    };
    const announceChannel: ClubChannel = {
      ...openChannel,
      id: 'ch-ann',
      name: 'annonces',
      kind: 'announcements',
      readOnlyForMembers: true,
    };
    expect(
      postChannelMessage({
        id: 'm-revoked',
        channel: openChannel,
        actorMember: volunteer,
        body: 'Bloqué',
        nowIso: now,
        canPostOverride: false,
        canPostAnnouncementsOverride: false,
      }).ok,
    ).toBe(false);
    expect(
      postChannelMessage({
        id: 'm-delegated-ann',
        channel: announceChannel,
        actorMember: volunteer,
        body: 'Annonce marathon',
        nowIso: now,
        canPostAnnouncementsOverride: true,
      }).ok,
    ).toBe(true);
  });
});
