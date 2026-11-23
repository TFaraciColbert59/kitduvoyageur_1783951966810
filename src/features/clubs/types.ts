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

export type ClubRole = 'founder' | 'admin' | 'moderator' | 'volunteer' | 'member';

export const CLUB_ROLE_RANK: Record<ClubRole, number> = {
  member: 1,
  volunteer: 2,
  moderator: 3,
  admin: 4,
  founder: 5,
};

export const CLUB_ROLE_LABELS: Record<ClubRole, string> = {
  founder: 'Fondateur',
  admin: 'Administrateur',
  moderator: 'Modérateur',
  volunteer: 'Bénévole',
  member: 'Membre',
};

export const CLUB_CAPABILITIES = [
  'club.edit_settings',
  'club.manage_billing_settings',
  'club.transfer_ownership',
  'club.delete',
  'members.manage_roles',
  'permissions.delegate',
  'members.view_audit_log',
  'members.review_requests',
  'members.manage_invites',
  'salons.moderate_messages',
  'moderation.resolve_reports',
  'members.mute',
  'members.ban_or_kick',
  'highlights.moderate',
  'salons.create',
  'salons.edit_settings',
  'salons.archive_or_delete',
  'salons.post_announcements',
  'salons.post',
  'events.create_official',
  'events.edit_or_cancel_any',
  'events.manage_routes',
  'collections.curate_routes',
  'events.manage_registrations',
  'volunteers.manage_shifts',
  'challenges.manage',
  'gear.manage_club_inventory',
  'gear.manage_standard_kits',
  'gear.approve_club_loans',
  'budget.view',
  'budget.propose_expense',
  'budget.approve_and_manage',
  'stories.publish_club',
  'stories.manage_highlights',
  'feed.post',
] as const;

export type ClubCapability = (typeof CLUB_CAPABILITIES)[number];

export type ClubCapabilityDomain =
  | 'governance'
  | 'sovereignty'
  | 'team'
  | 'membership'
  | 'moderation'
  | 'salons'
  | 'events'
  | 'volunteers'
  | 'challenges'
  | 'gear'
  | 'budget'
  | 'communication';

export interface ClubCapabilityMeta {
  key: ClubCapability;
  domain: ClubCapabilityDomain;
  domainLabel: string;
  label: string;
  founderOnly?: boolean;
  /** True si cette capacité ouvre au moins un écran/action de l'espace Admin. */
  isAdminCapability: boolean;
}

