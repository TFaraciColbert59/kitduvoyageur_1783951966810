/**
 * LE KIT DU VOYAGEUR — SOCLE GÉOGRAPHIQUE & RANDONNÉES
 * Contrats TypeScript stricts pour l'exploration OSM, l'identité canonique LKDV,
 * la provenance des données et la réutilisation multi-domaines.
 */

// ── 1. BRANDED IDENTIFIERS ────────────────────────────────────────────────────

export type Brand<K, T> = K & { readonly __brand: T };

/** Clé primaire canonique LKDV (hiking_routes.id) */
export type RouteId = Brand<number, 'RouteId'>;

/** Identifiant externe composé, ex: "osm:relation:2251447" | "osm:node:12345" */
export type SourceId = `osm:${'node' | 'way' | 'relation'}:${string}`;

/** Identifiant d'une session utilisateur réelle (hike_sessions.id) */
export type HikeSessionId = Brand<string, 'HikeSessionId'>;

// Fonctions utilitaires de branding sécurisé
export function toRouteId(id: number | string): RouteId {
  const n = typeof id === 'string' ? parseInt(id, 10) : id;
  if (!Number.isFinite(n) || n <= 0) {
    throw new TypeError(`Identifiant de route canonique invalide: ${id}`);
  }
  return n as RouteId;
}

export function toSourceId(type: 'node' | 'way' | 'relation', id: number | string): SourceId {
  return `osm:${type}:${id}`;
}

export function parseSourceId(sourceId: string): { type: 'node' | 'way' | 'relation'; id: string } | null {
  const parts = sourceId.split(':');
  if (parts.length === 3 && parts[0] === 'osm' && (parts[1] === 'node' || parts[1] === 'way' || parts[1] === 'relation')) {
    return { type: parts[1], id: parts[2] };
  }
  return null;
}

// ── 2. PROVENANCE & MÉTADONNÉES SOURCE ──────────────────────────────────────────

export type ProviderName = 'openstreetmap' | 'lkdv' | 'ign' | 'user';

export interface SourceProvenance {
  provider: ProviderName;
  sourceUrl?: string;
  externalId: string;
  sourceType: 'node' | 'way' | 'relation';
  fetchedAt: string; // ISO 8601
  sourceTimestamp?: string | null; // Heure du changeset OSM
  sourceVersion?: string | number | null;
  license: 'ODbL-1.0' | 'Proprietary-LKDV' | 'CC-BY-4.0';
}

export interface FieldProvenance<T> {
  value: T;
  source: ProviderName;
  method: 'declared' | 'calculated' | 'dem_elevation' | 'community_reported' | 'ai_derived';
  updatedAt: string;
  confidence: number; // 0.0 à 1.0
}

// ── 3. QUALITÉ ET STRUCTURE GÉOMÉTRIQUE ─────────────────────────────────────────

export type GeometryQualityStatus =
  | 'complete'      // Tracé complet et continu sans rupture
  | 'partial'       // Segments manquants ou ruptures détectées ("Tracé partiel")
  | 'unavailable'   // Aucune coordonnée exploitable disponible
  | 'invalid'       // Données géométriques corrompues ou auto-sécantes critiques
  | 'source_deleted'; // La relation source a été supprimée sur OSM, préservée dans LKDV

export type RouteMemberRole =
  | 'main'          // Tracé principal
  | 'alternative'   // Variante
  | 'approach'      // Approche / départ
  | 'excursion'     // Aller-retour vers point de vue / sommet
  | 'connection'    // Liaison vers autre sentier
  | 'child_relation'; // Sous-relation composite (ex. étape de GR)

export interface RouteGeometrySegment {
  id: string; // ID du way OSM
  role: RouteMemberRole;
  coordinates: [number, number][]; // [longitude, latitude] — norme GeoJSON
  distanceKm: number;
  isReversed: boolean;
}

export interface RouteGeometryHierarchy {
  status: GeometryQualityStatus;
  mainSegments: RouteGeometrySegment[];
  alternatives: RouteGeometrySegment[];
  approaches: RouteGeometrySegment[];
  excursions: RouteGeometrySegment[];
  connections: RouteGeometrySegment[];
  totalDistanceKm: number;
  gapCount: number;
  isLoop?: boolean;
  loopDetectionMethod?: 'exact_endpoints' | 'source_tag' | 'none';
  geometryHash?: string;
  warnings: string[];
}

