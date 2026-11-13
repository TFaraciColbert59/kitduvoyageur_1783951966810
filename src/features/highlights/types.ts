/**
 * C03 — Highlights, collections, points d'intérêt et contributions.
 *
 * Modèles partagés par les moteurs purs, les services et les composants.
 * Rien ici ne touche ExplorerV2, SheetContent, useGpsTracker ni `state/*` :
 * le lot est monté plus tard par les surfaces qui possèdent déjà leur drawer.
 *
 * Confidentialité P01 : un modèle peut porter une position exacte ou une photo
 * marquée ; la projection (`privacy.ts`) est le seul chemin autorisé vers une
 * autre audience. Aucun composant ne doit lire `Highlight` / `Collection`
 * directement pour un tiers.
 */

export type Sport = 'hike' | 'trail' | 'mtb' | 'road' | 'gravel' | 'ski' | 'other';

/** Audience d'un contenu. `unlisted` n'existe que pour les collections. */
export type Audience = 'private' | 'followers' | 'public';
export type CollectionVisibility = Audience | 'unlisted';

export type ViewerRelation = 'owner' | 'follower' | 'authenticated' | 'anonymous';

export interface Viewer {
  id: string | null;
  relation?: ViewerRelation;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type HighlightKind = 'place' | 'segment';
export type HighlightStatus = 'published' | 'hidden' | 'removed';
export type ContributionKind = 'tip' | 'photo';

/**
 * Les trois verrous P01 d'un highlight.
 *
 * - `hideExactLocation` : la position exacte ne sort jamais vers un tiers.
 * - `hidePhotos` : la galerie ne sort jamais vers un tiers.
 * - `requireExifStripped` : une photo non nettoyée reste privée, même marquée
 *   publique par erreur.
 */
export interface HighlightPrivacy {
  hideExactLocation: boolean;
  hidePhotos: boolean;
  requireExifStripped: boolean;
  allowContributions: boolean;
}

export interface HighlightPhoto {
  id: string;
  authorId: string;
  url: string;
  caption: string | null;
  /** P01 : photo volontairement masquée (personne, lieu privé, EXIF douteux). */
  masked: boolean;
  /** P01 : sans nettoyage EXIF, la photo ne peut pas être publiée. */
  exifStripped: boolean;
  /** Consentement explicite de l'auteur pour une audience tierce. */
  consentPublic: boolean;
  createdAt: string;
}

export interface HighlightTip {
  id: string;
  authorId: string;
  authorName: string | null;
  body: string;
  createdAt: string;
}

export interface HighlightVote {
  userId: string;
  value: 1 | -1;
  createdAt: string;
}

export interface Highlight {
  id: string;
  authorId: string;
  authorName: string | null;
  kind: HighlightKind;
  target: { type: 'place' | 'segment' | 'route'; id: string };
  title: string;
  description: string;
  sport: Sport;
  areaLabel: string;
  location: GeoPoint | null;
  privacy: HighlightPrivacy;
  audience: Audience;
  photos: HighlightPhoto[];
  tips: HighlightTip[];
  votes: HighlightVote[];
  status: HighlightStatus;
  createdAt: string;
  updatedAt: string;
}

/** Projection sûre : jamais de photo/coordonnée masquée. */
export interface HighlightView {
  id: string;
  authorName: string | null;
  kind: HighlightKind;
  targetType: Highlight['target']['type'];
  targetId: string;
  title: string;
  description: string;
  sport: Sport;
  areaLabel: string;
  location: GeoPoint | null;
  locationHidden: boolean;
  photos: Array<{ id: string; url: string; caption: string | null }>;
  photosHidden: boolean;
  tips: Array<{ id: string; authorName: string | null; body: string; createdAt: string }>;
  upvotes: number;
  downvotes: number;
  score: number;
  myVote: 1 | -1 | 0;
  audience: Audience;
  canContribute: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CollectionItemType = 'highlight' | 'route' | 'poi';

export interface CollectionItem {
  id: string;
  type: CollectionItemType;
  refId: string;
  title: string;
  sport: Sport | null;
  /** Position d'affichage, entière et strictement croissante à la lecture. */
  position: number;
}

export interface ShareLink {
  id: string;
  collectionId: string;
  token: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface Collection {
  id: string;
  ownerId: string;
  ownerName: string | null;
  kind: 'personal' | 'editorial';
  title: string;
  description: string;
  theme: string | null;
  region: string | null;
  partner: string | null;
  visibility: CollectionVisibility;
  items: CollectionItem[];
  shareLinks: ShareLink[];
  createdAt: string;
  updatedAt: string;
}

export interface CollectionItemView {
  id: string;
  type: CollectionItemType;
  refId: string;
  title: string;
  sport: Sport | null;
  position: number;
}

/** Projection d'une collection pour une audience donnée. */
export interface CollectionView {
  id: string;
  ownerName: string | null;
  kind: Collection['kind'];
  title: string;
  description: string;
  theme: string | null;
  region: string | null;
  partner: string | null;
  visibility: CollectionVisibility;
  items: CollectionItemView[];
  itemCount: number;
  updatedAt: string;
  /** Vrai uniquement quand la vue provient d'un lien de partage valide. */
  shared: boolean;
  /** Présent seulement pour le propriétaire. */
  canEdit: boolean;
  canShare: boolean;
  /** Liens actifs/révoqués, uniquement pour le propriétaire. */
  links: Array<{ id: string; path: string; expiresAt: string | null; revokedAt: string | null }>;
}

export interface CollectionSearchHit {
  collection: CollectionView;
  score: number;
  reason: 'title' | 'description' | 'theme' | 'region';
}

export type RouteAudience = Audience;

export interface RoutePhoto {
  id: string;
  routeId: string;
  authorId: string;
  authorName: string | null;
  url: string;
  caption: string | null;
  location: GeoPoint | null;
  takenAt: string;
  audience: RouteAudience;
  exifStripped: boolean;
  masked: boolean;
  consentPublic: boolean;
}

export interface TrailPhotoMarker {
  photoId: string;
  url: string;
  caption: string | null;
  authorName: string | null;
  distanceAlongM: number;
  offsetM: number;
  bearingDeg: number;
}

export interface RouteActivity {
  id: string;
  routeId: string;
  userId: string;
  displayName: string;
  date: string;
  distanceKm: number;
  durationS: number;
  sport: Sport;
  audience: RouteAudience;
  hideStats: boolean;
}

export interface PublicRouteActivity {
  id: string;
  displayName: string;
  date: string;
  sport: Sport;
  distanceKm: number | null;
  durationS: number | null;
}

export interface RouteCommunityMedia {
  photos: Array<{ id: string; url: string; caption: string | null; authorName: string | null }>;
  activities: PublicRouteActivity[];
}

export interface RouteObservation {
  id: string;
  routeId: string;
  userId: string;
  text: string;
  tags: string[];
  audience: RouteAudience;
  consentAggregate: boolean;
  status: 'published' | 'hidden' | 'removed';
  createdAt: string;
}

export interface RouteCommunityTag {
  tag: string;
  count: number;
  sources: number;
}

export interface RouteCommunitySummary {
  routeId: string;
  tags: RouteCommunityTag[];
  description: string | null;
  updatedAt: string | null;
  sourceCount: number;
}

export interface RouteRef {
  id: string;
  title: string;
  sport: Sport;
  region: string | null;
  audience: Audience;
  latitude: number | null;
  longitude: number | null;
  geometry?: GeoPoint[];
  updatedAt: string;
}

export interface PoiRef {
  id: string;
  name: string;
  category: string;
  region: string | null;
  audience: Audience;
  latitude: number | null;
  longitude: number | null;
  updatedAt: string;
}

export interface GuideSection {
  id: string;
  title: string;
  routes: RouteRef[];
  pois: PoiRef[];
  highlights: HighlightView[];
}

export interface EditorialGuide {
  id: string;
  slug: string;
  title: string;
  description: string;
  theme: string | null;
  region: string | null;
  partner: string | null;
  sections: GuideSection[];
  routeCount: number;
  poiCount: number;
  highlightCount: number;
  updatedAt: string;
}

export interface ParkPerimeter {
  id: string;
  name: string;
  region: string | null;
  /** Bbox [ouest, sud, est, nord] en degrés. */
  bbox: [number, number, number, number];
}

export interface InspirationHistory {
  sportCounts: Partial<Record<Sport, number>>;
  regionCounts: Record<string, number>;
  followedAuthorIds: string[];
  savedCollectionIds: string[];
  savedHighlightIds: string[];
}

export interface InspirationCandidate {
  id: string;
  type: 'route' | 'collection' | 'highlight';
  title: string;
  sport: Sport;
  region: string | null;
  authorId: string | null;
  audience: Audience;
  updatedAt: string;
  distanceKm?: number | null;
}

export interface InspirationRecommendation {
  candidate: InspirationCandidate;
  score: number;
  reason: string;
}

export interface StreetViewCoverage {
  panoId: string;
  point: GeoPoint;
  headingDeg: number;
  capturedAt: string;
}

export interface StreetViewProvider {
  /** Retourne la couverture la plus proche dans `radiusM`, ou null. */
  lookup(point: GeoPoint, radiusM: number): StreetViewCoverage | null;
}

export interface StreetViewResult {
  available: boolean;
  panoId: string | null;
  headingDeg: number | null;
  direction: 'front' | 'left' | 'right' | 'back' | null;
  distanceM: number | null;
  reason: 'ok' | 'no-coverage' | 'invalid-point' | 'provider-absent';
}

export type HighlightErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not-found'
  | 'invalid-input'
  | 'invalid-state'
  | 'limit-reached';

export interface HighlightFailure {
  code: HighlightErrorCode;
  message: string;
}

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: HighlightFailure };
