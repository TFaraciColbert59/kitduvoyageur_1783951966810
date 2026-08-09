/**
 * LE KIT DU VOYAGEUR — ARCHITECTURE HIKING / SYSTEM TYPES
 * Types TypeScript stricts et extensibles pour le système de randonnée
 */

export type HikingState =
  | 'IDLE'
  | 'PREPARING'
  | 'READY'
  | 'TRACKING'
  | 'PAUSED'
  | 'OFF_ROUTE'
  | 'GPS_WEAK'
  | 'OFFLINE'
  | 'LOW_BATTERY'
  | 'WEATHER_ALERT'
  | 'SAFETY_ALERT'
  | 'FINISHING'
  | 'COMPLETED';

export interface GPSPosition {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface GPSSample {
  position: GPSPosition;
  distanceDeltaM: number;
  timeDeltaS: number;
  elevationDeltaM: number;
}

export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  elevationM?: number | null;
  category?: string;
  distanceRemainingM?: number;
}

export interface POI {
  id: string | number;
  name: string;
  category: string;
  lat: number;
  lon: number;
  distance_m: number;
  bearing_deg: number;
  elevation_m?: string | number | null;
}

export interface Route {
  id: string | number;
  name: string;
  ref?: string | null;
  network?: string | null;
  distanceKm: number;
  elevationGainM?: number | null;
  geojson?: unknown;
  pois?: POI[];
}

export interface Trail {
  id: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
  distance_km?: number | null;
  duration_hours?: number | null;
  difficulty?: string | null;
  elevation_gain?: number | null;
}

export interface HikeSession {
  id: string;
  userId: string;
  routeId?: string | number | null;
  carnetId?: string | null;
  startedAt: string;
  endedAt?: string | null;
  distanceKm: number;
  durationSeconds: number;
  elevationGainM?: number | null;
  positions: GPSPosition[];
  poiEvents: { poiName: string; reachedAt: string; lat: number; lon: number }[];
  narratives?: {
    journal: string;
    aventure: string;
    sportive: string;
    generated_at: string;
  } | null;
}

export interface HikingStatistics {
  totalSessions: number;
  totalDistanceKm: number;
  avgDistanceKm: number;
  avgPaceMinPerKm: number;
  avgElevationGainM: number;
  favoriteDifficulty: string | null;
  mostActiveWeekday: string | null;
}

export interface WeatherSnapshot {
  tempC: number;
  condition: string;
  windKmH: number;
  precipitationProbability: number;
  uvIndex?: number;
  altitudeM?: number;
  isAlert: boolean;
  alertMessage?: string;
  fetchedAt: string;
}

export interface SafetyAlert {
  id: string;
  type: 'off-route' | 'weather' | 'battery' | 'sos' | 'gps-weak';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  location?: { lat: number; lon: number };
}

export interface NavigationInstruction {
  type: 'straight' | 'turn-left' | 'turn-right' | 'u-turn' | 'off-route' | 'poi-reached';
  message: string;
  distanceMeters: number;
  targetLat?: number;
  targetLon?: number;
  bearingDeg?: number;
}

export interface JournalEntry {
  id: string;
  carnetId: string;
  hikeSessionId?: string | null;
  momentTimestamp: string;
  source: 'manuel' | 'auto';
  citation?: string | null;
  lieu?: string | null;
  heure?: string | null;
  imageUrl?: string | null;
  identifiedSpecies?: unknown[];
}

export interface MediaCapture {
  id: string;
  type: 'image' | 'audio';
  url: string;
  timestamp: string;
  location?: { lat: number; lon: number };
}

export interface OfflineRegion {
  id: string;
  name: string;
  routeId: string;
  minZoom: number;
  maxZoom: number;
  totalTiles: number;
  downloadedTiles: number;
  sizeBytes: number;
  isComplete: boolean;
}

export interface GroupMember {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  location?: GPSPosition;
  lastActive: string;
  batteryLevel?: number;
  isEmergency?: boolean;
}

// ── EXTENSIBILITY INTERFACES (Preparation for future modules) ─────────────────

export interface ICopilotProvider {
  getAdvice(context: { session: HikeSession; weather?: WeatherSnapshot }): Promise<string>;
}

export interface IIntelligenceProvider {
  getPersonalStats(userId: string): Promise<HikingStatistics>;
  predictPace(distanceKm: number, elevationM: number): number;
}

export interface IDigitalTwinProvider {
  generate3DTwin(sessionId: string): Promise<{ twinId: string; modelUrl: string }>;
}

export interface IWatchSyncProvider {
  syncToWatch(session: HikeSession): Promise<boolean>;
}

export interface IARCompassProvider {
  getAROverlayPois(heading: number, location: GPSPosition): Promise<POI[]>;
}
