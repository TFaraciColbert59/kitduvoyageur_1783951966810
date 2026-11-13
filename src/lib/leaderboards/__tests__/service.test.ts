import { beforeEach, describe, expect, it } from 'vitest';
import type { AthletePrivacySnapshot, SegmentEffortInput } from '@/features/leaderboards';
import {
  LeaderboardAuthRequiredError,
  LeaderboardClubAccessError,
  LeaderboardSegmentNotFoundError,
  getSegmentLeaderboardView,
  getSegmentLocalLegendsView,
  listSegmentLeaderboardSummaries,
} from '../service';
import {
  resetLeaderboardsStore,
  saveLeaderboardViewerRelations,
  upsertAthletePrivacy,
  upsertLeaderboardClub,
  upsertLeaderboardEffort,
  upsertLeaderboardSegment,
} from '../store';
import type { LeaderboardSegmentView } from '../types';

const NOW_ISO = '2026-11-13T12:00:00.000Z';

const CYCLING_SEGMENT: LeaderboardSegmentView = {
  segmentId: 'seg-col-1',
  name: 'Montée du Belvédère',
  region: 'Vercors',
  surface: 'asphalt',
  createdAt: '2026-09-01T08:00:00.000Z',
  sport: 'cycling',
  distanceM: 2000,
  elevationGainM: 160,
};

const RUNNING_SEGMENT: LeaderboardSegmentView = {
  segmentId: 'seg-run-1',
  name: 'Boucle des Crêtes',
  region: 'Chartreuse',
  surface: 'trail',
  createdAt: '2026-09-01T08:00:00.000Z',
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
    sport: 'cycling',
    elapsedTimeS,
    movingTimeS: elapsedTimeS,
    completionRatio: 1,
    achievedAt: '2026-11-10T10:00:00.000Z',
    audience: 'public',
    athleteGender: 'men',
    ...overrides,
  };
}

function seedSegment(segment: LeaderboardSegmentView) {
  upsertLeaderboardSegment(segment);
}

function seedAthlete(userId: string, overrides: Partial<AthletePrivacySnapshot> = {}) {
  upsertAthletePrivacy(makeAthlete(userId, overrides));
}

function seedEffort(effort: SegmentEffortInput) {
  upsertLeaderboardEffort(effort);
}

beforeEach(() => {
  resetLeaderboardsStore();
  upsertLeaderboardClub({ id: 'club-alpin', name: 'Club Alpin' });
  upsertLeaderboardClub({ id: 'autre-club', name: 'Autre club' });
});

describe('getSegmentLeaderboardView — S4.05', () => {
  it('classe les meilleurs efforts, attribue KOM/QOM et pagine sans doublon', () => {
    seedSegment(CYCLING_SEGMENT);
    for (const userId of ['u-1', 'u-2', 'u-3', 'u-4', 'u-5']) seedAthlete(userId);
    seedEffort(makeEffort('e-1a', 'u-1', 260, { athleteGender: 'men' }));
    seedEffort(makeEffort('e-1b', 'u-1', 240, { athleteGender: 'men' }));
    seedEffort(makeEffort('e-2', 'u-2', 250, { athleteGender: 'women' }));
    seedEffort(makeEffort('e-3', 'u-3', 280, { athleteGender: 'women' }));
    seedEffort(makeEffort('e-4', 'u-4', 300, { athleteGender: 'men' }));
    seedEffort(makeEffort('e-5', 'u-5', 320, { athleteGender: 'men' }));

    const page1 = getSegmentLeaderboardView(CYCLING_SEGMENT.segmentId, {
      viewerId: null,
      pagination: { limit: 2 },
      nowIso: NOW_ISO,
    });

    expect(page1.segment.name).toBe('Montée du Belvédère');
    expect(page1.leaderboard.entries.map((entry) => [entry.userId, entry.title])).toEqual([
      ['u-1', 'KOM'],
      ['u-2', 'QOM'],
    ]);
    expect(page1.leaderboard.titles.kom?.userId).toBe('u-1');
    expect(page1.leaderboard.page.hasMore).toBe(true);
    expect(page1.leaderboard.page.nextCursor).toBe('offset:2');

    const page2 = getSegmentLeaderboardView(CYCLING_SEGMENT.segmentId, {
      viewerId: null,
      pagination: { limit: 2, offset: 2 },
      nowIso: NOW_ISO,
    });
    expect(page2.leaderboard.entries.map((entry) => entry.userId)).toEqual(['u-3', 'u-4']);
    expect(page2.leaderboard.viewerEntry).toBeNull();
  });

  it('attribue CR et gère les égalités stables sur un segment course', () => {
    seedSegment(RUNNING_SEGMENT);
    for (const userId of ['u-a', 'u-b', 'u-c']) seedAthlete(userId);
    seedEffort(
      makeEffort('e-b', 'u-b', 200, {
        segmentId: RUNNING_SEGMENT.segmentId,
        sport: 'running',
        achievedAt: '2026-11-11T09:00:00.000Z',
      })
    );
    seedEffort(
      makeEffort('e-a', 'u-a', 200, {
        segmentId: RUNNING_SEGMENT.segmentId,
        sport: 'running',
        achievedAt: '2026-11-10T09:00:00.000Z',
      })
    );
    seedEffort(
      makeEffort('e-c', 'u-c', 215, {
        segmentId: RUNNING_SEGMENT.segmentId,
        sport: 'running',
      })
    );

    const view = getSegmentLeaderboardView(RUNNING_SEGMENT.segmentId, {
      viewerId: null,
      nowIso: NOW_ISO,
    });

    expect(
      view.leaderboard.entries.map((entry) => [entry.rank, entry.isTied, entry.userId, entry.title])
    ).toEqual([
      [1, true, 'u-a', 'CR'],
      [1, true, 'u-b', 'CR'],
      [3, false, 'u-c', null],
    ]);
  });
});

