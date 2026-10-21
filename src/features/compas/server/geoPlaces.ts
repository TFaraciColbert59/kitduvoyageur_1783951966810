import 'server-only';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { getRequestLocale } from '@/lib/i18n/serverLocale';
import { areaKinds, type AreaPlace, type AreaQuery } from '../engine/itinerary';
import { areaBoxes, geoPlaceToArea, mergeBoxRows, SETTLEMENT_KINDS, type GeoPlaceRow } from '../engine/geoPlaces';
import {
  isCountryName,
  pickReferentialPlace,
  placeSearchKey,
  referentialPlaceToCompas,
  searchableKey,
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
  name_local: z.string().nullable().optional(),
  name_match: z.string().nullable().optional(),
});

/** Assez de lignes pour voir les homonymes du nom exact avant les préfixes. */
const SEARCH_LIMIT = 12;

/**
 * Noms par langue (PLAN-100 6.4) : la RPC `geo_places_search_names` vient de la migration DIFFÉRÉE
 * `20261018120000_geo_place_names.sql`. Tant qu'elle n'est pas appliquée, PostgREST répond « fonction
 * introuvable » : on revient à `geo_places_search` (nom GeoNames seul, exactement comme avant) et on
 * ne redemande pas la fonction avant 10 minutes.
 */
const NAMES_RETRY_MS = 10 * 60_000;
let namesMissingUntil = 0;

function functionMissing(error: { code?: string } | null | undefined): boolean {
  return error?.code === 'PGRST202' || error?.code === '42883';
}

/** Pour les tests : oublie qu'une RPC manquait. */
export function resetGeoPlaceNamesProbe(): void {
  namesMissingUntil = 0;
}

/**
 * Un lieu SAISI (destination, départ, domicile) retrouvé dans le référentiel `geo_places`
 * (`geo_places_search`, plan 3.1 et 1.3), sans carte en ligne : seulement un résultat sûr
 * (`pickReferentialPlace` : nom exact, ou préfixe d'une ville, qui domine ses homonymes).
 * Interrupteur éteint, ambigu, absent, base muette ou réponse inattendue : null, et l'appelant
 * cherche sur la carte exactement comme avant.
 *
 * Noms par langue (PLAN-100 6.4) : la saisie est aussi comparée aux noms de `geo_place_names`, toutes
 * écritures (« Vienne », « Wien », « Вена » → Vienna), et le lieu revient sous son nom dans la langue
 * de l'interface s'il existe, sinon sous le nom GeoNames. Sans la migration différée : la recherche
 * d'avant, inchangée (une saisie sans lettre latine ne rend alors rien, comme avant).
 */
export async function referentialPlaceSearch(query: string, country?: string | null): Promise<CompasPlace | null> {
  if (!geoPlacesSearchEnabled()) return null;
  const q = query.trim().slice(0, 80);
  const key = searchableKey(q);
  if (!key || isCountryName(q)) return null;
  const cc = country && /^[a-z]{2}$/i.test(country.trim()) ? country.trim().toUpperCase() : null;
  const client = getServiceSupabase();
  if (!client) return null;
  try {
    const lang = await getRequestLocale();
    let data: unknown = undefined;
    if (Date.now() >= namesMissingUntil) {
      const res = await client.rpc('geo_places_search_names', {
        p_q: q,
        p_key: key,
        p_lang: lang,
        p_cc: cc,
        p_limit: SEARCH_LIMIT,
      });
      if (!res.error) data = res.data;
      else if (functionMissing(res.error)) namesMissingUntil = Date.now() + NAMES_RETRY_MS;
      else {
        console.warn('[compas] recherche dans le référentiel des lieux', res.error.code);
        return null;
      }
    }
    if (data === undefined) {
      // Migration différée non appliquée : la recherche d'avant, par le nom GeoNames seul.
      if (placeSearchKey(q).length < 3) return null;
      const { data: rows, error } = await client.rpc('geo_places_search', { p_q: q, p_cc: cc, p_limit: SEARCH_LIMIT });
      if (error) {
        console.warn('[compas] recherche dans le référentiel des lieux', error.code);
        return null;
      }
      data = rows;
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
    return picked ? referentialPlaceToCompas(picked, lang) : null;
  } catch (err) {
    console.warn('[compas] recherche dans le référentiel des lieux', err instanceof Error ? err.message : 'erreur');
    return null;
  }
}
