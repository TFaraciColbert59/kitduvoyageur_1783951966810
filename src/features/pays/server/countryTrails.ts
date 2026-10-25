// src/features/pays/server/countryTrails.ts
// Résolution serveur des sentiers réels d'un pays (bbox géométrie → villes).
import 'server-only';
import type { CountryGeo } from '@/lib/supabase/types';
import { fetchPlacesByCountry } from '@/lib/geodata';
import { getTrails } from '@/lib/queries/trails';
import { computeGeometryBbox, type GeoBbox } from '../mappers/geoBbox';
import type { PaysTrail } from '../types';

const MAX_PLACES = 200;

function bboxFromPlaces(
  places: Array<{ latitude: number | null; longitude: number | null }>
): GeoBbox | null {
  const geometries = places
    .filter((place) => place.latitude != null && place.longitude != null)
    .map((place) => ({ type: 'Point' as const, coordinates: [place.longitude, place.latitude] }));
  if (geometries.length === 0) return null;
  return computeGeometryBbox({ type: 'GeometryCollection', geometries });
}

/** Renvoie les sentiers réels situés dans l'emprise du pays (jamais inventés). */
export async function resolveCountryTrails(
  country: CountryGeo,
  limit = 6
): Promise<PaysTrail[]> {
  let bbox = computeGeometryBbox(country.geometry);
  if (!bbox) {
    const places = await fetchPlacesByCountry(country.iso_a2, MAX_PLACES);
    bbox = bboxFromPlaces(places);
  }
  if (!bbox) return [];

  const trails = await getTrails({
    minLat: bbox.minLat,
    maxLat: bbox.maxLat,
    minLng: bbox.minLng,
    maxLng: bbox.maxLng,
    includeShort: true,
    limit,
  });

  return trails
    .filter((trail) => Boolean(trail.name))
    .slice(0, limit)
    .map((trail) => ({
      id: trail.id,
      name: trail.name,
      distanceKm: trail.distance_km ?? null,
      durationHours: trail.duration_hours ?? null,
      difficulty: trail.difficulty ?? null,
      elevationGain: trail.elevation_gain ?? null,
      latitude: trail.lat,
      longitude: trail.lng,
    }));
}
