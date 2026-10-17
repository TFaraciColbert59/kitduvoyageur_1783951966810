import 'server-only';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { lookupDestination, lookupLoose, lookupNatural } from './placeLookup';
import { referentialPlaceSearch } from './geoPlaces';
import type { CompasPlace } from '../engine/places';
import { serverText } from './serverText';

/**
 * Recherche d'un lieu par son nom, partagée par les actions qui en cherchent un
 * (destination, départ « depuis Lyon », domicile du profil voyageur). Module serveur
 * ordinaire, PAS une action : rien ici n'est appelable depuis le navigateur.
 */

/**
 * La carte (Photon, LocationIQ, Geoapify) et parfois l'IA : chaque recherche de
 * lieu (destination, départ, domicile) est comptée par personne (plan 2.2). Le
 * message à montrer si la limite est atteinte ou le compteur indisponible, sinon null.
 */
export async function placeSearchLimitError(userId: string): Promise<string | null> {
  const limited = await enforceRateLimit(userId, {
    scope: 'compas-destination',
    limit: 20,
    windowMs: 600_000,
    failMode: 'closed',
  });
  if (!limited) return null;
  return serverText(
    limited.status === 429
      ? 'compas.server.placeSearch.tooMany'
      : 'compas.server.placeSearch.unavailable'
  );
}

/**
 * Avant tout, le référentiel des lieux habités (`geo_places`, plan 1.3), s'il est allumé
 * (`COMPAS_GEO_PLACES_SEARCH`) et seulement pour un résultat sûr (`pickReferentialPlace`) ;
 * rien de sûr, éteint ou base muette : exactement la suite d'avant. Puis le nom exact sur la carte ; sinon, s'il est donné, le spécialiste (ville de base
 * d'un massif, d'un parc, d'un sentier) ; sinon le lieu naturel qui porte le nom
 * (« Calanques » : le parc national, pas le récif de Piana en Corse, premier venu
 * de la carte) ; sinon le premier lieu habité du nom. Sans spécialiste : un lieu de
 * départ ou un domicile, où une ville de base inventée serait un faux départ.
 */
export async function resolvePlaceByName(
  query: string,
  specialist?: (query: string) => Promise<CompasPlace | null>
): Promise<CompasPlace | null> {
  const local = await referentialPlaceSearch(query).catch(() => null);
  if (local) return local;
  const exact = await lookupDestination(query);
  if (exact) return exact;
  const based = specialist ? await specialist(query) : null;
  if (based) return based;
  const natural = await lookupNatural(query, null).catch(() => null);
  if (natural) return { ...natural, name: query.trim().slice(0, 80) };
  return lookupLoose(query);
}
