/**
 * CARTE VIVANTE 3D LKDV — Types et contrats TypeScript
 *
 * Moteur MapLibre 3D, drapage satellite, DEM Terrarium / IGN,
 * timeline synchronisée et gestion hors-ligne.
 */

export type Carte3DBasemap = 'satellite-esri' | 'ign-ortho' | 'topo-outdoor';

export type WaypointCategory =
  | 'summit'
  | 'refuge'
  | 'water'
  | 'viewpoint'
  | 'weather'
  | 'photo'
  | 'pass';

export interface Carte3DWaypoint {
  id: string;
  name: string;
  category: WaypointCategory;
  lat: number;
  lng: number;
  altitudeM: number;
  distanceKm: number; // Distance cumulée depuis le départ du sentier
  details?: string;
  photoUrl?: string;
  weatherSnapshot?: {
    tempC: number;
    windKmh: number;
    condition: string;
    icon: string;
  };
  capacity?: number;
  isPotable?: boolean;
}

export interface ElevationProfilePoint {
  distanceKm: number;
  elevationM: number;
  slopePercent: number;
  coord: [number, number]; // [lng, lat]
}

export interface Carte3DTrail {
  id: string;
  name: string;
  massif: string;
  country: string;
  region?: string;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  minElevationM: number;
  maxElevationM: number;
  estimatedDurationHours: number;
  bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  coordinates: [number, number, number?][]; // [lng, lat, elevation?]
  elevationProfile: ElevationProfilePoint[];
  waypoints: Carte3DWaypoint[];
  description?: string;
  difficulty?: 'facile' | 'moyen' | 'difficile' | 'expert';
  isCustomGpx?: boolean;
}

export interface ScrubberState {
  progress: number; // 0.0 à 1.0
  currentDistanceKm: number;
  currentElevationM: number;
  currentSlopePercent: number;
  currentCoordinate: [number, number]; // [lng, lat]
  currentBearingDeg: number;
  isPlaying: boolean;
  playbackSpeed: 1 | 2 | 5 | 10;
  chaseCamera: boolean;
  activeNearbyWaypoint: Carte3DWaypoint | null;
}

export interface Carte3DOfflinePack {
  id: string;
  trailId: string;
  trailName: string;
  bounds: [number, number, number, number];
  downloadedAt: string;
  sizeBytes: number;
  tileCount: number;
  isComplete: boolean;
  trailData: Carte3DTrail;
}

export interface TileCoordinate {
  x: number;
  y: number;
  z: number;
}
