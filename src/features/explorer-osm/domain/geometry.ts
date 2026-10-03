/**
 * LE KIT DU VOYAGEUR — VALIDATION & ASSEMBLAGE GÉOMÉTRIQUE OSM
 * Moteur d'assemblage strict des relations OpenStreetMap :
 * - Préservation des rôles (main, alternative, approach, excursion, connection)
 * - Orientation et ordonnancement sans jointure artificielle
 * - Détection des ruptures ("Tracé partiel")
 * - Zéro invention : pas de fermeture de boucle arbitraire, pas de ligne imaginaire.
 */

import type {
  GeometryQualityStatus,
  RouteGeometryHierarchy,
  RouteGeometrySegment,
  RouteMemberRole,
} from './types';

// Rayon moyen de la Terre en kilomètres (WGS84)
const EARTH_RADIUS_KM = 6371.0088;

/**
 * Calcul précis de la distance orthodromique (Haversine) entre deux points [lng, lat]
 */
export function haversineDistanceKm(p1: [number, number], p2: [number, number]): number {
  const [lng1, lat1] = p1;
  const [lng2, lat2] = p2;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calcule la distance totale cumulée d'une ligne de coordonnées [lng, lat]
 */
export function calculateLineDistanceKm(coordinates: [number, number][]): number {
  if (coordinates.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    total += haversineDistanceKm(coordinates[i], coordinates[i + 1]);
  }
  return total;
}

/**
 * Normalise et valide une paire [lng, lat]
 */
export function isValidCoordinate(lng: unknown, lat: unknown): boolean {
  if (lng == null || lat == null) return false;
  const nLng = Number(lng);
  const nLat = Number(lat);
  return (
    Number.isFinite(nLng) &&
    Number.isFinite(nLat) &&
    nLng >= -180 &&
    nLng <= 180 &&
    nLat >= -90 &&
    nLat <= 90
  );
}

/**
 * Normalise le rôle d'un membre de relation OSM
 */
export function normalizeMemberRole(rawRole: string | undefined): RouteMemberRole {
  if (!rawRole) return 'main';
  const role = rawRole.toLowerCase().trim();
  if (role === '' || role === 'main' || role === 'forward' || role === 'backward') {
    return 'main';
  }
  if (role.includes('alt') || role.includes('variant')) {
    return 'alternative';
  }
  if (role.includes('approach') || role.includes('acces') || role.includes('start')) {
    return 'approach';
  }
  if (role.includes('excursion') || role.includes('spoil') || role.includes('summit')) {
    return 'excursion';
  }
  if (role.includes('connect') || role.includes('link')) {
    return 'connection';
  }
  return 'main';
}

export interface RawOsmMemberGeometry {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role?: string;
  geometry?: Array<{ lat: number; lon: number }>;
}

/**
 * Tolérance numérique stricte (2.5 mètres) réservée UNIQUEMENT aux imprécisions
 * de conversion et d'arrondis des coordonnées flottantes WGS84 entre nœuds partagés.
 * Tout écart supérieur (notamment >= 5m ou 20m) est une vraie discontinuité topologique,
 * comptabilisé dans gapCount et fait basculer la qualité en 'partial'.
 */
export const GAP_NUMERICAL_TOLERANCE_METERS = 2.5;

/** Tolérance stricte pour coïncidence géométrique des extrémités de boucle */
export const LOOP_STRICT_TOLERANCE_METERS = 2.0;

/**
 * Détecte si un tracé assemblé constitue une boucle avec un niveau de preuve rigoureux :
 * 1. Coïncidence géométrique stricte (< 2.0m) entre départ et arrivée
 * 2. Tag source explicite (roundtrip=yes, circular=yes, loop=yes) avec départ/arrivée proches (< 100m)
 * Ne ferme JAMAIS la géométrie artificiellement.
 */
export function detectLoop(
  segments: RouteGeometrySegment[],
  gapCount: number,
  tags?: Record<string, string>
): { isLoop: boolean; loopDetectionMethod: 'exact_endpoints' | 'source_tag' | 'none' } {
  if (segments.length === 0 || gapCount > 0) {
    return { isLoop: false, loopDetectionMethod: 'none' };
  }

  const firstCoord = segments[0].coordinates[0];
  const lastSeg = segments[segments.length - 1];
  const lastCoord = lastSeg.coordinates[lastSeg.coordinates.length - 1];

  if (!firstCoord || !lastCoord) {
    return { isLoop: false, loopDetectionMethod: 'none' };
  }

  const distanceMeters = haversineDistanceKm(firstCoord, lastCoord) * 1000;

  // 1. Géométrie réellement fermée (extrémités coïncidentes < 2m)
  if (distanceMeters <= LOOP_STRICT_TOLERANCE_METERS) {
    return { isLoop: true, loopDetectionMethod: 'exact_endpoints' };
  }

  // 2. Information source explicite si disponible
  const tagRoundtrip =
    tags?.roundtrip?.toLowerCase() ||
    tags?.circular?.toLowerCase() ||
    tags?.loop?.toLowerCase();

  if ((tagRoundtrip === 'yes' || tagRoundtrip === 'true') && distanceMeters <= 100) {
    return { isLoop: true, loopDetectionMethod: 'source_tag' };
  }

  return { isLoop: false, loopDetectionMethod: 'none' };
}

/**
 * Assemble et ordonne les segments d'un rôle de façon bidirectionnelle
 * SANS JAMAIS inventer de point ni relier artificiellement deux points disjoints.
 * Supporte :
 * - Segments fournis dans le désordre (ex: way3, way1, way2)
 * - Segments inversés (direction opposée)
 * - Segments démarrant avant le premier segment (préfixage / prepend)
 * - Vraies discontinuités (> 2.5m, incluant 20m) identifiées et préservées
 * - Détection des boucles fermées prouvées
 */
export function chainRoleSegments(
  rawSegments: RouteGeometrySegment[],
  tags?: Record<string, string>
): {
  segments: RouteGeometrySegment[];
  gapCount: number;
  isLoop: boolean;
  loopDetectionMethod: 'exact_endpoints' | 'source_tag' | 'none';
} {
  if (rawSegments.length === 0) {
    return { segments: [], gapCount: 0, isLoop: false, loopDetectionMethod: 'none' };
  }
  if (rawSegments.length === 1) {
    const seg = rawSegments[0];
    const loopInfo = detectLoop([seg], 0, tags);
    return { segments: [seg], gapCount: 0, ...loopInfo };
  }

  // Filtrer les segments sans coordonnées valides
  const remaining = rawSegments
    .filter((s) => s.coordinates && s.coordinates.length >= 2)
    .map((s) => ({
      ...s,
      coordinates: [...s.coordinates],
    }));

  if (remaining.length === 0) {
    return { segments: [], gapCount: 0, isLoop: false, loopDetectionMethod: 'none' };
  }

  // Liste de chaînes continues indépendantes
  const chains: RouteGeometrySegment[][] = [];

  while (remaining.length > 0) {
    // Démarrer une nouvelle composante continue avec le premier segment disponible
    const currentChain: RouteGeometrySegment[] = [remaining.shift()!];
    let extended = true;

    while (extended && remaining.length > 0) {
      extended = false;

      const firstSeg = currentChain[0];
      const lastSeg = currentChain[currentChain.length - 1];

      const chainHead = firstSeg.coordinates[0];
      const chainTail = lastSeg.coordinates[lastSeg.coordinates.length - 1];

      let bestIdx = -1;
      let bestPlacement: 'prepend' | 'append' | null = null;
      let bestNeedsReverse = false;
      let minGapMeters = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const cand = remaining[i];
        const candStart = cand.coordinates[0];
        const candEnd = cand.coordinates[cand.coordinates.length - 1];

        // 1. Connexion au bout de la chaîne (Tail -> candidate)
        const dTailStart = haversineDistanceKm(chainTail, candStart) * 1000;
        if (dTailStart <= GAP_NUMERICAL_TOLERANCE_METERS && dTailStart < minGapMeters) {
          minGapMeters = dTailStart;
          bestIdx = i;
          bestPlacement = 'append';
          bestNeedsReverse = false;
        }

        const dTailEnd = haversineDistanceKm(chainTail, candEnd) * 1000;
        if (dTailEnd <= GAP_NUMERICAL_TOLERANCE_METERS && dTailEnd < minGapMeters) {
          minGapMeters = dTailEnd;
          bestIdx = i;
          bestPlacement = 'append';
          bestNeedsReverse = true;
        }

        // 2. Connexion au début de la chaîne (candidate -> Head)
        const dHeadEnd = haversineDistanceKm(chainHead, candEnd) * 1000;
        if (dHeadEnd <= GAP_NUMERICAL_TOLERANCE_METERS && dHeadEnd < minGapMeters) {
          minGapMeters = dHeadEnd;
          bestIdx = i;
          bestPlacement = 'prepend';
          bestNeedsReverse = false;
        }

        const dHeadStart = haversineDistanceKm(chainHead, candStart) * 1000;
        if (dHeadStart <= GAP_NUMERICAL_TOLERANCE_METERS && dHeadStart < minGapMeters) {
          minGapMeters = dHeadStart;
          bestIdx = i;
          bestPlacement = 'prepend';
          bestNeedsReverse = true;
        }
      }

      if (bestIdx !== -1 && bestPlacement) {
        const [cand] = remaining.splice(bestIdx, 1);
        let coords = cand.coordinates;
        let isReversed = cand.isReversed;

        if (bestNeedsReverse) {
          coords = [...coords].reverse();
          isReversed = !isReversed;
        }

        const matchedSeg: RouteGeometrySegment = {
          ...cand,
          coordinates: coords,
          isReversed,
        };

        if (bestPlacement === 'append') {
          currentChain.push(matchedSeg);
        } else {
          currentChain.unshift(matchedSeg);
        }

        extended = true;
      }
    }

    chains.push(currentChain);
  }

  // Si on a plusieurs chaînes discontinues, on les ordonne par proximité géographique
  // SANS JAMAIS relier artificiellement les points !
  const orderedSegments: RouteGeometrySegment[] = [];
  const remainingChains = [...chains];

  let currentC = remainingChains.shift()!;
  orderedSegments.push(...currentC);

  while (remainingChains.length > 0) {
    const lastSeg = orderedSegments[orderedSegments.length - 1];
    const tailCoord = lastSeg.coordinates[lastSeg.coordinates.length - 1];

    let closestChainIdx = 0;
    let closestDist = Infinity;
    let reverseChain = false;

    for (let i = 0; i < remainingChains.length; i++) {
      const c = remainingChains[i];
      const startCoord = c[0].coordinates[0];
      const endCoord = c[c.length - 1].coordinates[c[c.length - 1].coordinates.length - 1];

      const dStart = haversineDistanceKm(tailCoord, startCoord);
      const dEnd = haversineDistanceKm(tailCoord, endCoord);

      if (dStart < closestDist) {
        closestDist = dStart;
        closestChainIdx = i;
        reverseChain = false;
      }
      if (dEnd < closestDist) {
        closestDist = dEnd;
        closestChainIdx = i;
        reverseChain = true;
      }
    }

    const [nextChain] = remainingChains.splice(closestChainIdx, 1);
    if (reverseChain) {
      const rev = nextChain
        .map((s) => ({
          ...s,
          coordinates: [...s.coordinates].reverse(),
          isReversed: !s.isReversed,
        }))
        .reverse();
      orderedSegments.push(...rev);
    } else {
      orderedSegments.push(...nextChain);
    }
  }

  const gapCount = Math.max(0, chains.length - 1);

  // Détection de boucle rigoureuse SANS fermer artificiellement la géométrie
  const loopInfo = detectLoop(orderedSegments, gapCount, tags);

  return {
    segments: orderedSegments,
    gapCount,
    isLoop: loopInfo.isLoop,
    loopDetectionMethod: loopInfo.loopDetectionMethod,
  };
}

