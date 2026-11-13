/**
 * Lot N02 — Régions prédéfinies durables (K4.14), zones personnalisées libres
 * et multiples avec limites visibles (K4.15), et affichage de la couverture
 * téléchargée sur la carte avec déduplication des tuiles et détection de limite
 * de zoom (K4.16).
 */

import { EARTH_RADIUS_M } from '../explorer-v2/geo/track';
import type { ZoneBounds } from '../explorer-v2/offline/zone';
import type {
  CustomZoneSelectionDraft,
  DrawerReturnContext,
  MultiZoneSelectionState,
  OfflineCoverageFeature,
  OfflineCoverageFeatureCollection,
  OfflineDrawerSubViewState,
  OfflineInstalledPackRecord,
  OfflinePackSizeEstimate,
  PredefinedRegionCatalogItem,
  TileCoordinate,
  ViewportOfflineCoverageEvaluation,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes d'estimation réalistes (tuiles + ressources annexes — Recherche 04)
// ─────────────────────────────────────────────────────────────────────────────

export const AVG_VECTOR_TILE_BYTES = 24 * 1024; // ~24 Ko / tuile MVT
export const AVG_DEM_TILE_BYTES = 18 * 1024; // ~18 Ko / tuile Terrarium PNG
export const STYLE_AND_SPRITES_BASE_BYTES = 180 * 1024; // Style JSON + sprites
export const GLYPH_RANGES_BASE_BYTES = 320 * 1024; // Plages PBF Noto Sans
export const AVG_POI_RECORD_BYTES = 1024; // 1 Ko / POI
export const AVG_ROUTE_RECORD_BYTES = 12 * 1024; // 12 Ko / itinéraire
export const AVG_MEDIA_PREVIEW_BYTES = 48 * 1024; // 48 Ko / vignette photo WebP
export const AVG_ROUTING_GRAPH_TILE_BYTES = 14 * 1024; // ~14 Ko / tuile graphe

export const DEFAULT_MAX_TILES_PER_CUSTOM_ZONE = 1_200;
export const DEFAULT_MAX_CUSTOM_ZONE_AREA_KM2 = 2_500;
export const DEFAULT_MIN_CUSTOM_ZONE_AREA_KM2 = 0.05;
export const DEFAULT_MAX_MULTI_ZONES = 8;

// ─────────────────────────────────────────────────────────────────────────────
// Projections Web Mercator XYZ & géométrie d'emprise
// ─────────────────────────────────────────────────────────────────────────────

export function lonToTileX(lon: number, zoom: number): number {
  const clampedLon = Math.max(-179.999999, Math.min(179.999999, lon));
  return Math.floor(((clampedLon + 180) / 360) * 2 ** zoom);
}

export function latToTileY(lat: number, zoom: number): number {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clampedLat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom,
  );
}

export function tileCoordKey(tile: TileCoordinate): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

export function isValidZoneBounds(bounds: ZoneBounds): boolean {
  return (
    typeof bounds.west === 'number' &&
    typeof bounds.south === 'number' &&
    typeof bounds.east === 'number' &&
    typeof bounds.north === 'number' &&
    Number.isFinite(bounds.west) &&
    Number.isFinite(bounds.south) &&
    Number.isFinite(bounds.east) &&
    Number.isFinite(bounds.north) &&
    bounds.west >= -180 &&
    bounds.east <= 180 &&
    bounds.south >= -90 &&
    bounds.north <= 90 &&
    bounds.west < bounds.east &&
    bounds.south < bounds.north
  );
}

/** Surface approximative d'une emprise rectangulaire en km². */
export function computeBoundsAreaKm2(bounds: ZoneBounds): number {
  if (!isValidZoneBounds(bounds)) return 0;
  const latRadSouth = (bounds.south * Math.PI) / 180;
  const latRadNorth = (bounds.north * Math.PI) / 180;
  const dLonRad = ((bounds.east - bounds.west) * Math.PI) / 180;
  const areaM2 =
    EARTH_RADIUS_M *
    EARTH_RADIUS_M *
    Math.abs(Math.sin(latRadNorth) - Math.sin(latRadSouth)) *
    Math.abs(dLonRad);
  return Math.round((areaM2 / 1_000_000) * 100) / 100;
}

