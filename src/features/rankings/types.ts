/**
 * G03 — Rankings, Trophies, Local Legends, Challenge Badges & Social Progression
 * Domain Contract & Types
 *
 * Covers fiches: K5.25, K5.26, S5.20, S5.21, S5.22, S5.23, S5.24, S6.26.
 *
 * Invariants:
 * 1. Privacy fail-closed (P01): private activities, opted-out users, or blocked users (S6.19)
 *    are strictly excluded from all rankings, Local Legends, and peer comparisons.
 * 2. Reward integrity: no badge, trophy, or challenge progress is awarded for invalid,
 *    flagged, or moderated activities. Replaying an activity is idempotent; correcting or
 *    deleting an activity reconciles progress and revokes unearned trophies.
 * 3. Unknown is distinct from zero: missing metrics stay `null`, never fabricated defaults.
 * 4. No exact GPS coordinates are exposed in public ranking or peer comparison payloads.
 */

export type SportCategory =
  | 'all'
  | 'running'
  | 'trail'
  | 'cycling'
  | 'gravel'
  | 'mtb'
  | 'hiking'
  | 'walking'
  | 'swimming'
  | 'skiing'
  | 'other';

export type ActivityVisibility = 'public' | 'followers' | 'club' | 'private';

export type ActivityModerationStatus = 'clean' | 'flagged' | 'removed' | 'pending_review';

export interface GpsTrackPoint {
  lat: number;
  lng: number;
  elevationMeters?: number | null;
  timestamp?: string;
}

export interface BestEffortRecord {
  distanceMeters: number;
  durationSec: number;
  activityId: string;
  achievedAt: string;
  sport: SportCategory;
}

export interface RankingActivityRecord {
  id: string;
  userId: string;
  sport: SportCategory;
  startedAt: string; // ISO-8601
  durationSec: number | null;
  distanceMeters: number | null;
  elevationGainMeters: number | null;
  visibility: ActivityVisibility;
  isValid: boolean;
  isFlagged: boolean;
  moderationStatus?: ActivityModerationStatus;
  deleted?: boolean;
  gpsTrack?: GpsTrackPoint[];
  visitedZoneIds?: string[];
  segmentIds?: string[];
  routeIds?: string[];
  bestEfforts?: BestEffortRecord[];
}

export interface RankingUserProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  rankingsOptOut?: boolean;
  localLegendsOptOut?: boolean;
  peerComparisonOptOut?: boolean;
}

export interface PrivacyPolicyContext {
  viewerId: string;
  /** Users who opted out of global/period rankings (P01). */
  rankingsOptOutUserIds?: ReadonlySet<string> | readonly string[];
  /** Users who opted out of Local Legends (P01). */
  localLegendsOptOutUserIds?: ReadonlySet<string> | readonly string[];
  /** Users who opted out of peer progression comparisons (P01). */
  peerComparisonOptOutUserIds?: ReadonlySet<string> | readonly string[];
  /** Users blocked by the viewer (S6.19). */
  blockedUserIds?: ReadonlySet<string> | readonly string[];
  /** Users who have blocked the viewer (S6.19 bidirectional enforcement). */
  blockedByUserIds?: ReadonlySet<string> | readonly string[];
  /** Peers authorized to be compared with the viewer (e.g. mutual friends). */
  authorizedPeerIds?: ReadonlySet<string> | readonly string[];
  /** Club member IDs when viewing club-scoped content. */
  clubMemberIds?: ReadonlySet<string> | readonly string[];
}

// ---------------------------------------------------------------------------
// Period Leaderboards (Weekly / Monthly)
// ---------------------------------------------------------------------------

export type LeaderboardPeriodKind = 'weekly' | 'monthly';

export type LeaderboardMetric = 'distanceMeters' | 'elevationGainMeters' | 'durationSec' | 'activityCount';

export interface PeriodWindow {
  kind: LeaderboardPeriodKind;
  /** ISO-8601 inclusive start. */
  startsAt: string;
  /** ISO-8601 inclusive end. */
  endsAt: string;
  /** Human-readable period key, e.g. "2026-W46" or "2026-11". */
  periodKey: string;
}

