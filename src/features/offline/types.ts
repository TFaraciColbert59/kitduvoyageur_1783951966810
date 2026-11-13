/**
 * Lot N02 — Contrat TypeScript complet pour les paquets hors ligne, cartes
 * offline, régions prédéfinies et zones personnalisées, couverture téléchargée,
 * POI/photos et données de navigation à venir, pont de lecture tuiles/graphe
 * pour le guidage hors ligne et raccourcis natifs Android / Spotlight iOS.
 *
 * Références couvertes :
 * - K4.14 : Télécharger une région prédéfinie (sélection, estimation durable, droits des tuiles, reprise)
 * - K4.15 : Télécharger une zone personnalisée (emprise libre, zones multiples, limites visibles)
 * - K4.16 : Afficher les zones téléchargées sur la carte (limites en cache, déduplication des tuiles, plafond de zoom)
 * - K4.17 : Photos et POI à venir dans le paquet hors ligne (aperçus, médias licenciés, repères et données de navigation)
 * - K4.19 : Raccourcis Android et recherche Spotlight iOS hors ligne (planifier, enregistrer, parcours téléchargés)
 */

import type { ElevationPoint, LngLat, RouteLine } from '../explorer-v2/geo/track';
import type { ZoneBounds } from '../explorer-v2/offline/zone';
import type { PoiKind, Sport, TrailGeometryStatus } from '../explorer-v2/state/types';

export type { ElevationPoint, LngLat, PoiKind, RouteLine, Sport, TrailGeometryStatus, ZoneBounds };

// ─────────────────────────────────────────────────────────────────────────────
// États du cycle de vie des paquets hors ligne & fournisseurs de tuiles (Recherche 04)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cycle d'états strict d'un paquet hors ligne :
 * `estimated -> queued -> downloading -> verifying -> available`
 * avec états distincts pour `paused`, `degraded` (ex. glyphe ou média optionnel
 * manquant), `corrupted` (somme de contrôle SHA-256 ou taille invalide, fail-closed),
 * `expired` (version obsolète signalée) et `unavailable` (aucun paquet couvrant).
 */
export type OfflinePackStatus =
  | 'estimated'
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'verifying'
  | 'available'
  | 'degraded'
  | 'corrupted'
  | 'expired'
  | 'unavailable';

export type OfflinePackKind = 'predefined_region' | 'custom_zone' | 'route_corridor';

/**
 * Sources de tuiles identifiées.
 * Conformément à la politique OSMF (Recherche 04 §Résultats), `osm-public-raster`
 * est strictement interdit pour le préchargement massif et les packs hors ligne.
 */
export type OfflineTileProviderId =
  | 'openfreemap-vector'
  | 'terrarium-dem'
  | 'maptiler-licensed'
  | 'protomaps-pmtiles'
  | 'osm-public-raster';

export type OfflineRuntimeTarget =
  | 'web-cache-storage'
  | 'ios-maplibre-pack'
  | 'ios-local-pmtiles'
  | 'android-maplibre-region';

