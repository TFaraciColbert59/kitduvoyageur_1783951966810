/**
 * Contrat de types pour le lot S02 — Classements de segments, filtres et Local Legends
 * (S4.05, S4.06, S4.08) avec invariants de confidentialité P01 / S6.19.
 */

export type LeaderboardSport =
  | 'cycling'
  | 'mtb'
  | 'gravel'
  | 'running'
  | 'trail'
  | 'hiking'
  | 'ski'
  | 'swimming';

export type AthleteGender = 'men' | 'women' | 'non_binary' | 'unspecified';

export type LeaderboardTitle = 'KOM' | 'QOM' | 'CR';

export type EffortAudience = 'private' | 'friends' | 'club' | 'public';

export type AccountVisibility = 'private' | 'followers_only' | 'public';

export type ModerationStatus =
  | 'valid'
  | 'flagged'
  | 'excluded'
  | 'rejected'
  | 'reinstated';

export type LeaderboardPeriod =
  | 'all_time'
  | 'this_year'
  | 'this_month'
  | 'this_week'
  | 'today'
  | 'rolling_90d';

export type LeaderboardScope = 'global' | 'friends' | 'club';

/**
 * Filtres exposés dans le plan LKDV (S4.06).
 * Les sélecteurs âge et poids sont volontairement exclus du plan LKDV.
 */
export interface LeaderboardFilterQuery {
  period?: LeaderboardPeriod;
  scope?: LeaderboardScope;
  clubId?: string | null;
  gender?: AthleteGender | 'all';
  /**
   * Champs hérités éventuellement transmis par un ancien client :
   * systématiquement ignorés et signalés par `sanitizeLeaderboardFilters`.
   */
  ageGroup?: string;
  weightClass?: string;
}

export interface SanitizedLeaderboardFilters {
  period: LeaderboardPeriod;
  scope: LeaderboardScope;
  clubId: string | null;
  gender: AthleteGender | 'all';
  strippedUnsupportedFilters: Array<'ageGroup' | 'weightClass'>;
}

export interface LeaderboardFilterCapabilities {
  supportedFilters: ReadonlyArray<'period' | 'scope' | 'clubId' | 'gender'>;
  removedFilters: ReadonlyArray<'age' | 'weight'>;
  periods: ReadonlyArray<LeaderboardPeriod>;
  scopes: ReadonlyArray<LeaderboardScope>;
}

/**
 * Contexte du spectateur utilisé pour appliquer P01 / S6.19 en fail-closed.
 */
export interface LeaderboardViewerContext {
  viewerId: string | null;
  isAuthenticated: boolean;
  /** Utilisateurs amis / abonnés mutuellement autorisés. */
  friendIds?: ReadonlyArray<string>;
  /** Clubs dont le spectateur est membre vérifié. */
  clubIds?: ReadonlyArray<string>;
  /** Utilisateurs bloqués par le spectateur. */
  blockedUserIds?: ReadonlyArray<string>;
  /** Utilisateurs ayant bloqué le spectateur. */
  blockedByUserIds?: ReadonlyArray<string>;
  /** Utilisateurs mis en sourdine par le spectateur (S6.19). */
  mutedUserIds?: ReadonlyArray<string>;
}

/**
 * État de confidentialité d'un athlète pour un effort donné (P01 / S6.19).
 */
export interface AthletePrivacySnapshot {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  accountVisibility?: AccountVisibility;
  /** Consentement explicite à apparaître dans les classements publics. */
  leaderboardConsentGranted?: boolean;
  /** Profil masqué / suspendu / supprimé. */
  isHiddenOrSuspended?: boolean;
  /** Clubs dont l'athlète est membre vérifié. */
  clubIds?: ReadonlyArray<string>;
  /** Amis/abonnés autorisés de l'athlète. */
  friendIds?: ReadonlyArray<string>;
}

export interface SegmentDefinition {
  segmentId: string;
  sport: LeaderboardSport;
  distanceM: number;
  elevationGainM?: number | null;
  isHazardous?: boolean;
  isArchived?: boolean;
}

