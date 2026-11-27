/**
 * Explorer v2 — 3D Diorama Level-of-Detail (LOD), Visual Hierarchy & Diversity Quotas.
 *
 * Modulates 3D map objects dynamically by zoom, archetype importance, active drawer
 * category, and viewport density:
 * - 3 visual LOD tiers (`full` Meshy GLB, `compact` scaled GLB, `beacon` ultra-lightweight pin)
 * - Calibrated per-archetype scale hierarchy (landmarks/peaks/refuges > outdoor > local transit)
 * - Per-subtype viewport diversity quotas (prevents 8 bus stops crowding out refuges & peaks)
 * - Calm motion profiles (`gentle-sway` for architecture/vehicles vs `turntable` for collectibles)
 * - Clean ground rings (shown only on selected, hovered, or hero entities)
 */

import type { Floating3DEntityKind, Floating3DItem } from './explorerThree3DLayer';

export type Lod3DMode = 'full' | 'compact' | 'beacon';
export type Motion3DStyle = 'turntable' | 'gentle-sway' | 'static';
export type VisualTier = 1 | 2 | 3;

export interface Visual3DProfile {
  tier: VisualTier;
  lodMode: Lod3DMode;
  scaleMultiplier: number;
  showRing: boolean;
  motionStyle: Motion3DStyle;
}

const TIER_1_HERO_KINDS = new Set<Floating3DEntityKind>([
  'summit',
  'refuge',
  'city',
  'village',
  'carnet',
  'bottle',
  'club',
  'fire',
  'flood',
  'rescue',
  'seismic',
  'danger',
]);

const TIER_3_LOCAL_KINDS = new Set<Floating3DEntityKind>([
  'bus_stop',
  'parking',
  'train_station',
  'bike_shop',
  'bike_repair',
  'ebike_charging',
  'friend',
  'spot',
]);

const ARCHITECTURE_AND_VEHICLES = new Set<Floating3DEntityKind>([
  'refuge',
  'wilderness_hut',
  'shelter',
  'bivouac',
  'village',
  'city',
  'bus_stop',
  'train_station',
  'parking',
  'trailhead',
  'bike_shop',
  'bike_repair',
  'ebike_charging',
  'summit',
  'saddle',
  'club_event',
]);

/**
 * Minimum zoom at which a 3D archetype is eligible to appear (unless explicitly selected).
 * Prevents local transit & street furniture from cluttering valley or regional views.
 */
export function minZoomFor3DKind(kind: Floating3DEntityKind): number {
  switch (kind) {
    case 'bus_stop':
    case 'parking':
    case 'bike_repair':
    case 'ebike_charging':
      return 13.2;
    case 'bike_shop':
    case 'train_station':
    case 'trailhead':
    case 'shelter':
      return 12.0;
    case 'water':
    case 'spring':
    case 'wilderness_hut':
    case 'bivouac':
    case 'viewpoint':
    case 'saddle':
      return 10.6;
    case 'pokedex':
    case 'pokedex_flora':
    case 'pokedex_bird':
    case 'pokedex_mammal':
    case 'pokedex_fungi':
    case 'pokedex_insect':
    case 'pokedex_aqua':
      return 8.5;
    case 'summit':
    case 'refuge':
    case 'village':
    case 'city':
    case 'club':
    case 'club_event':
    case 'story':
    case 'saved_place':
      return 6.8;
    case 'bottle':
    case 'carnet':
    case 'fire':
    case 'flood':
    case 'seismic':
    case 'rescue':
    case 'danger':
    case 'aircraft':
      return 3.5;
    default:
      return 11.5;
  }
}

/**
 * Maximum simultaneous instances of the same subtype allowed in the 3D scene
 * so repetitive street POIs (bus stops, parkings) never drown out outdoor landmarks.
 */
export function subtypeQuotaFor3DKind(
  kind: Floating3DEntityKind,
  zoom: number,
  activeCategory?: string | null,
): number {
  if (kind === 'bus_stop') return zoom >= 15 ? 3 : 2;
  if (kind === 'parking') return zoom >= 15 ? 3 : 2;
  if (kind === 'train_station') return 2;
  if (kind === 'water' || kind === 'spring') {
    return activeCategory === 'safety' ? 6 : zoom >= 14 ? 4 : 3;
  }
  if (kind === 'village' || kind === 'city') return 3;
  if (kind === 'spot') return 2;
  if (kind.startsWith('pokedex')) return activeCategory === 'pokedex' ? 8 : 4;
  return 6;
}

export function visualTierFor3DKind(kind: Floating3DEntityKind): VisualTier {
  if (TIER_1_HERO_KINDS.has(kind)) return 1;
  if (TIER_3_LOCAL_KINDS.has(kind)) return 3;
  return 2;
}

/**
 * Computes the live visual LOD mode, scale hierarchy, ground-ring policy, and
 * motion style for a single 3D entity at the current zoom & screen position.
 */
