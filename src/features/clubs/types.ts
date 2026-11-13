/**
 * Lot G02 — Clubs, sorties collectives, défis, classements, salons et confidentialité.
 * Couvre les fiches : K5.21, K5.22, K5.23, S5.07, S5.10, S5.11, S5.13, S5.14, S5.15, S5.16, S5.17, S5.18, S5.19.
 *
 * Contrat TypeScript pur, sans dépendance React ni accès réseau direct.
 */

// ---------------------------------------------------------------------------
// Confidentialité P01 & Blocages S6.19 (fail-closed)
// ---------------------------------------------------------------------------

/**
 * Visibilité d'un club :
 * - `open` (alias `public`) : visible dans la recherche publique, adhésion libre.
 * - `closed` (alias `private`) : visible ou restreint selon contexte, adhésion sur validation/demande.
 * - `secret` (alias `invite_only`) : invisible hors membres, adhésion uniquement sur invitation valide.
 */
export type ClubPrivacy = 'open' | 'closed' | 'secret';
export type ClubVisibilityAlias = 'public' | 'private' | 'invite_only';

/** Niveau de confidentialité P01 d'une activité ou d'un profil. */
export type P01Visibility = 'public' | 'friends' | 'club_only' | 'private';

/** Relation de blocage S6.19 (bidirectionnelle en lecture). */
export interface S619BlockRelation {
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

/** Contexte de confidentialité du lecteur pour les contrôles fail-closed P01 / S6.19. */
export interface ViewerPrivacyContext {
  viewerId: string | null;
  /** IDs des utilisateurs amis/suivis mutuellement avec le viewer. */
  friendIds?: ReadonlySet<string> | readonly string[];
  /** Relations de blocage S6.19 connues. */
  blocks?: readonly S619BlockRelation[];
  /** IDs de clubs dont le viewer est membre actif. */
  viewerClubIds?: ReadonlySet<string> | readonly string[];
  /** Préférences de masquage P01 par utilisateur (opt-out classement / présence). */
  hiddenFromLeaderboardsUserIds?: ReadonlySet<string> | readonly string[];
}

// ---------------------------------------------------------------------------
// Rôles, adhésion & vérification (S5.10)
// ---------------------------------------------------------------------------

export type ClubRole = 'admin' | 'moderator' | 'member';

export type MembershipStatus = 'active' | 'pending' | 'removed' | 'banned';

export interface ClubMember {
  clubId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: ClubRole;
  status: MembershipStatus;
  joinedAt: string;
  mutedUntil?: string | null;
  /** Consentement P01 pour apparaître dans les classements hebdomadaires du club. */
  leaderboardOptIn?: boolean;
  /** Statut Pro sportif vérifié (S5.10). */
  isProAthlete?: boolean;
  verifiedSports?: readonly string[];
}

export interface ClubJoinRequest {
  id: string;
  clubId: string;
  userId: string;
  displayName: string;
  message: string | null;
  answers: readonly string[];
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export interface ClubAnnouncement {
  id: string;
  clubId: string;
  authorId: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
}

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'revoked';

export interface ClubVerification {
  status: VerificationStatus;
  verifiedAt: string | null;
  badgeLabel: string | null;
  eligibleSports: readonly string[];
}

export interface Club {
  id: string;
  slug: string;
  name: string;
  description: string;
  primarySport: string;
  sports: readonly string[];
  privacy: ClubPrivacy;
  zoneLabel: string | null;
  coverImage: string | null;
  rules: string | null;
  joinQuestions: readonly string[];
  verification: ClubVerification;
  createdBy: string;
  createdAt: string;
}

export interface VerificationBadgeView {
  visible: boolean;
  kind: 'club_verified' | 'pro_athlete' | null;
  label: string | null;
  sport: string | null;
}

// ---------------------------------------------------------------------------
// Salons de club & modération (S5.07)
// ---------------------------------------------------------------------------

export type ClubChannelKind = 'general' | 'announcements' | 'events' | 'custom';

export interface ClubChannel {
  id: string;
  clubId: string;
  name: string;
  kind: ClubChannelKind;
  /** Si true, seuls admin/moderator peuvent poster. */
  readOnlyForMembers: boolean;
  notificationsEnabledByDefault: boolean;
  createdBy: string;
  createdAt: string;
}

export interface ClubChannelMessage {
  id: string;
  channelId: string;
  clubId: string;
  authorId: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  hiddenByModeratorId?: string | null;
  hiddenReason?: string | null;
  deletedAt?: string | null;
}

export interface ClubContentReport {
  id: string;
  clubId: string;
  channelId: string;
  messageId: string;
  reporterId: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Événements / Sorties de club (K5.21, S5.13, S5.14, S5.15, S5.16)
// ---------------------------------------------------------------------------

export type EventFormat = 'social_ride' | 'training' | 'race' | 'trail_outing' | 'indoor';

export interface PaceGroup {
  id: string;
  label: string;
  targetPaceLabel: string;
  minSpeedKmh?: number | null;
  maxSpeedKmh?: number | null;
  leaderUserId?: string | null;
}

export interface EventFlyer {
  title: string;
  subtitle: string | null;
  dateLabel: string;
  locationLabel: string;
  sport: string;
  coHostClubNames: readonly string[];
  shareUrl: string;
  qrPayload: string;
}

export interface ClubEvent {
  id: string;
  clubId: string;
  coHostClubIds: readonly string[];
  title: string;
  description: string | null;
  sport: string;
  format: EventFormat;
  startsAt: string;
  endsAt: string | null;
  locationLabel: string;
  meetingPoint: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Visibilité propre de l'événement (bornée par celle du club). */
  visibility: P01Visibility;
  maxParticipants: number | null;
  waitlistEnabled: boolean;
  paceGroups: readonly PaceGroup[];
  /** Lien d'inscription externe/interne pour les courses (S5.16). */
  registrationUrl: string | null;
  /** Identifiant et révision courante du tracé partagé (K5.21, K5.23). */
  routeId: string | null;
  routeRevision: number;
  createdBy: string;
  createdAt: string;
}

export type EventRsvpStatus = 'registered' | 'waitlist' | 'cancelled';

export interface EventRegistration {
  eventId: string;
  userId: string;
  status: EventRsvpStatus;
  paceGroupId: string | null;
  invitedByUserId?: string | null;
  inviteId?: string | null;
  registeredAt: string;
  updatedAt: string;
}

export interface EventSearchQuery {
  text?: string;
  location?: string;
  sport?: string;
  format?: EventFormat;
  fromIso?: string;
  toIso?: string;
  racesOnly?: boolean;
}

export interface EventAttendanceRecord {
  eventId: string;
  userId: string;
  activityId: string;
  /** Consentement explicite P01 de l'utilisateur pour compter sa présence réelle. */
  consentGranted: boolean;
  activityVisibility: P01Visibility;
  matchedAt: string;
}

export interface EventAttendanceStats {
  eventId: string;
  registeredCount: number;
  waitlistCount: number;
  confirmedAttendeesCount: number;
  attendanceRate: number;
  consentedActivityIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Invitations, Liens / QR & Synchronisation de tracé (K5.21, K5.22, K5.23, S5.19)
// ---------------------------------------------------------------------------

export type InviteTargetKind = 'club' | 'event' | 'recorded_activity';

export interface InviteLink {
  id: string;
  token: string;
  kind: InviteTargetKind;
  targetId: string;
  clubId: string | null;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  maxUses: number | null;
  usesCount: number;
  revokedAt: string | null;
  qrPayload: string;
  shareUrl: string;
}

export interface RouteRevisionSnapshot {
  eventId: string;
  routeId: string;
  revision: number;
  checksum: string;
  distanceM: number;
  elevationGainM: number;
  updatedBy: string;
  updatedAt: string;
  requiresParticipantDecision: boolean;
}

export interface ParticipantRouteSyncState {
  eventId: string;
  userId: string;
  lastSyncedRevision: number;
  pendingRevision: number | null;
  decisionRequired: boolean;
  revoked: boolean;
  syncedAt: string;
}

export interface RecordedActivityInvite {
  id: string;
  activityId: string;
  ownerUserId: string;
  inviteeUserId: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  createdAt: string;
  respondedAt: string | null;
}

// ---------------------------------------------------------------------------
// Appariement automatique & Activités groupées (S5.17, S5.18)
// ---------------------------------------------------------------------------

export interface ClubActivityInput {
  id: string;
  userId: string;
  sport: string;
  isIndoor: boolean;
  startsAt: string;
  endsAt: string;
  distanceM: number;
  durationS: number;
  elevationGainM: number;
  startLat?: number | null;
  startLng?: number | null;
  visibility: P01Visibility;
  /** Consentement P01 pour appariement et présence. */
  allowEventMatching?: boolean;
  allowGroupDetection?: boolean;
}

export interface ActivityEventMatch {
  id: string;
  activityId: string;
  eventId: string;
  userId: string;
  confidenceScore: number;
  matchedAt: string;
  detachedAt: string | null;
}

export interface GroupActivityCluster {
  id: string;
  sport: string;
  isIndoor: boolean;
  startsAt: string;
  endsAt: string;
  participantUserIds: readonly string[];
  activityIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Défis individuels & de club, progression, badges
// ---------------------------------------------------------------------------

export type ChallengeScope = 'individual' | 'club';
export type ChallengeMetric = 'distance_m' | 'duration_s' | 'elevation_gain_m' | 'activities_count';

export interface ChallengeBadge {
  id: string;
  challengeId: string;
  title: string;
  icon: string;
  awardedAt: string;
}

export interface ClubChallenge {
  id: string;
  clubId: string | null;
  scope: ChallengeScope;
  title: string;
  description: string;
  sport: string | null;
  metric: ChallengeMetric;
  targetValue: number;
  startsAt: string;
  endsAt: string;
  badgeTitle: string;
  badgeIcon: string;
  createdBy: string;
}

export interface ChallengeParticipantProgress {
  challengeId: string;
  userId: string;
  currentValue: number;
  recordedActivityIds: readonly string[];
  completedAt: string | null;
  badge: ChallengeBadge | null;
}

export interface ClubChallengeSummary {
  challenge: ClubChallenge;
  totalProgressValue: number;
  progressPct: number;
  isCompleted: boolean;
  completedAt: string | null;
  participantsCount: number;
  badgeAwarded: ChallengeBadge | null;
}

// ---------------------------------------------------------------------------
// Classements hebdomadaires de club (S5.11)
// ---------------------------------------------------------------------------

export interface WeeklyClubLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalDurationS: number;
  totalDistanceM: number;
  totalElevationGainM: number;
  activitiesCount: number;
  isCurrentUser: boolean;
}

export interface WeeklyClubLeaderboard {
  clubId: string;
  sport: string | null;
  weekStartIso: string;
  weekEndIso: string;
  metric: ChallengeMetric;
  entries: readonly WeeklyClubLeaderboardEntry[];
  excludedCount: number;
}

// ---------------------------------------------------------------------------
// Résultat standard d'opération (sans exception silencieuse)
// ---------------------------------------------------------------------------

export type ClubErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'SELF_PROMOTION_FORBIDDEN'
  | 'LAST_ADMIN_PROTECTED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'CAPACITY_FULL'
  | 'INVITE_INVALID'
  | 'INVITE_EXPIRED'
  | 'INVITE_REVOKED'
  | 'INVITE_EXHAUSTED'
  | 'BLOCKED_USER'
  | 'PRIVACY_RESTRICTED'
  | 'INVALID_INPUT';

export type ClubResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ClubErrorCode; message: string };
