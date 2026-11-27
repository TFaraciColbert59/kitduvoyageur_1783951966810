/**
 * Explorer v2 — Canonical Contracts for Personalized, Multimodal & Explainable POI Routing.
 *
 * Shared across:
 * - Rust/WASM kernel (`crates/lkdv-route-core`) & TS parity fallback (`tsFallbackEngine.ts`)
 * - Server capability resolver (`capabilityManifest.ts`) & BFF (`/api/explorer/v2/route-plan`)
 * - Offline CSR graph pack storage (`offlineRuntimeStore.ts`)
 * - MapStage itinerary rendering (`xp-poi-itineraries`) & Ultra-Minimalist Liquid Glass UI
 */

import type { ExplorerReadiness, GearInventory, OfflineDaylight, OutingFitResult } from '../adaptive/types';
import type { Sport } from '../state/types';

export type RoutingTravelMode =
  | 'rando'
  | 'trail'
  | 'velo'
  | 'gravel'
  | 'vtt'
  | 'vae'
  | 'ski'
  | 'raquettes'
  | 'kayak'
  | 'multimodal';

export type LocomotionAssetKind =
  | 'foot'
  | 'road_bike'
  | 'gravel_bike'
  | 'mtb'
  | 'ebike'
  | 'car'
  | 'van_4x4'
  | 'motorcycle'
  | 'kayak'
  | 'packraft'
  | 'sup'
  | 'ski_touring'
  | 'snowshoes'
  | 'public_transit';

export type MobilityProfileKind = 'standard' | 'famille' | 'senior' | 'pmr';

export type RoutingPriority = 'securite' | 'equilibre' | 'doux' | 'rapide';

export interface UserKitOption {
  id: string;
  name: string;
  weightKg: number;
  season?: string | null;
}

export interface UserCapabilityManifest {
  authenticated: boolean;
  /** Strictly allowed terrain/approach modes (Fail-Safe: never includes unproven modes). */
  allowedModes: RoutingTravelMode[];
  /** Strictly allowed multimodal approach modes (car only if declared, transit allowed by default). */
  allowedApproachModes: Array<'car' | 'public_transit' | 'bike'>;
  mobilityProfile: MobilityProfileKind;
  priority: RoutingPriority;

  // Physiology & performance baselines (Campbell 2022 + Minetti 2002 + MOVE 2026)
  bodyWeightKg: number;
  heightCm: number;
  packWeightKg: number;
  activeKitId: string | null;
  activeKitName: string | null;
  availableKits: UserKitOption[];
  /** Flat walking speed (km/h) — calibrated from user_performance_profiles or conservative default. */
  flatSpeedKmh: number;
  /** Ascent rate VAM (m/h). */
  ascentSpeedMPerH: number;
  /** Descent rate VDM (m/h). */
  descentSpeedMPerH: number;
  /** Speed percentile (2.5..97.5) for Campbell (2022) Lorentzian slope-rate curve. */
  speedPercentile: number;
  /** Estimated VO2max (ml/kg/min) for MOVE (2026) relative effort % eCRF. */
  vo2maxMlKgMin: number;
  /** Cycling FTP (W) if known from activity_zone_configs. */
  ftpW: number | null;
  /** E-bike battery range in km if user owns an e-bike. */
  ebikeRangeKm: number | null;
  homeAltitudeM: number;

  // Live readiness (from 28d sessions + wellness snapshots, or cold_start)
  readiness: ExplorerReadiness;

  // Hard technical limits (strict Fail-Safe defaults when unproven)
  sacMaxGrade: 1 | 2 | 3 | 4 | 5 | 6;
  mtbMaxGrade: 0 | 1 | 2 | 3 | 4 | 5;
  whitewaterMaxGrade: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  viaFerrataOk: boolean;
  winterAvalancheTrained: boolean;
  maxComfortableDplusM: number;
  maxComfortableKm: number;

  // Proven gear & locomotion inventory
  gear: GearInventory;
  hasWatercraftAndPfd: boolean;
  hasViaFerrataKit: boolean;
  hasSnowshoes: boolean;
  hasTouringSkis: boolean;
  hasRoadBike: boolean;
  hasGravelBike: boolean;
  hasMtb: boolean;
  hasEbike: boolean;
  hasCar: boolean;
  hasPublicTransitAccess: boolean;