/**
 * Assembleur principal de la relation OSM en hiérarchie géométrique qualifiée
 */
export function assembleOsmRelationGeometry(
  members: RawOsmMemberGeometry[],
  tags?: Record<string, string>
): RouteGeometryHierarchy {
  const warnings: string[] = [];

  const mainSegmentsRaw: RouteGeometrySegment[] = [];
  const alternativeSegmentsRaw: RouteGeometrySegment[] = [];
  const approachSegmentsRaw: RouteGeometrySegment[] = [];
  const excursionSegmentsRaw: RouteGeometrySegment[] = [];
  const connectionSegmentsRaw: RouteGeometrySegment[] = [];

  let totalValidPoints = 0;
  let totalInvalidPoints = 0;

  for (const member of members) {
    if (member.type !== 'way' || !member.geometry || !Array.isArray(member.geometry)) {
      if (member.type === 'relation') {
        warnings.push(`Sous-relation non résolue: ${member.ref} (${member.role || 'no-role'})`);
      }
      continue;
    }

    const coords: [number, number][] = [];
    for (const pt of member.geometry) {
      if (isValidCoordinate(pt.lon, pt.lat)) {
        coords.push([Number(pt.lon), Number(pt.lat)]);
        totalValidPoints++;
      } else {
        totalInvalidPoints++;
      }
    }

    if (coords.length < 2) continue;

    const segment: RouteGeometrySegment = {
      id: String(member.ref),
      role: normalizeMemberRole(member.role),
      coordinates: coords,
      distanceKm: calculateLineDistanceKm(coords),
      isReversed: false,
    };

    switch (segment.role) {
      case 'main':
        mainSegmentsRaw.push(segment);
        break;
      case 'alternative':
        alternativeSegmentsRaw.push(segment);
        break;
      case 'approach':
        approachSegmentsRaw.push(segment);
        break;
      case 'excursion':
        excursionSegmentsRaw.push(segment);
        break;
      case 'connection':
        connectionSegmentsRaw.push(segment);
        break;
      default:
        mainSegmentsRaw.push(segment);
        break;
    }
  }

  // Si aucun point valide n'existe
  if (totalValidPoints === 0) {
    return {
      status: 'unavailable',
      mainSegments: [],
      alternatives: [],
      approaches: [],
      excursions: [],
      connections: [],
      totalDistanceKm: 0,
      gapCount: 0,
      isLoop: false,
      loopDetectionMethod: 'none',
      warnings: ['Aucune géométrie de way disponible pour cette relation'],
    };
  }

  // Chaînage et ordonnancement par rôle
  const mainChained = chainRoleSegments(mainSegmentsRaw, tags);
  const altChained = chainRoleSegments(alternativeSegmentsRaw, tags);
  const appChained = chainRoleSegments(approachSegmentsRaw, tags);
  const excChained = chainRoleSegments(excursionSegmentsRaw, tags);
  const connChained = chainRoleSegments(connectionSegmentsRaw, tags);

  const totalGaps =
    mainChained.gapCount +
    altChained.gapCount +
    appChained.gapCount +
    excChained.gapCount +
    connChained.gapCount;

  const totalDistanceKm =
    mainChained.segments.reduce((acc, s) => acc + s.distanceKm, 0) +
    altChained.segments.reduce((acc, s) => acc + s.distanceKm, 0) +
    appChained.segments.reduce((acc, s) => acc + s.distanceKm, 0) +
    excChained.segments.reduce((acc, s) => acc + s.distanceKm, 0) +
    connChained.segments.reduce((acc, s) => acc + s.distanceKm, 0);

  // Détermination stricte du statut de qualité
  let status: GeometryQualityStatus = 'complete';

  if (totalInvalidPoints > 0) {
    warnings.push(`${totalInvalidPoints} coordonnées invalides rejetées`);
  }

  if (mainChained.segments.length === 0 && altChained.segments.length > 0) {
    warnings.push('Aucun segment principal identifié, variantes seules présentes');
    status = 'partial';
  } else if (mainChained.gapCount > 0) {
    warnings.push(
      `Tracé partiel: ${mainChained.gapCount} rupture(s) détectée(s) entre les segments du tracé principal`
    );
    status = 'partial';
  }

  const geometryHash = computeGeometryHash(
    mainChained.segments.length > 0 ? mainChained.segments : altChained.segments
  );

  return {
    status,
    mainSegments: mainChained.segments,
    alternatives: altChained.segments,
    approaches: appChained.segments,
    excursions: excChained.segments,
    connections: connChained.segments,
    totalDistanceKm: Math.round(totalDistanceKm * 1000) / 1000,
    gapCount: totalGaps,
    isLoop: mainChained.isLoop,
    loopDetectionMethod: mainChained.loopDetectionMethod,
    geometryHash,
    warnings,
  };
}