// ── 4. MODÈLES DE RECHERCHE ET CONSULTATION ────────────────────────────────────

export interface BoundingBox {
  south: number; // minLat
  west: number;  // minLng
  north: number; // maxLat
  east: number;  // maxLng
}

export interface ExternalRouteSummary {
  id: SourceId;
  osmRelationId: number;
  name: string;
  ref: string | null;
  network: 'iwn' | 'nwn' | 'rwn' | 'lwn' | null; // international, national (GR), régional (GRP), local (PR)
  representativePoint: [number, number] | null; // [lng, lat] (centre géométrique, JAMAIS un départ fictif)
  representativePointKind: 'bbox-center' | 'geometry-point' | null;
  declaredDistanceKm: number | null;
  calculatedDistanceKm: number | null;
  geometryStatus: GeometryQualityStatus;
  source: SourceProvenance;
  tags: Record<string, string>;
}

export interface ExternalRouteDetail extends ExternalRouteSummary {
  geometryHierarchy: RouteGeometryHierarchy;
  geojson: GeoJSON.FeatureCollection | GeoJSON.MultiLineString | GeoJSON.LineString | null;
  elevationGainM?: number | null;
  elevationLossM?: number | null;
  difficulty?: string | null; // sac_scale ou normalisé LKDV
  durationHoursEstimated?: number | null;
  roundtrip?: boolean | null;
  pois?: RoutePoiSummary[];
}

// ── 5. POINTS D'INTÉRÊT (POI) SOURCE ───────────────────────────────────────────

export type PoiCategory =
  | 'refuge'       // Cabane, refuge gardé, gîte d'étape
  | 'water'        // Eau potable, source, fontaine
  | 'summit'       // Sommet, col, pic
  | 'camp'         // Bivouac, camping
  | 'viewpoint'    // Point de vue, panorama
  | 'parking'      // Parking de départ
  | 'transit'      // Arrêt de bus, gare
  | 'danger'       // Passage difficile, gué
  | 'shelter';     // Abri ouvert non gardé

export interface RoutePoiSummary {
  id: SourceId;
  category: PoiCategory;
  name: string | null;
  coordinates: [number, number]; // [lng, lat]
  elevationM?: number | null;
  distanceFromStartKm?: number | null;
  distanceFromTrailM?: number; // Déport par rapport au tracé
  tags: Record<string, string>;
  source: SourceProvenance;
}

// ── 6. ENVELOPPE DE RÉPONSE API RÉSISTANTE ────────────────────────────────────

export interface SearchEnvelope<T> {
  status: 'ok' | 'empty' | 'partial' | 'unavailable';
  items: T[];
  fetchedAt: string;
  stale: boolean;
  limited: boolean;
  fromCache: boolean;
  warnings: string[];
}

// ── 7. ENTITÉS NORMALISÉES LKDV (`hiking_routes`, `sources`, `revisions`) ─────

export interface HikingRouteSource {
  id: string;
  routeId: RouteId;
  provider: ProviderName | string;
  externalType: string;
  externalId: string;
  sourceVersion: string | null;
  sourceTimestamp: string | null;
  license: string;
  fetchedAt: string;
  updatedAt: string;
}

export interface HikingRouteRevision {
  id: string;
  routeId: RouteId;
  revisionNumber: number;
  geometryHash: string;
  sourceVersion: string | null;
  quality: GeometryQualityStatus;
  isCurrent: boolean;
  geom: GeoJSON.MultiLineString | null;
  createdAt: string;
}

export interface CanonicalRoute {
  id: RouteId; // LKDV ID (hiking_routes.id)
  osmRelationId: number; // Identifiant externe OSM relation
  name: string;
  ref: string | null;
  network: string | null;
  distanceKm: number;
  geom: GeoJSON.MultiLineString | GeoJSON.LineString | null;
  tags: Record<string, any>;
  region: string | null;
  sourceStatus: 'active' | 'stale' | 'source_deleted' | 'needs_review';
  geometryStatus: GeometryQualityStatus;
  currentRevisionHash?: string | null;
  createdAt: string;
  updatedAt?: string;
  source?: HikingRouteSource | null;
  revisions?: HikingRouteRevision[];
}

export interface MaterializationResult {
  route: CanonicalRoute;
  isNewlyCreated: boolean;
  canonicalId: RouteId;
}
