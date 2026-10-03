/**
 * LE KIT DU VOYAGEUR — SERVICE DE NORMALISATION DES DONNÉES OSM
 * Transforme les structures brutes Overpass en objets du domaine LKDV
 * avec validation, provenance par champ et intégrité ODbL.
 */

import type {
  ExternalRouteDetail,
  ExternalRouteSummary,
  PoiCategory,
  RoutePoiSummary,
  SourceProvenance,
} from '../domain/types';
import {
  assembleOsmRelationGeometry,
  hierarchyToMultiLineString,
  isValidCoordinate,
} from '../domain/geometry';

/**
 * Extrait et parse une distance textuelle déclarée dans un tag OSM
 * Exemples : "14 km", "14.5", "14200 m", "14km"
 */
export function parseDeclaredDistance(rawDistance: string | undefined): number | null {
  if (!rawDistance) return null;
  const str = rawDistance.toLowerCase().trim().replace(',', '.');
  const match = str.match(/^([\d.]+)\s*(km|m)?$/);
  if (!match) return null;

  const value = parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  const unit = match[2];
  if (unit === 'm') {
    return Math.round((value / 1000) * 100) / 100;
  }
  return Math.round(value * 100) / 100;
}

/**
 * Normalise un élément relation Overpass en ExternalRouteSummary
 */
export function normalizeOsmRelationSummary(
  element: any,
  fetchedAt: string = new Date().toISOString()
): ExternalRouteSummary | null {
  if (!element || element.type !== 'relation' || !element.id) {
    return null;
  }

  const tags = element.tags || {};

  // Résolution du nom : privilégie name, name:fr, name:en, puis ref
  const name =
    tags.name ||
    tags['name:fr'] ||
    tags['name:en'] ||
    (tags.ref ? `Itinéraire ${tags.ref}` : 'Itinéraire sans titre');

  const ref = tags.ref || null;

  // Réseau OSM
  let network: 'iwn' | 'nwn' | 'rwn' | 'lwn' | null = null;
  if (tags.network) {
    const net = tags.network.toLowerCase();
    if (net === 'iwn' || net === 'nwn' || net === 'rwn' || net === 'lwn') {
      network = net;
    }
  }

  // Point représentatif (center Overpass)
  let representativePoint: [number, number] | null = null;
  let representativePointKind: 'bbox-center' | 'geometry-point' | null = null;

  if (element.center && isValidCoordinate(element.center.lon, element.center.lat)) {
    representativePoint = [Number(element.center.lon), Number(element.center.lat)];
    representativePointKind = 'bbox-center';
  }

  const declaredDistanceKm = parseDeclaredDistance(tags.distance);

  const source: SourceProvenance = {
    provider: 'openstreetmap',
    sourceUrl: `https://www.openstreetmap.org/relation/${element.id}`,
    externalId: String(element.id),
    sourceType: 'relation',
    fetchedAt,
    sourceTimestamp: element.timestamp || null,
    sourceVersion: element.version || null,
    license: 'ODbL-1.0',
  };

  return {
    id: `osm:relation:${element.id}`,
    osmRelationId: element.id,
    name,
    ref,
    network,
    representativePoint,
    representativePointKind,
    declaredDistanceKm,
    calculatedDistanceKm: null,
    geometryStatus: 'complete', // Statut initial avant chargement du tracé détaillé
    source,
    tags,
  };
}

/**
 * Normalise la relation complète avec membres géométriques en ExternalRouteDetail
 */
export function normalizeOsmRelationDetail(
  element: any,
  fetchedAt: string = new Date().toISOString()
): ExternalRouteDetail | null {
  const summary = normalizeOsmRelationSummary(element, fetchedAt);
  if (!summary) return null;

  const members = element.members || [];
  const tags = element.tags || {};
  const geometryHierarchy = assembleOsmRelationGeometry(members, tags);
  const geojson = hierarchyToMultiLineString(geometryHierarchy, true);

  // Calcul du dénivelé si présent dans les tags
  let elevationGainM: number | null = null;
  if (tags['ele:gain'] || tags.ascent) {
    const rawGain = tags['ele:gain'] || tags.ascent;
    const n = parseFloat(String(rawGain).replace(',', '.'));
    if (Number.isFinite(n) && n > 0) elevationGainM = Math.round(n);
  }

  let elevationLossM: number | null = null;
  if (tags['ele:loss'] || tags.descent) {
    const rawLoss = tags['ele:loss'] || tags.descent;
    const n = parseFloat(String(rawLoss).replace(',', '.'));
    if (Number.isFinite(n) && n > 0) elevationLossM = Math.round(n);
  }

  // Difficulté technique déclarée
  const difficulty = tags.sac_scale || tags.difficulty || null;

  // Boucle ou aller simple (priorité au tag déclaré, repli sur la détection géométrique fermée)
  const roundtrip =
    tags.roundtrip === 'yes'
      ? true
      : tags.roundtrip === 'no'
      ? false
      : (geometryHierarchy.isLoop ?? null);

  return {
    ...summary,
    geometryStatus: geometryHierarchy.status,
    calculatedDistanceKm: geometryHierarchy.totalDistanceKm,
    geometryHierarchy,
    geojson,
    elevationGainM,
    elevationLossM,
    difficulty,
    roundtrip,
  };
}

/**
 * Catégorise un élément OSM en POI de randonnée
 */
export function classifyPoiCategory(tags: Record<string, string>): PoiCategory | null {
  if (tags.tourism === 'alpine_hut' || tags.tourism === 'wilderness_hut') return 'refuge';
  if (tags.amenity === 'shelter') return 'shelter';
  if (tags.amenity === 'drinking_water') return 'water';
  if (tags.natural === 'peak' || tags.natural === 'volcano' || tags.mountain_pass === 'yes') return 'summit';
  if (tags.tourism === 'camp_site' || tags.camp_site === 'bivouac') return 'camp';
  if (tags.tourism === 'viewpoint') return 'viewpoint';
  if (tags.amenity === 'parking') return 'parking';
  if (tags.highway === 'bus_stop' || tags.railway === 'station' || tags.railway === 'halt') return 'transit';
  return null;
}

/**
 * Normalise un node OSM en RoutePoiSummary
 */
export function normalizeOsmPoi(
  element: any,
  fetchedAt: string = new Date().toISOString()
): RoutePoiSummary | null {
  if (!element || !element.id || !isValidCoordinate(element.lon, element.lat)) {
    return null;
  }

  const tags = element.tags || {};
  const category = classifyPoiCategory(tags);
  if (!category) return null;

  let elevationM: number | null = null;
  if (tags.ele) {
    const n = parseFloat(String(tags.ele).replace(',', '.'));
    if (Number.isFinite(n)) elevationM = Math.round(n);
  }

  const name = tags.name || tags['name:fr'] || tags['name:en'] || null;

  const source: SourceProvenance = {
    provider: 'openstreetmap',
    sourceUrl: `https://www.openstreetmap.org/node/${element.id}`,
    externalId: String(element.id),
    sourceType: 'node',
    fetchedAt,
    sourceTimestamp: element.timestamp || null,
    sourceVersion: element.version || null,
    license: 'ODbL-1.0',
  };

  return {
    id: `osm:node:${element.id}`,
    category,
    name,
    coordinates: [Number(element.lon), Number(element.lat)],
    elevationM,
    tags,
    source,
  };
}
