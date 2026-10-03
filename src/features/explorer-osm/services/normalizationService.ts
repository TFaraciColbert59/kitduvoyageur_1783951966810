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
 * Extrait et parse une durée textuelle déclarée dans un tag OSM
 * Formats gérés : "01:30", "1:30", "2h30", "2h", "2.5h", "90 min", "90m"
 */
export function parseOsmDuration(rawDuration: string | undefined): number | null {
  if (!rawDuration) return null;
  const str = rawDuration.toLowerCase().trim().replace(',', '.');

  // Format HH:MM:SS ou HH:MM (ex: "01:30", "1:30", "02:15:00")
  const colonMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1], 10);
    const minutes = parseInt(colonMatch[2], 10);
    return Math.round((hours + minutes / 60) * 100) / 100;
  }

  // Format "2h30", "2h 30", "2h30min"
  const hMinMatch = str.match(/^(\d+)\s*h\s*(\d{1,2})(?:min|m)?$/);
  if (hMinMatch) {
    const hours = parseInt(hMinMatch[1], 10);
    const minutes = parseInt(hMinMatch[2], 10);
    return Math.round((hours + minutes / 60) * 100) / 100;
  }

  // Format "2h", "2.5h", "2 hours"
  const hMatch = str.match(/^([\d.]+)\s*(?:h|hr|hours?)$/);
  if (hMatch) {
    const val = parseFloat(hMatch[1]);
    return Number.isFinite(val) && val > 0 ? Math.round(val * 100) / 100 : null;
  }

  // Format "90 min", "90m"
  const minMatch = str.match(/^([\d.]+)\s*(?:min|mins|minutes?|m)$/);
  if (minMatch) {
    const minutes = parseFloat(minMatch[1]);
    return Number.isFinite(minutes) && minutes > 0 ? Math.round((minutes / 60) * 100) / 100 : null;
  }

  // Chiffre d'heures brut (ex: "2.5")
  const num = parseFloat(str);
  if (Number.isFinite(num) && num > 0 && num < 240) {
    return Math.round(num * 100) / 100;
  }

  return null;
}

/**
 * Résout une photo réelle depuis les tags OSM (image, wikimedia_commons, etc.)
 */
export function resolveOsmImage(tags: Record<string, string> | undefined): string | null {
  if (!tags) return null;

  const raw = tags.image || tags.image_url || tags['image:url'];
  if (raw) {
    const str = raw.trim();
    if (str.startsWith('http://') || str.startsWith('https://')) {
      return str;
    }
    const cleanFile = str.replace(/^File:/i, '').trim();
    if (cleanFile.length > 0 && /\.(jpe?g|png|webp|svg)$/i.test(cleanFile)) {
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(cleanFile)}?width=800`;
    }
  }

  if (tags.wikimedia_commons) {
    const str = tags.wikimedia_commons.trim();
    const cleanFile = str.replace(/^File:/i, '').trim();
    if (cleanFile.length > 0 && /\.(jpe?g|png|webp|svg)$/i.test(cleanFile)) {
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(cleanFile)}?width=800`;
    }
  }

  return null;
}

/**
 * Calcule des indicateurs d'expérience dynamiques et calibrés
 */
export function calculateExperienceScores(
  tags: Record<string, string>,
  distanceKm: number | null | undefined,
  elevationGainM: number | null | undefined,
  network: string | null | undefined
): { adventure: number; nature: number; panorama: number } {
  // Aventure : difficulté technique + dénivelé + distance + réseau
  let adventure = 40;
  const sac = (tags.sac_scale || '').toLowerCase();
  if (sac === 'hiking' || sac === 't1') adventure = 30;
  else if (sac === 'mountain_hiking' || sac === 't2') adventure = 55;
  else if (sac === 'demanding_mountain_hiking' || sac === 't3') adventure = 75;
  else if (sac === 'alpine_hiking' || sac === 't4') adventure = 88;
  else if (sac.includes('alpine') || sac === 't5' || sac === 't6') adventure = 96;

  if (distanceKm) {
    if (distanceKm > 30) adventure += 15;
    else if (distanceKm > 15) adventure += 8;
    else if (distanceKm < 3) adventure -= 10;
  }
  if (elevationGainM) {
    if (elevationGainM > 1000) adventure += 15;
    else if (elevationGainM > 500) adventure += 8;
    else if (elevationGainM < 100) adventure -= 8;
  }
  if (network === 'iwn' || network === 'nwn') adventure += 10;

  // Nature : immersion forestière / parcs / absence de goudron
  let nature = 75;
  const textContext = `${tags.name || ''} ${tags.description || ''} ${tags.natural || ''}`.toLowerCase();
  if (
    textContext.includes('bois') ||
    textContext.includes('foret') ||
    textContext.includes('forêt') ||
    tags.landuse === 'forest'
  ) {
    nature += 15;
  }
  if (textContext.includes('naturel') || textContext.includes('parc') || textContext.includes('reserve')) {
    nature += 10;
  }
  if (tags.surface === 'asphalt' || tags.surface === 'paved') {
    nature -= 20;
  }

  // Panorama : points de vue, sommets, relief
  let panorama = 60;
  if (elevationGainM) {
    if (elevationGainM > 800) panorama += 25;
    else if (elevationGainM > 350) panorama += 15;
    else if (elevationGainM < 50) panorama -= 10;
  }
  if (
    textContext.includes('vue') ||
    textContext.includes('point de vue') ||
    textContext.includes('belvedere') ||
    textContext.includes('belvédère') ||
    textContext.includes('panorama') ||
    textContext.includes('crete') ||
    textContext.includes('crête') ||
    textContext.includes('sommet')
  ) {
    panorama += 20;
  }

  return {
    adventure: Math.max(15, Math.min(99, Math.round(adventure))),
    nature: Math.max(20, Math.min(99, Math.round(nature))),
    panorama: Math.max(15, Math.min(99, Math.round(panorama))),
  };
}

