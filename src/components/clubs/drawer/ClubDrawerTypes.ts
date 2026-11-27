import type { ClubCapability, ClubRole, MembershipStatus } from '@/features/clubs/types';
import type { ClubG02Section } from '../g02/ClubG02Screen';
import type { ClubFeedPostItem } from '../feed/ClubInlineFeed';
import type { ClubMapPokedexItem } from '../map/clubMapTypes';

export type ClubVisibility = 'public' | 'prive' | 'secret';

export interface ClubPoleItem {
  id: string;
  name: string;
  specialty: string;
}

export interface ClubItemData {
  id: string;
  slug: string;
  name: string;
  massif: string;
  category: string;
  level: string;
  membersCount: number;
  outingsCount: number;
  salonsCount?: number;
  totalKm: number;
  totalDplus: number;
  joined: boolean;
  role: string;
  visibility: ClubVisibility;
  bio: string;
  charter: string;
  nextOutingTitle: string;
  nextOutingDate: string;
  weatherIso: string;
  weatherWind: string;
  weatherTrail: string;
  lat: number;
  lng: number;
  coverUrl?: string;
  viewerRole?: ClubRole | null;
  viewerCapabilities?: ClubCapability[];
  viewerCanManageStories?: boolean;
  viewerCanManageGear?: boolean;
  membershipStatus?: MembershipStatus | null;
  pendingRequestsCount?: number;
  isVerified?: boolean;
  verifiedSports?: string[];
  memberAvatars?: Array<{ name: string; avatarUrl?: string }>;
  hasLiveOrImminentOuting?: boolean;
  lastActivityAt?: string;
  createdBy?: string | null;
  poles?: ClubPoleItem[];
}

export type ClubMemberRoleLabel =
  | 'Fondateur'
  | 'Guide & Sécurité'
  | 'Encadrant'
  | 'Bénévole'
  | 'Membre actif'
  | 'Nouveau';

export interface ClubMemberData {
  id: string;
  userId?: string;
  name: string;
  handle: string;
  role: ClubMemberRoleLabel;
  rawRole?: ClubRole;
  level?: string;
  massif: string;
  skills: string[];
  availableWeekend?: boolean;
  availableDays?: Array<'sam' | 'dim'>;
  seekingObjective?: string;
  carpoolCity?: string;
  carpoolSeats?: number;
  followed?: boolean;
  isNew7d?: boolean;
  joinedAt?: string;
  mutedUntil?: string | null;
  isProAthlete?: boolean;
  verifiedSports?: string[];
  outingsCount?: number;
  distanceKm?: number;
  dplusM?: number;
  hours?: number;
  postsCount?: number;
  gearCount?: number;
  shareClubLocation?: boolean;
  lastLat?: number | null;
  lastLng?: number | null;
  avatarUrl?: string;
  canManageStories?: boolean;
  canManageGear?: boolean;
  isCertifiedLeader?: boolean;
}

export type ClubOutingStatus = 'upcoming' | 'live' | 'completed' | 'cancelled';

export interface ClubOutingPaceGroup {
  id: string;
  label: string;
  speedLabel?: string | null;
  capacity?: number | null;
}

export interface ClubOutingTransportBooking {
  id: string;
  transportId: string;
  userId: string;
  userName: string;
  userHandle: string;
  userAvatarUrl: string | null;
  leg: 'aller_retour' | 'aller' | 'retour';
  pickupNote?: string | null;
  hasBulkyGear: boolean;
}

export interface ClubOutingTransportItem {
  id: string;
  eventId: string;
  clubId: string;
  organizerId: string;
  organizerName: string;
  organizerHandle: string;
  organizerAvatarUrl: string | null;
  direction: 'aller_retour' | 'aller' | 'retour';
  mode: 'carpool' | 'minibus_club' | 'train' | 'bus' | 'bike' | 'foot';
  outboundFromLabel: string;
  outboundFromLat?: number | null;
  outboundFromLng?: number | null;
  outboundDepartureAt?: string | null;
  outboundToLabel?: string | null;
  returnFromLabel?: string | null;
  returnFromLat?: number | null;
  returnFromLng?: number | null;
  returnDepartureAt?: string | null;
  returnToLabel?: string | null;
  seatsTotal: number;
  seatsLeftAller: number;
  seatsLeftRetour: number;
  gearNotes?: string | null;
  costShareCents: number;
  notes?: string | null;
  bookings: ClubOutingTransportBooking[];
  myBookingLeg: 'aller_retour' | 'aller' | 'retour' | null;
}

