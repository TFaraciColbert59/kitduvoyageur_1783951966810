import type {
  Club,
  ClubChallenge,
  ClubChallengeSummary,
  ClubChannel,
  ClubChannelMessage,
  ClubEvent,
  ClubJoinRequest,
  ClubMember,
  EventRegistration,
  InviteLink,
  WeeklyClubLeaderboard,
} from '@/features/clubs';

export const NOW = '2026-11-13T10:00:00.000Z';

export function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'trail-alpes',
    name: 'Trail Alpes',
    description: 'Sorties trail et montagne',
    primarySport: 'trail',
    sports: ['trail', 'running'],
    privacy: 'open',
    zoneLabel: 'Grenoble',
    coverImage: null,
    rules: 'Respect des sentiers.',
    joinQuestions: [],
    verification: {
      status: 'verified',
      verifiedAt: '2026-01-01T00:00:00.000Z',
      badgeLabel: 'Club officiel',
      eligibleSports: ['trail'],
    },
    createdBy: '22222222-2222-4222-8222-222222222222',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeMember(overrides: Partial<ClubMember> = {}): ClubMember {
  return {
    clubId: '11111111-1111-4111-8111-111111111111',
    userId: '33333333-3333-4333-8333-333333333333',
    displayName: 'Alice Martin',
    avatarUrl: null,
    role: 'member',
    status: 'active',
    joinedAt: '2026-02-01T00:00:00.000Z',
    leaderboardOptIn: true,
    ...overrides,
  };
}

export function makeEvent(overrides: Partial<ClubEvent> = {}): ClubEvent {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    clubId: '11111111-1111-4111-8111-111111111111',
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
    paceGroups: [{ id: '55555555-5555-4555-8555-555555555555', label: 'Allure modérée', targetPaceLabel: '6:00/km' }],
    registrationUrl: null,
    routeId: 'route-1',
    routeRevision: 1,
    createdBy: '22222222-2222-4222-8222-222222222222',
    createdAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeRegistration(overrides: Partial<EventRegistration> = {}): EventRegistration {
  return {
    eventId: '44444444-4444-4444-8444-444444444444',
    userId: '33333333-3333-4333-8333-333333333333',
    status: 'registered',
    paceGroupId: null,
    registeredAt: '2026-11-02T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    ...overrides,
  };
}

export function makeChannel(overrides: Partial<ClubChannel> = {}): ClubChannel {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    clubId: '11111111-1111-4111-8111-111111111111',
    name: 'général',
    kind: 'general',
    readOnlyForMembers: false,
    notificationsEnabledByDefault: true,
    createdBy: '22222222-2222-4222-8222-222222222222',
    createdAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

export function makeMessage(overrides: Partial<ClubChannelMessage> = {}): ClubChannelMessage {
  return {
    id: '77777777-7777-4777-8777-777777777777',
    channelId: '66666666-6666-4666-8666-666666666666',
    clubId: '11111111-1111-4111-8111-111111111111',
    authorId: '33333333-3333-4333-8333-333333333333',
    body: 'Boucle confirmée pour dimanche.',
    createdAt: '2026-11-10T09:00:00.000Z',
    editedAt: null,
    hiddenByModeratorId: null,
    hiddenReason: null,
    deletedAt: null,
    ...overrides,
  };
}

export function makeChallenge(overrides: Partial<ClubChallenge> = {}): ClubChallenge {
  return {
    id: '88888888-8888-4888-8888-888888888888',
    clubId: '11111111-1111-4111-8111-111111111111',
    scope: 'club',
    title: '100 km de novembre',
    description: 'Cumuler 100 km en trail.',
    sport: 'trail',
    metric: 'distance_m',
    targetValue: 100_000,
    startsAt: '2026-11-01T00:00:00.000Z',
    endsAt: '2026-11-30T23:59:59.000Z',
    badgeTitle: 'Centurion',
    badgeIcon: '🏅',
    createdBy: '22222222-2222-4222-8222-222222222222',
    ...overrides,
  };
}

export function makeSummary(overrides: Partial<ClubChallengeSummary> = {}): ClubChallengeSummary {
  const challenge = overrides.challenge ?? makeChallenge();
  return {
    challenge,
    totalProgressValue: 42_000,
    progressPct: 42,
    isCompleted: false,
    completedAt: null,
    participantsCount: 4,
    badgeAwarded: null,
    ...overrides,
  };
}

export function makeJoinRequest(overrides: Partial<ClubJoinRequest> = {}): ClubJoinRequest {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    clubId: '11111111-1111-4111-8111-111111111111',
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    displayName: 'Bob Durand',
    message: 'Je cours en trail depuis 3 ans.',
    answers: ['Trail'],
    status: 'pending',
    createdAt: '2026-11-05T00:00:00.000Z',
    reviewedBy: null,
    reviewedAt: null,
    ...overrides,
  };
}

export function makeInvite(overrides: Partial<InviteLink> = {}): InviteLink {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    token: 'token-demo',
    kind: 'club',
    targetId: '11111111-1111-4111-8111-111111111111',
    clubId: '11111111-1111-4111-8111-111111111111',
    createdBy: '22222222-2222-4222-8222-222222222222',
    createdAt: '2026-11-01T00:00:00.000Z',
    expiresAt: '2026-12-01T00:00:00.000Z',
    maxUses: 2,
    usesCount: 0,
    revokedAt: null,
    qrPayload: 'lkdv://invite/club/111?token=token-demo',
    shareUrl: 'https://lkdv.fr/invite/token-demo',
    ...overrides,
  };
}

export function makeLeaderboard(overrides: Partial<WeeklyClubLeaderboard> = {}): WeeklyClubLeaderboard {
  return {
    clubId: '11111111-1111-4111-8111-111111111111',
    sport: null,
    weekStartIso: '2026-11-09T00:00:00.000Z',
    weekEndIso: '2026-11-16T00:00:00.000Z',
    metric: 'distance_m',
    entries: [
      {
        rank: 1,
        userId: '33333333-3333-4333-8333-333333333333',
        displayName: 'Alice Martin',
        avatarUrl: null,
        totalDurationS: 12_600,
        totalDistanceM: 42_000,
        totalElevationGainM: 1_800,
        activitiesCount: 3,
        isCurrentUser: true,
      },
      {
        rank: 2,
        userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        displayName: 'Bob Durand',
        avatarUrl: null,
        totalDurationS: 9_000,
        totalDistanceM: 28_000,
        totalElevationGainM: 900,
        activitiesCount: 2,
        isCurrentUser: false,
      },
    ],
    excludedCount: 2,
    ...overrides,
  };
}
