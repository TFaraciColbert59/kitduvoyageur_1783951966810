/**
 * Explorer v2 — Interactive Map Feature Hit-Testing & Tap Priority.
 *
 * Enforces strict deterministic selection order whenever multiple interactive
 * MapLibre layers overlap under a single user tap:
 *   1. Hazards / Airspace / Bottles / Pokédex / Social points & clusters (priority 100)
 *   2. Routes (`xp-routes`) (priority 50)
 *   3. Regions (`xp-regions`) (priority 20)
 *   4. Countries (`xp-countries`) (priority 10)
 */

export type MapInteractiveKind =
  | 'hazard'
  | 'bottle'
  | 'pokedex'
  | 'carnet'
  | 'club'
  | 'story'
  | 'friend'
  | 'itinerary'
  | 'route'
  | 'region'
  | 'country';

export interface MapInteractiveSelection {
  kind: MapInteractiveKind;
  id: string;
  sourceId: string;
  isCluster?: boolean;
  clusterId?: number;
  pointCount?: number;
  properties: Record<string, unknown>;
  coordinates: [number, number];
}

export interface PickableMapFeature {
  layerId: string;
  sourceId: string;
  properties: Record<string, unknown>;
  coordinates: [number, number];
}

interface LayerClassification {
  kind: MapInteractiveKind;
  priority: number;
}

const POINT_PRIORITY = 100;
const ITINERARY_PRIORITY = 70;
const ROUTE_PRIORITY = 50;
const REGION_PRIORITY = 20;
const COUNTRY_PRIORITY = 10;

function classifyInteractiveFeature(
  layerId: string,
  sourceId: string,
): LayerClassification | null {
  const layer = layerId.trim();
  const source = sourceId.trim();

  if (source.startsWith('xp-hazard-') || layer.startsWith('xp-hazard-')) {
    return { kind: 'hazard', priority: POINT_PRIORITY };
  }
  if (source === 'xp-airspace-aircraft' || layer.startsWith('xp-airspace-aircraft')) {
    return { kind: 'hazard', priority: POINT_PRIORITY };
  }
  if (source === 'xp-social-bottles' || layer.startsWith('xp-social-bottles')) {
    return { kind: 'bottle', priority: POINT_PRIORITY };
  }
  if (source === 'xp-pokedex-species' || layer.startsWith('xp-pokedex-species')) {
    return { kind: 'pokedex', priority: POINT_PRIORITY };
  }
  if (source === 'xp-social-carnets' || layer.startsWith('xp-social-carnets')) {
    return { kind: 'carnet', priority: POINT_PRIORITY };
  }
  if (source === 'xp-social-clubs' || layer.startsWith('xp-social-clubs')) {
    return { kind: 'club', priority: POINT_PRIORITY };
  }
  if (source === 'xp-social-stories' || layer.startsWith('xp-social-stories')) {
    return { kind: 'story', priority: POINT_PRIORITY };
  }
  if (source === 'xp-social-friends' || layer.startsWith('xp-social-friends')) {
    return { kind: 'friend', priority: POINT_PRIORITY };
  }

  if (
    source === 'xp-poi-itineraries' ||
    layer === 'xp-poi-itinerary-main-line' ||
    layer === 'xp-poi-itinerary-alt-line' ||
    layer === 'xp-poi-itinerary-alt-hit'
  ) {
    return { kind: 'itinerary', priority: ITINERARY_PRIORITY };
  }

  if (
    source === 'xp-routes' ||
    layer === 'xp-routes' ||
    layer === 'xp-routes-line' ||
    layer === 'xp-routes-casing'
  ) {
    return { kind: 'route', priority: ROUTE_PRIORITY };
  }

  if (source === 'xp-regions' || layer === 'xp-regions' || layer === 'xp-regions-fill') {
    return { kind: 'region', priority: REGION_PRIORITY };
  }

  if (source === 'xp-countries' || layer === 'xp-countries' || layer === 'xp-countries-fill') {
    return { kind: 'country', priority: COUNTRY_PRIORITY };
  }

  return null;
}

/**
 * Returns true if a MapLibre layer ID should be queried on map click.
 */
export function isInteractiveMapLayerId(layerId: string): boolean {
  if (!layerId) return false;
  if (
    layerId.startsWith('xp-hazard-') ||
    layerId.startsWith('xp-social-') ||
    layerId.startsWith('xp-pokedex-') ||
    layerId.startsWith('xp-airspace-')
  ) {
    return true;
  }
  return (
    layerId === 'xp-poi-itinerary-main-line' ||
    layerId === 'xp-poi-itinerary-alt-line' ||
    layerId === 'xp-poi-itinerary-alt-hit' ||
    layerId === 'xp-routes-line' ||
    layerId === 'xp-routes-casing' ||
    layerId === 'xp-regions-fill' ||
    layerId === 'xp-countries-fill'
  );
}

function resolveFeatureId(
  kind: MapInteractiveKind,
  sourceId: string,
  properties: Record<string, unknown>,
  isCluster: boolean,
  clusterId: number | undefined,
  pointCount: number | undefined,
): string {
  if (isCluster) {
    return `cluster:${sourceId}:${clusterId ?? pointCount ?? 'group'}`;
  }

  if (kind === 'country') {
    const iso = properties.iso_a2 ?? properties.iso ?? properties.id;
    return typeof iso === 'string' || typeof iso === 'number' ? String(iso) : '';
  }

  if (kind === 'region') {
    const group =
      (typeof properties.group === 'string' && properties.group.trim().length > 0
        ? properties.group
        : null) ??
      (typeof properties.name === 'string' && properties.name.trim().length > 0
        ? properties.name
        : null) ??
      properties.id;
    return typeof group === 'string' || typeof group === 'number' ? String(group) : '';
  }

  if (kind === 'itinerary') {
    const itId = properties.itineraryId ?? properties.id;
    return typeof itId === 'string' || typeof itId === 'number' ? String(itId) : '';
  }

  const candidate =
    properties.id ??
    properties.taxonId ??
    properties.icao24 ??
    properties.callsign ??
    properties.slug ??
    properties.name;
  return typeof candidate === 'string' || typeof candidate === 'number' ? String(candidate) : '';
}

/**
 * Picks the single highest-priority interactive feature from a rendered feature list.
 * Non-interactive layers are ignored; among equal priorities, the topmost (first) wins.
 */
export function pickHighestPriorityFeature(
  features: ReadonlyArray<PickableMapFeature>,
): MapInteractiveSelection | null {
  let bestPriority = -1;
  let bestSelection: MapInteractiveSelection | null = null;

  for (const feature of features) {
    const classification = classifyInteractiveFeature(feature.layerId, feature.sourceId);
    if (!classification) continue;
    if (classification.priority <= bestPriority) continue;

    const props = feature.properties ?? {};
    const isCluster = typeof props.point_count === 'number';
    const pointCount = isCluster ? (props.point_count as number) : undefined;
    const clusterId =
      isCluster && typeof props.cluster_id === 'number'
        ? (props.cluster_id as number)
        : undefined;

    const id = resolveFeatureId(
      classification.kind,
      feature.sourceId,
      props,
      isCluster,
      clusterId,
      pointCount,
    );

    const selection: MapInteractiveSelection = {
      kind: classification.kind,
      id,
      sourceId: feature.sourceId,
      properties: props,
      coordinates: feature.coordinates,
    };

    if (isCluster) {
      selection.isCluster = true;
      selection.pointCount = pointCount;
      if (clusterId !== undefined) {
        selection.clusterId = clusterId;
      }
    }

    bestPriority = classification.priority;
    bestSelection = selection;
  }

  return bestSelection;
}
