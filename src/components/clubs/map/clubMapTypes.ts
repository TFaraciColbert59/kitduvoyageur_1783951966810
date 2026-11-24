/**
 * Shared types for the 3D Club Map (`ClubLiquidGlassV8`, `ClubMap`, and `/api/clubs/[id]/map`).
 */

export type ClubZoomStage = 'planetary' | 'country' | 'massif' | 'trail';

export type Club3DBaseStyle = 'topo3d' | 'ign-ortho' | 'ign-topo' | 'dusk';

export type ClubTrackCoord = [lng: number, lat: number, ele?: number];

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
  observerName: string;
  observedAt: string;
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