/** Vrai si `inner` est entièrement contenue dans `outer`. */
export function boundsContainsBounds(outer: ZoneBounds, inner: ZoneBounds): boolean {
  if (!isValidZoneBounds(outer) || !isValidZoneBounds(inner)) return false;
  return (
    inner.west >= outer.west &&
    inner.east <= outer.east &&
    inner.south >= outer.south &&
    inner.north <= outer.north
  );
}

/** Vrai si deux emprises se chevauchent. */
export function boundsIntersect(a: ZoneBounds, b: ZoneBounds): boolean {
  if (!isValidZoneBounds(a) || !isValidZoneBounds(b)) return false;
  return a.west <= b.east && a.east >= b.west && a.south <= b.north && a.north >= b.south;
}

/** Vrai si un point `[lng, lat]` est dans `bounds`. */
export function boundsContainsPoint(bounds: ZoneBounds, lng: number, lat: number): boolean {
  if (!isValidZoneBounds(bounds)) return false;
  return lng >= bounds.west && lng <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

/**
 * Énumère toutes les coordonnées de tuiles `{ z, x, y }` couvrant `bounds`
 * entre `minZoom` et `maxZoom` inclus.
 */
export function enumerateTilesForBounds(
  bounds: ZoneBounds,
  minZoom: number,
  maxZoom: number,
): TileCoordinate[] {
  if (!isValidZoneBounds(bounds) || minZoom > maxZoom || minZoom < 0) return [];
  const tiles: TileCoordinate[] = [];
  for (let z = minZoom; z <= maxZoom; z += 1) {
    const x0 = lonToTileX(bounds.west, z);
    const x1 = lonToTileX(bounds.east, z);
    const y0 = latToTileY(bounds.north, z);
    const y1 = latToTileY(bounds.south, z);
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        tiles.push({ z, x, y });
      }
    }
  }
  return tiles;
}

/**
 * Construit l'ensemble des clés de tuiles `{z}/{x}/{y}` déjà présentes dans
 * des paquets installés et vérifiés (`available` ou `degraded`).
 */