describe('getSegmentLeaderboardView — filtres S4.06', () => {
  it('retire âge et poids et applique période, genre et scope', () => {
    seedSegment(CYCLING_SEGMENT);
    seedAthlete('u-today');
    seedAthlete('u-old');
    seedAthlete('u-women');
    seedEffort(makeEffort('e-today', 'u-today', 210, { achievedAt: '2026-11-13T08:00:00.000Z' }));
    seedEffort(makeEffort('e-old', 'u-old', 200, { achievedAt: '2025-12-20T08:00:00.000Z' }));
    seedEffort(
      makeEffort('e-women', 'u-women', 220, {
        athleteGender: 'women',
        achievedAt: '2026-11-13T09:00:00.000Z',
      })
    );

    const view = getSegmentLeaderboardView(CYCLING_SEGMENT.segmentId, {
      viewerId: null,
      query: {
        period: 'today',
        gender: 'women',
        ageGroup: '30-39',
        weightClass: '70-79kg',
      },
      nowIso: NOW_ISO,
    });

    expect(view.leaderboard.entries.map((entry) => entry.userId)).toEqual(['u-women']);
    expect(view.leaderboard.filters.strippedUnsupportedFilters).toEqual([
      'ageGroup',
      'weightClass',
    ]);
    expect(view.leaderboard.capabilities.removedFilters).toEqual(['age', 'weight']);
  });

  it('exige une session et une appartenance vérifiée pour les scopes privés', () => {
    seedSegment(CYCLING_SEGMENT);
    seedAthlete('u-friend', { accountVisibility: 'followers_only', friendIds: ['viewer-1'] });
    seedAthlete('u-club');
    seedEffort(makeEffort('e-friend', 'u-friend', 220, { audience: 'friends' }));
    seedEffort(makeEffort('e-club', 'u-club', 210, { audience: 'club' }));

    expect(() =>
      getSegmentLeaderboardView(CYCLING_SEGMENT.segmentId, {
        viewerId: null,
        query: { scope: 'friends' },
        nowIso: NOW_ISO,
      })
    ).toThrow(LeaderboardAuthRequiredError);

    saveLeaderboardViewerRelations({
      userId: 'viewer-1',
      friendIds: ['u-friend'],
      clubIds: ['club-alpin'],
      blockedUserIds: [],
      blockedByUserIds: [],
      mutedUserIds: [],
    });

    const friends = getSegmentLeaderboardView(CYCLING_SEGMENT.segmentId, {
      viewerId: 'viewer-1',
      query: { scope: 'friends' },
      nowIso: NOW_ISO,
    });
    expect(friends.leaderboard.entries.map((entry) => entry.userId)).toEqual(['u-friend']);

    const club = getSegmentLeaderboardView(CYCLING_SEGMENT.segmentId, {
      viewerId: 'viewer-1',
      query: { scope: 'club', clubId: 'club-alpin' },
      nowIso: NOW_ISO,
    });
    expect(club.leaderboard.entries.map((entry) => entry.userId)).toEqual(['u-club']);

    saveLeaderboardViewerRelations({
      userId: 'viewer-2',
      friendIds: [],
      clubIds: [],
      blockedUserIds: [],
      blockedByUserIds: [],
      mutedUserIds: [],
    });
    expect(() =>
      getSegmentLeaderboardView(CYCLING_SEGMENT.segmentId, {
        viewerId: 'viewer-2',
        query: { scope: 'club', clubId: 'club-alpin' },
        nowIso: NOW_ISO,
      })
    ).toThrow(LeaderboardClubAccessError);
  });
});

