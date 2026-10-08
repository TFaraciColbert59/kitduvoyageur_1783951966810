import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { areaKinds, type AreaPlace, type AreaQuery } from '../engine/itinerary';
import { areaBox, geoPlaceToArea, SETTLEMENT_KINDS, type GeoPlaceRow } from '../engine/geoPlaces';

/**
 * Les lieux habités d'une zone, lus dans le référentiel (`geo_places_in_box`,
 * plan 3.2) : aucun appel à une carte en ligne. Null si la base ne répond pas
 * ou n'a rien (la carte en ligne prend alors le relais).
 */
export async function referentialAreaPlaces(q: AreaQuery, limit = 800): Promise<AreaPlace[] | null> {
  const kinds = areaKinds(q).filter((k) => SETTLEMENT_KINDS.has(k));
  if (kinds.length === 0) return null;
  const client = getServiceSupabase();
  if (!client) return null;
  const [w, s, e, n] = areaBox(q);
  try {
    const { data, error } = await client.rpc('geo_places_in_box', {
      p_west: w,
      p_south: s,
      p_east: e,
      p_north: n,
      p_kinds: kinds,
      p_limit: limit,
    });
    if (error) {
      console.warn('[compas] référentiel des lieux', error.code);
      return null;
    }
    const places = ((data ?? []) as GeoPlaceRow[]).map(geoPlaceToArea).filter((p): p is AreaPlace => p != null);
    return places.length ? places : null;
  } catch (err) {
    console.warn('[compas] référentiel des lieux', err instanceof Error ? err.message : 'erreur');
    return null;
  }
}