export interface ClubOutingData {
  id: string;
  clubId: string;
  title: string;
  description?: string | null;
  date: string;
  startsAtIso?: string;
  endsAtIso?: string | null;
  dateLabel?: string;
  massif: string;
  meetingPoint?: string | null;
  sport?: string | null;
  level?: string | null;
  km: number;
  dplus: number;
  dminus?: number;
  maxAlt: number;
  durationLabel?: string | null;
  status: ClubOutingStatus;
  organizerId?: string | null;
  leaderName: string;
  leaderHandle: string;
  leaderAvatarUrl?: string | null;
  participantsCount: number;
  maxParticipants: number;
  waitlistEnabled?: boolean;
  waitlistCount?: number;
  paceGroups?: ClubOutingPaceGroup[];
  rsvpJoined: boolean;
  carpoolCity: string;
  carpoolSeatsLeft: number;
  requiredGear: string[];
  safetyChecklist?: string[] | null;
  safetyNotes?: string | null;
  kitId?: string | null;
  standardKitId?: string | null;
  lat: number;
  lng: number;
  routeTrace?: Array<[number, number] | [number, number, number]> | null;
  coverUrl?: string;
  weatherSummary?: string;
}

export interface ClubGearVaultItem {
  id: string;
  clubId: string;
  ownershipScope?: 'club' | 'member';
  name: string;
  brand: string;
  category: string;
  weightG: number;
  ownerName: string;
  ownerHandle: string;
  available: boolean;
  quantityTotal?: number;
  quantityAvailable?: number;
  conditionStatus?: 'new' | 'good' | 'worn' | 'repair';
  depositCents?: number;
  isEpi?: boolean;
  epiExpiresAt?: string | null;
  reservedByMe?: boolean;
  imageUrl?: string;
  condition?: string;
  loanId?: string;
  loanStatus?:
    | 'requested'
    | 'approved'
    | 'checked_out'
    | 'returned'
    | 'overdue'
    | 'issue'
    | 'declined'
    | 'cancelled';
  eventId?: string | null;
  neededFrom?: string | null;
  neededUntil?: string | null;
  borrowerName?: string;
}

export interface ClubStandardKitItem {
  name: string;
  category?: string;
  weightG?: number;
  quantity?: number;
  carryMode?: 'worn' | 'pack' | 'consumable';
  mandatory?: boolean;
}

export interface ClubStandardKit {
  id: string;
  title: string;
  season: string;
  totalWeightG: number;
  itemsCount: number;
  items: string[];
  detailedItems?: ClubStandardKitItem[];
  cloned?: boolean;
}

export interface ClubChallengeItem {
  id: string;
  title: string;
  subtitle: string;
  current: number;
  target: number;
  unit: string;
  rewardBadge: string;
}

export interface ClubChatMessage {
  id: string;
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  authorId?: string;
  channelId?: string;
  roleBadge?: string;
  text: string;
  time: string;
}

export interface ClubDrawerIntent {
  nonce: number;
  tab?: number;
  subTab?: number;
  outingId?: string;
  memberId?: string;
  kitId?: string;
  pokedexId?: string;
  initialSection?: ClubG02Section;
  searchQuery?: string;
}

export interface ClubToastPayload {
  title: string;
  subtitle?: string;
  undo?: () => void;
}

export type ClubRuntimeOverlayKind =
  | 'seal'
  | 'display'
  | 'map_layers'
  | 'peek'
  | 'story'
  | 'post_modal'
  | 'quick_circle'
  | 'create_group'
  | 'club_switcher'
  | 'club_search';

export interface ClubRuntimeOverlayState {
  kind: ClubRuntimeOverlayKind;
  payload?: Record<string, unknown>;
}

export interface ClubDrawerData {
  activeClub: ClubItemData;
  clubs: ClubItemData[];
  members: ClubMemberData[];
  outings: ClubOutingData[];
  vaultGear: ClubGearVaultItem[];
  standardKits: ClubStandardKit[];
  pokedexItems?: ClubMapPokedexItem[];
  onPokedexObservationCreated?: (item: ClubMapPokedexItem) => void;
  challenges: ClubChallengeItem[];
  chatMessages: ClubChatMessage[];
  posts: ClubFeedPostItem[];
  currentUserId?: string | null;
}