export function computeCachedTileKeySet(
  installedPacks: readonly OfflineInstalledPackRecord[],
): Set<string> {
  const cachedKeys = new Set<string>();
  for (const pack of installedPacks) {
    if (pack.status !== 'available' && pack.status !== 'degraded') continue;
    for (const resource of pack.manifest.resources) {
      if (
        (resource.kind === 'vector_tile' || resource.kind === 'dem_tile') &&
        resource.tile &&
        pack.verifiedResources.has(resource.id)
      ) {
        cachedKeys.add(tileCoordKey(resource.tile));
      }
    }
    // Si le paquet couvre géométriquement des zooms et que toutes ses tuiles sont vérifiées
    const allVectorVerified = pack.manifest.resources
      .filter((r) => r.kind === 'vector_tile')
      .every((r) => pack.verifiedResources.has(r.id));
    if (allVectorVerified) {
      for (const tile of enumerateTilesForBounds(
        pack.manifest.bounds,
        pack.manifest.minZoom,
        pack.manifest.maxZoom,
      )) {
        cachedKeys.add(tileCoordKey(tile));
      }
    }
  }
  return cachedKeys;
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.14 — Catalogue de régions prédéfinies durables & estimation complète
// ─────────────────────────────────────────────────────────────────────────────

export const PREDEFINED_REGIONS_CATALOG: readonly PredefinedRegionCatalogItem[] = [
  {
    regionId: 'fr-chamonix-mont-blanc',
    name: 'Vallée de Chamonix & Massif du Mont-Blanc',
    countryIsoA2: 'FR',
    bounds: { west: 6.75, south: 45.82, east: 7.05, north: 46.02 },
    recommendedMinZoom: 10,
    recommendedMaxZoom: 14,
    poiCount: 145,
    routeCount: 38,
    unlocked: true,
    providerId: 'openfreemap-vector',
  },
  {
    regionId: 'fr-vercors-hauts-plateaux',
    name: 'Parc naturel régional du Vercors',
    countryIsoA2: 'FR',
    bounds: { west: 5.32, south: 44.75, east: 5.62, north: 45.15 },
    recommendedMinZoom: 10,
    recommendedMaxZoom: 14,
    poiCount: 110,
    routeCount: 29,
    unlocked: true,
    providerId: 'openfreemap-vector',
  },
  {
    regionId: 'fr-calanques-marseille',
    name: 'Parc national des Calanques',
    countryIsoA2: 'FR',
    bounds: { west: 5.35, south: 43.18, east: 5.58, north: 43.26 },
    recommendedMinZoom: 10,
    recommendedMaxZoom: 15,
    poiCount: 84,
    routeCount: 22,
    unlocked: true,
    providerId: 'openfreemap-vector',
  },
  {
    regionId: 'es-picos-de-europa',
    name: 'Picos de Europa',
    countryIsoA2: 'ES',
    bounds: { west: -5.05, south: 43.1, east: -4.65, north: 43.28 },
    recommendedMinZoom: 10,
    recommendedMaxZoom: 14,
    poiCount: 92,
    routeCount: 24,
    unlocked: true,
    providerId: 'openfreemap-vector',
  },
];

export function listPredefinedRegions(countryIsoA2?: string): PredefinedRegionCatalogItem[] {
  if (!countryIsoA2) return [...PREDEFINED_REGIONS_CATALOG];
  const normalized = countryIsoA2.trim().toUpperCase();
  return PREDEFINED_REGIONS_CATALOG.filter((item) => item.countryIsoA2 === normalized);
}

export function getPredefinedRegionById(regionId: string): PredefinedRegionCatalogItem | null {
  return PREDEFINED_REGIONS_CATALOG.find((item) => item.regionId === regionId) ?? null;
}

/**
 * Estime le volume complet d'un paquet hors ligne (région prédéfinie ou zone),
 * incluant les tuiles vectorielles, DEM, styles, glyphes, POI, itinéraires,
 * vignettes photos et graphe de routage optionnel, ainsi que l'économie liée aux
 * tuiles déjà en cache (K4.14, K4.16, Recherche 04).
 */
export function estimateOfflinePackSize(params: {
  regionOrZoneId: string;
  bounds: ZoneBounds;
  minZoom?: number;
  maxZoom?: number;
  poiCount?: number;
  routeCount?: number;
  mediaPreviewCount?: number;
  includeRoutingGraph?: boolean;
  installedPacks?: readonly OfflineInstalledPackRecord[];
}): OfflinePackSizeEstimate {
  const minZoom = params.minZoom ?? 10;
  const maxZoom = params.maxZoom ?? 14;
  const tiles = enumerateTilesForBounds(params.bounds, minZoom, maxZoom);
  const cachedTileKeys = computeCachedTileKeySet(params.installedPacks ?? []);

  let alreadyCachedTileCount = 0;
  for (const tile of tiles) {
    if (cachedTileKeys.has(tileCoordKey(tile))) {
      alreadyCachedTileCount += 1;
    }
  }

  const totalTileCount = tiles.length;
  const netTilesToDownload = Math.max(0, totalTileCount - alreadyCachedTileCount);

  const vectorTilesBytes = totalTileCount * AVG_VECTOR_TILE_BYTES;
  const demTilesBytes = totalTileCount * AVG_DEM_TILE_BYTES;
  const styleAndGlyphsBytes = STYLE_AND_SPRITES_BASE_BYTES + GLYPH_RANGES_BASE_BYTES;
  const poisAndRoutesBytes =
    (params.poiCount ?? 0) * AVG_POI_RECORD_BYTES +
    (params.routeCount ?? 0) * AVG_ROUTE_RECORD_BYTES;
  const mediaPreviewsBytes = (params.mediaPreviewCount ?? 0) * AVG_MEDIA_PREVIEW_BYTES;
  const routingGraphBytes = params.includeRoutingGraph
    ? totalTileCount * AVG_ROUTING_GRAPH_TILE_BYTES
    : 0;

  const totalEstimatedBytes =
    vectorTilesBytes +
    demTilesBytes +
    styleAndGlyphsBytes +
    poisAndRoutesBytes +
    mediaPreviewsBytes +
    routingGraphBytes;

  const cachedSavingsBytes =
    alreadyCachedTileCount * (AVG_VECTOR_TILE_BYTES + AVG_DEM_TILE_BYTES);
  const netBytesToDownload = Math.max(
    styleAndGlyphsBytes + poisAndRoutesBytes + mediaPreviewsBytes + routingGraphBytes,
    totalEstimatedBytes - cachedSavingsBytes,
  );

  return {
    regionOrZoneId: params.regionOrZoneId,
    bounds: params.bounds,
    minZoom,
    maxZoom,
    totalTileCount,
    alreadyCachedTileCount,
    netTilesToDownload,
    vectorTilesBytes,
    demTilesBytes,
    styleAndGlyphsBytes,
    poisAndRoutesBytes,
    mediaPreviewsBytes,
    routingGraphBytes,
    totalEstimatedBytes,
    netBytesToDownload,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.15 — Sélecteur d'emprise libre, zones multiples et restauration du drawer
// ─────────────────────────────────────────────────────────────────────────────

export function validateAndEstimateCustomZone(params: {
  zoneId: string;
  label: string;
  bounds: ZoneBounds;
  minZoom?: number;
  maxZoom?: number;
  maxTilesLimit?: number;
  maxAreaKm2?: number;
  minAreaKm2?: number;
  installedPacks?: readonly OfflineInstalledPackRecord[];
}): CustomZoneSelectionDraft {
  const minZoom = params.minZoom ?? 10;
  const maxZoom = params.maxZoom ?? 15;
  const maxTilesLimit = params.maxTilesLimit ?? DEFAULT_MAX_TILES_PER_CUSTOM_ZONE;
  const maxAreaKm2 = params.maxAreaKm2 ?? DEFAULT_MAX_CUSTOM_ZONE_AREA_KM2;
  const minAreaKm2 = params.minAreaKm2 ?? DEFAULT_MIN_CUSTOM_ZONE_AREA_KM2;

  const coordsFinite =
    Number.isFinite(params.bounds.west) &&
    Number.isFinite(params.bounds.south) &&
    Number.isFinite(params.bounds.east) &&
    Number.isFinite(params.bounds.north) &&
    params.bounds.west >= -180 &&
    params.bounds.east <= 180 &&
    params.bounds.south >= -90 &&
    params.bounds.north <= 90;

  if (!coordsFinite) {
    return {
      zoneId: params.zoneId,
      label: params.label,
      bounds: params.bounds,
      minZoom,
      maxZoom,
      valid: false,
      validationError: 'invalid_coordinates',
      estimatedTiles: 0,
      estimatedBytes: 0,
      areaKm2: 0,
    };
  }

  if (params.bounds.west >= params.bounds.east || params.bounds.south >= params.bounds.north) {
    return {
      zoneId: params.zoneId,
      label: params.label,
      bounds: params.bounds,
      minZoom,
      maxZoom,
      valid: false,
      validationError: 'inverted_bounds',
      estimatedTiles: 0,
      estimatedBytes: 0,
      areaKm2: 0,
    };
  }

  const areaKm2 = computeBoundsAreaKm2(params.bounds);
  if (areaKm2 < minAreaKm2) {
    return {
      zoneId: params.zoneId,
      label: params.label,
      bounds: params.bounds,
      minZoom,
      maxZoom,
      valid: false,
      validationError: 'area_too_small',
      estimatedTiles: 0,
      estimatedBytes: 0,
      areaKm2,
    };
  }

  if (areaKm2 > maxAreaKm2) {
    const tiles = enumerateTilesForBounds(params.bounds, minZoom, maxZoom);
    return {
      zoneId: params.zoneId,
      label: params.label,
      bounds: params.bounds,
      minZoom,
      maxZoom,
      valid: false,
      validationError: 'exceeds_max_area_km2',
      estimatedTiles: tiles.length,
      estimatedBytes: tiles.length * (AVG_VECTOR_TILE_BYTES + AVG_DEM_TILE_BYTES),
      areaKm2,
    };
  }

  const estimate = estimateOfflinePackSize({
    regionOrZoneId: params.zoneId,
    bounds: params.bounds,
    minZoom,
    maxZoom,
    installedPacks: params.installedPacks,
  });

  if (estimate.totalTileCount > maxTilesLimit) {
    return {
      zoneId: params.zoneId,
      label: params.label,
      bounds: params.bounds,
      minZoom,
      maxZoom,
      valid: false,
      validationError: 'exceeds_max_tiles_limit',
      estimatedTiles: estimate.totalTileCount,
      estimatedBytes: estimate.totalEstimatedBytes,
      areaKm2,
    };
  }

  return {
    zoneId: params.zoneId,
    label: params.label,
    bounds: params.bounds,
    minZoom,
    maxZoom,
    valid: true,
    validationError: null,
    estimatedTiles: estimate.netTilesToDownload,
    estimatedBytes: estimate.netBytesToDownload,
    areaKm2,
  };
}

/**
 * Évalue une sélection de zones personnalisées multiples (K4.15) en dédupliquant
 * les tuiles communes aux zones sélectionnées et aux paquets déjà installés,
 * et génère le GeoJSON des limites visibles.
 */
export function evaluateMultiZoneSelection(
  drafts: readonly CustomZoneSelectionDraft[],
  options: {
    installedPacks?: readonly OfflineInstalledPackRecord[];
    maxZonesAllowed?: number;
    maxTilesPerZone?: number;
  } = {},
): MultiZoneSelectionState {
  const maxZonesAllowed = options.maxZonesAllowed ?? DEFAULT_MAX_MULTI_ZONES;
  const maxTilesPerZone = options.maxTilesPerZone ?? DEFAULT_MAX_TILES_PER_CUSTOM_ZONE;
  const cachedTileKeys = computeCachedTileKeySet(options.installedPacks ?? []);
  const seenKeysAcrossSelection = new Set<string>(cachedTileKeys);

  const boundedDrafts = drafts.slice(0, maxZonesAllowed);
  let combinedNetTileCount = 0;

  const features: OfflineCoverageFeature[] = [];

  for (const draft of boundedDrafts) {
    if (!draft.valid) continue;
    const tiles = enumerateTilesForBounds(draft.bounds, draft.minZoom, draft.maxZoom);
    for (const tile of tiles) {
      const key = tileCoordKey(tile);
      if (!seenKeysAcrossSelection.has(key)) {
        seenKeysAcrossSelection.add(key);
        combinedNetTileCount += 1;
      }
    }

    features.push({
      type: 'Feature',
      id: draft.zoneId,
      properties: {
        packId: draft.zoneId,
        title: draft.label,
        kind: 'custom_zone',
        status: 'available',
        minZoom: draft.minZoom,
        maxZoom: draft.maxZoom,
        storedBytes: draft.estimatedBytes,
        verifiedAtMs: null,
        expiresAtMs: null,
        isExpired: false,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [draft.bounds.west, draft.bounds.south],
            [draft.bounds.east, draft.bounds.south],
            [draft.bounds.east, draft.bounds.north],
            [draft.bounds.west, draft.bounds.north],
            [draft.bounds.west, draft.bounds.south],
          ],
        ],
      },
    });
  }

  const combinedEstimatedBytes =
    combinedNetTileCount > 0
      ? combinedNetTileCount * (AVG_VECTOR_TILE_BYTES + AVG_DEM_TILE_BYTES) +
        STYLE_AND_SPRITES_BASE_BYTES +
        GLYPH_RANGES_BASE_BYTES
      : 0;

  return {
    zones: boundedDrafts,
    maxZonesAllowed,
    maxTilesPerZone,
    combinedNetTileCount,
    combinedEstimatedBytes,
    visibleLimitsGeoJson: {
      type: 'FeatureCollection',
      features,
    },
  };
}

/**
 * Ouvre un sous-drawer Hors ligne (K4.14, K4.15, K4.16) sur action explicite
 * en sauvegardant le contexte exact du drawer parent pour le retour.
 */
export function openOfflineSubDrawer(
  subView: OfflineDrawerSubViewState['activeSubView'],
  returnContext: DrawerReturnContext,
): OfflineDrawerSubViewState {
  return {
    activeSubView: subView,
    returnContext: { ...returnContext },
  };
}

/**
 * Ferme le sous-drawer Hors ligne et restaure le contexte exact du drawer parent.
 */
export function closeOfflineSubDrawerAndRestoreParent(
  state: OfflineDrawerSubViewState,
): DrawerReturnContext {
  return { ...state.returnContext };
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.16 — Couverture téléchargée sur la carte & contrôle de limite de zoom
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construit le GeoJSON `FeatureCollection` des limites des paquets effectivement
 * en cache (`available`, `degraded`, `expired`) pour les afficher sur la carte
 * et éviter de retélécharger les mêmes tuiles (K4.16).
 * Les paquets `corrupted`, `paused` ou `downloading` sont strictement exclus.
 */
export function buildDownloadedCoverageGeoJson(
  installedPacks: readonly OfflineInstalledPackRecord[],
  nowMs: number = Date.now(),
): OfflineCoverageFeatureCollection {
  const features: OfflineCoverageFeature[] = [];

  for (const record of installedPacks) {
    const isExpired =
      record.manifest.expiresAtMs !== null && nowMs > record.manifest.expiresAtMs;
    const effectiveStatus = isExpired ? 'expired' : record.status;

    if (
      effectiveStatus !== 'available' &&
      effectiveStatus !== 'degraded' &&
      effectiveStatus !== 'expired'
    ) {
      continue;
    }

    const b = record.manifest.bounds;
    features.push({
      type: 'Feature',
      id: record.manifest.packId,
      properties: {
        packId: record.manifest.packId,
        title: record.manifest.title,
        kind: record.manifest.kind,
        status: effectiveStatus,
        minZoom: record.manifest.minZoom,
        maxZoom: record.manifest.maxZoom,
        storedBytes: record.actualStoredBytes,
        verifiedAtMs: record.manifest.verifiedAtMs,
        expiresAtMs: record.manifest.expiresAtMs,
        isExpired,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [b.west, b.south],
            [b.east, b.south],
            [b.east, b.north],
            [b.west, b.north],
            [b.west, b.south],
          ],
        ],
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Évalue la couverture hors ligne de la vue courante `(viewportBounds, requestedZoom)`.
 * Recherche 04 §Cas qui doivent échouer proprement :
 * « Zoom au-delà du paquet : limite visible, sans carte blanche silencieuse. »
 */
export function evaluateViewportOfflineCoverage(
  viewportBounds: ZoneBounds,
  requestedZoom: number,
  installedPacks: readonly OfflineInstalledPackRecord[],
): ViewportOfflineCoverageEvaluation {
  const verifiedPacks = installedPacks.filter(
    (p) => p.status === 'available' || p.status === 'degraded',
  );

  const intersectingPacks = verifiedPacks.filter((p) =>
    boundsIntersect(p.manifest.bounds, viewportBounds),
  );

  if (intersectingPacks.length === 0) {
    return {
      status: 'no_offline_coverage',
      coveringPackIds: [],
      effectiveMinZoom: null,
      effectiveMaxZoom: null,
      requestedZoom,
      visibleLimitNotice: 'Aucun paquet hors ligne installé ne couvre cette zone.',
    };
  }

  const coveringIds = intersectingPacks.map((p) => p.manifest.packId);
  const effectiveMinZoom = Math.min(...intersectingPacks.map((p) => p.manifest.minZoom));
  const effectiveMaxZoom = Math.max(...intersectingPacks.map((p) => p.manifest.maxZoom));

  if (requestedZoom > effectiveMaxZoom) {
    return {
      status: 'zoom_exceeds_pack_limit',
      coveringPackIds: coveringIds,
      effectiveMinZoom,
      effectiveMaxZoom,
      requestedZoom,
      visibleLimitNotice: `Zoom ${requestedZoom} au-delà de la limite téléchargée (zoom max hors ligne : ${effectiveMaxZoom}).`,
    };
  }

  const fullyCoveredBySinglePack = intersectingPacks.some(
    (p) =>
      boundsContainsBounds(p.manifest.bounds, viewportBounds) &&
      requestedZoom >= p.manifest.minZoom &&
      requestedZoom <= p.manifest.maxZoom,
  );

  if (fullyCoveredBySinglePack) {
    return {
      status: 'fully_covered',
      coveringPackIds: coveringIds,
      effectiveMinZoom,
      effectiveMaxZoom,
      requestedZoom,
      visibleLimitNotice: null,
    };
  }

  return {
    status: 'partially_covered',
    coveringPackIds: coveringIds,
    effectiveMinZoom,
    effectiveMaxZoom,
    requestedZoom,
    visibleLimitNotice: 'Couverture hors ligne partielle sur cette emprise.',
  };
}
