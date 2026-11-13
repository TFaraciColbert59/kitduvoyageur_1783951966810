import { describe, expect, it } from 'vitest';
import {
  buildSegmentLeaderboard,
  buildWithdrawalProjectionScenario,
  computeLocalLegends,
  createInitialLeaderboardDrawerState,
  getLeaderboardFilterCapabilities,
  LeaderboardProjectionStore,
  reduceLeaderboardDrawerState,
  sanitizeLeaderboardFilters,
  validateSegmentEffort,
  type AthletePrivacySnapshot,
  type LeaderboardViewerContext,
  type SegmentDefinition,
  type SegmentEffortInput,
} from '../index';

const NOW_ISO = '2026-11-13T12:00:00.000Z';

const CYCLING_SEGMENT: SegmentDefinition = {
  segmentId: 'seg-col-1',
  sport: 'cycling',
  distanceM: 2000,
  elevationGainM: 160,
};

const RUNNING_SEGMENT: SegmentDefinition = {
  segmentId: 'seg-run-1',
  sport: 'running',
  distanceM: 1000,
  elevationGainM: 25,
};

function makeAthlete(
  userId: string,
  overrides: Partial<AthletePrivacySnapshot> = {}
): AthletePrivacySnapshot {
  return {
    userId,
    displayName: `Athlète ${userId}`,
    avatarUrl: null,
    accountVisibility: 'public',
    leaderboardConsentGranted: true,
    isHiddenOrSuspended: false,
    clubIds: ['club-alpin'],
    friendIds: ['viewer-1'],
    ...overrides,
  };
}

function makeEffort(
  effortId: string,
  userId: string,
  elapsedTimeS: number,
  overrides: Partial<SegmentEffortInput> = {}
): SegmentEffortInput {
  return {
    effortId,
    activityId: `act-${effortId}`,
    segmentId: CYCLING_SEGMENT.segmentId,
    userId,
    sport: CYCLING_SEGMENT.sport,
    elapsedTimeS,
    movingTimeS: elapsedTimeS,
    completionRatio: 1,
    achievedAt: '2026-11-10T10:00:00.000Z',
    audience: 'public',
    athleteGender: 'men',
    athlete: makeAthlete(userId),
    ...overrides,
  };
}

const AUTH_VIEWER: LeaderboardViewerContext = {
  viewerId: 'viewer-1',
  isAuthenticated: true,
  friendIds: ['u-friend', 'u-1'],
  clubIds: ['club-alpin'],
  blockedUserIds: [],
  blockedByUserIds: [],
  mutedUserIds: [],
};