export interface TileProviderLicensePolicy {
  providerId: OfflineTileProviderId;
  allowedForOfflinePack: boolean;
  attributionRequired: string;
  maxZoomSupported: number;
  /**
   * Précision native issue de la Recherche 04 :
   * - Sur iOS, PMTiles est lisible comme archive locale mais ne participe pas
   *   à l'API de packs/cache `MLNOfflineStorage`.
   * - Sur Android, `createOfflineRegion` crée une région initialement inactive.
   */
  supportedTargets: readonly OfflineRuntimeTarget[];
  requiresExplicitDownloadStartOnAndroid: boolean;
  participatesInIosNativeOfflinePackApi: boolean;
  rejectionReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ressources du paquet, sommes de contrôle SHA-256 & matrice de capacités
// ─────────────────────────────────────────────────────────────────────────────

export type OfflineResourceKind =
  | 'vector_tile'
  | 'dem_tile'
  | 'style_json'
  | 'glyph_range'
  | 'sprite_sheet'
  | 'route_geometry'
  | 'navigation_maneuvers'
  | 'elevation_profile'
  | 'routing_graph_tile'
  | 'poi_dataset'
  | 'media_preview'
  | 'address_index';

export type OfflineResourcePrivacyScope = 'public' | 'private_user';

export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

export interface OfflineResourceDescriptor {
  /** Identifiant stable de la ressource (indépendant de tout jeton d'URL éphémère). */
  id: string;
  kind: OfflineResourceKind;
  /** URL canonique nettoyée de tout paramètre d'authentification temporaire. */
  canonicalUri: string;
  /** Coordonnée de tuile si la ressource est une tuile cartographique/DEM/graphe. */
  tile?: TileCoordinate;
  /** Somme de contrôle SHA-256 hexadécimale attendue (64 caractères). */
  expectedSha256: string;
  /** Taille exacte attendue en octets. */
  expectedBytes: number;
  /** Vrai si l'absence ou la corruption de cette ressource bloque la disponibilité du pack. */
  required: boolean;
  /** Licence / droit associé à la ressource. */
  license: string;
  /** Portée de confidentialité : les ressources `private_user` sont purgées au logout et exclues des packs partagés. */
  privacyScope: OfflineResourcePrivacyScope;
}

export interface VerifiedResourceChunk {
  resourceId: string;
  canonicalUri: string;
  actualSha256: string;
  actualBytes: number;
  verifiedAtMs: number;
  payload: Uint8Array | string;
}

export type OfflineCapabilityStatus = 'available' | 'degraded' | 'unavailable';

export interface OfflineCapabilityEntry {
  status: OfflineCapabilityStatus;
  reason: string | null;
}

/**
 * Matrice de capacités hors réseau publiée par paquet (Recherche 04 §Matrice de capacités) :
 * déclarer séparément carte, trace, guidage, recherche, recalcul et météo/fermetures.
 */
export interface OfflineCapabilityMatrix {
  /** Voir le parcours (trace et style local utilisable). */
  viewRoute: OfflineCapabilityEntry;
  /** Voir la carte alentour (tuiles, glyphes, sprites et emprise dans les zooms téléchargés). */
  viewMapAround: OfflineCapabilityEntry;
  /** Suivre les instructions (manœuvres et progression locales sur la révision téléchargée). */
  followInstructions: OfflineCapabilityEntry;
  /** Chercher une adresse (index de lieux local, non acquis par le seul pack cartographique). */
  searchAddresses: OfflineCapabilityEntry;
  /** Recalculer un itinéraire hors réseau (moteur + graphe + profil compatibles). */
  recalculateRoute: OfflineCapabilityEntry;
  /** Recevoir météo et fermetures nouvelles (indisponible hors réseau ; dernière donnée datée seulement). */
  liveWeatherAndClosures: OfflineCapabilityEntry;
}

export interface OfflineClosureNotice {
  id: string;
  title: string;
  position: [number, number];
  recordedAtMs: number;
  expiresAtMs: number | null;
}

export interface OfflineClosureEvaluation {
  closureId: string;
  title: string;
  recordedAtMs: number;
  expiresAtMs: number | null;
  /**
   * Si la date de fin connue est dépassée hors ligne, on conserve la date et
   * l'incertitude (`uncertain_expired`) sans jamais affirmer la réouverture.
   */
  freshness: 'active_known' | 'uncertain_expired';
  warningLabel: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Manifeste de paquet, Staging & Swap Atomique
// ─────────────────────────────────────────────────────────────────────────────

export interface OfflinePackManifest {
  packId: string;
  version: number;
  /** Identifiant de l'utilisateur propriétaire local (`null` si pack régional public). */
  ownerUserId: string | null;
  kind: OfflinePackKind;
  title: string;
  regionId: string | null;
  routeId: string | null;
  routeRevision: string | null;
  bounds: ZoneBounds;
  minZoom: number;
  maxZoom: number;
  pixelRatio: number;
  providerId: OfflineTileProviderId;
  licenseAttribution: string;
  styleVersion: string;
  engineVersion: string;
  /** Paquet épinglé (protégé de l'éviction LRU automatique) vs cache évictable. */
  pinned: boolean;
  /** Vrai si le paquet est destiné à être partagé publiquement (interdit toute donnée `private_user`). */
  sharedPublicly: boolean;
  resources: readonly OfflineResourceDescriptor[];
  totalExpectedBytes: number;
  /** Somme de contrôle SHA-256 déterministe de l'ensemble du manifeste. */
  manifestSha256: string;
  createdAtMs: number;
  updatedAtMs: number;
  expiresAtMs: number | null;
  verifiedAtMs: number | null;
}

export interface OfflineDownloadProgress {
  packId: string;
  status: OfflinePackStatus;
  verifiedResourcesCount: number;
  totalResourcesCount: number;
  downloadedBytes: number;
  totalExpectedBytes: number;
  reusedCachedTilesCount: number;
  reusedCachedBytes: number;
  failureReason: string | null;
}

export interface OfflineInstalledPackRecord {
  manifest: OfflinePackManifest;
  status: OfflinePackStatus;
  capabilities: OfflineCapabilityMatrix;
  verifiedResources: ReadonlyMap<string, VerifiedResourceChunk>;
  actualStoredBytes: number;
  lastAccessedAtMs: number;
  installedAtMs: number;
  failureReason: string | null;
  /** Indique si une ancienne version valide a été préservée suite à l'échec d'un remplacement. */
  preservedPreviousVersionOnFailure: boolean;
}

export interface OfflineStagingSlot {
  packId: string;
  targetManifest: OfflinePackManifest;
  status: 'queued' | 'downloading' | 'paused' | 'verifying' | 'corrupted';
  verifiedChunks: Map<string, VerifiedResourceChunk>;
  reusedResourceIds: Set<string>;
  stagedBytes: number;
  startedAtMs: number;
  updatedAtMs: number;
  failureReason: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quotas de stockage, éviction LRU et préservation des séances
// ─────────────────────────────────────────────────────────────────────────────

export interface StorageQuotaConfig {
  /** Quota maximal alloué aux paquets et au cache hors ligne (octets). */
  maxTotalBytes: number;
  /** Plafond du cache ambiant évictable (octets). */
  maxAmbientCacheBytes: number;
  /** Marge de sécurité minimale à préserver lors d'un remplacement atomique (octets). */
  minFreeHeadroomBytes: number;
}

export interface StorageUsageSummary {
  maxTotalBytes: number;
  pinnedPacksBytes: number;
  unpinnedPacksBytes: number;
  stagingBytes: number;
  ambientCacheBytes: number;
  totalUsedBytes: number;
  availableBytes: number;
  installedPackCount: number;
  recordedActivitySessionsProtected: boolean;
}

export interface EvictionResult {
  freedBytes: number;
  evictedAmbientBytes: number;
  evictedPackIds: string[];
  sufficientSpaceAchieved: boolean;
  reason: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.14 & K4.15 — Régions prédéfinies, Zones personnalisées & Contexte Drawer
// ─────────────────────────────────────────────────────────────────────────────

export interface DrawerReturnContext {
  parentSheet: string;
  parentDetent: 'peek' | 'low' | 'mid' | 'full';
  parentTab: number;
  selectedRegionId?: string | null;
  selectedRouteId?: string | null;
  cameraCenter?: [number, number];
  cameraZoom?: number;
}

export interface OfflineDrawerSubViewState {
  activeSubView: 'root' | 'predefined_regions' | 'custom_zone_selector' | 'coverage_overlay';
  returnContext: DrawerReturnContext;
}

export interface PredefinedRegionCatalogItem {
  regionId: string;
  name: string;
  countryIsoA2: string;
  bounds: ZoneBounds;
  recommendedMinZoom: number;
  recommendedMaxZoom: number;
  poiCount: number;
  routeCount: number;
  unlocked: boolean;
  providerId: OfflineTileProviderId;
}

export interface OfflinePackSizeEstimate {
  regionOrZoneId: string;
  bounds: ZoneBounds;
  minZoom: number;
  maxZoom: number;
  totalTileCount: number;
  alreadyCachedTileCount: number;
  netTilesToDownload: number;
  vectorTilesBytes: number;
  demTilesBytes: number;
  styleAndGlyphsBytes: number;
  poisAndRoutesBytes: number;
  mediaPreviewsBytes: number;
  routingGraphBytes: number;
  totalEstimatedBytes: number;
  netBytesToDownload: number;
}

export interface CustomZoneSelectionDraft {
  zoneId: string;
  label: string;
  bounds: ZoneBounds;
  minZoom: number;
  maxZoom: number;
  valid: boolean;
  validationError:
    | 'invalid_coordinates'
    | 'inverted_bounds'
    | 'area_too_small'
    | 'exceeds_max_tiles_limit'
    | 'exceeds_max_area_km2'
    | null;
  estimatedTiles: number;
  estimatedBytes: number;
  areaKm2: number;
}

export interface MultiZoneSelectionState {
  zones: readonly CustomZoneSelectionDraft[];
  maxZonesAllowed: number;
  maxTilesPerZone: number;
  combinedNetTileCount: number;
  combinedEstimatedBytes: number;
  visibleLimitsGeoJson: OfflineCoverageFeatureCollection;
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.16 — Couverture téléchargée sur la carte, déduplication & limite de zoom
// ─────────────────────────────────────────────────────────────────────────────

export interface OfflineCoverageFeatureProperties {
  packId: string;
  title: string;
  kind: OfflinePackKind;
  status: 'available' | 'degraded' | 'expired';
  minZoom: number;
  maxZoom: number;
  storedBytes: number;
  verifiedAtMs: number | null;
  expiresAtMs: number | null;
  isExpired: boolean;
}

export interface OfflineCoverageFeature {
  type: 'Feature';
  id: string;
  properties: OfflineCoverageFeatureProperties;
  geometry: {
    type: 'Polygon';
    coordinates: readonly [readonly [number, number][]];
  };
}

export interface OfflineCoverageFeatureCollection {
  type: 'FeatureCollection';
  features: readonly OfflineCoverageFeature[];
}

export interface ViewportOfflineCoverageEvaluation {
  status:
    | 'fully_covered'
    | 'partially_covered'
    | 'zoom_exceeds_pack_limit'
    | 'no_offline_coverage';
  coveringPackIds: readonly string[];
  effectiveMinZoom: number | null;
  effectiveMaxZoom: number | null;
  requestedZoom: number;
  /**
   * Message explicite à afficher lorsque l'utilisateur zoome au-delà du paquet
   * (évite toute carte blanche silencieuse — Recherche 04 §Cas qui doivent échouer proprement).
   */
  visibleLimitNotice: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.17 — Photos, POI à venir et données de navigation dans le paquet hors ligne
// ─────────────────────────────────────────────────────────────────────────────

export interface OfflineMediaAsset {
  mediaId: string;
  poiId: string;
  canonicalUri: string;
  mimeType: 'image/jpeg' | 'image/webp' | 'image/png';
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  license: string;
  caption?: string | null;
  privacyScope: OfflineResourcePrivacyScope;
}

export interface OfflinePoiRecord {
  id: string;
  name: string;
  kind: PoiKind | 'highlight' | 'waypoint';
  lat: number;
  lng: number;
  eleM?: number | null;
  description?: string | null;
  sports?: readonly Sport[];
  authorized: boolean;
  privacyScope: OfflineResourcePrivacyScope;
  mediaAssets: readonly OfflineMediaAsset[];
}

export interface OfflineRouteNavigationData {
  routeId: string;
  routeRevision: string;
  name: string;
  sport: Sport;
  geojson: unknown;
  elevationProfile: readonly ElevationPoint[];
  maneuvers: readonly {
    id: string;
    index: number;
    kind: string;
    position: [number, number];
    alongTrackM: number;
    instruction: string;
  }[];
  pois: readonly OfflinePoiRecord[];
  closures?: readonly OfflineClosureNotice[];
}

export interface OfflineUpcomingPoiViewItem {
  poi: OfflinePoiRecord;
  alongTrackM: number;
  distanceRemainingM: number;
  lateralOffsetM: number;
  verifiedMediaPreviews: readonly {
    mediaId: string;
    canonicalUri: string;
    caption: string | null;
    width: number;
    height: number;
    payload: Uint8Array | string;
  }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Pont de lecture de tuiles et graphe pour le guidage hors ligne (N01 <-> N02)
// ─────────────────────────────────────────────────────────────────────────────

export interface OfflineTileReadResult {
  status: 'available' | 'unavailable';
  reason:
    | null
    | 'no_covering_pack'
    | 'zoom_out_of_range'
    | 'pack_not_verified'
    | 'resource_missing'
    | 'checksum_mismatch';
  packId: string | null;
  tile: TileCoordinate;
  layer: 'vector' | 'dem' | 'routing_graph';
  payload: Uint8Array | string | null;
}

export interface OfflineRouteBundleReadResult {
  status: 'available' | 'degraded' | 'unavailable';
  reason: null | 'route_not_in_offline_packs' | 'pack_corrupted' | 'missing_route_geometry';
  packId: string | null;
  routeData: OfflineRouteNavigationData | null;
  capabilities: OfflineCapabilityMatrix | null;
}

export interface OfflineLocalRoutingGraphEngine {
  supportsSport(sport: Sport): boolean;
  computeDetour(params: {
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
    sport: Sport;
    graphTiles: readonly (Uint8Array | string)[];
  }): Promise<{
    distanceM: number;
    durationS: number;
    geometry: readonly [number, number][];
  } | null>;
}

export interface OfflineRoutingGraphLookupResult {
  status: 'available' | 'unavailable';
  reason:
    | null
    | 'no_covering_pack'
    | 'no_routing_graph_in_pack'
    | 'engine_not_configured'
    | 'sport_not_supported';
  packId: string | null;
  graphTiles: readonly (Uint8Array | string)[];
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.19 — Raccourcis Android (App Shortcuts) & Recherche Spotlight iOS
// ─────────────────────────────────────────────────────────────────────────────

export type NativeShortcutActionKind =
  | 'plan_route'
  | 'record_activity'
  | 'open_offline_downloads'
  | 'open_downloaded_route'
  | 'open_downloaded_region';

export interface AndroidAppShortcutDescriptor {
  shortcutId: string;
  actionKind: NativeShortcutActionKind;
  shortLabel: string;
  longLabel: string;
  disabledMessage: string;
  deepLinkUri: string;
  iconName: 'ic_shortcut_plan' | 'ic_shortcut_record' | 'ic_shortcut_offline' | 'ic_shortcut_route';
  rank: number;
  offlineCapable: true;
  requiresInstalledPackId?: string;
}

export interface IosSpotlightSearchableItem {
  uniqueIdentifier: string;
  domainIdentifier: 'com.lkdv.offline.routes' | 'com.lkdv.offline.regions' | 'com.lkdv.actions';
  title: string;
  contentDescription: string;
  keywords: readonly string[];
  deepLinkUri: string;
  actionKind: NativeShortcutActionKind;
  packId: string | null;
  routeId: string | null;
  regionId: string | null;
  bounds: ZoneBounds | null;
  offlineAvailable: boolean;
  expirationDateMs: number | null;
}

export interface NativeShortcutResolutionResult {
  status: 'resolved' | 'unavailable' | 'denied_or_incompatible';
  reason:
    | null
    | 'unknown_shortcut_uri'
    | 'pack_not_available_offline'
    | 'platform_unsupported'
    | 'permission_denied';
  actionKind: NativeShortcutActionKind | null;
  targetRouteId: string | null;
  targetRegionId: string | null;
  targetPackId: string | null;
  /**
   * Invariant K4.19 : l'ouverture via un raccourci système ou Spotlight ne crée
   * aucune entrée dans la navigation principale LKDV et ne déclenche aucune
   * requête d'écriture serveur.
   */
  addsMainNavigationEntry: false;
  performsServerWrite: false;
}
