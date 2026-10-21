import { HikeEngine } from '@/features/hiking/engine/HikeEngine';
import type { Carte3DTrail, Carte3DWaypoint, ElevationProfilePoint, WaypointCategory } from '../types';
import { buildElevationProfile } from './elevationEngine';

export interface LiveTrailSummary {
  id: string;
  name: string;
  massif: string;
  distanceKm: number;
  elevationGainM: number;
  difficulty: string;
}

/**
 * Recherche des sentiers réels LKDV dans Supabase/PostGIS via /api/hikes
 */
export async function searchSupabaseTrails(query: string): Promise<LiveTrailSummary[]> {
  if (!query || query.trim().length === 0) return [];

  try {
    const res = await fetch(`/api/hikes?search=${encodeURIComponent(query.trim())}&limit=15`);
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((t: any) => ({
      id: String(t.id),
      name: t.name || 'Sentier sans titre',
      massif: t.region || 'France',
      distanceKm: t.distance_km ? Math.round(Number(t.distance_km) * 10) / 10 : 0,
      elevationGainM: t.elevation_gain ? Math.round(Number(t.elevation_gain)) : 0,
      difficulty: t.difficulty || 'moyen',
    }));
  } catch (err) {
    console.warn('[SupabaseTrailService] Échec recherche sentiers live:', err);
    return [];
  }
}

/**
 * Charge la géométrie complète d'un sentier PostGIS et le convertit en Carte3DTrail
 */
export async function fetchSupabaseTrailDetails(id: string): Promise<Carte3DTrail | null> {
  try {
    const res = await fetch(`/api/hikes/${id}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || !data.geojson) return null;

    let rawCoords: number[][] = [];
    const geojson = data.geojson;

    if (geojson.type === 'FeatureCollection' && geojson.features?.length > 0) {
      const feat = geojson.features[0];
      if (feat.geometry?.type === 'LineString') {
        rawCoords = feat.geometry.coordinates;
      } else if (feat.geometry?.type === 'MultiLineString') {
        rawCoords = feat.geometry.coordinates.flat(1);
      }
    } else if (geojson.type === 'Feature') {
      if (geojson.geometry?.type === 'LineString') {
        rawCoords = geojson.geometry.coordinates;
      } else if (geojson.geometry?.type === 'MultiLineString') {
        rawCoords = geojson.geometry.coordinates.flat(1);
      }
    } else if (geojson.type === 'LineString') {
      rawCoords = geojson.coordinates;
    } else if (geojson.type === 'MultiLineString') {
      rawCoords = geojson.coordinates.flat(1);
    }

    if (!rawCoords || rawCoords.length < 2) return null;

    const coordinates: [number, number, number?][] = [];
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    for (const pt of rawCoords) {
      if (!Array.isArray(pt) || pt.length < 2) continue;
      const lng = pt[0];
      const lat = pt[1];
      const ele = pt[2] != null ? Math.round(pt[2]) : undefined;

      if (isNaN(lng) || isNaN(lat)) continue;
      coordinates.push(ele !== undefined ? [lng, lat, ele] : [lng, lat]);

      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }

    if (coordinates.length < 2) return null;

    const elevationResult = buildElevationProfile(coordinates);

    const padLng = Math.max(0.015, (maxLng - minLng) * 0.08);
    const padLat = Math.max(0.015, (maxLat - minLat) * 0.08);
    const bounds: [number, number, number, number] = [
      minLng - padLng,
      minLat - padLat,
      maxLng + padLng,
      maxLat + padLat,
    ];

    const trail: Carte3DTrail = {
      id: `supabase-${data.id}`,
      name: data.name || 'Sentier LKDV',
      massif: data.region || 'Sentier PostGIS',
      country: 'France',
      region: data.region,
      distanceKm: data.distance_km ? Number(data.distance_km) : elevationResult.distanceKm,
      elevationGainM: data.elevation_gain ? Number(data.elevation_gain) : elevationResult.elevationGainM,
      elevationLossM: data.elevation_loss ? Number(data.elevation_loss) : elevationResult.elevationLossM,
      minElevationM: elevationResult.minElevationM,
      maxElevationM: elevationResult.maxElevationM,
      estimatedDurationHours: data.duration_hours ? Number(data.duration_hours) : elevationResult.estimatedDurationHours,
      bounds,
      coordinates,
      elevationProfile: elevationResult.elevationProfile,
      waypoints: [],
      description: data.ai_description || undefined,
      difficulty: data.difficulty || 'moyen',
    };

    // Chargement des POIs live associés dans l'emprise
    const livePois = await fetchLivePoisForBbox(bounds, trail.elevationProfile);
    trail.waypoints = livePois;

    return trail;
  } catch (err) {
    console.warn(`[SupabaseTrailService] Échec chargement sentier ${id}:`, err);
    return null;
  }
}

/**
 * Récupère les POIs PostGIS réels dans l'emprise d'un sentier et calcule leur kilométrage le long du tracé
 */
export async function fetchLivePoisForBbox(
  bounds: [number, number, number, number],
  trailProfile: ElevationProfilePoint[]
): Promise<Carte3DWaypoint[]> {
  if (!bounds || bounds.length !== 4) return [];

  const [minLng, minLat, maxLng, maxLat] = bounds;
  try {
    const url = `/api/pois?minLng=${minLng.toFixed(4)}&minLat=${minLat.toFixed(4)}&maxLng=${maxLng.toFixed(4)}&maxLat=${maxLat.toFixed(4)}&limit=35`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const waypoints: Carte3DWaypoint[] = [];

    for (let i = 0; i < data.length; i++) {
      const poi = data[i];
      if (poi.lat == null || poi.lng == null) continue;

      const category = mapPoiCategory(poi.category);
      let altitudeM = poi.altitude_m ? Math.round(poi.altitude_m) : 0;

      // Calcul du kilométrage précis le long du profil altimétrique
      let bestDistKm = 0;
      let minDistance = Infinity;

      if (trailProfile.length > 0) {
        for (const pt of trailProfile) {
          const d = HikeEngine.calculateDistanceKm(poi.lat, poi.lng, pt.coord[1], pt.coord[0]);
          if (d < minDistance) {
            minDistance = d;
            bestDistKm = pt.distanceKm;
            if (altitudeM === 0) {
              altitudeM = pt.elevationM;
            }
          }
        }
      }

      waypoints.push({
        id: `poi-${poi.id || i + 1}`,
        name: poi.name || `Point ${i + 1}`,
        category,
        lat: Number(poi.lat),
        lng: Number(poi.lng),
        altitudeM: altitudeM || 1000,
        distanceKm: Math.round(bestDistKm * 100) / 100,
        details: poi.details || poi.description || undefined,
        capacity: poi.capacity || undefined,
        isPotable: poi.is_potable || undefined,
      });
    }

    waypoints.sort((a, b) => a.distanceKm - b.distanceKm);
    return waypoints;
  } catch (err) {
    console.warn('[SupabaseTrailService] Échec fetchLivePoisForBbox:', err);
    return [];
  }
}

function mapPoiCategory(rawCategory: string | undefined): WaypointCategory {
  if (!rawCategory) return 'viewpoint';
  const c = rawCategory.toLowerCase();
  if (c === 'summit') return 'summit';
  if (c === 'refuge' || c === 'camping' || c === 'stay') return 'refuge';
  if (c === 'water' || c === 'waterfall') return 'water';
  if (c === 'col' || c === 'pass') return 'pass';
  if (c === 'viewpoint') return 'viewpoint';
  return 'viewpoint';
}
