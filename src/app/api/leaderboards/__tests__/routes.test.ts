import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { resetMemoryRateLimits } from '@/lib/rate-limit';
import { GET as getSegment } from '@/app/api/leaderboards/segments/[segmentId]/route';
import { GET as getLocalLegends } from '@/app/api/leaderboards/segments/[segmentId]/local-legends/route';
import { GET as getAntiCheat } from '@/app/api/leaderboards/segments/[segmentId]/anti-cheat/route';
import { GET as getSegments } from '@/app/api/leaderboards/segments/route';
import { GET as getFilters } from '@/app/api/leaderboards/filters/route';
import {
  resetLeaderboardsStore,
  saveLeaderboardViewerRelations,
  upsertAthletePrivacy,
  upsertLeaderboardClub,
  upsertLeaderboardEffort,
  upsertLeaderboardSegment,
} from '@/lib/leaderboards/store';
import type { LeaderboardSegmentView } from '@/lib/leaderboards/types';
import type { AthletePrivacySnapshot, SegmentEffortInput } from '@/features/leaderboards';

const SEGMENT: LeaderboardSegmentView = {
  segmentId: 'seg-col-1',
  name: 'Montée du Belvédère',
  region: 'Vercors',
  surface: 'asphalt',
  createdAt: '2026-09-01T08:00:00.000Z',
  sport: 'cycling',
  distanceM: 2000,
  elevationGainM: 160,
};

function athlete(
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

function effort(
  effortId: string,
  userId: string,
  elapsedTimeS: number,
  overrides: Partial<SegmentEffortInput> = {}
): SegmentEffortInput {
  return {
    effortId,
    activityId: `act-${effortId}`,
    segmentId: SEGMENT.segmentId,
    userId,
    sport: 'cycling',
    elapsedTimeS,
    movingTimeS: elapsedTimeS,
    completionRatio: 1,
    achievedAt: '2026-11-12T10:00:00.000Z',
    audience: 'public',
    athleteGender: 'men',
    ...overrides,
  };
}

function setUser(userId: string | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null } })),
    },
  } as never);
}

