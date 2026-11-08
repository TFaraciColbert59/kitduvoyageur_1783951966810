/**
 * Communauté v2 — modèles de vue partagés entre la couche données (RPC Supabase)
 * et les deux tiroirs. Aucune dépendance React, aucun accès réseau : types purs.
 *
 * Règle : les tuiles, lignes et détails ne reçoivent QUE ces VMs (jamais une ligne
 * Supabase brute) ; les mappers `data/communityFeedMappers.ts` font la conversion et
 * sont testés unitairement.
 */

export type TypeKind = 'post' | 'carnet' | 'club' | 'sortie' | 'membre';

/** Volet du tiroir Explorer (capsule 56 px). */
export type ExploreTab = 'search' | 'carnets' | 'clubs' | 'sorties';

export type CarnetFilter = 'discover' | 'mine' | 'followed' | 'near';
export type CarnetSort = 'recent' | 'popular' | 'near' | 'duration';
export type ClubFilter = 'discover' | 'mine' | 'near';
export type ClubSort = 'activity' | 'near' | 'size';
export type EventFilter = 'discover' | 'mine' | 'near';
export type SearchScope = 'all' | 'posts' | 'carnets' | 'clubs' | 'sorties' | 'membres';

/** Type de création du tiroir Création (capsule 56 px). */
export type CreateKindV2 = 'post' | 'story' | 'carnet' | 'sortie' | 'kit' | 'club';

export type ClubPrivacy = 'open' | 'closed' | 'secret';
export type MemberStatus = 'none' | 'member' | 'pending' | 'admin';
export type EventRegistration = 'none' | 'registered' | 'waitlist';
export type Visibility = 'public' | 'friends' | 'private';

/** Coordonnées « Près de moi » (jamais stockées, seulement passées aux RPC). */
export interface GeoPoint {
  lat: number;
  lng: number;
}

export type GeoPermissionState = 'idle' | 'prompt' | 'granted' | 'denied' | 'unavailable';

export interface ExplorerUser {
  id: string;
  is_anonymous?: boolean | null;
  handle?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface AvatarVM {
  id: string;
  name: string;
  handle?: string | null;
  avatarUrl?: string | null;
  /** Initiales déjà calculées (1 à 2 lettres) pour les avatars sans photo. */
  initials: string;
}

export interface CarnetCardVM {
  id: string;
  title: string;
  destination: string;
  coverImage: string | null;
  coverAlt: string | null;
  days: number | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  author: AvatarVM;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  travelers: AvatarVM[];
  travelersTotal: number;
  /** Carnet « en route » (partage en direct actif). */
  isLive: boolean;
  /** Trace GPS vérifiée (issu d'une sortie enregistrée). */
  verifiedGps: boolean;
  startDate: string | null;
  endDate: string | null;
  visibility: Visibility;
  distanceKmFromMe: number | null;
  /** Trace simplifiée (points [x,y] normalisés 0-100) pour le filigrane de couverture. */
  routeTrace: Array<[number, number]> | null;
}

export interface ClubCardVM {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  emoji: string | null;
  activities: string[];
  privacy: ClubPrivacy;
  coverImage: string | null;
  coverColor: string | null;
  /** Graine déterministe du blason (dérivée de l'id/du nom). */
  crestSeed: string;
  membersCount: number;
  myStatus: MemberStatus;
  eventsThisMonth: number;
  lastPostAt: string | null;
  distanceKmFromMe: number | null;
  zoneLabel: string | null;
  friends: AvatarVM[];
  friendsTotal: number;
  rules: string | null;
  joinQuestions: string[];
}

export interface ClubJoinRequestVM {
  id: string;
  user: AvatarVM;
  answers: string[];
  message: string | null;
  createdAt: string;
}

export interface EventCardVM {
  id: string;
  title: string;
  activity: string;
  startsAt: string | null;
  endsAt: string | null;
  eventDate: string;
  location: string;
  meetingPoint: string | null;
  level: 'facile' | 'moyen' | 'difficile' | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  duration: string | null;
  coverImage: string | null;
  coverAlt: string | null;
  maxParticipants: number;
  currentParticipants: number;
  spotsLeft: number;
  waitlistEnabled: boolean;
  myStatus: EventRegistration;
  organizer: AvatarVM;
  participants: AvatarVM[];
  participantsTotal: number;
  clubId: string | null;
  clubName: string | null;
  kitId: string | null;
  description: string | null;
  safetyNotes: string | null;
  safetyChecklist: string[];
  recurrence: 'weekly' | 'monthly' | null;
  /** Sortie déjà passée (récap, non inscriptible). */
  past: boolean;
  distanceKmFromMe: number | null;
}

export interface MemberHitVM {
  id: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
  massif: string | null;
  bio: string | null;
  followersCount: number | null;
}

export interface SearchHitVM {
  kind: TypeKind;
  id: string;
  title: string;
  subtitle: string;
  cover: string | null;
  href: string;
  score: number | null;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  startsAt: string | null;
  /** Texte brut additionnel (aperçu d'un post) — surligné comme le titre. */
  excerpt?: string | null;
}

export interface TrendingItemVM {
  kind: 'term' | 'place';
  label: string;
  hits: number;
}

export interface RecentSearchVM {
  id: string;
  label: string;
}

export interface KitOptionVM {
  id: string;
  name: string;
  totalWeightG: number;
  isPublic: boolean;
  itemCount: number;
}

export interface ProductOptionVM {
  id: string;
  name: string;
  category: string;
  weightG: number;
  /** Prix boutique éventuel (renseigné seulement si l'objet est achetables). */
  priceEur: number | null;
  icon: string | null;
}

export type AgendaCounts = Record<string, number>;

/** État générique d'un flux paginé par curseur (retour des RPC de lecture). */
export interface FeedState<T> {
  items: T[];
  /** Premier chargement (skeleton) ; `loadingMore` couvre la page suivante. */
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  refresh: () => void;
  loadMore: () => void;
}

export interface SearchState {
  query: string;
  scope: SearchScope;
  results: SearchHitVM[];
  trending: TrendingItemVM[];
  loading: boolean;
  error: string | null;
  setQuery: (query: string) => void;
  setScope: (scope: SearchScope) => void;
  retry: () => void;
}

/** Réponse uniforme d'une mutation optimiste (île + Annuler). */
export interface MutationOutcome<T = undefined> {
  ok: boolean;
  data?: T;
  /** Message prêt à afficher (FR), déjà traduit côté appelant. */
  error?: string;
  /** Code stable (`banned`, `full`, `slug_taken`, `not_authenticated`…) pour l'UI. */
  code?: string;
}

export interface ClubMembershipSnapshot {
  genre: 'join' | 'leave' | 'request' | 'cancel';
  clubId: string;
  previousStatus: MemberStatus;
}