describe('S4.05 — Classements globaux, titres KOM/QOM/CR, égalités et pagination', () => {
  it('classe les meilleurs efforts valides par utilisateur et attribue KOM et QOM en cyclisme', () => {
    const efforts: SegmentEffortInput[] = [
      // Deux efforts pour u-1 : seul le plus rapide (240s) doit compter
      makeEffort('e-1a', 'u-1', 260, { athleteGender: 'men' }),
      makeEffort('e-1b', 'u-1', 240, { athleteGender: 'men' }),
      makeEffort('e-2', 'u-2', 250, { athleteGender: 'women' }),
      makeEffort('e-3', 'u-3', 280, { athleteGender: 'women' }),
    ];

    const res = buildSegmentLeaderboard(CYCLING_SEGMENT, efforts, { nowIso: NOW_ISO });

    expect(res.entries.map((e) => [e.rank, e.userId, e.elapsedTimeS, e.title])).toEqual([
      [1, 'u-1', 240, 'KOM'],
      [2, 'u-2', 250, 'QOM'],
      [3, 'u-3', 280, null],
    ]);
    expect(res.titles.kom?.userId).toBe('u-1');
    expect(res.titles.qom?.userId).toBe('u-2');
    expect(res.titles.cr).toBeNull();
  });

  it('attribue le titre CR sur un segment course à pied et gère les égalités stables (1, 1, 3)', () => {
    const efforts: SegmentEffortInput[] = [
      makeEffort('e-b', 'u-b', 200, {
        segmentId: RUNNING_SEGMENT.segmentId,
        sport: 'running',
        achievedAt: '2026-11-11T09:00:00.000Z',
      }),
      makeEffort('e-a', 'u-a', 200, {
        segmentId: RUNNING_SEGMENT.segmentId,
        sport: 'running',
        achievedAt: '2026-11-10T09:00:00.000Z',
      }),
      makeEffort('e-c', 'u-c', 215, {
        segmentId: RUNNING_SEGMENT.segmentId,
        sport: 'running',
      }),
    ];

    const res = buildSegmentLeaderboard(RUNNING_SEGMENT, efforts, { nowIso: NOW_ISO });

    expect(res.entries.map((e) => [e.rank, e.isTied, e.userId, e.title])).toEqual([
      [1, true, 'u-a', 'CR'],
      [1, true, 'u-b', 'CR'],
      [3, false, 'u-c', null],
    ]);
    expect(res.titles.cr?.userId).toBe('u-a');
  });

  it('pagine de manière stable sans doublon ni omission via cursor', () => {
    const efforts = ['u1', 'u2', 'u3', 'u4', 'u5'].map((uid, idx) =>
      makeEffort(`e-${idx + 1}`, uid, 200 + idx * 10)
    );

    const page1 = buildSegmentLeaderboard(CYCLING_SEGMENT, efforts, {
      nowIso: NOW_ISO,
      pagination: { limit: 2 },
    });
    expect(page1.entries.map((e) => e.userId)).toEqual(['u1', 'u2']);
    expect(page1.page.hasMore).toBe(true);
    expect(page1.page.nextCursor).toBe('offset:2');

    const page2 = buildSegmentLeaderboard(CYCLING_SEGMENT, efforts, {
      nowIso: NOW_ISO,
      pagination: { limit: 2, cursor: page1.page.nextCursor },
    });
    expect(page2.entries.map((e) => e.userId)).toEqual(['u3', 'u4']);
    expect(page2.page.hasMore).toBe(true);

    const page3 = buildSegmentLeaderboard(CYCLING_SEGMENT, efforts, {
      nowIso: NOW_ISO,
      pagination: { limit: 2, cursor: page2.page.nextCursor },
    });
    expect(page3.entries.map((e) => e.userId)).toEqual(['u5']);
    expect(page3.page.hasMore).toBe(false);
    expect(page3.page.nextCursor).toBeNull();
  });
});

