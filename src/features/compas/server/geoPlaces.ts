import 'server-only';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { areaKinds, type AreaPlace, type AreaQuery } from '../engine/itinerary';
import { areaBoxes, geoPlaceToArea, mergeBoxRows, SETTLEMENT_KINDS, type GeoPlaceRow } from '../engine/geoPlaces';
import {
  isCountryName,
  pickReferentialPlace,
  placeSearchKey,
  referentialPlaceToCompas,
  type GeoPlaceSearchRow,
} from '../engine/geoPlaceSearch';
import type { CompasPlace } from '../engine/places';

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
  try {
    // Une zone qui franchit l'antiméridien se lit en deux boîtes : le `box` de
    // Postgres range ses coins et lirait sinon tout ce qui est ENTRE les deux.
    const lists: GeoPlaceRow[][] = [];
    for (const [w, s, e, n] of areaBoxes(q)) {
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
      lists.push((data ?? []) as GeoPlaceRow[]);
    }
    const places = mergeBoxRows(lists, limit).map(geoPlaceToArea).filter((p): p is AreaPlace => p != null);
    return places.length ? places : null;
  } catch (err) {
    console.warn('[compas] référentiel des lieux', err instanceof Error ? err.message : 'erreur');
    return null;
  }
}

/**
 * INTERRUPTEUR de la recherche d'un lieu saisi dans le référentiel : `COMPAS_GEO_PLACES_SEARCH=1`
 * (variable Vercel), à poser une fois la RPC `geo_places_search` appliquée en base. Éteint
 * (défaut) : `referentialPlaceSearch` ne touche pas à la base, rien ne change.
 */
export function geoPlacesSearchEnabled(): boolean {
  const v = (process.env.COMPAS_GEO_PLACES_SEARCH ?? '').trim().toLowerCase();
  return v === '1' || v === 'on' || v === 'true';
}

const searchRowSchema = z.object({
  geoname_id: z.number().int().positive(),
  name: z.string().min(1),
  kind: z.string(),
  country_code: z.string(),
  admin1: z.string().nullable().optional(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  ele_m: z.number().nullable(),
  population: z.number().nullable(),
  name_fr: z.string().nullable().optional(),
});

/** Assez de lignes pour voir les homonymes du nom exact avant les préfixes. */
const SEARCH_LIMIT = 12;

/**
 * Un lieu SAISI (destination, départ, domicile) retrouvé dans le référentiel `geo_places`
 * (`geo_places_search`, plan 3.1 et 1.3), sans carte en ligne : seulement un résultat sûr
 * (`pickReferentialPlace` : nom exact, ou préfixe d'une ville, qui domine ses homonymes).
 * Interrupteur éteint, ambigu, absent, base muette ou réponse inattendue : null, et l'appelant
 * cherche sur la carte exactement comme avant.
 */
export async function referentialPlaceSearch(query: string, country?: string | null): Promise<CompasPlace | null> {
  if (!geoPlacesSearchEnabled()) return null;
  const q = query.trim().slice(0, 80);
  if (placeSearchKey(q).length < 3 || isCountryName(q)) return null;
  const cc = country && /^[a-z]{2}$/i.test(country.trim()) ? country.trim().toUpperCase() : null;
  const client = getServiceSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('geo_places_search', { p_q: q, p_cc: cc, p_limit: SEARCH_LIMIT });
    if (error) {
      console.warn('[compas] recherche dans le référentiel des lieux', error.code);
      return null;
    }
    if (!Array.isArray(data)) return null;
    const rows: GeoPlaceSearchRow[] = [];
    for (const raw of data) {
      const row = searchRowSchema.safeParse(raw);
      // Une ligne illisible fausserait le compte des homonymes : rien plutôt qu'un choix au hasard.
      if (!row.success) return null;
      rows.push(row.data);
    }
    const picked = pickReferentialPlace(rows, q);
    return picked ? referentialPlaceToCompas(picked) : null;
  } catch (err) {
    console.warn('[compas] recherche dans le référentiel des lieux', err instanceof Error ? err.message : 'erreur');
    return null;
  }
}