export const CLUB_CAPABILITY_CATALOG: readonly ClubCapabilityMeta[] = [
  // Gouvernance
  { key: 'club.edit_settings', domain: 'governance', domainLabel: 'Gouvernance', label: 'Modifier identité, bio, visibilité & charte', isAdminCapability: true },
  { key: 'club.manage_billing_settings', domain: 'governance', domainLabel: 'Gouvernance', label: 'Paramètres financiers & mentions club', isAdminCapability: true },
  // Souveraineté
  { key: 'club.transfer_ownership', domain: 'sovereignty', domainLabel: 'Souveraineté', label: 'Transférer le statut Fondateur', founderOnly: true, isAdminCapability: true },
  { key: 'club.delete', domain: 'sovereignty', domainLabel: 'Souveraineté', label: 'Supprimer définitivement le club', founderOnly: true, isAdminCapability: true },
  // Équipe & Droits
  { key: 'members.manage_roles', domain: 'team', domainLabel: 'Équipe & Droits', label: 'Changer le grade des rangs inférieurs', isAdminCapability: true },
  { key: 'permissions.delegate', domain: 'team', domainLabel: 'Équipe & Droits', label: 'Activer/désactiver les droits des rangs inférieurs', isAdminCapability: true },
  { key: 'members.view_audit_log', domain: 'team', domainLabel: 'Équipe & Droits', label: 'Consulter le journal d’audit sécurité', isAdminCapability: true },
  // Adhésions
  { key: 'members.review_requests', domain: 'membership', domainLabel: 'Adhésions', label: 'Accepter / refuser les demandes d’adhésion', isAdminCapability: true },
  { key: 'members.manage_invites', domain: 'membership', domainLabel: 'Adhésions', label: 'Créer / révoquer les liens & QR d’invitation', isAdminCapability: true },
  // Modération
  { key: 'salons.moderate_messages', domain: 'moderation', domainLabel: 'Modération', label: 'Masquer / supprimer un message dans un salon', isAdminCapability: true },
  { key: 'moderation.resolve_reports', domain: 'moderation', domainLabel: 'Modération', label: 'Traiter la file des signalements', isAdminCapability: true },
  { key: 'members.mute', domain: 'moderation', domainLabel: 'Modération', label: 'Mettre en sourdine un membre (rangs inférieurs)', isAdminCapability: true },
  { key: 'members.ban_or_kick', domain: 'moderation', domainLabel: 'Modération', label: 'Expulser / bannir un membre (rangs inférieurs)', isAdminCapability: true },
  { key: 'highlights.moderate', domain: 'moderation', domainLabel: 'Modération', label: 'Modérer les publications du fil club', isAdminCapability: true },
  // Salons
  { key: 'salons.create', domain: 'salons', domainLabel: 'Salons', label: 'Créer un salon (public ou restreint par rôle)', isAdminCapability: true },
  { key: 'salons.edit_settings', domain: 'salons', domainLabel: 'Salons', label: 'Renommer, ordonner, régler lecture seule / rôle min', isAdminCapability: true },
  { key: 'salons.archive_or_delete', domain: 'salons', domainLabel: 'Salons', label: 'Archiver ou supprimer un salon', isAdminCapability: true },
  { key: 'salons.post_announcements', domain: 'salons', domainLabel: 'Salons', label: 'Publier dans les salons en lecture seule / annonces', isAdminCapability: true },
  { key: 'salons.post', domain: 'salons', domainLabel: 'Salons', label: 'Écrire dans les salons ouverts', isAdminCapability: false },
  // Sorties & Events
  { key: 'events.create_official', domain: 'events', domainLabel: 'Sorties & Events', label: 'Créer une sortie officielle ou un grand événement', isAdminCapability: true },
  { key: 'events.edit_or_cancel_any', domain: 'events', domainLabel: 'Sorties & Events', label: 'Modifier ou annuler toute sortie du club', isAdminCapability: true },
  { key: 'events.manage_routes', domain: 'events', domainLabel: 'Sorties & Events', label: 'Associer / éditer les traces GPX & parcours', isAdminCapability: true },
  { key: 'collections.curate_routes', domain: 'events', domainLabel: 'Sorties & Events', label: 'Organiser les collections d’itinéraires du club', isAdminCapability: true },
  // Orga Grands Events
  { key: 'events.manage_registrations', domain: 'volunteers', domainLabel: 'Orga Grands Events', label: 'Gérer inscrits, liste d’attente, sas & check-in jour J', isAdminCapability: true },
  { key: 'volunteers.manage_shifts', domain: 'volunteers', domainLabel: 'Orga Grands Events', label: 'Créer postes/créneaux bénévoles & affecter l’équipe', isAdminCapability: true },
  // Défis
  { key: 'challenges.manage', domain: 'challenges', domainLabel: 'Défis', label: 'Créer, éditer et clôturer les défis du club', isAdminCapability: true },
  // Matériel & Prêts
  { key: 'gear.manage_club_inventory', domain: 'gear', domainLabel: 'Matériel & Prêts', label: 'Ajouter / éditer le stock matériel & alertes EPI', isAdminCapability: true },
  { key: 'gear.manage_standard_kits', domain: 'gear', domainLabel: 'Matériel & Prêts', label: 'Créer / modifier les kits types officiels du club', isAdminCapability: true },
  { key: 'gear.approve_club_loans', domain: 'gear', domainLabel: 'Matériel & Prêts', label: 'Valider, remettre et réceptionner les prêts matériel', isAdminCapability: true },
  // Budget
  { key: 'budget.view', domain: 'budget', domainLabel: 'Budget', label: 'Consulter les budgets (global & par événement)', isAdminCapability: true },
  { key: 'budget.propose_expense', domain: 'budget', domainLabel: 'Budget', label: 'Saisir une dépense / devis / recette à valider', isAdminCapability: true },
  { key: 'budget.approve_and_manage', domain: 'budget', domainLabel: 'Budget', label: 'Valider, marquer payé, rejeter & exporter CSV', isAdminCapability: true },
  // Communication
  { key: 'stories.publish_club', domain: 'communication', domainLabel: 'Communication', label: 'Publier une story au nom du club', isAdminCapability: true },
  { key: 'stories.manage_highlights', domain: 'communication', domainLabel: 'Communication', label: 'Gérer les stories à la une & le fil club', isAdminCapability: true },
] as const;

const ADMIN_CAPABILITY_SET = new Set<ClubCapability>(
  CLUB_CAPABILITY_CATALOG.filter((c) => c.isAdminCapability).map((c) => c.key),
);

export function isAdminCapability(cap: ClubCapability): boolean {
  return ADMIN_CAPABILITY_SET.has(cap);
}

export const CLUB_DEFAULT_ROLE_CAPABILITIES: Record<ClubRole, readonly ClubCapability[]> = {
  founder: CLUB_CAPABILITIES,
  admin: CLUB_CAPABILITIES.filter(
    (c) => c !== 'club.delete' && c !== 'club.transfer_ownership',
  ),
  moderator: [
    'members.review_requests',
    'members.manage_invites',
    'salons.moderate_messages',
    'moderation.resolve_reports',
    'members.mute',
    'members.ban_or_kick',
    'highlights.moderate',
    'salons.post_announcements',
    'salons.post',
    'stories.publish_club',
    'stories.manage_highlights',
    'feed.post',
  ],
  volunteer: [
    'salons.post',
    'feed.post',
    'events.manage_registrations',
    'volunteers.manage_shifts',
    'gear.manage_club_inventory',
    'gear.manage_standard_kits',
    'gear.approve_club_loans',
    'budget.view',
    'budget.propose_expense',
  ],
  member: ['salons.post', 'feed.post'],
};