/**
 * Résout la description ou produit une synthèse factuelle
 */
export function resolveOsmDescription(
  tags: Record<string, string>,
  name: string,
  distanceKm: number | null | undefined,
  elevationGainM: number | null | undefined,
  roundtrip: boolean | null | undefined
): string {
  if (tags.description) return tags.description;
  if (tags['description:fr']) return tags['description:fr'];
  if (tags['description:en']) return tags['description:en'];
  if (tags.note) return tags.note;
  if (tags.comment) return tags.comment;

  const parts: string[] = [];
  const typeStr = roundtrip === true ? 'en boucle' : roundtrip === false ? 'en aller simple' : '';
  const distStr = distanceKm ? `${distanceKm.toFixed(1)} km` : '';
  const gainStr = elevationGainM ? `+${Math.round(elevationGainM)} m de dénivelé` : '';

  if (distStr && gainStr) {
    parts.push(`Itinéraire ${typeStr} de ${distStr} avec ${gainStr}.`.replace('  ', ' '));
  } else if (distStr) {
    parts.push(`Itinéraire ${typeStr} de ${distStr}.`.replace('  ', ' '));
  } else {
    parts.push(`Itinéraire ${typeStr} balisé.`.replace('  ', ' '));
  }

  if (tags.from && tags.to) {
    parts.push(`Départ : ${tags.from}, arrivée : ${tags.to}.`);
  } else if (tags.from) {
    parts.push(`Point de départ : ${tags.from}.`);
  }

  if (tags.operator) {
    parts.push(`Gestionnaire : ${tags.operator}.`);
  } else if (tags.network) {
    const netLabels: Record<string, string> = {
      iwn: 'Sentier international de grande randonnée.',
      nwn: 'Sentier national de Grande Randonnée (GR).',
      rwn: 'Grande Randonnée de Pays (GRP).',
      lwn: 'Sentier local de Promenade et Randonnée (PR).',
    };
    if (netLabels[tags.network.toLowerCase()]) {
      parts.push(netLabels[tags.network.toLowerCase()]);
    }
  }

  if (tags.symbol) {
    parts.push(`Balisage : ${tags.symbol}.`);
  }

  return parts.join(' ');
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

  let elevationGainM: number | null = null;
  if (tags['ele:gain'] || tags.ascent) {
    const rawGain = tags['ele:gain'] || tags.ascent;
    const n = parseFloat(String(rawGain).replace(',', '.'));
    if (Number.isFinite(n) && n > 0) elevationGainM = Math.round(n);
  }

  const durationHours =
    parseOsmDuration(tags.duration || tags.time || tags['duration:forward']) ||
    (declaredDistanceKm
      ? Math.round((declaredDistanceKm / 4.0 + (elevationGainM ? elevationGainM / 300 : 0)) * 10) / 10
      : null);

  const imageUrl = resolveOsmImage(tags);
  const description = tags.description || tags['description:fr'] || tags.note || null;

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
    geometryStatus: 'complete',
    source,
    tags,
    imageUrl,
    elevationGainM,
    durationHours,
    description,
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
  let elevationGainM: number | null = summary.elevationGainM ?? null;
  if (!elevationGainM && (tags['ele:gain'] || tags.ascent)) {
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

  const totalDist = geometryHierarchy.totalDistanceKm || summary.declaredDistanceKm;
  const durationHours =
    parseOsmDuration(tags.duration || tags.time || tags['duration:forward']) ||
    (totalDist ? Math.round((totalDist / 4.0 + (elevationGainM ? elevationGainM / 300 : 0)) * 10) / 10 : summary.durationHours);

  const experienceScores = calculateExperienceScores(tags, totalDist, elevationGainM, summary.network);

  const description = resolveOsmDescription(tags, summary.name, totalDist, elevationGainM, roundtrip);

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
    imageUrl: summary.imageUrl || resolveOsmImage(tags),
    durationHoursEstimated: durationHours,
    durationHours,
    description,
    experienceScores,
    operator: tags.operator || null,
    symbol: tags.symbol || tags['osmc:symbol'] || null,
    from: tags.from || null,
    to: tags.to || null,
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