function request(path: string, ip = '203.0.113.10') {
  return new NextRequest(`http://localhost${path}`, {
    headers: { 'x-forwarded-for': ip },
  });
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-13T12:00:00.000Z'));
  resetLeaderboardsStore();
  resetMemoryRateLimits();
  vi.clearAllMocks();
  setUser(null);
  upsertLeaderboardClub({ id: 'club-alpin', name: 'Club Alpin' });
  upsertLeaderboardSegment(SEGMENT);
  for (const userId of ['u-1', 'u-2', 'u-cheat', 'u-private']) {
    upsertAthletePrivacy(athlete(userId));
  }
  upsertAthletePrivacy(athlete('u-private', { accountVisibility: 'private' }));
  upsertLeaderboardEffort(effort('e-1', 'u-1', 240, { athleteGender: 'women' }));
  upsertLeaderboardEffort(effort('e-2', 'u-2', 260));
  upsertLeaderboardEffort(effort('e-cheat', 'u-cheat', 30, { movingTimeS: 30 }));
  upsertLeaderboardEffort(effort('e-private', 'u-private', 200));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('GET /api/leaderboards/segments/[segmentId]', () => {
  it('renvoie le classement public, les titres et l’agrégat anti-triche sans diagnostic', async () => {
    const response = await getSegment(
      request('/api/leaderboards/segments/seg-col-1?period=all_time&scope=global&gender=all'),
      { params: Promise.resolve({ segmentId: SEGMENT.segmentId }) }
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('private');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(body.success).toBe(true);
    expect((body.segment as { name: string }).name).toBe('Montée du Belvédère');

    const leaderboard = body.leaderboard as {
      entries: Array<{ userId: string; title: string | null }>;
      rejectedCount: number;
      filters: { strippedUnsupportedFilters: string[] };
      diagnostics?: unknown;
    };
    expect(leaderboard.entries.map((entry) => entry.userId)).toEqual(['u-1', 'u-2']);
    expect(leaderboard.entries[0].title).toBe('QOM');
    expect(leaderboard.rejectedCount).toBe(2);
    expect(leaderboard.diagnostics).toBeUndefined();

    const antiCheat = body.antiCheat as { rejectedCount: number; antiCheatRejectedCount: number };
    expect(antiCheat.rejectedCount).toBe(2);
    expect(antiCheat.antiCheatRejectedCount).toBe(1);
    expect(JSON.stringify(body)).not.toContain('e-cheat');
    expect(JSON.stringify(body)).not.toContain('u-private');
  });

  it('applique les filtres, ignore âge et poids et pagine par offset', async () => {
    const response = await getSegment(
      request(
        '/api/leaderboards/segments/seg-col-1?period=all_time&gender=women&ageGroup=30-39&weightClass=70kg&limit=1&offset=0'
      ),
      { params: Promise.resolve({ segmentId: SEGMENT.segmentId }) }
    );
    const body = await json(response);
    const leaderboard = body.leaderboard as {
      entries: Array<{ userId: string }>;
      filters: { strippedUnsupportedFilters: string[] };
      page: { hasMore: boolean; limit: number; offset: number };
    };

    expect(response.status).toBe(200);
    expect(leaderboard.entries.map((entry) => entry.userId)).toEqual(['u-1']);
    expect(leaderboard.filters.strippedUnsupportedFilters).toEqual(['ageGroup', 'weightClass']);
    expect(leaderboard.page).toMatchObject({ limit: 1, offset: 0, hasMore: false });
  });

  it('refuse un scope privé anonyme et un club non sélectionné', async () => {
    const friends = await getSegment(
      request('/api/leaderboards/segments/seg-col-1?scope=friends'),
      { params: Promise.resolve({ segmentId: SEGMENT.segmentId }) }
    );
    expect(friends.status).toBe(401);
    expect((await json(friends)).code).toBe('authentication_required');

    setUser('viewer-1');
    saveLeaderboardViewerRelations({
      userId: 'viewer-1',
      friendIds: [],
      clubIds: ['club-alpin'],
      blockedUserIds: [],
      blockedByUserIds: [],
      mutedUserIds: [],
    });

    const club = await getSegment(request('/api/leaderboards/segments/seg-col-1?scope=club'), {
      params: Promise.resolve({ segmentId: SEGMENT.segmentId }),
    });
    expect(club.status).toBe(400);
    expect((await json(club)).code).toBe('club_id_required');
  });

  it('valide la requête et renvoie 404 pour un segment inconnu', async () => {
    const invalid = await getSegment(
      request('/api/leaderboards/segments/seg-col-1?period=decade&limit=abc'),
      { params: Promise.resolve({ segmentId: SEGMENT.segmentId }) }
    );
    expect(invalid.status).toBe(400);
    expect((await json(invalid)).code).toBe('invalid_query');

    const missing = await getSegment(request('/api/leaderboards/segments/seg-inconnu'), {
      params: Promise.resolve({ segmentId: 'seg-inconnu' }),
    });
    expect(missing.status).toBe(404);
    expect((await json(missing)).code).toBe('segment_not_found');
  });
});

describe('routes Local Legend, anti-triche, index et filtres', () => {
  it('renvoie la Local Legend autorisée', async () => {
    for (const index of [1, 2, 3]) {
      upsertLeaderboardEffort(
        effort(`l-${index}`, 'u-1', 240 + index, {
          achievedAt: `2026-11-${String(8 + index).padStart(2, '0')}T10:00:00.000Z`,
        })
      );
    }

    const response = await getLocalLegends(
      request('/api/leaderboards/segments/seg-col-1/local-legends?windowDays=90&minEfforts=3'),
      { params: Promise.resolve({ segmentId: SEGMENT.segmentId }) }
    );
    const body = await json(response);
    const localLegend = body.localLegend as {
      shouldDisplayMention: boolean;
      legend: { userId: string } | null;
    };

    expect(response.status).toBe(200);
    expect(localLegend.shouldDisplayMention).toBe(true);
    expect(localLegend.legend?.userId).toBe('u-1');
  });

  it('renvoie seulement des compteurs anti-triche, sans identité', async () => {
    const response = await getAntiCheat(
      request('/api/leaderboards/segments/seg-col-1/anti-cheat'),
      { params: Promise.resolve({ segmentId: SEGMENT.segmentId }) }
    );
    const body = await json(response);
    const antiCheat = body.antiCheat as {
      antiCheatRejectedCount: number;
      reasons: Array<{ reason: string }>;
      checks: unknown[];
    };

    expect(response.status).toBe(200);
    expect(antiCheat.antiCheatRejectedCount).toBe(1);
    expect(antiCheat.reasons.map((reason) => reason.reason)).toContain('implausible_speed');
    expect(antiCheat.checks.length).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain('u-cheat');
    expect(JSON.stringify(body)).not.toContain('e-cheat');
  });

  it('liste les segments et expose les capacités de filtres', async () => {
    const list = await getSegments(request('/api/leaderboards/segments?q=belvédère&sport=cycling'));
    const listBody = await json(list);
    expect(list.status).toBe(200);
    expect((listBody.segments as Array<unknown>).length).toBe(1);

    const filters = await getFilters(request('/api/leaderboards/filters'));
    const filtersBody = await json(filters);
    const capabilities = filtersBody.capabilities as {
      removedFilters: string[];
      supportedFilters: string[];
    };
    expect(filters.status).toBe(200);
    expect(capabilities.removedFilters).toEqual(['age', 'weight']);
    expect(capabilities.supportedFilters).toEqual(['period', 'scope', 'clubId', 'gender']);
  });
});