export interface PeriodLeaderboardQuery {
  periodKind: LeaderboardPeriodKind;
  referenceDate: string; // ISO-8601
  sport?: SportCategory;
  metric?: LeaderboardMetric;
  scope?: 'public' | 'club' | 'peers';
  limit?: number;
}

export interface PeriodLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  metricValue: number;
  activityCount: number;
  totalDistanceMeters: number;
  totalElevationGainMeters: number;
  totalDurationSec: number;
  isCurrentUser: boolean;
}

export interface PeriodLeaderboardResult {
  window: PeriodWindow;
  sport: SportCategory;
  metric: LeaderboardMetric;
  totalParticipants: number;
  entries: PeriodLeaderboardEntry[];
  currentUserEntry: PeriodLeaderboardEntry | null;
}

// ---------------------------------------------------------------------------
// Local Legends (90-day rolling window)
// ---------------------------------------------------------------------------

export interface LocalLegendTarget {
  targetId: string;
  targetType: 'segment' | 'route';
  name: string;
  sport: SportCategory;
}

export interface LocalLegendEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  effortCount: number;
  lastEffortAt: string;
  isLegend: boolean;
  isCurrentUser: boolean;
}

export interface LocalLegendResult {
  target: LocalLegendTarget;
  windowStart: string;
  windowEnd: string;
  windowDays: number;
  minEffortsRequired: number;
  leader: LocalLegendEntry | null;
  entries: LocalLegendEntry[];
  currentUserEffortCount: number;
  effortsToDethrone: number | null;
  currentUserOptedOut: boolean;
}

// ---------------------------------------------------------------------------
// Challenges, Idempotent Ledger & Virtual Races / Campaigns
// (K5.25, S5.20, S5.21, S5.22, S5.23, S6.26)
// ---------------------------------------------------------------------------

export type ChallengeKind =
  | 'public'
  | 'sponsored'
  | 'private_invite'
  | 'best_effort'
  | 'virtual_race'
  | 'campaign';

export type ChallengeCriterionType =
  | 'distance_meters'
  | 'elevation_gain_meters'
  | 'duration_sec'
  | 'activity_count'
  | 'zone_visit'
  | 'gps_point_radius'
  | 'best_effort_time';

export interface ChallengeRule {
  id: string;
  version: number;
  kind: ChallengeKind;
  title: string;
  description: string;
  sport: SportCategory;
  criterion: ChallengeCriterionType;
  targetValue: number;
  unit: string;
  startsAt: string;
  endsAt: string;
  rewardBadgeId: string;
  rewardTitle: string;
  rewardPoints: number;
  /** Required for zone_visit criterion. */
  requiredZoneIds?: string[];
  /** Required for gps_point_radius criterion. */
  targetCoordinate?: { lat: number; lng: number; radiusMeters: number };
  /** For S5.21 private_invite challenges: only invited users can participate and view. */
  invitedUserIds?: string[];
  /** For S5.20 / S6.26 sponsored challenges. */
  sponsorId?: string;
  sponsorName?: string;
  /** For S5.23 virtual races. */
  partnerId?: string;
  partnerAvailable?: boolean;
  /** Max time allowed for best_effort_time criterion (in seconds). */
  maxDurationSec?: number;
  /** Required distance for best_effort_time criterion (in meters). */
  effortDistanceMeters?: number;
}

export interface ChallengeLedgerEntry {
  idempotencyKey: string; // `${ruleId}:v${ruleVersion}:${activityId}`
  ruleId: string;
  ruleVersion: number;
  userId: string;
  activityId: string;
  deltaValue: number;
  status: 'applied' | 'compensated';
  recordedAt: string;
  reason: 'initial' | 'correction' | 'deletion' | 'flagged' | 'invalid';
}

export interface ChallengeProgressState {
  ruleId: string;
  ruleVersion: number;
  userId: string;
  currentValue: number;
  targetValue: number;
  progressPct: number;
  isCompleted: boolean;
  completedAt: string | null;
  badgeAwarded: boolean;
  appliedActivityIds: string[];
  ledger: ChallengeLedgerEntry[];
}

export interface VirtualRaceRegistration {
  raceId: string;
  userId: string;
  registeredAt: string;
  status: 'registered' | 'withdrawn';
}

