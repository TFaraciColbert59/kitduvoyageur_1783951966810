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
   * Projected onto a standard 240x90 or 240x80 viewBox.
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
  gpxUrl?: string;
}

// ============================================================================
// 2. KIT SNAPSHOT (PACK & GEAR LINEAGE)
// ============================================================================

export interface KitCategoryBreakdown {
  name: string;
  count: number;
  weightGrams: number;
}

export type KitCategoryMetric = KitCategoryBreakdown;

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
  updatedAt?: string;
  baseWeightGrams?: number;
}

// ============================================================================
// 3. EQUIPMENT SNAPSHOT (SINGLE GEAR PIECE & SHOP INTEGRATION)
// ============================================================================

export interface EquipmentSnapshot {
  type: 'equipment_snapshot';
  equipmentId: string;
  id?: string;
  name: string;
  category: string; // e.g. 'shelter', 'sleep', 'cook', 'clothing', 'water', 'safety', 'misc', 'tech'
  weightGrams: number;
  brand?: string;
  model?: string;
  priceCents?: number;
  photoUrl?: string;
  productSlug?: string;
  isShared?: boolean;
  capacityPeople?: number;
  isVital?: boolean;
  status?: 'to_buy' | 'owned' | 'packed' | 'shared' | 'wishlist';
  specs?: Record<string, string | number>;
  assignedTo?: string;
  packedSize?: string;
}

// ============================================================================
// 4. EXPEDITION SNAPSHOT (EXPEDITION ROOMS & TRIPS)
// ============================================================================

export interface ExpeditionParticipantPreview {
  id: string;
  name: string;
  fullName?: string;
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
  id?: string;
  tripId?: string;
  title: string;
  destinationName?: string;
  locationName?: string;
  status: 'planning' | 'confirmed' | 'active' | 'completed' | 'archived' | 'canceled';
  startDate?: string;
  endDate?: string;
  daysRemaining?: number;
  participantCount: number;
  participantsPreview?: ExpeditionParticipantPreview[];
  members?: Array<{
    id: string;
    fullName: string;
    avatarUrl: string;
    role?: 'owner' | 'guide' | 'safety' | 'member';
  }>;
  gpxPreview?: {
    title: string;
    distanceKm: number;
    elevationGainM: number;
    svgPolylinePath?: string;
  };
  totalDistanceKm?: number;
  routeDistanceKm?: number;
  totalElevationGainM?: number;
  elevationGainM?: number;
  totalKitWeightKg?: number;
  coverImageUrl?: string;
  weatherPreview?: ExpeditionWeatherPreview;
  routeSnapshotSvg?: string;
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

export type OutdoorSnapshot = OutdoorObjectSnapshot;
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
  if (!meta || typeof meta !== 'object') return false;
  const s = meta as Record<string, unknown>;
  return (
    s.type === 'gpx_snapshot' &&
    typeof s.title === 'string' &&
    typeof s.distanceKm === 'number' &&
    !isNaN(s.distanceKm) &&
    s.distanceKm >= 0 &&
    typeof s.svgPolylinePath === 'string' &&
    typeof s.bounds === 'object' &&
    s.bounds !== null &&
    !Array.isArray(s.bounds)
  );
}

export function isKitSnapshot(meta: unknown): meta is KitSnapshot {
  if (!meta || typeof meta !== 'object') return false;
  const s = meta as Record<string, unknown>;
  return (
    s.type === 'kit_snapshot' &&
    typeof s.kitId === 'string' &&
    typeof s.totalWeightGrams === 'number' &&
    !isNaN(s.totalWeightGrams) &&
    s.totalWeightGrams >= 0 &&
    Array.isArray(s.categories)
  );
}

export function isEquipmentSnapshot(meta: unknown): meta is EquipmentSnapshot {
  if (!meta || typeof meta !== 'object') return false;
  const s = meta as Record<string, unknown>;
  return (
    s.type === 'equipment_snapshot' &&
    (typeof s.equipmentId === 'string' || typeof s.id === 'string') &&
    typeof s.name === 'string' &&
    typeof s.weightGrams === 'number' &&
    !isNaN(s.weightGrams) &&
    s.weightGrams >= 0
  );
}