export interface SegmentEffortInput {
  effortId: string;
  activityId: string;
  segmentId: string;
  userId: string;
  sport: LeaderboardSport;
  /** Temps écoulé sur le segment en secondes (strictement positif). */
  elapsedTimeS: number;
  /** Temps en mouvement en secondes (<= elapsedTimeS). */
  movingTimeS?: number | null;
  /** Distance mesurée sur le segment en mètres. */
  distanceM?: number | null;
  /** Ratio de complétion du segment [0..1]. */
  completionRatio?: number | null;
  /** Date ISO-8601 de réalisation de l'effort. */
  achievedAt: string;
  /** Audience propre de l'activité/effort. */
  audience?: EffortAudience;
  /** Genre sportif pour attribution KOM/QOM/CR. */
  athleteGender?: AthleteGender;
  /** Indicateurs géométriques et anti-triche (S01/S02). */
  maxSpeedKmh?: number | null;
  averageSpeedKmh?: number | null;
  hasGpsJump?: boolean;
  offRoute?: boolean;
  uturnDetected?: boolean;
  motorizedSuspected?: boolean;
  gpsQuality?: number | null;
  moderationStatus?: ModerationStatus;
  /** Données athlète embarquées ou résolues via table de confidentialité. */
  athlete?: AthletePrivacySnapshot;
}

export type EffortRejectionReason =
  | 'segment_mismatch'
  | 'sport_mismatch'
  | 'invalid_elapsed_time'
  | 'invalid_moving_time'
  | 'incomplete_passage'
  | 'off_route'
  | 'uturn_detected'
  | 'gps_jump'
  | 'implausible_speed'
  | 'motorized_suspected'
  | 'moderation_excluded'
  | 'invalid_timestamp'
  | 'outside_period'
  | 'privacy_missing_snapshot'
  | 'privacy_unconsented'
  | 'privacy_private_account'
  | 'privacy_hidden_or_suspended'
  | 'privacy_audience_denied'
  | 'privacy_blocked'
  | 'privacy_muted'
  | 'scope_not_in_friends'
  | 'scope_not_in_club';

export interface RejectedEffortDiagnostic {
  effortId: string;
  userId: string;
  reason: EffortRejectionReason;
}

export interface SanitizedLeaderboardEntry {
  rank: number;
  isTied: boolean;
  effortId: string;
  activityId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  elapsedTimeS: number;
  movingTimeS: number | null;
  averageSpeedKmh: number | null;
  achievedAt: string;
  athleteGender: AthleteGender;
  title: LeaderboardTitle | null;
  isViewer: boolean;
}

export interface LeaderboardPaginationInput {
  limit?: number;
  cursor?: string | null;
  offset?: number;
}

export interface LeaderboardPageInfo {
  limit: number;
  offset: number;
  totalEntries: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface SegmentLeaderboardResult {
  segmentId: string;
  sport: LeaderboardSport;
  filters: SanitizedLeaderboardFilters;
  capabilities: LeaderboardFilterCapabilities;
  entries: SanitizedLeaderboardEntry[];
  page: LeaderboardPageInfo;
  viewerEntry: SanitizedLeaderboardEntry | null;
  titles: {
    kom: SanitizedLeaderboardEntry | null;
    qom: SanitizedLeaderboardEntry | null;
    cr: SanitizedLeaderboardEntry | null;
  };
  /** Nombre d'efforts rejetés pour confidentialité ou anti-triche (sans fuite d'identité). */
  rejectedCount: number;
  /** Diagnostics détaillés uniquement si demandés en mode serveur/test. */
  diagnostics?: RejectedEffortDiagnostic[];
  computedAt: string;
}

export interface LocalLegendEntry {
  rank: number;
  isTied: boolean;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  effortCount: number;
  bestElapsedTimeS: number;
  lastEffortAt: string;
  isLocalLegend: boolean;
  isViewer: boolean;
}

export interface LocalLegendResult {
  segmentId: string;
  sport: LeaderboardSport;
  windowDays: number;
  windowStartIso: string;
  windowEndIso: string;
  minEffortsForTitle: number;
  /** Règle S4.08 : afficher uniquement si donnée existe, bon sport et autorisée. */
  shouldDisplayMention: boolean;
  /** Titulaire actuel (null si égalité non tranchée ou seuil non atteint ou non autorisé). */
  legend: LocalLegendEntry | null;
  /** Tous les titulaires ex-æquo au rang 1 si égalité. */
  tiedLegends: LocalLegendEntry[];
  rankings: LocalLegendEntry[];
  viewerStanding: LocalLegendEntry | null;
  totalEligiblePassages: number;
  rejectedCount: number;
  computedAt: string;
}

export interface LeaderboardDrawerState {
  isOpen: boolean;
  segmentId: string | null;
  parentDrawerContext: string | null;
  activeTab: 'leaderboard' | 'local_legend';
  filters: SanitizedLeaderboardFilters;
  offset: number;
  limit: number;
}