export interface VirtualRaceResult {
  raceId: string;
  userId: string;
  eligible: boolean;
  reasonIfIneligible: string | null;
  bestDurationSec: number | null;
  distanceMeters: number | null;
  completedAt: string | null;
  finisherBadgeAwarded: boolean;
}

export interface BestEffortGoalProposal {
  sport: SportCategory;
  distanceMeters: number;
  previousBestDurationSec: number;
  proposedTargetDurationSec: number;
  improvementPct: number;
  sourceActivityId: string;
  sourceAchievedAt: string;
}

export interface CampaignEligibilityRule {
  campaignId: string;
  sponsorName: string;
  startsAt: string;
  endsAt: string;
  allowedSports: SportCategory[];
  minDistanceMeters?: number;
  minElevationGainMeters?: number;
  requiresPublicVisibility?: boolean;
}

export interface CampaignParticipationMetrics {
  campaignId: string;
  uniqueParticipants: number;
  validatedActivities: number;
  rejectedActivities: number;
  totalDistanceMeters: number;
  totalElevationGainMeters: number;
  totalDurationSec: number;
}

// ---------------------------------------------------------------------------
// Peak Bagging (K5.26)
// ---------------------------------------------------------------------------

export interface PeakDefinition {
  id: string;
  name: string;
  elevationMeters: number;
  lat: number;
  lng: number;
  /** Validation radius in meters (defaults to 50m). */
  validationRadiusMeters?: number;
  region?: string;
}

export interface PeakAscentRecord {
  peakId: string;
  peakName: string;
  peakElevationMeters: number;
  activityId: string;
  ascendedAt: string;
  closestDistanceMeters: number;
}

export interface PeakBaggingEntry {
  peakId: string;
  name: string;
  elevationMeters: number;
  region: string | null;
  isConquered: boolean;
  ascentCount: number;
  firstAscentAt: string | null;
  lastAscentAt: string | null;
}

export interface PeakBaggingSummary {
  userId: string;
  totalPeaksInCatalog: number;
  conqueredPeaksCount: number;
  completionPct: number;
  totalAscentsCount: number;
  highestConqueredPeakMeters: number | null;
  cumulativePeakElevationMeters: number;
  entries: PeakBaggingEntry[];
}

// ---------------------------------------------------------------------------
// Trophies, Crowns & Showcase (S5.24)
// ---------------------------------------------------------------------------

export type TrophyCategory = 'challenge_finisher' | 'local_legend_crown' | 'period_podium' | 'peak_milestone';

export interface TrophyBadge {
  id: string;
  category: TrophyCategory;
  title: string;
  subtitle: string;
  awardedAt: string;
  sourceId: string; // challengeId, segmentId, periodKey, or peak milestone id
  isRevoked: boolean;
  rank?: number;
}

export interface TrophyShowcase {
  userId: string;
  totalActiveTrophies: number;
  crownsCount: number;
  finisherBadgesCount: number;
  peakMilestonesCount: number;
  trophies: TrophyBadge[];
}

// ---------------------------------------------------------------------------
// Peer Progression Comparison
// ---------------------------------------------------------------------------

export interface PeerComparisonQuery {
  periodKind: LeaderboardPeriodKind;
  referenceDate: string;
  sport?: SportCategory;
}

export interface PeerProgressionSnapshot {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isCurrentUser: boolean;
  activityCount: number;
  totalDistanceMeters: number | null;
  totalElevationGainMeters: number | null;
  totalDurationSec: number | null;
  conqueredPeaksCount: number;
  activeTrophiesCount: number;
}

export interface PeerComparisonDelta {
  peerUserId: string;
  peerDisplayName: string;
  distanceDeltaMeters: number | null;
  elevationDeltaMeters: number | null;
  durationDeltaSec: number | null;
  activityCountDelta: number;
}

export interface PeerComparisonResult {
  window: PeriodWindow;
  sport: SportCategory;
  currentUser: PeerProgressionSnapshot;
  peers: PeerProgressionSnapshot[];
  deltas: PeerComparisonDelta[];
  excludedPeerCount: number;
}
