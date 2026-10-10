/**
 * LKDV Social — Outdoor Objects Domain Snapshots & Types
 * File: src/features/messaging/types/outdoorObjects.types.ts
 *
 * Provides pre-computed lightweight snapshots for 1st-class outdoor objects:
 * - GPXSnapshot (pre-computed SVG geometry, 0 runtime XML parse during chat scroll)
 * - KitSnapshot (gear count, categories, weight breakdown, pack merge readiness)
 * - EquipmentSnapshot (specs, weight in grams, shop link, sharing capabilities)
 * - ExpeditionSnapshot (expedition rooms & trips status, roster preview, weather)
 * - ActivitySheetSnapshot (topo fiche, logistics scope, key stats)
 *
 * Seamlessly wires into Message.metadata via OutdoorObjectSnapshot union and type guards.
 */

import type {
  ProductMessageMeta,
  TrailMessageMeta,
  KitMessageMeta,
} from './messaging.types';

// ============================================================================
// 1. GPX SNAPSHOT (ZERO-OVERHEAD RUNTIME RENDERING)
// ============================================================================

export interface GPXBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface GPXWaypointSummary {
  id: string;
  name: string;
  lat: number;
  lng: number;
  elevationM?: number;
  type?: 'water_point' | 'bivouac' | 'summit' | 'refuge' | 'danger' | 'generic';
}

export interface GPXSnapshot {
  type: 'gpx_snapshot';
  id?: string;
  title: string;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM?: number;
  estimatedDurationMinutes: number;
  /**
   * Pre-computed SVG polyline path coordinates string (e.g. "12.4,85.1 24.8,60.2 ...")
   * Projected onto a standard 240x90 or custom viewBox.
   * Eliminates runtime GPX XML parsing and coordinates projection during chat scroll.
   */
  svgPolylinePath: string;
  /**
   * Geographic bounding box for map zoom on click.
   */
  bounds: GPXBounds;
  /**
   * Optional pre-computed SVG path for elevation profile silhouette (area/polyline).
   */
  elevationProfilePath?: string;
  startPoint?: { lat: number; lng: number; label?: string };
  endPoint?: { lat: number; lng: number; label?: string };
  maxElevationM?: number;
  minElevationM?: number;
  difficulty?: 'easy' | 'moderate' | 'hard' | 'expert';
  waypointsPreview?: GPXWaypointSummary[];
  /** Remote URL to download original GPX for GPS watch / export */
  gpxFileUrl?: string;
}

// ============================================================================
// 2. KIT SNAPSHOT (PACK & GEAR LINEAGE)
// ============================================================================

export interface KitCategoryBreakdown {
  name: string;
  count: number;
  weightGrams: number;
}

export interface KitItemPreview {
  id: string;
  name: string;
  weightGrams: number;
  category: string;
  isShared?: boolean;
  isWorn?: boolean;
  isConsumable?: boolean;
  quantity?: number;
}

export interface KitSnapshot {
  type: 'kit_snapshot';
  kitId: string;
  title: string;
  totalWeightGrams: number;
  itemCount: number;
  categories: KitCategoryBreakdown[];
  ownerId?: string;
  ownerName?: string;
  mulCategory?: 'ultralight' | 'light' | 'traditional';
  itemsPreview?: KitItemPreview[];
  /** Whether the kit includes shared gear marked for group pack merge */
  isSharedPackReady?: boolean;
}

// ============================================================================
// 3. EQUIPMENT SNAPSHOT (SINGLE GEAR PIECE & SHOP INTEGRATION)
// ============================================================================

export interface EquipmentSnapshot {
  type: 'equipment_snapshot';
  equipmentId: string;
  name: string;
  category: string; // e.g. 'shelter', 'sleep', 'cook', 'clothing', 'water', 'safety', 'misc'
  weightGrams: number;
  brand?: string;
  priceCents?: number;
  photoUrl?: string;
  productSlug?: string;
  isShared?: boolean;
  capacityPeople?: number;
  isVital?: boolean;
  specs?: Record<string, string | number>;
}

// ============================================================================
// 4. EXPEDITION SNAPSHOT (EXPEDITION ROOMS & TRIPS)
// ============================================================================

export interface ExpeditionParticipantPreview {
  id: string;
  name: string;
  avatarUrl?: string;
  role?: 'owner' | 'admin' | 'guide' | 'safety' | 'medic' | 'scout' | 'member';
  isDog?: boolean;
}

