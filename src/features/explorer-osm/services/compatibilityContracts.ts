/**
 * LE KIT DU VOYAGEUR — CONTRATS DE COMPATIBILITÉ MULTI-DOMAINES
 * Démontre et garantit que l'identifiant canonique unique `RouteId` (hiking_routes.id)
 * est directement consommable par :
 * - Compas (guidage)
 * - HikeSession (randonnée active & GPS réel)
 * - Communauté (publications & récits)
 * - Carnets (souvenirs & moments)
 * - Profil (statistiques d'activités réelles)
 * - Adventure Intelligence / Voyages (préparation)
 */

import type { RouteId, HikeSessionId } from '../domain/types';

// ── 1. COMPAS CONTRACT ────────────────────────────────────────────────────────
export interface CompasRoutePayload {
  routeId: RouteId;
  name: string;
  distanceKm: number;
  geometry: GeoJSON.Geometry;
  waypoints?: Array<{ lat: number; lng: number; label: string }>;
}

export function buildCompasPayload(route: {
  id: RouteId;
  name: string;
  distanceKm: number;
  geom: GeoJSON.Geometry | null;
}): CompasRoutePayload {
  if (!route.geom) {
    throw new Error('Impossible de lancer le Compas sans géométrie valide');
  }
  return {
    routeId: route.id,
    name: route.name,
    distanceKm: route.distanceKm,
    geometry: route.geom,
  };
}

// ── 2. HIKE SESSION CONTRACT (Randonnée active) ───────────────────────────────
export interface NewHikeSessionParams {
  userId: string;
  routeId: RouteId;
  startedAt: string;
}

export interface HikeSessionRecord {
  id: HikeSessionId;
  userId: string;
  routeId: RouteId; // Référence à la route canonique
  startedAt: string;
  endedAt?: string | null;
  distanceKm: number; // Distance réellement parcourue par le marcheur
  durationSeconds: number; // Temps réel
  elevationGainM: number; // D+ réel
  positionsGeojson: GeoJSON.LineString; // TRACE GPS RÉELLE (séparée du tracé officiel)
  poiEvents: Array<{ poiName: string; lat: number; lon: number; reachedAt: string }>;
}

// ── 3. COMMUNAUTÉ CONTRACT (Publications) ─────────────────────────────────────
export interface CommunityPostSnapshot {
  title: string;
  distanceKm: number;
  elevationGainM?: number | null;
  durationFormatted?: string;
  startRegion?: string | null;
}

export interface CommunityPostPayload {
  id: string;
  authorId: string;
  routeId?: RouteId | null; // Route canonique partagée
  hikeSessionId?: HikeSessionId | null; // Session utilisateur facultative
  snapshot: CommunityPostSnapshot; // Snapshot de présentation léger
  content: string;
  photos: string[];
}

export function createCommunityPost(
  authorId: string,
  content: string,
  route: { id: RouteId; name: string; distanceKm: number },
  session?: { id: HikeSessionId; distanceKm: number; elevationGainM: number; durationSeconds: number }
): CommunityPostPayload {
  return {
    id: `post_${Date.now()}`,
    authorId,
    routeId: route.id,
    hikeSessionId: session ? session.id : null,
    snapshot: {
      title: route.name,
      distanceKm: session ? session.distanceKm : route.distanceKm,
      elevationGainM: session?.elevationGainM ?? null,
      durationFormatted: session ? `${Math.round(session.durationSeconds / 60)} min` : undefined,
    },
    content,
    photos: [],
  };
}

// ── 4. CARNETS CONTRACT ───────────────────────────────────────────────────────
export interface CarnetRecord {
  id: string;
  authorId: string;
  routeId: RouteId;
  hikeSessionId?: HikeSessionId | null;
  title: string;
  story: string;
  photos: string[];
  gearUsed: string[];
  createdAt: string;
}

// ── 5. PROFIL STATS CONTRACT ──────────────────────────────────────────────────
export interface UserOutdoorStats {
  userId: string;
  sortiesCount: number; // Nombre d'activités réellement effectuées
  totalDistanceKm: number; // Somme des km réels GPS
  totalElevationGainM: number; // Somme des D+ réels
  distinctRoutesHikedCount: number; // Nombre de routes canoniques distinctes parcourues
}

export function computeUserOutdoorStats(
  userId: string,
  completedSessions: Array<{ routeId: RouteId; distanceKm: number; elevationGainM: number }>
): UserOutdoorStats {
  const distinctRoutes = new Set<RouteId>();
  let totalKm = 0;
  let totalDPlus = 0;

  for (const s of completedSessions) {
    distinctRoutes.add(s.routeId);
    totalKm += s.distanceKm;
    totalDPlus += s.elevationGainM;
  }

  return {
    userId,
    sortiesCount: completedSessions.length,
    totalDistanceKm: Math.round(totalKm * 10) / 10,
    totalElevationGainM: Math.round(totalDPlus),
    distinctRoutesHikedCount: distinctRoutes.size,
  };
}
