import type {
  LocalLegendEntry,
  LocalLegendResult,
  SanitizedLeaderboardEntry,
  SegmentLeaderboardResult,
} from '@/features/leaderboards';
import type { AntiCheatSummary, LeaderboardSegmentView } from '@/lib/leaderboards/types';

export const NOW_ISO = '2026-11-13T12:00:00.000Z';

export const SEGMENT: LeaderboardSegmentView = {
  segmentId: 'seg-col-1',
  name: 'Montée du Belvédère',
  region: 'Vercors',
  surface: 'asphalt',
  createdAt: '2026-09-01T08:00:00.000Z',
  sport: 'cycling',
  distanceM: 2000,
  elevationGainM: 160,
};

export const ENTRIES: SanitizedLeaderboardEntry[] = [
  {
    rank: 1,
    isTied: false,
    effortId: 'e-1',
    activityId: 'a-1',
    userId: 'u-1',
    displayName: 'Camille Martin',
    avatarUrl: null,
    elapsedTimeS: 240,
    movingTimeS: 240,
    averageSpeedKmh: 30,
    achievedAt: '2026-11-10T10:00:00.000Z',
    athleteGender: 'women',
    title: 'QOM',
    isViewer: true,
  },
  {
    rank: 1,
    isTied: true,
    effortId: 'e-2',
    activityId: 'a-2',
    userId: 'u-2',
    displayName: 'Nils Bernard',
    avatarUrl: null,
    elapsedTimeS: 240,
    movingTimeS: 240,
    averageSpeedKmh: 30,
    achievedAt: '2026-11-11T10:00:00.000Z',
    athleteGender: 'men',
    title: 'KOM',
    isViewer: false,
  },
  {
    rank: 3,
    isTied: false,
    effortId: 'e-3',
    activityId: 'a-3',
    userId: 'u-3',
    displayName: 'Sacha Petit',
    avatarUrl: null,
    elapsedTimeS: 320,
    movingTimeS: 320,
    averageSpeedKmh: 22.5,
    achievedAt: '2026-11-09T10:00:00.000Z',
    athleteGender: 'non_binary',
    title: null,
    isViewer: false,
  },
];

export function makeLeaderboardResult(
  overrides: Partial<SegmentLeaderboardResult> = {}
): SegmentLeaderboardResult {
  return {
    segmentId: SEGMENT.segmentId,
    sport: SEGMENT.sport,
    filters: {
      period: 'all_time',
      scope: 'global',
      clubId: null,
      gender: 'all',
      strippedUnsupportedFilters: [],
    },
    capabilities: {
      supportedFilters: ['period', 'scope', 'clubId', 'gender'],
      removedFilters: ['age', 'weight'],
      periods: ['all_time', 'this_year', 'this_month', 'this_week', 'today', 'rolling_90d'],
      scopes: ['global', 'friends', 'club'],
    },
    entries: ENTRIES,
    page: {
      limit: 20,
      offset: 0,
      totalEntries: ENTRIES.length,
      hasMore: false,
      nextCursor: null,
    },
    viewerEntry: ENTRIES[0],
    titles: {
      kom: ENTRIES[1],
      qom: ENTRIES[0],
      cr: null,
    },
    rejectedCount: 2,
    computedAt: NOW_ISO,
    ...overrides,
  };
}

const LEGEND_ENTRY: LocalLegendEntry = {
  rank: 1,
  isTied: false,
  userId: 'u-1',
  displayName: 'Camille Martin',
  avatarUrl: null,
  effortCount: 7,
  bestElapsedTimeS: 238,
  lastEffortAt: '2026-11-12T10:00:00.000Z',
  isLocalLegend: true,
  isViewer: true,
};

export function makeLocalLegendResult(
  overrides: Partial<LocalLegendResult> = {}
): LocalLegendResult {
  return {
    segmentId: SEGMENT.segmentId,
    sport: SEGMENT.sport,
    windowDays: 90,
    windowStartIso: '2026-08-15T12:00:00.000Z',
    windowEndIso: NOW_ISO,
    minEffortsForTitle: 3,
    shouldDisplayMention: true,
    legend: LEGEND_ENTRY,
    tiedLegends: [LEGEND_ENTRY],
    rankings: [
      LEGEND_ENTRY,
      {
        ...LEGEND_ENTRY,
        rank: 2,
        userId: 'u-2',
        displayName: 'Nils Bernard',
        effortCount: 3,
        bestElapsedTimeS: 250,
        isLocalLegend: false,
        isViewer: false,
      },
    ],
    viewerStanding: LEGEND_ENTRY,
    totalEligiblePassages: 10,
    rejectedCount: 1,
    computedAt: NOW_ISO,
    ...overrides,
  };
}

export const ANTI_CHEAT: AntiCheatSummary = {
  rejectedCount: 2,
  antiCheatRejectedCount: 1,
  privacyRejectedCount: 1,
  periodRejectedCount: 0,
  reasons: [
    {
      reason: 'implausible_speed',
      category: 'anti_cheat',
      label: 'Vitesse implausible',
      count: 1,
    },
    {
      reason: 'privacy_unconsented',
      category: 'privacy',
      label: 'Consentement aux classements absent',
      count: 1,
    },
  ],
  checks: [
    {
      id: 'speed_plausibility',
      label: 'Vitesse plausible',
      detail: 'La vitesse est comparée au plafond du sport.',
      enforced: true,
    },
    {
      id: 'gps_integrity',
      label: 'Continuité GPS',
      detail: 'Les sauts de position sont écartés.',
      enforced: true,
    },
  ],
  computedAt: NOW_ISO,
};
