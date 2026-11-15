import {
  normalizeClubPrivacy,
  type ChallengeMetric,
  type ChallengeParticipantProgress,
  type Club,
  type ClubChallenge,
  type ClubChannel,
  type ClubChannelKind,
  type ClubChannelMessage,
  type ClubEvent,
  type ClubMember,
  type ClubPrivacy,
  type ClubRole,
  type EventFormat,
  type EventRegistration,
  type InviteLink,
  type InviteTargetKind,
  type MembershipStatus,
  type P01Visibility,
  type PaceGroup,
  type ParticipantRouteSyncState,
  type RouteRevisionSnapshot,
} from '@/features/clubs';
import type { PublicProfile } from '@/lib/queries/publicProfilesCore';

export type Row = Record<string, unknown>;

export function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function asStringArray(value: unknown): string[] {
  return asArray(value).filter((entry): entry is string => typeof entry === 'string');
}

export function iso(value: unknown, fallback = new Date(0).toISOString()): string {
  const raw = asString(value);
  if (!raw) return fallback;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

const ROLES: readonly ClubRole[] = ['admin', 'moderator', 'member'];
const MEMBERSHIP_STATUSES: readonly MembershipStatus[] = ['active', 'pending', 'removed', 'banned'];

export function mapClubRole(value: unknown): ClubRole {
  return ROLES.includes(value as ClubRole) ? (value as ClubRole) : 'member';
}

export function mapMembershipStatus(value: unknown): MembershipStatus {
  return MEMBERSHIP_STATUSES.includes(value as MembershipStatus)
    ? (value as MembershipStatus)
    : 'pending';
}

export function mapClubRow(row: Row): Club {
  const sports = asStringArray(row.sports);
  const primarySport =
    asString(row.primary_sport) ?? asString(row.category) ?? asString(row.type) ?? 'multi';
  const verificationStatus = asString(row.verification_status);
  const verified = verificationStatus === 'verified' || asBoolean(row.is_verified);
  const eligibleSports = asStringArray(row.verification_sports);
  return {
    id: String(row.id ?? ''),
    slug: asString(row.slug) ?? String(row.id ?? ''),
    name: asString(row.name) ?? 'Club',
    description: asString(row.description) ?? '',
    primarySport,
    sports: sports.length > 0 ? sports : [primarySport],
    privacy: normalizeClubPrivacy((asString(row.privacy) as ClubPrivacy | null) ?? 'secret'),
    zoneLabel: asString(row.location_label),
    coverImage: asString(row.cover_image),
    rules: asString(row.rules),
    joinQuestions: asStringArray(row.join_questions),
    verification: {
      status: verified ? 'verified' : verificationStatus === 'pending' ? 'pending' : verificationStatus === 'revoked' ? 'revoked' : 'unverified',
      verifiedAt: asString(row.verified_at) ? iso(row.verified_at) : null,
      badgeLabel: asString(row.verification_badge_label),
      eligibleSports: eligibleSports.length > 0 ? eligibleSports : verified ? [primarySport] : [],
    },
    createdBy: asString(row.created_by) ?? '',
    createdAt: iso(row.created_at),
  };
}

export function mapMemberRow(row: Row, profile?: PublicProfile): ClubMember {
  return {
    clubId: String(row.club_id ?? ''),
    userId: String(row.user_id ?? ''),
    displayName: profile?.full_name ?? asString(row.display_name) ?? 'Membre',
    avatarUrl: profile?.avatar_url ?? asString(row.avatar_url),
    role: mapClubRole(row.role),
    status: mapMembershipStatus(row.status),
    joinedAt: iso(row.joined_at),
    mutedUntil: asString(row.muted_until) ? iso(row.muted_until) : null,
    leaderboardOptIn: row.leaderboard_opt_in === false ? false : true,
    isProAthlete: asBoolean(row.is_pro_athlete),
    verifiedSports: asStringArray(row.verified_sports),
  };
}

const EVENT_FORMATS: readonly EventFormat[] = ['social_ride', 'training', 'race', 'trail_outing', 'indoor'];
const EVENT_VISIBILITIES: readonly P01Visibility[] = ['public', 'friends', 'club_only', 'private'];

function mapEventFormat(value: unknown): EventFormat {
  return EVENT_FORMATS.includes(value as EventFormat) ? (value as EventFormat) : 'trail_outing';
}

function mapEventVisibility(value: unknown): P01Visibility {
  return EVENT_VISIBILITIES.includes(value as P01Visibility) ? (value as P01Visibility) : 'club_only';
}

function mapPaceGroups(value: unknown): PaceGroup[] {
  return asArray<Row>(value)
    .map((group, index) => ({
      id: asString(group.id) ?? `pg_${index + 1}`,
      label: asString(group.label) ?? `Groupe ${index + 1}`,
      targetPaceLabel: asString(group.target_pace_label) ?? asString(group.targetPaceLabel) ?? 'Libre',
      minSpeedKmh: asNumber(group.min_speed_kmh) ?? asNumber(group.minSpeedKmh),
      maxSpeedKmh: asNumber(group.max_speed_kmh) ?? asNumber(group.maxSpeedKmh),
      leaderUserId: asString(group.leader_user_id) ?? asString(group.leaderUserId),
    }));
}

export function mapEventRow(row: Row): ClubEvent {
  const startsAt = iso(row.starts_at ?? row.event_date);
  const maxParticipants = asNumber(row.max_participants);
  return {
    id: String(row.id ?? ''),
    clubId: String(row.club_id ?? ''),
    coHostClubIds: asStringArray(row.co_host_club_ids),
    title: asString(row.title) ?? 'Sortie',
    description: asString(row.description),
    sport: asString(row.sport) ?? 'multi',
    format: mapEventFormat(row.format),
    startsAt,
    endsAt: asString(row.ends_at) ? iso(row.ends_at) : null,
    locationLabel: asString(row.location) ?? 'Lieu à préciser',
    meetingPoint: asString(row.meeting_point),
    lat: asNumber(row.lat),
    lng: asNumber(row.lng),
    visibility: mapEventVisibility(row.visibility),
    maxParticipants: maxParticipants !== null && maxParticipants > 0 ? maxParticipants : null,
    waitlistEnabled: asBoolean(row.waitlist_enabled, true),
    paceGroups: mapPaceGroups(row.pace_groups),
    registrationUrl: asString(row.registration_url),
    routeId: asString(row.route_id),
    routeRevision: asNumber(row.route_revision) ?? 0,
    createdBy: asString(row.organizer_id) ?? asString(row.created_by) ?? '',
    createdAt: iso(row.created_at),
  };
}

export function mapRegistrationRow(row: Row): EventRegistration {
  const status = asString(row.status);
  return {
    eventId: String(row.event_id ?? ''),
    userId: String(row.user_id ?? ''),
    status: status === 'waitlist' ? 'waitlist' : status === 'cancelled' ? 'cancelled' : 'registered',
    paceGroupId: asString(row.pace_group_id),
    invitedByUserId: asString(row.invited_by_user_id),
    inviteId: asString(row.invite_id),
    registeredAt: iso(row.registered_at),
    updatedAt: iso(row.updated_at ?? row.registered_at),
  };
}

export function mapChannelRow(row: Row): ClubChannel {
  const kind = asString(row.kind);
  const safeKind: ClubChannelKind =
    kind === 'announcements' || kind === 'events' || kind === 'custom' ? kind : 'general';
  return {
    id: String(row.id ?? ''),
    clubId: String(row.club_id ?? ''),
    name: asString(row.name) ?? 'Salon',
    kind: safeKind,
    readOnlyForMembers: asBoolean(row.read_only_for_members, safeKind === 'announcements'),
    notificationsEnabledByDefault: asBoolean(row.notifications_enabled_by_default, true),
    createdBy: asString(row.created_by) ?? '',
    createdAt: iso(row.created_at),
  };
}

export function mapMessageRow(row: Row): ClubChannelMessage {
  return {
    id: String(row.id ?? ''),
    channelId: String(row.channel_id ?? ''),
    clubId: String(row.club_id ?? ''),
    authorId: String(row.author_id ?? ''),
    body: asString(row.body) ?? '',
    createdAt: iso(row.created_at),
    editedAt: asString(row.edited_at) ? iso(row.edited_at) : null,
    hiddenByModeratorId: asString(row.hidden_by_moderator_id),
    hiddenReason: asString(row.hidden_reason),
    deletedAt: asString(row.deleted_at) ? iso(row.deleted_at) : null,
  };
}

const METRICS: readonly ChallengeMetric[] = [
  'distance_m',
  'duration_s',
  'elevation_gain_m',
  'activities_count',
];

function mapMetric(value: unknown): ChallengeMetric {
  return METRICS.includes(value as ChallengeMetric) ? (value as ChallengeMetric) : 'activities_count';
}

export function mapChallengeRow(row: Row): ClubChallenge {
  return {
    id: String(row.id ?? ''),
    clubId: asString(row.club_id),
    scope: row.scope === 'club' ? 'club' : 'individual',
    title: asString(row.title) ?? 'Défi',
    description: asString(row.description) ?? '',
    sport: asString(row.sport),
    metric: mapMetric(row.metric),
    targetValue: asNumber(row.target_value) ?? asNumber(row.xp) ?? 0,
    startsAt: iso(row.starts_at ?? row.start_date ?? row.created_at),
    endsAt: iso(row.ends_at ?? row.end_date ?? row.deadline),
    badgeTitle: asString(row.badge_title) ?? 'Badge du défi',
    badgeIcon: asString(row.badge_icon) ?? '🏅',
    createdBy: asString(row.created_by) ?? '',
  };
}

export function mapProgressRow(row: Row): ChallengeParticipantProgress {
  const badgeId = asString(row.badge_id);
  const challengeId = String(row.challenge_id ?? '');
  return {
    challengeId,
    userId: String(row.user_id ?? ''),
    currentValue: asNumber(row.current_value) ?? 0,
    recordedActivityIds: asStringArray(row.recorded_activity_ids),
    completedAt: asString(row.completed_at) ? iso(row.completed_at) : null,
    badge: badgeId
      ? {
          id: badgeId,
          challengeId,
          title: asString(row.badge_title) ?? 'Badge du défi',
          icon: asString(row.badge_icon) ?? '🏅',
          awardedAt: iso(row.badge_awarded_at ?? row.completed_at),
        }
      : null,
  };
}

export function mapInviteRow(row: Row): InviteLink {
  const kind = asString(row.kind);
  const safeKind: InviteTargetKind =
    kind === 'event' || kind === 'recorded_activity' ? kind : 'club';
  return {
    id: String(row.id ?? ''),
    token: String(row.token ?? ''),
    kind: safeKind,
    targetId: String(row.target_id ?? ''),
    clubId: asString(row.club_id),
    createdBy: asString(row.created_by) ?? '',
    createdAt: iso(row.created_at),
    expiresAt: asString(row.expires_at) ? iso(row.expires_at) : null,
    maxUses: asNumber(row.max_uses),
    usesCount: asNumber(row.uses_count) ?? 0,
    revokedAt: asString(row.revoked_at) ? iso(row.revoked_at) : null,
    shareUrl: asString(row.share_url) ?? '',
    qrPayload: asString(row.qr_payload) ?? '',
  };
}

export function mapRouteSnapshot(row: Row): RouteRevisionSnapshot {
  return {
    eventId: String(row.event_id ?? ''),
    routeId: String(row.route_id ?? ''),
    revision: asNumber(row.revision) ?? 0,
    checksum: String(row.checksum ?? ''),
    distanceM: asNumber(row.distance_m) ?? 0,
    elevationGainM: asNumber(row.elevation_gain_m) ?? 0,
    updatedBy: String(row.updated_by ?? ''),
    updatedAt: iso(row.updated_at),
    requiresParticipantDecision: asBoolean(row.requires_participant_decision),
  };
}

export function mapRouteSyncRow(row: Row): ParticipantRouteSyncState {
  return {
    eventId: String(row.event_id ?? ''),
    userId: String(row.user_id ?? ''),
    lastSyncedRevision: asNumber(row.last_synced_revision) ?? 0,
    pendingRevision: asNumber(row.pending_revision),
    decisionRequired: asBoolean(row.decision_required),
    revoked: asBoolean(row.revoked),
    syncedAt: iso(row.synced_at),
  };
}

export function mapJoinRequestRow(row: Row): import('@/features/clubs').ClubJoinRequest {
  const status = asString(row.status);
  return {
    id: String(row.id ?? ''),
    clubId: String(row.club_id ?? ''),
    userId: String(row.user_id ?? ''),
    displayName: asString(row.display_name) ?? 'Candidat',
    message: asString(row.message),
    answers: asStringArray(row.answers),
    status:
      status === 'approved' || status === 'rejected' || status === 'cancelled'
        ? status
        : 'pending',
    createdAt: iso(row.created_at),
    reviewedBy: asString(row.reviewed_by),
    reviewedAt: asString(row.reviewed_at) ? iso(row.reviewed_at) : null,
  };
}
