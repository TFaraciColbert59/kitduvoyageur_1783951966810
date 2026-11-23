import type { ClubRole } from '@/features/clubs/types';

export type ClubStatsWindow = '7d' | '30d' | 'season' | 'all';

export type ClubHierarchyTier = 'visitor' | 'member' | 'staff' | 'admin';

export interface ClubPerformancePillar {
  id: 'regularity' | 'volume' | 'kits' | 'cohesion';
  label: string;
  score: number;
  max: number;
  detail: string;
}

export interface ClubStatsSeriesPoint {
  key: string;
  label: string;
  distanceKm: number;
  dplusM: number;
  outingsCount: number;
  hours: number;
}

export interface ClubTerrainStat {
  name: string;
  outingsCount: number;
  distanceKm: number;
  dplusM: number;
  sharePct: number;
}

export interface ClubDisciplineStat {
  name: string;
  count: number;
  distanceKm: number;
  sharePct: number;
}

export interface ClubRecordHighlight {
  id: string;
  title: string;
  valueLabel: string;
  massif: string;
  dateLabel: string;
}

export interface ClubOfficialKitStat {
  id: string;
  title: string;
  season: string;
  totalWeightG: number;
  itemsCount: number;
}

export interface ClubVaultCategoryStat {
  category: string;
  count: number;
  totalWeightKg: number;
}

export interface ClubChallengeStat {
  id: string;
  title: string;
  metric: string;
  currentValue: number;
  targetValue: number;
  pct: number;
  participantsCount: number;
  badgeTitle: string;
  badgeIcon: string;
}

export interface ClubMemberEffortStat {
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  role: ClubRole;
  roleLabel: string;
  distanceKm: number;
  dplusM: number;
  hours: number;
  outingsCount: number;
  activitiesCount: number;
  postsCount: number;
  gearCount: number;
  contributions: number;
  isMe: boolean;
  verifiedActivities: boolean;
  canManageStories: boolean;
}

export interface ClubMyContributionStat {
  rank: number | null;
  rankedTotal: number;
  distanceKm: number;
  dplusM: number;
  hours: number;
  outingsCount: number;
  activitiesCount: number;
  eventsJoined: number;
  postsCount: number;
  gearLentCount: number;
  shareOfClubPct: number;
  clubAvgKm: number;
  clubAvgDplusM: number;
}

export interface ClubTopOrganizerStat {
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  roleLabel: string;
  eventsOrganized: number;
  totalParticipants: number;
}

export interface ClubStatsPayload {
  clubId: string;
  tier: ClubHierarchyTier;
  window: ClubStatsWindow;
  generatedAt: string;
  performanceScore: {
    total: number;
    grade: string;
    deltaPct: number;
    pillars: ClubPerformancePillar[];
  };
  summary: {
    totalDistanceKm: number;
    totalDplusM: number;
    totalDurationH: number;
    completedOutingsCount: number;
    upcomingEventsCount: number;
    totalEventsOrganized: number;
    recordedActivitiesCount: number;
    membersCount: number;
    activeMembersWindowCount: number;
    standardKitsCount: number;
    vaultItemsCount: number;
    gearLoansCount: number;
    challengesActiveCount: number;
    topicsCount: number;
    channelsCount: number;
    avgOutingKm: number;
    avgOutingDplusM: number;
  };
  timeSeries: ClubStatsSeriesPoint[];
  terrains: ClubTerrainStat[];
  disciplines: ClubDisciplineStat[];
  eventsBreakdown: {
    organized: number;
    completed: number;
    upcoming: number;
    cancelled: number;
    totalRegistrations: number;
    avgFillRatePct: number;
    attendanceCount: number;
    records: {
      longestOuting: ClubRecordHighlight | null;
      biggestDplus: ClubRecordHighlight | null;
      mostPopularEvent: ClubRecordHighlight | null;
    };
  };
  kitsAndVault: {
    standardKitsCount: number;
    avgBaseWeightG: number;
    ultralightKitsCount: number;
    vaultItemsCount: number;
    activeLoansCount: number;
    returnedLoansCount: number;
    loanRotationPct: number;
    categories: ClubVaultCategoryStat[];
    officialKits: ClubOfficialKitStat[];
  };
  challengesSummary: ClubChallengeStat[];
  roleDistribution: {
    leadersCount: number;
    activeMembersCount: number;
    proAthletesCount: number;
  };
  memberView: {
    myStats: ClubMyContributionStat;
    memberRankings: ClubMemberEffortStat[];
    excludedOptOutCount: number;
  } | null;
  managementView: {
    activeRate30dPct: number;
    newMembers30d: number;
    pendingJoinRequestsCount: number;
    avgFillRatePct: number;
    attendanceRatePct: number;
    vaultRotationPct: number;
    storiesAuthorizedCount: number;
    topOrganizers: ClubTopOrganizerStat[];
    inactiveMembersEstimate: number;
    canManagePermissions: boolean;
  } | null;
}
