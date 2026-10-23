import 'server-only';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { lookupDestination, lookupLoose, lookupNatural } from './placeLookup';
import { referentialPlaceSearch } from './geoPlaces';
import { leadingProperName, subPlaceQueries, type CompasPlace } from '../engine/places';
import { splitPlaceCountry } from '../engine/countryNames';
import { knownRegion } from '../engine/knownRegions';
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
  // « Tatras, Pologne » : le pays dit dans la phrase restreint la recherche ; sans résultat dans ce pays, le lieu seul.
  const said = splitPlaceCountry(query);
  // Région célèbre mal rangée par la carte (Lofoten, Tatras) : table fermée, le pays dit choisit l'entrée.
  const known = knownRegion(said?.place ?? query, said?.code ?? null);
  if (known) return known;
  if (said) {
    const inCountry =
      (await referentialPlaceSearch(said.place, said.code).catch(() => null)) ?? (await lookupDestination(said.place, said.country));
    if (inCountry) return inCountry;
    // « Tatras » en Pologne : la carte les range sous un autre nom ; recherche avec le pays ajouté.
    const withCountry = await lookupLoose(said.place, said.country).catch(() => null);
    if (withCountry) return withCountry;
    query = said.place;
  }
  const local = await referentialPlaceSearch(query).catch(() => null);
  if (local) return local;
  const exact = await lookupDestination(query);
  if (exact) return exact;
  const based = specialist ? await specialist(query) : null;
  if (based) return based;
  const natural = await lookupNatural(query, null).catch(() => null);
  if (natural) return { ...natural, name: query.trim().slice(0, 80) };
  const loose = await lookupLoose(query);
  if (loose) return loose;
  // « Argentine Mendoza » : la carte ne connaît pas le tout, mais le référentiel connaît Mendoza (constat C-014).
  // Référentiel local seulement : aucun appel de plus à la carte en ligne, hors du compteur par personne.
  for (const part of subPlaceQueries(query)) {
    const found = await referentialPlaceSearch(part).catch(() => null);
    if (found) return found;
  }
  // Nom long que ni la carte ni le référentiel ne connaissent (« Népal camp de base de l'Everest », lu
  // ainsi le 13 oct.) : son début en noms propres, s'il est plus court (« Népal »), sous son nom exact.
  const lead = leadingProperName(query);
  return lead ? lookupDestination(lead) : null;
}
