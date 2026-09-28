/**
 * La position reelle de la personne, nommee par sa commune.
 *
 * Un GPS rend deux nombres, pas un nom. Ecrire « Ma position » partout laisse
 * l ecran 2 vide de sens ; ecrire un nom invente serait pire. La seule source
 * acceptable est `/api/geocode` en mode inverse : le fournisseur nomme la
 * commune, nous gardons la position mesuree.
 *
 * Regle du module : aucune valeur n est completee. Pas de reponse, pas de
 * nom — on garde alors « Ma position », qui dit exactement ce qu elle est.
 */

import type { PlaceRef } from './types';

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface CommuneName {
  readonly name: string;
  readonly country: string;
}

/** L'URL de la route controlee : jamais un appel direct a un fournisseur. */
export function buildReverseGeocodeUrl(gps: GeoPoint): string {
  return `/api/geocode?lat=${gps.latitude}&lon=${gps.longitude}`;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Lit la reponse du service. `null` = rien d exploitable, et c'est un statut
 * normal : un point en pleine mer ou une panne ne doivent pas interdire de
 * partir de sa position.
 */
export function parseReverseGeocode(payload: unknown): CommuneName | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const body = payload as { status?: unknown; matches?: unknown };
  if (body.status !== 'ok' || !Array.isArray(body.matches)) return null;
  for (const raw of body.matches) {
    if (typeof raw !== 'object' || raw === null) continue;
    const match = raw as { name?: unknown; country?: unknown };
    const name = readString(match.name);
    if (name.length === 0) continue;
    return { name, country: readString(match.country) };
  }
  return null;
}

/**
 * L'identifiant ne depend QUE des coordonnees : deux resolutions successives
 * du meme point doivent produire le meme lieu, sinon la liste de suggestions
 * afficherait deux lignes pour une seule position.
 */
export function myPositionToPlace(gps: GeoPoint, commune: CommuneName | null): PlaceRef {
  return {
    id: `here-${gps.latitude.toFixed(5)}-${gps.longitude.toFixed(5)}`,
    name: commune === null ? 'Ma position' : commune.name,
    country: commune === null ? '' : commune.country,
    lat: gps.latitude,
    lon: gps.longitude,
  };
}

/**
 * Le depart par defaut, propose et non impose.
 *
 * Un GPS a repondu et la personne n'a rien choisi : partir de la ou elle est
 * est l'hypothese la plus frequente, et c'est une donnee reelle. Deux garde-fous
 * :
 *   - un depart deja choisi n'est JAMAIS ecrase, meme s'il vient d'une saisie
     manuelle sans coordonnees (c'est peut-etre une gare, pas un point GPS) ;
 *   - l'arrivee n'est jamais remplie : partir et revenir a sa position n'est
 *     pas un voyage, et le trajet afficherait 0 km.
 *
 * Le bloc d'origine n'est jamais modifie : on renvoie un nouveau bloc.
 */
export function withDefaultOrigin<T extends { origin: PlaceRef | null }>(
  route: T,
  place: PlaceRef | null,
): T {
  if (place === null) return route;
  if (route.origin !== null) return route;
  return { ...route, origin: place };
}