export function resolve3DVisualProfile(
  kind: Floating3DEntityKind,
  zoom: number,
  options: {
    selected?: boolean;
    hovered?: boolean;
    distCenterNorm?: number;
    activeCategory?: string | null;
  } = {},
): Visual3DProfile {
  const z = Number.isFinite(zoom) ? zoom : 12;
  const selected = Boolean(options.selected);
  const hovered = Boolean(options.hovered);
  const distNorm = typeof options.distCenterNorm === 'number' ? options.distCenterNorm : 0.35;
  const tier = visualTierFor3DKind(kind);

  const motionStyle: Motion3DStyle =
    kind === 'aircraft'
      ? 'static'
      : ARCHITECTURE_AND_VEHICLES.has(kind)
        ? 'gentle-sway'
        : 'turntable';

  // Selected hero always gets full-detail GLB + prominent scale + luminous ring
  if (selected) {
    return {
      tier: 1,
      lodMode: 'full',
      scaleMultiplier: 1.24,
      showRing: true,
      motionStyle,
    };
  }

  // Determine 3-tier LOD:
  // - Wide overview (z < 9.2): lightweight shared 3D beacon (zero GLB download/draw cost)
  // - Regional / valley (9.2 <= z < 12.2): full for Tier 1, compact for Tier 2, beacon for Tier 3/far edges
  // - Local terrain (z >= 12.2): full for Tier 1 & central Tier 2, compact for Tier 3 & screen periphery
  let lodMode: Lod3DMode = 'full';
  if (z < 9.2) {
    lodMode = tier === 1 && distNorm < 0.55 ? 'compact' : 'beacon';
  } else if (z < 12.2) {
    if (tier === 1) lodMode = distNorm < 0.72 ? 'full' : 'compact';
    else if (tier === 2) lodMode = distNorm < 0.65 ? 'compact' : 'beacon';
    else lodMode = 'beacon';
  } else {
    if (tier === 1) lodMode = 'full';
    else if (tier === 2) lodMode = distNorm < 0.85 ? 'full' : 'compact';
    else lodMode = distNorm < 0.75 ? 'compact' : 'beacon';
  }

  // Calibrated visual scale hierarchy: landmarks pop, local transit stays compact & tidy
  let scaleMultiplier = tier === 1 ? 1.08 : tier === 2 ? 0.94 : 0.74;
  if (lodMode === 'compact') scaleMultiplier *= 0.88;
  if (lodMode === 'beacon') scaleMultiplier = 0.64;

  // Keep ground rings clean: only on hovered items, Tier 1 landmarks at close zoom, or active-category focus
  const isCategoryFocus =
    (options.activeCategory === 'pokedex' && (kind === 'pokedex' || kind.startsWith('pokedex_'))) ||
    (options.activeCategory === 'community' &&
      (kind === 'bottle' || kind === 'carnet' || kind === 'club' || kind === 'club_event' || kind === 'story')) ||
    (options.activeCategory === 'safety' &&
      (kind === 'fire' || kind === 'flood' || kind === 'seismic' || kind === 'rescue' || kind === 'danger'));

  const showRing = hovered || (lodMode === 'full' && (tier === 1 || isCategoryFocus));

  return {
    tier,
    lodMode,
    scaleMultiplier,
    showRing,
    motionStyle,
  };
}

/**
 * Adaptive screen-space collision clearance so mid-zoom scenes breathe generously
 * while zoomed-in local views pack rich detail cleanly.
 */
export function adaptiveCollisionSpacing(zoom: number): { enterPx: number; exitPx: number } {
  const z = Number.isFinite(zoom) ? zoom : 12;
  if (z < 10.5) return { enterPx: 62, exitPx: 44 };
  if (z < 13.0) return { enterPx: 54, exitPx: 38 };
  return { enterPx: 48, exitPx: 34 };
}

/**
 * Selects a balanced, diverse subset of 3D items for the current zoom & category:
 * - Always keeps the selected item first
 * - Filters out micro-scale street furniture when zoomed out (`minZoomFor3DKind`)
 * - Enforces per-subtype diversity quotas so one repetitive POI type never hijacks the map
 */
export function selectBalanced3DItems(
  scoredCandidates: ReadonlyArray<{ item: Floating3DItem; score: number }>,
  options: { zoom: number; activeCategory?: string | null; maxTotal: number },
): Floating3DItem[] {
  const { zoom, activeCategory, maxTotal } = options;
  const sorted = [...scoredCandidates].sort((a, b) => a.score - b.score);
  const selectedOut: Floating3DItem[] = [];
  const countsByKind = new Map<Floating3DEntityKind, number>();

  for (const entry of sorted) {
    if (selectedOut.length >= maxTotal) break;
    const { item } = entry;

    if (item.selected) {
      selectedOut.push(item);
      countsByKind.set(item.kind, (countsByKind.get(item.kind) ?? 0) + 1);
      continue;
    }

    if (zoom < minZoomFor3DKind(item.kind)) continue;

    const quota = subtypeQuotaFor3DKind(item.kind, zoom, activeCategory);
    const currentCount = countsByKind.get(item.kind) ?? 0;
    if (currentCount >= quota) continue;

    countsByKind.set(item.kind, currentCount + 1);
    selectedOut.push(item);
  }

  return selectedOut;
}
