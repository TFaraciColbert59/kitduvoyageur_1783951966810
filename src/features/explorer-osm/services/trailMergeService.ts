import type { MapTrail } from '@/components/explorer/types';
import type { UnifiedPOI } from '@/lib/queries/pois';

export interface ViewportBbox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  zoom?: number;
}

/**
 * Extrait l'identifiant de relation OSM s'il est disponible.
 */
export function extractOsmRelationId(trail: Partial<MapTrail> | Record<string, unknown>): number | null {
  if (!trail) return null;

  // 1. osm_relation_id (snake_case) ou osmRelationId (camelCase)
  const directOsm = (trail as any).osm_relation_id ?? (trail as any).osmRelationId;
  if (typeof directOsm === 'number' && Number.isFinite(directOsm) && directOsm > 0) {
    return directOsm;
  }
  if (directOsm) {
    const parsed = parseInt(String(directOsm), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  // 2. id string : 'osm:relation:12345'
  const idStr = String(trail.id || '');
  if (idStr.startsWith('osm:relation:')) {
    const parsed = parseInt(idStr.replace('osm:relation:', ''), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  // 3. source 'openstreetmap' avec external_id ou source_external_id ou externalId
  if ((trail as any).source === 'openstreetmap') {
    const ext = (trail as any).external_id || (trail as any).source_external_id || (trail as any).externalId;
    if (ext) {
      const parsed = parseInt(String(ext), 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }

  return null;
}

/**
 * Extrait les coordonnées d'un sentier (lat/lng, start_lat/start_lng ou premier point geojson).
 */
export function getTrailCoordinates(trail: Partial<MapTrail> | Record<string, unknown>): [number, number] | null {
  if (!trail) return null;
  const lat = trail.lat != null ? Number(trail.lat) : (trail as any).start_lat != null ? Number((trail as any).start_lat) : null;
  const lng = trail.lng != null ? Number(trail.lng) : (trail as any).start_lng != null ? Number((trail as any).start_lng) : null;

  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return [lat, lng];
  }

  // Extraction de repli depuis geojson si présent
  const geojson = (trail as any).geojson;
  if (geojson && typeof geojson === 'object') {
    try {
      const coords = geojson.coordinates;
      if (Array.isArray(coords)) {
        if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
          return [Number(coords[1]), Number(coords[0])];
        }
        if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number' && typeof coords[0][1] === 'number') {
          return [Number(coords[0][1]), Number(coords[0][0])];
        }
      }
    } catch {
      // Ignorer les géométries GeoJSON non conformes ou corrompues
    }
  }

  return null;
}

/**
 * Compare deux tracés pour déterminer s'ils représentent la même randonnée.
 * RÈGLE STRICTE : Deux randonnées ne sont JAMAIS considérées comme doublons
 * simplement parce qu'elles portent le même nom.
 */
export function isSameTrail(
  a: Partial<MapTrail> | Record<string, unknown>,
  b: Partial<MapTrail> | Record<string, unknown>
): boolean {
  if (!a || !b) return false;

  // 1. Identifiants identiques stricts
  if (a.id && b.id && String(a.id) === String(b.id)) {
    return true;
  }

  // 2. Même relation OSM (ex: route locale matérialisée vs découverte OSM directe)
  const aOsm = extractOsmRelationId(a);
  const bOsm = extractOsmRelationId(b);
  if (aOsm !== null && bOsm !== null && aOsm === bOsm) {
    return true;
  }

  // 3. Même source + externalId
  const aExt = (a as any).external_id || (a as any).source_external_id || (a as any).externalId;
  const bExt = (b as any).external_id || (b as any).source_external_id || (b as any).externalId;
  const aSrc = (a as any).source || 'lkdv';
  const bSrc = (b as any).source || 'lkdv';
  if (aExt && bExt && aSrc === bSrc && String(aExt) === String(bExt)) {
    return true;
  }

  // 4. Stratégie secondaire documentée :
  // Même nom ET coordonnées géographiques coïncidentes (< 200m) ET distances proches.
  const aName = String((a as any).name || '').trim().toLowerCase();
  const bName = String((b as any).name || '').trim().toLowerCase();
  if (aName && bName && aName === bName) {
    const aCoords = getTrailCoordinates(a as MapTrail);
    const bCoords = getTrailCoordinates(b as MapTrail);

    if (aCoords && bCoords) {
      const dLat = Math.abs(aCoords[0] - bCoords[0]);
      const dLng = Math.abs(aCoords[1] - bCoords[1]);
      // ~200m ≈ 0.002 degrés
      if (dLat < 0.002 && dLng < 0.002) {
        const aDist = a.distance_km != null ? Number(a.distance_km) : null;
        const bDist = b.distance_km != null ? Number(b.distance_km) : null;
        if (aDist === null || bDist === null) {
          return true;
        }
        if (Math.abs(aDist - bDist) <= Math.max(aDist, bDist) * 0.15) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Fusionne les sentiers de base (Supabase/viewport) et les sentiers découverts sur OSM,
 * avec déduplication prioritaire par IDs (route ID, relation OSM, source + external ID).
 */
export function mergeAndDeduplicateTrails(
  baseTrails: MapTrail[],
  osmTrails: MapTrail[]
): MapTrail[] {
  if (!osmTrails || osmTrails.length === 0) return baseTrails;
  if (!baseTrails || baseTrails.length === 0) return osmTrails;

  const existingIds = new Set<string>();
  const existingOsmRelationIds = new Set<number>();
  const existingSourceExternal = new Set<string>();

  for (const t of baseTrails) {
    if (t.id) existingIds.add(String(t.id));

    const osmId = extractOsmRelationId(t);
    if (osmId !== null) existingOsmRelationIds.add(osmId);

    const ext = (t as any).external_id || (t as any).source_external_id || (t as any).externalId;
    if (ext) {
      const src = (t as any).source || 'lkdv';
      existingSourceExternal.add(`${src}:${ext}`);
    }
  }

  const combined: MapTrail[] = [...baseTrails];

  for (const ot of osmTrails) {
    if (ot.id && existingIds.has(String(ot.id))) {
      continue;
    }

    const otOsmId = extractOsmRelationId(ot);
    if (otOsmId !== null && existingOsmRelationIds.has(otOsmId)) {
      continue;
    }

    const otExt = (ot as any).external_id || (ot as any).source_external_id || (ot as any).externalId;
    if (otExt) {
      const otSrc = (ot as any).source || 'openstreetmap';
      if (existingSourceExternal.has(`${otSrc}:${otExt}`)) {
        continue;
      }
    }

    // Contrôle secondaire (géolocalisation coïncidente avec même nom) contre TOUT élément déjà combiné
    if (combined.some((bt) => isSameTrail(bt, ot))) {
      continue;
    }

    combined.push(ot);
    if (ot.id) existingIds.add(String(ot.id));
    if (otOsmId !== null) existingOsmRelationIds.add(otOsmId);
    if (otExt) {
      const otSrc = (ot as any).source || 'openstreetmap';
      existingSourceExternal.add(`${otSrc}:${otExt}`);
    }
  }

  // Tri par priorité de prestige : Grands GR (iwn/nwn/GR) et parcours renommés en tête
  combined.sort((a, b) => getTrailPriority(b) - getTrailPriority(a));

  return combined;
}

/**
 * Calcule un score de priorité pour placer les GR et sentiers réputés en haut de liste.
 */
export function getTrailPriority(trail: Partial<MapTrail> | Record<string, unknown>): number {
  let score = 0;
  const net = String((trail as any).network || '').toLowerCase();
  const ref = String((trail as any).ref || '').toUpperCase();
  const name = String(trail.name || '').toUpperCase();

  if (net === 'iwn') score += 100; // International (TMB, etc.)
  else if (net === 'nwn') score += 90; // National (GR)
  else if (net === 'rwn') score += 70; // Régional (GRP)
  else if (net === 'lwn') score += 40; // PR local

  if (ref.includes('GR') || ref.includes('TMB')) score += 80;
  if (
    name.includes('GR ') ||
    name.includes('GR20') ||
    name.includes('MONT-BLANC') ||
    name.includes('MONT BLANC') ||
    name.includes('TRAVERS') ||
    name.includes('TOUR DU') ||
    name.includes('TOUR DES')
  ) {
    score += 80;
  }

  if (name && !name.toLowerCase().includes('sans titre')) score += 30;
  if ((trail as any).distance_km) score += 15;

  return score;
}

/**
 * Fusionne les POIs LKDV et les POIs OSM avec déduplication.
 */
export function mergeAndDeduplicatePois(
  basePois: UnifiedPOI[],
  osmPois: UnifiedPOI[]
): UnifiedPOI[] {
  if (!osmPois || osmPois.length === 0) return basePois;
  if (!basePois || basePois.length === 0) return osmPois;

  const existingIds = new Set<string>(basePois.map((p) => String(p.id)));
  const existingOsmNodeIds = new Set<string>();

  for (const p of basePois) {
    const idStr = String(p.id);
    if (idStr.startsWith('osm:node:')) {
      existingOsmNodeIds.add(idStr);
    }
    if ((p as any).osm_id) {
      existingOsmNodeIds.add(`osm:node:${(p as any).osm_id}`);
    }
  }

  const combined: UnifiedPOI[] = [...basePois];

  for (const op of osmPois) {
    const opIdStr = String(op.id);
    if (existingIds.has(opIdStr)) continue;
    if (opIdStr.startsWith('osm:node:') && existingOsmNodeIds.has(opIdStr)) continue;

    // Déduplication spatiale pour les POIs identiques (< 50m et même catégorie)
    const isDuplicate = basePois.some((bp) => {
      if (bp.category !== op.category) return false;
      const dLat = Math.abs(bp.lat - op.lat);
      const dLng = Math.abs(bp.lng - op.lng);
      return dLat < 0.0005 && dLng < 0.0005;
    });

    if (isDuplicate) continue;

    combined.push(op);
    existingIds.add(opIdStr);
    if (opIdStr.startsWith('osm:node:')) {
      existingOsmNodeIds.add(opIdStr);
    }
  }

  return combined;
}

/**
 * Filtre les randonnées pour ne conserver que celles situées dans le viewport actif.
 * Évite qu'une randonnée d'une zone précédente (ex: Nord / Roubaix) reste affichée
 * lorsqu'on navigue vers une autre zone (ex: Japon, Dolomites).
 * Tout tracé sans coordonnées résolvables est strictement exclu de la vue courante.
 */
export function filterTrailsByViewport(
  trails: MapTrail[],
  queriedBbox: ViewportBbox | null
): MapTrail[] {
  if (!queriedBbox) return trails;

  const latSpan = queriedBbox.maxLat - queriedBbox.minLat;
  const lngSpan = queriedBbox.maxLng - queriedBbox.minLng;

  return trails.filter((t) => {
    const coords = getTrailCoordinates(t);
    // Un sentier sans aucune coordonnée ne peut pas appartenir au viewport géographique
    if (!coords) return false;

    const [tLat, tLng] = coords;
    const isGrandGr =
      (t as any).network === 'iwn' ||
      (t as any).network === 'nwn' ||
      (t as any).network === 'rwn' ||
      String((t as any).ref || '').toUpperCase().includes('GR') ||
      String((t as any).ref || '').toUpperCase().includes('TMB');

    // Marge proportionnelle : permet aux Grands GR qui traversent le massif d'être inclus
    // même si leur centre global est décalé (jusqu'à ~0.8° soit ~80 km),
    // tout en excluant rigoureusement les sentiers d'autres régions ou pays (ex: Nord à 500km, Dolomites à 400km, Japon à 9000km).
    const latMargin = isGrandGr ? Math.min(0.8, Math.max(0.2, latSpan * 1.5)) : Math.min(0.25, Math.max(0.05, latSpan * 0.25));
    const lngMargin = isGrandGr ? Math.min(0.8, Math.max(0.2, lngSpan * 1.5)) : Math.min(0.25, Math.max(0.05, lngSpan * 0.25));

    if (
      tLat < queriedBbox.minLat - latMargin ||
      tLat > queriedBbox.maxLat + latMargin ||
      tLng < queriedBbox.minLng - lngMargin ||
      tLng > queriedBbox.maxLng + lngMargin
    ) {
      return false;
    }

    return true;
  });
}

/**
 * Filtre les POIs pour ne conserver que ceux situés dans le viewport actif.
 */
export function filterPoisByViewport(
  pois: UnifiedPOI[],
  queriedBbox: ViewportBbox | null
): UnifiedPOI[] {
  if (!queriedBbox) return pois;

  const latSpan = queriedBbox.maxLat - queriedBbox.minLat;
  const lngSpan = queriedBbox.maxLng - queriedBbox.minLng;
  const latMargin = Math.min(0.1, Math.max(0.02, latSpan * 0.15));
  const lngMargin = Math.min(0.1, Math.max(0.02, lngSpan * 0.15));

  return pois.filter((p) => {
    if (p.lat == null || p.lng == null || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
      return false;
    }
    if (
      p.lat < queriedBbox.minLat - latMargin ||
      p.lat > queriedBbox.maxLat + latMargin ||
      p.lng < queriedBbox.minLng - lngMargin ||
      p.lng > queriedBbox.maxLng + lngMargin
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Traduit une erreur API OSM en message utilisateur clair et explicite.
 */
export function resolveOsmErrorMessage(error: unknown): string | null {
  if (!error) return null;
  const err = error as any;

  // Les annulations volontaires du client (ex: déplacement de carte) ne sont pas des erreurs
  if (
    err.name === 'AbortError' ||
    err.code === 'ABORTED' ||
    String(err.message || '').includes('aborted') ||
    String(err.message || '').includes('annulée')
  ) {
    return null;
  }

  if (err.code === 'VIEWPORT_TOO_LARGE' || err.message?.includes('Zoome') || (err.status === 400 && String(err.message || '').includes('Zoome'))) {
    return 'Zoome davantage pour rechercher les randonnées de cette zone.';
  }
  if (err.status === 429 || err.code === 'RATE_LIMITED' || err.code === 'UPSTREAM_RATE_LIMITED') {
    return 'Recherche temporairement limitée. Réessaie dans quelques secondes.';
  }
  if (err.status === 503 || err.code === 'SERVICE_UNAVAILABLE') {
    return 'Les randonnées en ligne sont temporairement indisponibles.';
  }
  return err.message || 'Erreur lors de la recherche des randonnées.';
}