  /** Provenance tags for transparent XAI ("Profil calibré sur 14 sorties", "Kit Alpes 6,8 kg", etc.). */
  dataSources: string[];
}

// ── Compact Corridor Graph (shared between BFF, Offline IDB, TS Fallback & Rust/WASM) ──

export const EDGE_FLAG_WATERWAY = 1 << 0;
export const EDGE_FLAG_FERRY = 1 << 1;
export const EDGE_FLAG_FORD = 1 << 2;
export const EDGE_FLAG_STEPS = 1 << 3;
export const EDGE_FLAG_VIA_FERRATA = 1 << 4;
export const EDGE_FLAG_EXPOSED_RIDGE = 1 << 5;
export const EDGE_FLAG_FOREST_COVER = 1 << 6;
export const EDGE_FLAG_LIT = 1 << 7;
export const EDGE_FLAG_CYCLEWAY = 1 << 8;
export const EDGE_FLAG_ROAD_TRAFFIC = 1 << 9;
export const EDGE_FLAG_GLACIER_SNOW = 1 << 10;

export const HAZARD_FLAG_FIRE = 1 << 0;
export const HAZARD_FLAG_FLOOD = 1 << 1;
export const HAZARD_FLAG_AVALANCHE_SLOPE = 1 << 2;
export const HAZARD_FLAG_STORM_EXPOSED = 1 << 3;
export const HAZARD_FLAG_REPORT_BLOCKED = 1 << 4;

/** Surface codes matching Looney LCDA / Weyand (2021) terrain multipliers. */
export const SURFACE_PAVED = 0; // eta 1.00
export const SURFACE_GRAVEL = 1; // eta 1.15
export const SURFACE_DIRT_TRAIL = 2; // eta 1.12
export const SURFACE_GRASS_FOREST = 3; // eta 1.18
export const SURFACE_ROCK_SCREE = 4; // eta 1.50
export const SURFACE_SNOW_ICE = 5; // eta 1.85
export const SURFACE_WATER = 6; // nautical only

export interface CompactGraphNode {
  lat: number;
  lon: number;
  eleM: number;
  /** Bitmask: 1=water, 2=shelter, 4=parking, 8=transit_hub, 16=water_put_in */
  poiFlags: number;
}

export interface CompactGraphEdge {
  from: number;
  to: number;
  lengthM: number;
  dplusM: number;
  dminusM: number;
  maxSlopeDeg: number;
  surface: number;
  /** 0=none, 1..6 = SAC T1..T6 */
  sacGrade: number;
  /** 0..5 = MTB S0..S5, 255 = bike forbidden */
  mtbGrade: number;
  /** 0..6 = Whitewater grade I..VI */
  wwGrade: number;
  flags: number;
  hazardFlags: number;
}

export interface CompactCorridorGraph {
  version: 1;
  nodes: CompactGraphNode[];
  edges: CompactGraphEdge[];
  fetchedAtIso: string;
  source: 'overpass_corridor' | 'offline_pack' | 'hybrid_external';
}

export interface RouteEnvironmentSnapshot {
  fetchedAtIso: string;
  temperatureStartC: number | null;
  temperatureHighC: number | null;
  windKmh: number;
  ridgeWindKmh: number;
  precipMmH: number;
  snowDepthCm: number;
  freezingLevelM: number | null;
  thunderstormRisk: boolean;
  avalancheBraLevel: 0 | 1 | 2 | 3 | 4 | 5;
  activeFireCount: number;
  activeFloodAlert: boolean;
  activeWeatherAlerts: string[];
  daylight: OfflineDaylight;
  sources: Array<{ name: string; updatedAtIso: string }>;
}

// ── Route Plan Request & Explainable Output ───────────────────────────────────

export interface RoutePlanEndpoint {
  lat: number;
  lng: number;
  label?: string;
  poiId?: string;
}

