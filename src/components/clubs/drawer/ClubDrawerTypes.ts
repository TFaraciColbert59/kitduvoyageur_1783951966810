import type { ClubRole, MembershipStatus } from '@/features/clubs/types';
import type { ClubG02Section } from '../g02/ClubG02Screen';
import type { ClubFeedPostItem } from '../feed/ClubInlineFeed';

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
  avatarUrl?: string;
}

export type ClubOutingStatus = 'upcoming' | 'live' | 'completed' | 'cancelled';

export interface ClubOutingData {
  id: string;
  clubId: string;
  title: string;
  date: string;
  startsAtIso?: string;
  dateLabel?: string;
  massif: string;
  km: number;
  dplus: number;
  maxAlt: number;
  status: ClubOutingStatus;
  leaderName: string;
  leaderHandle: string;
  participantsCount: number;
  maxParticipants: number;
  rsvpJoined: boolean;
  carpoolCity: string;
  carpoolSeatsLeft: number;
  requiredGear: string[];
  lat: number;
  lng: number;
  coverUrl?: string;
  weatherSummary?: string;
}

export interface ClubGearVaultItem {
  id: string;
  clubId: string;
  name: string;
  brand: string;
  category: string;
  weightG: number;
  ownerName: string;
  ownerHandle: string;
  available: boolean;
  reservedByMe?: boolean;
  imageUrl?: string;
  condition?: string;
  loanId?: string;
  loanStatus?: 'requested' | 'approved' | 'returned' | 'declined';
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
  | 'create_group';

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
  onChangeMemberRole?: (
    member: ClubMemberData,
    nextRole: 'admin' | 'moderator' | 'member',
  ) => Promise<void> | void;
  onCreateBinomeGroup?: (member: ClubMemberData, outingId?: string) => Promise<void> | void;
  onToggleRsvpOuting: (outingId: string) => void;
  onCreateGroupFromOuting: (outing: ClubOutingData) => void;
  onDownloadGpx: (outing: ClubOutingData) => void;
  onFlyToCoords: (lat: number, lng: number, label: string) => void;
  onToggleReserveGear: (gearId: string) => void;
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
  }) => void;
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
export type MemberDetailLensId = 'm-stats' | 'm-outings' | 'm-gear' | 'm-media';

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
    member: ClubMemberData,
    nextRole: 'admin' | 'moderator' | 'member',
  ) => Promise<void> | void;
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
  onCloneStandardKit: (kitId: string) => void;
  onSwitchTab?: (tab: number, subTab?: number) => void;
  onSwitchToCreate?: (createTab: number) => void;
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
  challenges: ClubChallengeItem[];
  posts: ClubFeedPostItem[];
  currentUserId?: string | null;
  onSelectClub: (clubId: string) => void;
  onToggleJoinClub: (clubId: string) => void;
  onToggleRsvpOuting: (outingId: string) => void;
  onCreateGroupFromOuting: (outing: ClubOutingData) => void;
  onOpenClubDrawer: (tab: number, subTab?: number, extras?: Partial<ClubDrawerIntent>) => void;
  onFlyToCoords: (lat: number, lng: number, label: string) => void;
  onToast: (toast: ClubToastPayload) => void;
}