export interface ClubDrawerNavOptions {
  inspectOuting?: ClubOutingData;
  inspectMember?: ClubMemberData;
  chatDraft?: string;
  g02Section?: ClubG02Section;
  highlightGearId?: string;
  createClubMassif?: string;
}

export type ClubDrawerNavHandler = (
  tab: number,
  lens?: number,
  options?: ClubDrawerNavOptions,
) => void;

export interface ClubDrawerHostProps {
  mode: 'main' | 'create';
  isOpen?: boolean;
  initialTab?: number;
  initialSubTab?: number;
  initialSearch?: boolean;
  initialOutingId?: string;
  initialMemberId?: string;
  initialSection?: ClubG02Section;
  intent?: ClubDrawerIntent | null;
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  onRetrySync?: () => void;
  currentUserId?: string | null;
  currentUserHandle?: string | null;
  blockedUserIds?: ReadonlySet<string> | readonly string[];
  isOutdoor?: boolean;
  reduceMotion?: boolean;
  activeClub: ClubItemData;
  clubs: ClubItemData[];
  members: ClubMemberData[];
  outings: ClubOutingData[];
  vaultGear: ClubGearVaultItem[];
  standardKits: ClubStandardKit[];
  pokedexItems?: ClubMapPokedexItem[];
  onPokedexObservationCreated?: (item: ClubMapPokedexItem) => void;
  challenges: ClubChallengeItem[];
  chatMessages: ClubChatMessage[];
  posts: ClubFeedPostItem[];
  onSelectClub: (clubId: string) => void;
  onToggleJoinClub: (clubId: string, options?: { message?: string }) => Promise<boolean> | void;
  onToggleFollowMember: (handleOrMemberId: string) => Promise<void> | void;
  onProposeBinome?: (
    member: ClubMemberData,
    payload: { outingId?: string; slot?: 'sam' | 'dim' | 'we'; note?: string },
  ) => Promise<boolean> | void;
  onRetractBinome?: (member: ClubMemberData) => Promise<void> | void;
  onUpdateMyAvailability?: (payload: {
    availableWeekend: boolean;
    days: Array<'sam' | 'dim'>;
    objective: string;
  }) => Promise<void> | void;
  onChangeMemberRole?: (
    userId: string,
    nextRole: ClubRole,
  ) => Promise<boolean> | void;
  onToggleMemberStoryPermission?: (
    userId: string,
    canManageStories: boolean,
  ) => Promise<boolean> | void;
  onCreateBinomeGroup?: (member: ClubMemberData, outingId?: string) => Promise<void> | void;
  onToggleRsvpOuting: (outingId: string) => void;
  onCreateGroupFromOuting: (outing: ClubOutingData) => void;
  onDownloadGpx: (outing: ClubOutingData) => void;
  onFlyToCoords: (lat: number, lng: number, label: string) => void;
  onToggleReserveGear: (gearId: string) => void;
  onRequestGearLoan?: (payload: {
    gearItemId: string;
    quantity: number;
    eventId?: string | null;
    neededFrom?: string | null;
    neededUntil?: string | null;
    note?: string | null;
  }) => Promise<boolean> | void;
  onTransitionGearLoan?: (payload: {
    loanId: string;
    gearItemId: string;
    status: 'approved' | 'checked_out' | 'returned' | 'issue' | 'declined' | 'cancelled';
    checkoutCondition?: 'new' | 'good' | 'worn' | 'repair';
    returnCondition?: 'new' | 'good' | 'worn' | 'repair';
    conditionNote?: string;
  }) => Promise<boolean> | void;
  onCloneStandardKit: (kitId: string) => void;
  onSendChatMessage: (text: string) => void;
  onToggleClubVisibility: () => void;
  onCreatePost: (payload: {
    kind: 'media' | 'text';
    caption: string;
    spot: string;
    mediaUrl?: string;
    poleId?: string;
    poleName?: string;
  }) => void;
  onCreateOuting: (payload: {
    title: string;
    date: string;
    massif: string;
    km: number;
    dplus: number;
    carpoolCity: string;
    poleId?: string;
    poleName?: string;
  }) => void;
  onCreateVaultGear: (payload: {
    name: string;
    brand: string;
    weightG: number;
    category: string;
    ownershipScope?: 'club' | 'member';
    quantityTotal?: number;
    depositCents?: number;
    isEpi?: boolean;
    epiExpiresAt?: string;
  }) => void;
  onToggleMemberGearPermission?: (
    userId: string,
    canManageGear: boolean,
  ) => Promise<boolean> | void;
  onToggleMemberLeaderBadge?: (
    userId: string,
    isCertifiedLeader: boolean,
  ) => Promise<boolean> | void;
  onCreateNewClub: (payload: {
    name: string;
    massif: string;
    category: string;
    bio: string;
    visibility: 'public' | 'prive';
    poles?: ClubPoleItem[];
  }) => void;
  onToast?: (toast: ClubToastPayload) => void;
  onOpenRuntimeOverlay?: (kind: ClubRuntimeOverlayKind, payload?: Record<string, unknown>) => void;
  onTabChange?: (tab: number, lensId: string) => void;
  onClose?: () => void;
}