describe('S4.06 — Filtres période/amis/club et suppression âge/poids du plan LKDV', () => {
  it('retire les sélecteurs âge et poids des capacités et des filtres nettoyés', () => {
    const caps = getLeaderboardFilterCapabilities();
    expect(caps.removedFilters).toEqual(['age', 'weight']);
    expect(caps.supportedFilters).toEqual(['period', 'scope', 'clubId', 'gender']);

    const sanitized = sanitizeLeaderboardFilters({
      period: 'this_month',
      scope: 'friends',
      ageGroup: '25-34',
      weightClass: '70-79kg',
    });
    expect(sanitized.strippedUnsupportedFilters).toEqual(['ageGroup', 'weightClass']);
    expect(sanitized.period).toBe('this_month');
    expect(sanitized.scope).toBe('friends');
  });

  it('filtre par période (today, this_week, this_month, this_year) sans fuite hors fenêtre', () => {
    const efforts: SegmentEffortInput[] = [
      makeEffort('e-today', 'u-1', 210, { achievedAt: '2026-11-13T08:00:00.000Z' }),
      makeEffort('e-week', 'u-2', 220, { achievedAt: '2026-11-10T08:00:00.000Z' }),
      makeEffort('e-month', 'u-3', 230, { achievedAt: '2026-11-01T08:00:00.000Z' }),
      makeEffort('e-year', 'u-4', 240, { achievedAt: '2026-03-15T08:00:00.000Z' }),
      makeEffort('e-old', 'u-5', 250, { achievedAt: '2025-12-20T08:00:00.000Z' }),
    ];

    const today = buildSegmentLeaderboard(CYCLING_SEGMENT, efforts, {
      nowIso: NOW_ISO,
      filters: { period: 'today' },
    });
    expect(today.entries.map((e) => e.userId)).toEqual(['u-1']);

    const week = buildSegmentLeaderboard(CYCLING_SEGMENT, efforts, {
      nowIso: NOW_ISO,
      filters: { period: 'this_week' },
    });
    expect(week.entries.map((e) => e.userId)).toEqual(['u-1', 'u-2']);

    const month = buildSegmentLeaderboard(CYCLING_SEGMENT, efforts, {
      nowIso: NOW_ISO,
      filters: { period: 'this_month' },
    });
    expect(month.entries.map((e) => e.userId)).toEqual(['u-1', 'u-2', 'u-3']);

    const year = buildSegmentLeaderboard(CYCLING_SEGMENT, efforts, {
      nowIso: NOW_ISO,
      filters: { period: 'this_year' },
    });
    expect(year.entries.map((e) => e.userId)).toEqual(['u-1', 'u-2', 'u-3', 'u-4']);
  });

  it('isole strictement les audiences amis et club en fail-closed', () => {
    const efforts: SegmentEffortInput[] = [
      makeEffort('e-friend', 'u-friend', 220, {
        audience: 'friends',
        athlete: makeAthlete('u-friend', { accountVisibility: 'followers_only', clubIds: [] }),
      }),
      makeEffort('e-club', 'u-club-only', 210, {
        audience: 'club',
        athlete: makeAthlete('u-club-only', { clubIds: ['club-alpin'] }),
      }),
      makeEffort('e-stranger', 'u-stranger', 200, {
        audience: 'public',
        athlete: makeAthlete('u-stranger', { clubIds: ['autre-club'], friendIds: [] }),
      }),
    ];

    // En global : ni friends-only ni club-only ne fuient
    const globalRes = buildSegmentLeaderboard(CYCLING_SEGMENT, efforts, {
      nowIso: NOW_ISO,
      viewer: AUTH_VIEWER,
      filters: { scope: 'global' },
    });
    expect(globalRes.entries.map((e) => e.userId)).toEqual(['u-stranger']);

    // En friends : seul u-friend apparaît
    const friendsRes = buildSegmentLeaderboard(CYCLING_SEGMENT, efforts, {
      nowIso: NOW_ISO,
      viewer: AUTH_VIEWER,
      filters: { scope: 'friends' },
    });
    expect(friendsRes.entries.map((e) => e.userId)).toEqual(['u-friend']);

    // En club : seul u-club-only apparaît (u-stranger est dans autre-club)
    const clubRes = buildSegmentLeaderboard(CYCLING_SEGMENT, efforts, {
      nowIso: NOW_ISO,
      viewer: AUTH_VIEWER,
      filters: { scope: 'club', clubId: 'club-alpin' },
    });
    expect(clubRes.entries.map((e) => e.userId)).toEqual(['u-club-only']);

    // Spectateur non authentifié sur friends/club => fail-closed vide
    const anonFriends = buildSegmentLeaderboard(CYCLING_SEGMENT, efforts, {
      nowIso: NOW_ISO,
      filters: { scope: 'friends' },
    });
    expect(anonFriends.entries).toEqual([]);
  });
});

