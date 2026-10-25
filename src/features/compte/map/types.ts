export type CompteMapMode =
  | 'overview'
  | 'vitrine'
  | 'kit'
  | 'prets'
  | 'souvenirs'
  | 'communaute'
  | 'compte'
  | 'reseau'
  | 'sortie';

export interface TrackPoint {
  lng: number;
  lat: number;
}

export type MapBounds = [west: number, south: number, east: number, north: number];

export interface MapTrack {
  id: string;
  title: string;
  startedAt: string | null;
  year: number | null;
  km: number;
  dplus: number;
  maxAlt: number | null;
  verified: boolean;
  visibility: 'private' | 'collective_anonymized';
  massif: string | null;
  massifId: string | null;
  kitId: string | null;
  kitName: string | null;
  carnetId: string | null;
  photosCount: number;
  participantsCount: number;
  coordinates: TrackPoint[];
  bounds: MapBounds;
  start: TrackPoint;
  end: TrackPoint;
}

export interface MapMassif {
  id: string;
  name: string;
  countryCode: string | null;
  center: TrackPoint;
  outings: number;
  verified: boolean;
}

export interface MapCarnet {
  id: string;
  title: string;
  coverUrl: string | null;
  outingId: string;
  position: TrackPoint;
}

export interface MapPoi {
  id: string;
  outingId: string;
  label: string;
  day: number | null;
  position: TrackPoint;
}

export interface CompteMapStats {
  outings: number;
  km: number;
  dplus: number;
  massifs: number;
  countries: number;
}

export interface CompteMapPayload {
  tracks: MapTrack[];
  massifs: MapMassif[];
  carnets: MapCarnet[];
  pois: MapPoi[];
  stats: CompteMapStats;
  bounds: MapBounds | null;
  truncated: boolean;
  generatedAt: string;
}

export interface CompteMapSheet {
  kind: string | null;
  step: number;
  slot: string | null;
  detent: string;
  outingId: string | null;
}

export interface CompteMapUi {
  tracks: 'all' | 'filtered' | 'selected' | 'none';
  massifs: boolean;
  carnets: boolean;
  pois: boolean;
  outingPins: boolean;
}

export interface MapModeConfig {
  mode: CompteMapMode;
  label: string;
  emptyTitle: string;
  emptyHint: string;
  emptyCta: { label: string; href?: string; action?: 'open-kits' | 'open-outings' } | null;
  camera: 'fit-all' | 'fit-filtered' | 'fit-selected' | 'keep' | 'default';
  layers: CompteMapUi;
  hud: 'full' | 'count' | 'outing' | 'none';
  dimmed: boolean;
}