export function isExpeditionSnapshot(meta: unknown): meta is ExpeditionSnapshot {
  if (!meta || typeof meta !== 'object') return false;
  const s = meta as Record<string, unknown>;
  return (
    s.type === 'expedition_snapshot' &&
    (typeof s.expeditionId === 'string' || typeof s.id === 'string') &&
    typeof s.title === 'string' &&
    typeof s.status === 'string' &&
    typeof s.participantCount === 'number' &&
    !isNaN(s.participantCount) &&
    s.participantCount >= 0
  );
}

export function isActivitySheetSnapshot(meta: unknown): meta is ActivitySheetSnapshot {
  if (!meta || typeof meta !== 'object') return false;
  const s = meta as Record<string, unknown>;
  return (
    s.type === 'activity_sheet_snapshot' &&
    typeof s.activityId === 'string' &&
    typeof s.title === 'string'
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

// ============================================================================
// 8. HYDRATION HELPER
// ============================================================================

export function hydrateOutdoorSnapshot(metadata: unknown): OutdoorSnapshot | null {
  if (isGPXSnapshot(metadata)) return metadata;
  if (isKitSnapshot(metadata)) return metadata;
  if (isEquipmentSnapshot(metadata)) return metadata;
  if (isExpeditionSnapshot(metadata)) return metadata;
  if (isActivitySheetSnapshot(metadata)) return metadata;
  return null;
}

// ============================================================================
// 9. SERIALIZERS
// ============================================================================

export function serializeGPXSnapshot(input: {
  title: string;
  points: Array<{ lat: number; lng: number; ele?: number }>;
  width?: number;
  height?: number;
  padding?: number;
}): GPXSnapshot {
  const { title, points, width = 240, height = 90, padding = 10 } = input;
  if (!points || points.length < 2) {
    throw new Error('GPX snapshot requires at least 2 points');
  }

  let totalDistKm = 0;
  let elevationGainM = 0;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    minLat = Math.min(minLat, p1.lat);
    maxLat = Math.max(maxLat, p1.lat);
    minLng = Math.min(minLng, p1.lng);
    maxLng = Math.max(maxLng, p1.lng);

    if (i > 0) {
      const p0 = points[i - 1];
      const R = 6371;
      const dLat = ((p1.lat - p0.lat) * Math.PI) / 180;
      const dLon = ((p1.lng - p0.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((p0.lat * Math.PI) / 180) *
          Math.cos((p1.lat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalDistKm += R * c;

      if (p0.ele != null && p1.ele != null) {
        const diff = p1.ele - p0.ele;
        if (diff > 0) elevationGainM += diff;
      }
    }
  }

  const latSpan = maxLat - minLat || 0.0001;
  const lngSpan = maxLng - minLng || 0.0001;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const polyline = points
    .map((p) => {
      const x = ((p.lng - minLng) / lngSpan) * innerW + padding;
      const y = height - (((p.lat - minLat) / latSpan) * innerH + padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Mountain pace: 4 km/h flat + 300m/h ascent
  const flatHours = totalDistKm / 4.0;
  const ascentHours = elevationGainM / 300.0;
  const estDurationMin = Math.round((flatHours + ascentHours) * 60);

  return {
    type: 'gpx_snapshot',
    title,
    distanceKm: Math.round(totalDistKm * 10) / 10,
    elevationGainM: Math.round(elevationGainM),
    estimatedDurationMinutes: estDurationMin,
    svgPolylinePath: polyline,
    bounds: { minLat, maxLat, minLng, maxLng },
  };
}

export function serializeKitSnapshot(kit: {
  id: string;
  title: string;
  items: Array<{ name: string; weightGrams: number; category: string }>;
}): KitSnapshot {
  const categoryMap = new Map<string, { count: number; weightGrams: number }>();
  let totalWeightGrams = 0;

  for (const item of kit.items) {
    totalWeightGrams += item.weightGrams;
    const cat = categoryMap.get(item.category) || { count: 0, weightGrams: 0 };
    cat.count += 1;
    cat.weightGrams += item.weightGrams;
    categoryMap.set(item.category, cat);
  }

  const categories: KitCategoryBreakdown[] = Array.from(categoryMap.entries()).map(([name, stat]) => ({
    name,
    count: stat.count,
    weightGrams: stat.weightGrams,
  }));

  return {
    type: 'kit_snapshot',
    kitId: kit.id,
    title: kit.title,
    totalWeightGrams,
    itemCount: kit.items.length,
    categories,
  };
}