describe('P01 / S6.19 — Confidentialité fail-closed, blocage, sourdine et anti-triche', () => {
  it('exclut en fail-closed les profils privés, sans consentement, bloqués, en sourdine ou sans snapshot', () => {
    const viewer: LeaderboardViewerContext = {
      ...AUTH_VIEWER,
      blockedUserIds: ['u-blocked-by-me'],
      blockedByUserIds: ['u-blocked-me'],
      mutedUserIds: ['u-muted'],
    };

    const efforts: SegmentEffortInput[] = [
      makeEffort('e-ok', 'u-ok', 220),
      makeEffort('e-no-snap', 'u-no-snap', 180, { athlete: undefined }),
      makeEffort('e-no-consent', 'u-no-consent', 185, {
        athlete: makeAthlete('u-no-consent', { leaderboardConsentGranted: false }),
      }),
      makeEffort('e-private-acc', 'u-private-acc', 190, {
        athlete: makeAthlete('u-private-acc', { accountVisibility: 'private' }),
      }),
      makeEffort('e-private-eff', 'u-private-eff', 195, { audience: 'private' }),
      makeEffort('e-blocked-1', 'u-blocked-by-me', 196),
      makeEffort('e-blocked-2', 'u-blocked-me', 197),
      makeEffort('e-muted', 'u-muted', 198),
      makeEffort('e-suspended', 'u-suspended', 199, {
        athlete: makeAthlete('u-suspended', { isHiddenOrSuspended: true }),
      }),
    ];

    const res = buildSegmentLeaderboard(CYCLING_SEGMENT, efforts, {
      nowIso: NOW_ISO,
      viewer,
      includeDiagnostics: true,
    });

    expect(res.entries.map((e) => e.userId)).toEqual(['u-ok']);
    expect(res.rejectedCount).toBe(8);
    expect(res.diagnostics?.map((d) => d.reason)).toEqual([
      'privacy_missing_snapshot',
      'privacy_unconsented',
      'privacy_private_account',
      'privacy_audience_denied',
      'privacy_blocked',
      'privacy_blocked',
      'privacy_muted',
      'privacy_hidden_or_suspended',
    ]);
  });

  it('rejette les efforts invalides et anomalies anti-triche de manière déterministe', () => {
    const cases: Array<[Partial<SegmentEffortInput>, string]> = [
      [{ elapsedTimeS: 0 }, 'invalid_elapsed_time'],
      [{ movingTimeS: 300, elapsedTimeS: 200 }, 'invalid_moving_time'],
      [{ completionRatio: 0.8 }, 'incomplete_passage'],
      [{ offRoute: true }, 'off_route'],
      [{ uturnDetected: true }, 'uturn_detected'],
      [{ hasGpsJump: true }, 'gps_jump'],
      [{ motorizedSuspected: true }, 'motorized_suspected'],
      [{ moderationStatus: 'flagged' }, 'moderation_excluded'],
      // 2000m en 30s = 240 km/h > 110 km/h
      [{ elapsedTimeS: 30, movingTimeS: 30 }, 'implausible_speed'],
    ];

    for (const [override, expectedReason] of cases) {
      const effort = makeEffort('e-bad', 'u-bad', 200, override);
      const check = validateSegmentEffort(effort, CYCLING_SEGMENT);
      expect(check.valid).toBe(false);
      expect(check.reason).toBe(expectedReason);
    }
  });
});