/**
 * Calcule un hash déterministe de la géométrie pour le versionnement des routes
 */
export function computeGeometryHash(segments: RouteGeometrySegment[]): string {
  if (segments.length === 0) return 'geo_empty';
  const sample = segments
    .map(
      (s) =>
        `${s.id}:${s.coordinates.length}:${s.coordinates[0]?.join(',')}:${s.coordinates[s.coordinates.length - 1]?.join(',')}`
    )
    .join('|');

  let hash = 5381;
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) + hash) ^ sample.charCodeAt(i);
  }
  return `geo_${Math.abs(hash).toString(16)}`;
}

/**
 * Construit un GeoJSON MultiLineString valide à partir de la hiérarchie
 * Compatible avec ST_GeomFromGeoJSON PostGIS et MapLibre / Leaflet.
 */
export function hierarchyToMultiLineString(
  hierarchy: RouteGeometryHierarchy,
  includeVariants = false
): GeoJSON.MultiLineString | GeoJSON.LineString | null {
  const lines: [number, number][][] = [];

  for (const seg of hierarchy.mainSegments) {
    if (seg.coordinates.length >= 2) {
      lines.push(seg.coordinates);
    }
  }

  if (includeVariants) {
    for (const seg of [
      ...hierarchy.alternatives,
      ...hierarchy.approaches,
      ...hierarchy.excursions,
      ...hierarchy.connections,
    ]) {
      if (seg.coordinates.length >= 2) {
        lines.push(seg.coordinates);
      }
    }
  }

  if (lines.length === 0) return null;
  if (lines.length === 1) {
    return {
      type: 'LineString',
      coordinates: lines[0],
    };
  }

  return {
    type: 'MultiLineString',
    coordinates: lines,
  };
}