export interface ExpeditionWeatherPreview {
  condition?: string;
  tempMinC?: number;
  tempMaxC?: number;
  precipitationProb?: number;
  windSpeedKmh?: number;
}

export interface ExpeditionSnapshot {
  type: 'expedition_snapshot';
  expeditionId: string;
  tripId?: string;
  title: string;
  destinationName?: string;
  status: 'planning' | 'active' | 'completed' | 'archived';
  startDate?: string;
  endDate?: string;
  participantCount: number;
  participantsPreview: ExpeditionParticipantPreview[];
  gpxPreview?: {
    title: string;
    distanceKm: number;
    elevationGainM: number;
    svgPolylinePath?: string;
  };
  totalKitWeightKg?: number;
  weatherPreview?: ExpeditionWeatherPreview;
}

// ============================================================================
// 5. ACTIVITY SHEET SNAPSHOT (TOPO FICHE & ITINERARY TEMPLATE)
// ============================================================================

export interface ActivitySheetSnapshot {
  type: 'activity_sheet_snapshot';
  activityId: string;
  title: string;
  activityType: 'hiking' | 'trekking' | 'bivouac' | 'roadtrip' | 'bushcraft' | 'mixed' | 'travel';
  difficulty?: 'easy' | 'moderate' | 'hard' | 'expert';
  estimatedDurationMinutes?: number;
  distanceKm?: number;
  elevationGainM?: number;
  requiredGearHighlights?: string[];
  seasonRecommended?: string[];
  logisticsScope?: 'none' | 'access' | 'stages' | 'full';
  keyWaypointsCount?: number;
  coverImageUrl?: string;
}

// ============================================================================
// 6. METADATA UNION & WIRING INTO MESSAGING
// ============================================================================

export type OutdoorObjectSnapshot =
  | GPXSnapshot
  | KitSnapshot
  | EquipmentSnapshot
  | ExpeditionSnapshot
  | ActivitySheetSnapshot;

export type OutdoorSnapshotType = OutdoorObjectSnapshot['type'];

/**
 * Message metadata with complete type safety across legacy metas and new outdoor snapshots.
 */
export type MessageMetadata =
  | OutdoorObjectSnapshot
  | ProductMessageMeta
  | TrailMessageMeta
  | KitMessageMeta
  | Record<string, unknown>;

// ============================================================================
// 7. TYPE GUARDS / PREDICATES
// ============================================================================

export function isGPXSnapshot(meta: unknown): meta is GPXSnapshot {
  return (
    typeof meta === 'object' &&
    meta !== null &&
    (meta as { type?: string }).type === 'gpx_snapshot' &&
    typeof (meta as GPXSnapshot).svgPolylinePath === 'string'
  );
}

export function isKitSnapshot(meta: unknown): meta is KitSnapshot {
  return (
    typeof meta === 'object' &&
    meta !== null &&
    (meta as { type?: string }).type === 'kit_snapshot' &&
    typeof (meta as KitSnapshot).kitId === 'string'
  );
}

export function isEquipmentSnapshot(meta: unknown): meta is EquipmentSnapshot {
  return (
    typeof meta === 'object' &&
    meta !== null &&
    (meta as { type?: string }).type === 'equipment_snapshot' &&
    typeof (meta as EquipmentSnapshot).equipmentId === 'string'
  );
}

export function isExpeditionSnapshot(meta: unknown): meta is ExpeditionSnapshot {
  return (
    typeof meta === 'object' &&
    meta !== null &&
    (meta as { type?: string }).type === 'expedition_snapshot' &&
    typeof (meta as ExpeditionSnapshot).expeditionId === 'string'
  );
}

export function isActivitySheetSnapshot(meta: unknown): meta is ActivitySheetSnapshot {
  return (
    typeof meta === 'object' &&
    meta !== null &&
    (meta as { type?: string }).type === 'activity_sheet_snapshot' &&
    typeof (meta as ActivitySheetSnapshot).activityId === 'string'
  );
}

export function isOutdoorObjectSnapshot(meta: unknown): meta is OutdoorObjectSnapshot {
  return (
    isGPXSnapshot(meta) ||
    isKitSnapshot(meta) ||
    isEquipmentSnapshot(meta) ||
    isExpeditionSnapshot(meta) ||
    isActivitySheetSnapshot(meta)
  );
}