export type ExplorerLensId = 'my-clubs' | 'discover-clubs' | 'search-all';
export type CordeeLensId = 'members-all' | 'members-guides' | 'members-binomes';
export type MemberDetailLensId = 'm-stats' | 'm-outings' | 'm-gear' | 'm-media' | 'm-pokedex';

export interface ClubExplorerDrawerBodyProps {
  lensId: ExplorerLensId;
  active: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  initialSearchFocus?: boolean;
  activeClub: ClubItemData;
  clubs: ClubItemData[];
  members: ClubMemberData[];
  outings: ClubOutingData[];
  posts: ClubFeedPostItem[];
  vaultGear: ClubGearVaultItem[];
  currentUserId?: string | null;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSelectClub: (clubId: string) => void;
  onToggleJoinClub: (clubId: string, options?: { message?: string }) => Promise<boolean> | void;
  onFlyToCoords: (lat: number, lng: number, label: string) => void;
  onSwitchLens: (lensIndex: number) => void;
  onSwitchTabAndLens: ClubDrawerNavHandler;
  onOpenCreateClub: (prefillMassif?: string) => void;
  onBorrowGear?: (gearId: string) => void;
  onToast: (toast: ClubToastPayload) => void;
  onClose: () => void;
}

export interface ClubCordeeDrawerBodyProps {
  lensId: CordeeLensId | MemberDetailLensId;
  active: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  activeClub: ClubItemData;
  members: ClubMemberData[];
  outings: ClubOutingData[];
  posts: ClubFeedPostItem[];
  vaultGear: ClubGearVaultItem[];
  currentUserId?: string | null;
  currentUserHandle?: string | null;
  blockedUserIds?: ReadonlySet<string> | readonly string[];
  inspectedMember: ClubMemberData | null;
  memberLensIndex: number;
  filteredRoster?: ClubMemberData[];
  onInspectMember: (member: ClubMemberData | null, sourceLens?: number) => void;
  onMemberLensChange: (index: number) => void;
  onToggleFollowMember: (member: ClubMemberData) => Promise<void> | void;
  onProposeBinome: (
    member: ClubMemberData,
    payload: { outingId?: string; slot?: 'sam' | 'dim' | 'we'; note?: string },
  ) => Promise<boolean> | void;
  onRetractBinome: (member: ClubMemberData) => Promise<void> | void;
  onUpdateMyAvailability: (payload: {
    availableWeekend: boolean;
    days: Array<'sam' | 'dim'>;
    objective: string;
  }) => Promise<void> | void;
  onChangeMemberRole?: (
    userId: string,
    nextRole: ClubRole,
  ) => Promise<boolean> | void;
  onToggleMemberStoryPermission?: (
    userId: string,
    canManageStories: boolean,
  ) => Promise<boolean> | void;
  onCreateBinomeGroup?: (member: ClubMemberData, outingId?: string) => Promise<void> | void;
  onBorrowGear?: (gearId: string) => void;
  onSwitchTabAndLens: ClubDrawerNavHandler;
  onOpenMemberProfile: (handle: string) => void;
  onToast: (toast: ClubToastPayload) => void;
  onClose: () => void;
}