export interface ClubRoleCapabilityPolicy {
  clubId: string;
  role: Exclude<ClubRole, 'founder'>;
  capability: ClubCapability;
  allowed: boolean;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export interface ClubMemberCapabilityOverride {
  clubId: string;
  userId: string;
  capability: ClubCapability;
  allowed: boolean;
  grantedBy?: string | null;
  updatedAt?: string | null;
}

/**
 * Résolution pure 3 niveaux identique à public.club_has_capability() en SQL :
 * founder => toujours true ; sinon override > club_role_policy > global_default.
 */
export function resolveClubCapabilities(params: {
  role: ClubRole | null | undefined;
  rolePolicies?: readonly Pick<ClubRoleCapabilityPolicy, 'role' | 'capability' | 'allowed'>[];
  memberOverrides?: readonly Pick<ClubMemberCapabilityOverride, 'capability' | 'allowed'>[];
}): ClubCapability[] {
  const { role, rolePolicies = [], memberOverrides = [] } = params;
  if (!role) return [];
  if (role === 'founder') return [...CLUB_CAPABILITIES];

  const defaults = new Set<ClubCapability>(CLUB_DEFAULT_ROLE_CAPABILITIES[role] ?? []);
  const policyMap = new Map<ClubCapability, boolean>();
  for (const p of rolePolicies) {
    if (p.role === role) policyMap.set(p.capability, p.allowed);
  }
  const overrideMap = new Map<ClubCapability, boolean>();
  for (const o of memberOverrides) {
    overrideMap.set(o.capability, o.allowed);
  }

  return CLUB_CAPABILITIES.filter((cap) => {
    if (overrideMap.has(cap)) return Boolean(overrideMap.get(cap));
    if (policyMap.has(cap)) return Boolean(policyMap.get(cap));
    return defaults.has(cap);
  });
}

export interface ClubAuditEntry {
  id: string;
  clubId: string;
  actorId: string | null;
  targetUserId: string | null;
  targetRole?: ClubRole | null;
  action: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  createdAt: string;
}

export type ClubVolunteerAssignmentStatus = 'assigned' | 'confirmed' | 'checked_in' | 'declined';

export interface ClubVolunteerShift {
  id: string;
  clubId: string;
  eventId: string;
  title: string;
  zoneLabel: string | null;
  startsAt: string | null;
  endsAt: string | null;
  capacity: number;
  instructions: string | null;
  createdBy: string | null;
  createdAt: string;
  assignments?: readonly ClubVolunteerAssignment[];
}

export interface ClubVolunteerAssignment {
  id: string;
  shiftId: string;
  clubId: string;
  userId: string;
  status: ClubVolunteerAssignmentStatus;
  checkedInAt: string | null;
  assignedBy: string | null;
  notes: string | null;
  createdAt: string;
}

export type ClubBudgetKind = 'income' | 'expense';
export type ClubBudgetStatus = 'proposed' | 'approved' | 'paid' | 'rejected';

export interface ClubBudgetEntry {
  id: string;
  clubId: string;
  eventId: string | null;
  kind: ClubBudgetKind;
  category: string;
  label: string;
  amountCents: number;
  status: ClubBudgetStatus;
  notes: string | null;
  receiptUrl: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  /** Droit granulaire de création / gestion des stories à la une du club. */
  canManageStories?: boolean;
  /** Droit granulaire de gestion du parc matériel & validation des prêts club. */
  canManageGear?: boolean;
  /** Badge terrain cumulable : Encadrant / Guide certifié du club. */
  isCertifiedLeader?: boolean;
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
  description?: string | null;
  /** Rôle minimum requis pour voir et accéder au salon (défaut: 'member'). */
  minRole?: ClubRole;
  /** Si true, seuls les détenteurs de salons.post_announcements peuvent poster. */
  readOnlyForMembers: boolean;
  notificationsEnabledByDefault: boolean;
  position?: number;
  archivedAt?: string | null;
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
  cancelledAt?: string | null;
  locationLabel: string;
  meetingPoint: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Visibilité propre de l'événement (bornée par celle du club). */
  visibility: P01Visibility;
  maxParticipants: number | null;
  registeredCount?: number | null;
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
  elevationGainM: number | null;
  canonicalRevisionId?: string | null;
  routeName?: string | null;
  meetingPoint?: string | null;
  updatedBy: string;
  updatedAt: string;
  requiresParticipantDecision: boolean;
}

export interface ParticipantRouteSyncState {
  eventId: string;
  userId: string;
  lastSyncedRevision: number;
  adoptedRevision?: number | null;
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