describe('S4.08 — Local Legends sur fenêtre glissante et scénarios avant/après retrait', () => {
  it('compte uniquement les passages valides et autorisés dans la fenêtre glissante de 90 jours', () => {
    const efforts: SegmentEffortInput[] = [
      // u-1 : 3 passages valides dans les 90 jours + 1 doublon même effortId + 1 hors fenêtre
      makeEffort('l-1', 'u-1', 250, { achievedAt: '2026-11-10T10:00:00.000Z' }),
      makeEffort('l-1', 'u-1', 250, { achievedAt: '2026-11-10T10:00:00.000Z' }),
      makeEffort('l-2', 'u-1', 255, { achievedAt: '2026-10-20T10:00:00.000Z' }),
      makeEffort('l-3', 'u-1', 260, { achievedAt: '2026-09-15T10:00:00.000Z' }),
      makeEffort('l-old', 'u-1', 240, { achievedAt: '2026-06-01T10:00:00.000Z' }),
      // u-2 : 2 passages valides + 1 passage privé + 1 passage triche (saut GPS)
      makeEffort('l-4', 'u-2', 230, { achievedAt: '2026-11-11T10:00:00.000Z' }),
      makeEffort('l-5', 'u-2', 235, { achievedAt: '2026-11-05T10:00:00.000Z' }),
      makeEffort('l-6-priv', 'u-2', 225, { audience: 'private' }),
      makeEffort('l-7-cheat', 'u-2', 220, { hasGpsJump: true }),
    ];

    const res = computeLocalLegends(CYCLING_SEGMENT, efforts, {
      nowIso: NOW_ISO,
      windowDays: 90,
      minEffortsForTitle: 3,
    });

    expect(res.shouldDisplayMention).toBe(true);
    expect(res.legend?.userId).toBe('u-1');
    expect(res.legend?.effortCount).toBe(3);
    expect(res.totalEligiblePassages).toBe(5);
    expect(res.rankings.map((r) => [r.rank, r.userId, r.effortCount, r.isLocalLegend])).toEqual([
      [1, 'u-1', 3, true],
      [2, 'u-2', 2, false],
    ]);
  });

  it('masque la mention Local Legend si aucun athlète n’atteint le seuil ou si le segment est dangereux', () => {
    const efforts = [makeEffort('l-1', 'u-1', 250)];
    const belowThreshold = computeLocalLegends(CYCLING_SEGMENT, efforts, {
      nowIso: NOW_ISO,
      minEffortsForTitle: 3,
    });
    expect(belowThreshold.shouldDisplayMention).toBe(false);
    expect(belowThreshold.legend).toBeNull();

    const hazardous = computeLocalLegends(
      { ...CYCLING_SEGMENT, isHazardous: true },
      [
        makeEffort('l-1', 'u-1', 250),
        makeEffort('l-2', 'u-1', 251),
        makeEffort('l-3', 'u-1', 252),
      ],
      { nowIso: NOW_ISO, minEffortsForTitle: 3 }
    );
    expect(hazardous.shouldDisplayMention).toBe(false);
  });

  it('recalcule classement, KOM et Local Legend après retrait/passage en privé et invalide le cache', () => {
    const efforts: SegmentEffortInput[] = [
      makeEffort('e-1', 'u-1', 210, { achievedAt: '2026-11-12T10:00:00.000Z' }),
      makeEffort('e-2', 'u-1', 220, { achievedAt: '2026-11-11T10:00:00.000Z' }),
      makeEffort('e-3', 'u-1', 230, { achievedAt: '2026-11-10T10:00:00.000Z' }),
      makeEffort('e-4', 'u-2', 225, { achievedAt: '2026-11-09T10:00:00.000Z' }),
    ];

    const scenario = buildWithdrawalProjectionScenario(
      CYCLING_SEGMENT,
      efforts,
      { userId: 'u-1' },
      { nowIso: NOW_ISO, minEffortsForTitle: 3 }
    );

    expect(scenario.before.titles.kom?.userId).toBe('u-1');
    expect(scenario.beforeLocalLegend.legend?.userId).toBe('u-1');

    expect(scenario.after.titles.kom?.userId).toBe('u-2');
    expect(scenario.after.entries.map((e) => e.userId)).toEqual(['u-2']);
    expect(scenario.afterLocalLegend.shouldDisplayMention).toBe(false);
    expect(scenario.afterLocalLegend.legend).toBeNull();

    // Vérification du magasin de projections et de l'invalidation à chaud
    const store = new LeaderboardProjectionStore();
    const key = 'seg-col-1:global:all_time';
    store.getOrComputeLeaderboard(key, CYCLING_SEGMENT, efforts, { nowIso: NOW_ISO });
    expect(store.getCacheVersion()).toBe(0);
    const removed = store.invalidateUser('u-1');
    expect(removed).toBe(1);
    expect(store.getCacheVersion()).toBe(1);
  });

  it('gère le sous-drawer Classement en restaurant le contexte parent à la fermeture', () => {
    let state = createInitialLeaderboardDrawerState(15);
    state = reduceLeaderboardDrawerState(state, {
      type: 'OPEN_LEADERBOARD_DRAWER',
      segmentId: 'seg-col-1',
      parentDrawerContext: 'segment-detail:seg-col-1',
      filters: { period: 'this_month', ageGroup: '30-39', weightClass: '80kg' },
    });

    expect(state.isOpen).toBe(true);
    expect(state.filters.strippedUnsupportedFilters).toEqual(['ageGroup', 'weightClass']);

    state = reduceLeaderboardDrawerState(state, { type: 'CLOSE_LEADERBOARD_DRAWER' });
    expect(state.isOpen).toBe(false);
    expect(state.parentDrawerContext).toBe('segment-detail:seg-col-1');
  });
});