describe('P01 / S6.19 — confidentialité et anti-triche', () => {
  it('exclut les profils non autorisés et n’expose aucun diagnostic nominatif', () => {
    seedSegment(CYCLING_SEGMENT);
    seedAthlete('u-ok');
    seedAthlete('u-no-consent', { leaderboardConsentGranted: false });
    seedAthlete('u-private', { accountVisibility: 'private' });
    seedAthlete('u-blocked');
    seedAthlete('u-muted');
    seedAthlete('u-suspended', { isHiddenOrSuspended: true });
    seedEffort(makeEffort('e-ok', 'u-ok', 220));
    seedEffort(makeEffort('e-no-consent', 'u-no-consent', 200));
    seedEffort(makeEffort('e-private', 'u-private', 201));
    seedEffort(makeEffort('e-blocked', 'u-blocked', 202));
    seedEffort(makeEffort('e-muted', 'u-muted', 203));
    seedEffort(makeEffort('e-suspended', 'u-suspended', 204));
    seedEffort(makeEffort('e-no-snapshot', 'u-no-snapshot', 205));

    saveLeaderboardViewerRelations({
      userId: 'viewer-1',
      friendIds: [],
      clubIds: [],
      blockedUserIds: ['u-blocked'],
      blockedByUserIds: [],
      mutedUserIds: ['u-muted'],
    });

    const view = getSegmentLeaderboardView(CYCLING_SEGMENT.segmentId, {
      viewerId: 'viewer-1',
      nowIso: NOW_ISO,
    });

    expect(view.leaderboard.entries.map((entry) => entry.userId)).toEqual(['u-ok']);
    expect(view.leaderboard.rejectedCount).toBe(6);
    expect(view.antiCheat.privacyRejectedCount).toBe(6);
    expect(view.antiCheat.antiCheatRejectedCount).toBe(0);
    expect('diagnostics' in view.leaderboard).toBe(false);
    expect(JSON.stringify(view.antiCheat)).not.toContain('u-no-consent');
    expect(JSON.stringify(view.antiCheat)).not.toContain('e-no-consent');
  });

  it('agrège les motifs anti-triche sans identité et refuse la vitesse implausible', () => {
    seedSegment(CYCLING_SEGMENT);
    seedAthlete('u-cheat');
    seedAthlete('u-clean');
    seedEffort(makeEffort('e-speed', 'u-cheat', 30, { movingTimeS: 30 }));
    seedEffort(makeEffort('e-gps', 'u-cheat', 240, { hasGpsJump: true }));
    seedEffort(makeEffort('e-off', 'u-cheat', 240, { offRoute: true }));
    seedEffort(makeEffort('e-uturn', 'u-cheat', 240, { uturnDetected: true }));
    seedEffort(makeEffort('e-incomplete', 'u-cheat', 240, { completionRatio: 0.5 }));
    seedEffort(makeEffort('e-moderation', 'u-cheat', 240, { moderationStatus: 'flagged' }));
    seedEffort(makeEffort('e-clean', 'u-clean', 250));

    const view = getSegmentLeaderboardView(CYCLING_SEGMENT.segmentId, {
      viewerId: null,
      nowIso: NOW_ISO,
    });

    expect(view.leaderboard.entries.map((entry) => entry.userId)).toEqual(['u-clean']);
    expect(view.antiCheat.rejectedCount).toBe(6);
    expect(view.antiCheat.antiCheatRejectedCount).toBe(6);
    expect(view.antiCheat.reasons.map((reason) => reason.reason)).toEqual(
      expect.arrayContaining([
        'implausible_speed',
        'gps_jump',
        'off_route',
        'uturn_detected',
        'incomplete_passage',
        'moderation_excluded',
      ])
    );
    expect(view.antiCheat.checks.length).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(view.antiCheat)).not.toContain('u-cheat');
    expect(JSON.stringify(view.antiCheat)).not.toContain('e-speed');
  });

  it('lève une erreur 404 métier pour un segment inconnu', () => {
    expect(() =>
      getSegmentLeaderboardView('seg-inconnu', { viewerId: null, nowIso: NOW_ISO })
    ).toThrow(LeaderboardSegmentNotFoundError);
  });
});

