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

  if (typeof (trail as any).osm_relation_id === 'number' && Number.isFinite((trail as any).osm_relation_id) && (trail as any).osm_relation_id > 0) {
    return (trail as any).osm_relation_id;
  }
  if ((trail as any).osm_relation_id) {
    const parsed = parseInt(String((trail as any).osm_relation_id), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const idStr = String(trail.id || '');
  if (idStr.startsWith('osm:relation:')) {
    const parsed = parseInt(idStr.replace('osm:relation:', ''), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  if ((trail as any).source === 'openstreetmap') {
    const ext = (trail as any).external_id || (trail as any).source_external_id;
    if (ext) {
      const parsed = parseInt(String(ext), 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
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
  const aExt = (a as any).external_id || (a as any).source_external_id;
  const bExt = (b as any).external_id || (b as any).source_external_id;
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
    const aLat = a.lat != null ? Number(a.lat) : (a as any).start_lat != null ? Number((a as any).start_lat) : null;
    const aLng = a.lng != null ? Number(a.lng) : (a as any).start_lng != null ? Number((a as any).start_lng) : null;
    const bLat = b.lat != null ? Number(b.lat) : (b as any).start_lat != null ? Number((b as any).start_lat) : null;
    const bLng = b.lng != null ? Number(b.lng) : (b as any).start_lng != null ? Number((b as any).start_lng) : null;

    if (aLat !== null && aLng !== null && bLat !== null && bLng !== null) {
      const dLat = Math.abs(aLat - bLat);
      const dLng = Math.abs(aLng - bLng);
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

    const ext = (t as any).external_id || (t as any).source_external_id;
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

    const otExt = (ot as any).external_id || (ot as any).source_external_id;
    if (otExt) {
      const otSrc = (ot as any).source || 'openstreetmap';
      if (existingSourceExternal.has(`${otSrc}:${otExt}`)) {
        continue;
      }
    }

    // Contrôle secondaire (géolocalisation coïncidente avec même nom)
    if (baseTrails.some((bt) => isSameTrail(bt, ot))) {
      continue;
    }

    combined.push(ot);
    if (ot.id) existingIds.add(String(ot.id));
    if (otOsmId !== null) existingOsmRelationIds.add(otOsmId);
  }

  return combined;
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
 */
export function filterTrailsByViewport(
  trails: MapTrail[],
  queriedBbox: ViewportBbox | null
): MapTrail[] {
  if (!queriedBbox) return trails;

  return trails.filter((t) => {
    const tLat = t.lat != null ? Number(t.lat) : (t as any).start_lat != null ? Number((t as any).start_lat) : null;
    const tLng = t.lng != null ? Number(t.lng) : (t as any).start_lng != null ? Number((t as any).start_lng) : null;

    if (tLat != null && tLng != null && !Number.isNaN(tLat) && !Number.isNaN(tLng)) {
      const isOsm = (t as any).source === 'openstreetmap';
      // Pour les tracés OSM, le centre géométrique d'une grande traversée (ex. GR, Kumano Kodo)
      // peut se trouver légèrement en marge de la BBOX tout en intersectant la zone.
      // On applique une marge de tolérance locale proportionnelle, mais qui rejette
      // absolument tout ce qui se trouve hors de la région.
      const latMargin = isOsm ? Math.max(0.5, (queriedBbox.maxLat - queriedBbox.minLat) * 0.5) : 0;
      const lngMargin = isOsm ? Math.max(0.5, (queriedBbox.maxLng - queriedBbox.minLng) * 0.5) : 0;

      if (
        tLat < queriedBbox.minLat - latMargin ||
        tLat > queriedBbox.maxLat + latMargin ||
        tLng < queriedBbox.minLng - lngMargin ||
        tLng > queriedBbox.maxLng + lngMargin
      ) {
        return false;
      }
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

  if (err.code === 'VIEWPORT_TOO_LARGE') {
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
