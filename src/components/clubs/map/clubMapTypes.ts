/**
 * Shared types for the 3D Club Map (`ClubLiquidGlassV8`, `ClubMap`, and `/api/clubs/[id]/map`).
 */

export type ClubZoomStage = 'planetary' | 'country' | 'massif' | 'trail';

export type Club3DBaseStyle = 'topo3d' | 'ign-ortho' | 'ign-topo' | 'dusk';

export type ClubOutdoorOverlayId = 'hiking' | 'nautical' | 'mtb' | 'cycling' | 'slopes';

export type ClubOutdoorOverlaysState = Record<ClubOutdoorOverlayId, boolean>;

export type ClubTrackCoord = [lng: number, lat: number, ele?: number];

export interface ClubMapOutingRouteHydration {
  routeId: string;
  osmRelationId?: number | null;
  ref?: string | null;
  network?: string | null;
  km?: number | null;
  dplus?: number | null;
  maxAlt?: number | null;
  coords: ClubTrackCoord[];
}

export interface ClubMapOutingTrack {
  id: string;
  title: string;
  massif: string;
  massifId: string;
  countryCode: string;
  status: 'live' | 'upcoming' | 'completed';
  startsAtIso: string;
  dateLabel: string;
  km: number;
  dplus: number;
  maxAlt: number;
  participantsCount: number;
  maxParticipants: number | null;
  rsvpJoined: boolean;
  leaderName: string;
  leaderHandle?: string;
  leaderId?: string;
  poleId?: string;
  isApproximateRoute?: boolean;
  coords: ClubTrackCoord[];
  start: [number, number];
  peak: [number, number, number];
  bounds: [number, number, number, number];
}

export interface ClubMapLiveMember {
  id: string;
  name: string;
  handle: string;
  role: string;
  avatarUrl: string | null;
  lat: number;
  lng: number;
  fuzzy: boolean;
}

export interface ClubMapPokedexItem {
  id: string;
  commonName: string;
  latinName?: string;
  outingId: string;
  outingTitle: string;
  observerId?: string;
  observerName: string;
  observerAvatarUrl?: string | null;
  observedAt: string;
  spot?: string;
  citation?: string;
  imageUrl?: string | null;
  wikipediaUrl?: string | null;
  kingdom?: 'faune' | 'flore' | 'geologie';
  confidence?: string;
  lat: number;
  lng: number;
  trackProgress: number;
}

export interface ClubMapKitUsage {
  id: string;
  title: string;
  season: string;
  totalWeightG: number;
  itemsCount: number;
  items: string[];
  outingId: string;
  outingTitle: string;
  lat: number;
  lng: number;
  trackProgress: number;
}

export interface ClubMapPostPin {
  id: string;
  spot: string;
  caption: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string | null;
  mediaUrl: string | null;
  timeAgo: string;
  massif: string;
  massifId: string;
  likes: number;
  outingId?: string;
  poleId?: string;
  lat: number;
  lng: number;
  trackProgress?: number;
}

export interface ClubRichMapMassifSummary {
  id: string;
  name: string;
  center: [number, number];
  outings: number;
  postsCount: number;
}

export interface ClubMapStoryPin {
  id: string;
  outingId: string;
  outingTitle: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl?: string | null;
  imageUrl: string;
  caption: string;
  spot?: string | null;
  lat: number;
  lng: number;
  trackProgress: number;
  createdAt: string;
}

export interface ClubRichMapPayload {
  clubId: string;
  clubName: string;
  center: [number, number];
  countrySummary: {
    code: string;
    name: string;
    outings: number;
    members: number;
  };
  massifs: ClubRichMapMassifSummary[];
  outings: ClubMapOutingTrack[];
  liveMembers: ClubMapLiveMember[];
  pokedex: ClubMapPokedexItem[];
  kits: ClubMapKitUsage[];
  posts: ClubMapPostPin[];
  stories?: ClubMapStoryPin[];
}

export type ClubMapSelection =
  | { kind: 'country'; id: string }
  | { kind: 'massif'; id: string; name: string }
  | { kind: 'outing'; id: string }
  | { kind: 'post'; id: string; outingId?: string }
  | { kind: 'pokedex'; id: string; outingId: string }
  | { kind: 'kit'; id: string; outingId?: string }
  | { kind: 'member'; id: string }
  | null;