describe('getSegmentLocalLegendsView — S4.08', () => {
  it('compte les passages de la fenêtre, gère l’égalité et masque un segment dangereux', () => {
    seedSegment(CYCLING_SEGMENT);
    seedAthlete('u-1');
    seedAthlete('u-2');
    for (const [index, date] of ['2026-11-10', '2026-10-20', '2026-09-15'].entries()) {
      seedEffort(makeEffort(`l-1-${index}`, 'u-1', 250, { achievedAt: `${date}T10:00:00.000Z` }));
      seedEffort(makeEffort(`l-2-${index}`, 'u-2', 260, { achievedAt: `${date}T11:00:00.000Z` }));
    }
    seedEffort(makeEffort('l-old', 'u-1', 240, { achievedAt: '2026-06-01T10:00:00.000Z' }));

    const view = getSegmentLocalLegendsView(CYCLING_SEGMENT.segmentId, {
      viewerId: null,
      windowDays: 90,
      minEffortsForTitle: 3,
      nowIso: NOW_ISO,
    });

    expect(view.localLegend.shouldDisplayMention).toBe(true);
    expect(view.localLegend.tiedLegends.map((entry) => entry.userId)).toEqual(['u-1', 'u-2']);
    expect(view.localLegend.totalEligiblePassages).toBe(6);
    expect(view.localLegend.legend?.userId).toBe('u-1');
  });

  it('ne publie aucune mention sous le seuil ou sur un segment signalé', () => {
    seedSegment(CYCLING_SEGMENT);
    seedAthlete('u-1');
    seedEffort(makeEffort('l-1', 'u-1', 250));

    const below = getSegmentLocalLegendsView(CYCLING_SEGMENT.segmentId, {
      viewerId: null,
      minEffortsForTitle: 3,
      nowIso: NOW_ISO,
    });
    expect(below.localLegend.shouldDisplayMention).toBe(false);
    expect(below.localLegend.legend).toBeNull();

    const hazardous = { ...CYCLING_SEGMENT, isHazardous: true };
    resetLeaderboardsStore();
    upsertLeaderboardSegment(hazardous);
    seedAthlete('u-1');
    for (const index of [1, 2, 3]) {
      seedEffort(makeEffort(`lh-${index}`, 'u-1', 250 + index));
    }
    const view = getSegmentLocalLegendsView(hazardous.segmentId, {
      viewerId: null,
      minEffortsForTitle: 3,
      nowIso: NOW_ISO,
    });
    expect(view.localLegend.shouldDisplayMention).toBe(false);
  });
});

describe('listSegmentLeaderboardSummaries', () => {
  it('résume les segments, leur top 3 et la Local Legend autorisée', () => {
    seedSegment(CYCLING_SEGMENT);
    seedSegment(RUNNING_SEGMENT);
    seedAthlete('u-1');
    seedAthlete('u-2');
    seedAthlete('u-3');
    for (const index of [1, 2, 3]) {
      seedEffort(makeEffort(`c-${index}`, 'u-1', 230 + index));
    }
    seedEffort(makeEffort('c-4', 'u-3', 260));
    seedEffort(
      makeEffort('r-1', 'u-2', 200, {
        segmentId: RUNNING_SEGMENT.segmentId,
        sport: 'running',
      })
    );

    const summaries = listSegmentLeaderboardSummaries({ viewerId: null, nowIso: NOW_ISO });

    expect(summaries.map((summary) => summary.segment.segmentId)).toEqual([
      CYCLING_SEGMENT.segmentId,
      RUNNING_SEGMENT.segmentId,
    ]);
    expect(summaries[0].totalEntries).toBe(2);
    expect(summaries[0].localLegend?.displayName).toBe('Athlète u-1');
    expect(summaries[1].topEntries.length).toBe(1);

    const filtered = listSegmentLeaderboardSummaries({
      viewerId: null,
      q: 'crêtes',
      nowIso: NOW_ISO,
    });
    expect(filtered.map((summary) => summary.segment.segmentId)).toEqual([
      RUNNING_SEGMENT.segmentId,
    ]);
  });
});