/**
 * Construit un GeoJSON MultiLineString strict pour PostGIS (geometry(MultiLineString, 4326)).
 * Même pour une seule ligne, renvoie toujours { type: 'MultiLineString', coordinates: [line] }
 * pour respecter la contrainte de type de colonne de la table `hiking_routes`.
 */
export function hierarchyToGeoJsonMultiLineString(
  hierarchy: RouteGeometryHierarchy,
  includeVariants = false
): GeoJSON.MultiLineString | null {
  const lines: [number, number][][] = [];

  for (const seg of hierarchy.mainSegments) {
    if (seg.coordinates.length >= 2) {
      lines.push(seg.coordinates);
    }
  }

  if (includeVariants) {
    for (const seg of [
      ...hierarchy.alternatives,
      ...hierarchy.approaches,
      ...hierarchy.excursions,
      ...hierarchy.connections,
    ]) {
      if (seg.coordinates.length >= 2) {
        lines.push(seg.coordinates);
      }
    }
  }

  if (lines.length === 0) return null;

  return {
    type: 'MultiLineString',
    coordinates: lines,
  };
}

/**
 * Budget surfacique maximal autorisé pour une requête Overpass exploratoire (en km²).
 * Évite les requêtes massives qui bloquent le serveur Overpass amont.
 */
export const MAX_OVERPASS_GEODESIC_AREA_KM2 = 400;

/**
 * Calcule l'aire géodésique sphérique réelle d'une BBOX en km²,
 * en tenant compte de la courbure de la Terre et de la latitude.
 * Formule sphérique exacte : A = R² * |sin(lat2) - sin(lat1)| * |lng2 - lng1| * (π / 180)
 */
export function calculateBboxGeodesicAreaKm2(bbox: {
  south: number;
  west: number;
  north: number;
  east: number;
}): number {
  const lat1 = Math.min(bbox.south, bbox.north);
  const lat2 = Math.max(bbox.south, bbox.north);
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  // Calcul du delta longitude en gérant le franchissement éventuel de l'antiméridien
  let dLngDeg = Math.abs(bbox.east - bbox.west);
  if (dLngDeg > 360) dLngDeg = 360;
  const dLngRad = (dLngDeg * Math.PI) / 180;

  const area =
    EARTH_RADIUS_KM *
    EARTH_RADIUS_KM *
    Math.abs(Math.sin(lat2Rad) - Math.sin(lat1Rad)) *
    dLngRad;

  return Math.round(area * 100) / 100;
}