export interface RoutePlanRequest {
  origin: RoutePlanEndpoint;
  destination: RoutePlanEndpoint;
  mode?: RoutingTravelMode;
  kitId?: string | null;
  packWeightKg?: number | null;
  departureTimeIso?: string | null;
}

export interface ExplanationVariableItem {
  id: string;
  pillar: 'physiology' | 'equipment' | 'weather' | 'terrain';
  label: string;
  value: string;
  /** Signed impact summary, e.g. "+14 min", "Évité", "Validé", "Marge +2h10". */
  impactLabel: string;
  tone: 'good' | 'neutral' | 'warn' | 'bad';
  detail: string;
  /** Optional map focus coordinate or highlighted segment when tapped in XAI sub-sheet. */
  focusCoords?: [number, number] | null;
  highlightSegment?: Array<[number, number]> | null;
  source?: string;
  updatedAtIso?: string;
}

export interface RouteExplanationBreakdown {
  headline: string;
  whyChosen: string[];
  comparisonVsPrimary?: string | null;
  variables: ExplanationVariableItem[];
  surfaceBreakdownPct: {
    paved: number;
    gravel: number;
    trail: number;
    technical: number;
  };
  maxSacGradeLabel: string;
  maxSlopeDeg: number;
  exposedSlope30PlusM: number;
  waterPointsCount: number;
  sheltersCount: number;
  dataFreshness: Array<{ source: string; updatedAtIso: string }>;
}

export interface ItineraryElevationPoint {
  km: number;
  ele: number;
  lat: number;
  lng: number;
  slopePct: number;
}

export interface ItineraryLeg {
  id: string;
  kind: 'approach_car' | 'approach_transit' | 'approach_bike' | 'terrain';
  mode: RoutingTravelMode | 'car' | 'public_transit';
  label: string;
  fromLabel: string;
  toLabel: string;
  distanceKm: number;
  durationMin: number;
  dplusM: number;
  dminusM: number;
  coordinates: Array<[number, number]>;
}

export interface ComputedItinerary {
  id: string;
  rank: number;
  role: 'recommended' | 'safer' | 'gentler' | 'faster';
  roleLabel: string;
  title: string;
  mode: RoutingTravelMode;
  recommendedSport: Sport;
  engineUsed: 'rust_wasm_local' | 'ts_parity_local' | 'valhalla_enriched' | 'geoapify_enriched' | 'multimodal_hybrid';
  computeTimeMs: number;

  // Core KPIs
  distanceKm: number;
  dplusM: number;
  dminusM: number;
  maxAltM: number | null;
  minAltM: number | null;
  durationP50Min: number;
  durationP90Min: number;
  estimatedKcal: number;
  relativeEffortPct: number;
  hydrationLiters: number;
  arrivalTimeIso: string;
  turnaroundTimeIso: string | null;
  afterDarkMinutes: number;

  // Deltas vs recommended route (null on rank 0)
  deltaDurationMin: number | null;
  deltaDplusM: number | null;
  deltaDistanceKm: number | null;
  overlapRatioWithPrimary: number;

  // Safety & Fit
  fit: OutingFitResult;

  // Geometry, legs, elevation profile & full XAI breakdown
  geojson: {
    type: 'Feature';
    properties: Record<string, unknown>;
    geometry: {
      type: 'LineString';
      coordinates: Array<[number, number]>;
    };
  };
  legs: ItineraryLeg[];
  elevationProfile: ItineraryElevationPoint[];
  explanation: RouteExplanationBreakdown;
}

export interface RoutePlanResponse {
  ok: true;
  origin: RoutePlanEndpoint;
  destination: RoutePlanEndpoint;
  manifestSummary: {
    authenticated: boolean;
    allowedModes: RoutingTravelMode[];
    activeMode: RoutingTravelMode;
    packWeightKg: number;
    activeKitId: string | null;
    activeKitName: string | null;
    availableKits: UserKitOption[];
    readinessScore: number | null;
    readinessStatus: ExplorerReadiness['status'];
    calibrationSummary: string;
  };
  environment: RouteEnvironmentSnapshot;
  recommended: ComputedItinerary;
  alternatives: ComputedItinerary[];
  offlineReady: boolean;
}