export interface ClubSortiesDrawerBodyProps {
  activeSubTab: number;
  active?: boolean;
  activeClub: ClubItemData;
  outings: ClubOutingData[];
  members: ClubMemberData[];
  vaultGear: ClubGearVaultItem[];
  inspectedOuting: ClubOutingData | null;
  onInspectOuting: (o: ClubOutingData | null) => void;
  onToggleRsvpOuting: (outingId: string) => void;
  onCreateGroupFromOuting: (outing: ClubOutingData) => void;
  onDownloadGpx: (outing: ClubOutingData) => void;
  onFlyToCoords: (lat: number, lng: number, label: string) => void;
  onSwitchTab?: (tab: number, subTab?: number) => void;
  onToast?: (toast: ClubToastPayload) => void;
  onOpenRuntimeOverlay?: (kind: ClubRuntimeOverlayKind, payload?: Record<string, unknown>) => void;
  currentUserId?: string | null;
  initialSection?: ClubG02Section;
}

export interface ClubCoffreDrawerBodyProps {
  activeSubTab: number;
  activeClub: ClubItemData;
  vaultGear: ClubGearVaultItem[];
  standardKits: ClubStandardKit[];
  members: ClubMemberData[];
  outings: ClubOutingData[];
  onToggleReserveGear: (gearId: string) => void;
  onRequestGearLoan?: (payload: {
    gearItemId: string;
    quantity: number;
    eventId?: string | null;
    neededFrom?: string | null;
    neededUntil?: string | null;
    note?: string | null;
  }) => Promise<boolean> | void;
  onTransitionGearLoan?: (payload: {
    loanId: string;
    gearItemId: string;
    status: 'approved' | 'checked_out' | 'returned' | 'issue' | 'declined' | 'cancelled';
    checkoutCondition?: 'new' | 'good' | 'worn' | 'repair';
    returnCondition?: 'new' | 'good' | 'worn' | 'repair';
    conditionNote?: string;
  }) => Promise<boolean> | void;
  onCloneStandardKit: (kitId: string) => void;
  onSwitchTab?: (tab: number, subTab?: number) => void;
  onSwitchToCreate?: (createTab: number) => void;
  onToast?: (toast: ClubToastPayload) => void;
}

export interface ClubStatsDrawerBodyProps {
  activeSubTab: number;
  active: boolean;
  activeClub: ClubItemData;
  members: ClubMemberData[];
  outings: ClubOutingData[];
  posts: ClubFeedPostItem[];
  vaultGear: ClubGearVaultItem[];
  challenges: ClubChallengeItem[];
  currentUserId?: string | null;
  onInspectMember: (member: ClubMemberData) => void;
  onOpenMemberProfile: (handle: string) => void;
  onSwitchTabAndLens: ClubDrawerNavHandler;
  onToast?: (toast: ClubToastPayload) => void;
}

export interface ClubCreateDrawerBodyProps {
  activeTab: number;
  activeClub: ClubItemData;
  prefillMassif?: string;
  onTabChange: (tab: number) => void;
  onCreatePost: ClubDrawerHostProps['onCreatePost'];
  onCreateOuting: ClubDrawerHostProps['onCreateOuting'];
  onCreateVaultGear: ClubDrawerHostProps['onCreateVaultGear'];
  onCreateNewClub: ClubDrawerHostProps['onCreateNewClub'];
  onToast?: (toast: ClubToastPayload) => void;
}

export interface ClubRuntimeOverlaysProps {
  overlay: ClubRuntimeOverlayState | null;
  onClose: () => void;
  activeClub: ClubItemData;
  clubs: ClubItemData[];
  members: ClubMemberData[];
  outings: ClubOutingData[];
  vaultGear: ClubGearVaultItem[];
  standardKits?: ClubStandardKit[];
  challenges: ClubChallengeItem[];
  posts: ClubFeedPostItem[];
  currentUserId?: string | null;
  onSelectClub: (clubId: string) => void;
  onToggleJoinClub: (clubId: string) => void;
  onToggleRsvpOuting: (outingId: string) => void;
  onCreateGroupFromOuting: (outing: ClubOutingData) => void;
  onOpenClubDrawer: (tab: number, subTab?: number, extras?: Partial<ClubDrawerIntent>) => void;
  onOpenCreateClub?: () => void;
  onFlyToCoords: (lat: number, lng: number, label: string) => void;
  onToast: (toast: ClubToastPayload) => void;
}
