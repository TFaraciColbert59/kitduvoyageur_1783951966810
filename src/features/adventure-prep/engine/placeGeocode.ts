/**
 * Le repli GEOCODAGE : une deuxieme source de positions, reelle et gardee.
 *
 * L inventaire local ne couvre pas les refuges de haute montagne. Mesure du
 * 2026-09-28 sur le corridor de Chamonix : `/api/pois` + `/api/amenities`
 * rendent 18 + 374 lieux, et `Refuge des Grands Mulets` n est pas parmi eux.
 * Les etapes qui le citent restaient sans position, donc sans chaine a router,
 * donc sans kilometre - et la totalite de l aventure passait a « a verifier ».
 *
 * Le geocodeur, lui, repond. MAIS il se trompe, et c est ce qui dicte la
 * garde : sur les memes appels, il place `Le Brevent` a 45.76699 / 6.40971,
 * soit environ 45 km a l ouest de Chamonix alors que le sommet est a 6 km.
 *
 * Une position de moins vaut mieux qu une position fausse : ce module accepte
 * donc un lieu GEOCODE que si sa distance a l ancre du trajet tient dans
 * `GEOCODE_REACH_KM`. Le refus est la regle, pas l exception.
 *
 * Aucune valeur n est inventeee : sans reponse, sans coordonnee, ou hors
 * rayon, la fonction rend `null` et l etape reste sans position.
 */

import { haversineKm } from './routing';
import type { PlaceCandidate } from './places';

/**
 * Le rayon d'atteinte, en kilometres.
 *
 * Borne MESUREE, pas choisie : il doit laissser passer le refuge le plus
 * lointain du corridor (Grands Mulets, 6,4 km de Chamonix) et refuser le
 * sommet mal place (Brevent, ~45 km). `GF-05` verrouille les deux bornes.
 */
export const GEOCODE_REACH_KM = 25;

/** Ce que `/api/geocode` rend pour un nom trouve. */
export interface GeocodeMatch {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly country: string | null;
  /** Le fournisseur qualifie lui-meme sa reponse : `commune`, `inexact`... */
  readonly precision: string | null;
}

/** Une ancre : le depart, l arrivee, ou le point de depart de la journee. */
export interface GeocodeAnchor {
  readonly lat: number;
  readonly lon: number;
}

/** En dessous, une suite de caracteres n est pas un nom. */
const MIN_NAME = 3;

function isPlaceName(name: string): boolean {
  return name.trim().length >= MIN_NAME;
}

function isOnEarth(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function isOnEarthAnchor(anchor: GeocodeAnchor): boolean {
  return isOnEarth(anchor.lat, anchor.lon);
}

/**
 * Le candidat qu'un geocode autorise, ou `null`.
 *
 * `null` est la reponse la plus frequente, et c est normal : un nom que
 * personne ne sait placer, une coordonnee absurde, un sommet envoye dans le
 * Jura. Dans les trois cas l etape reste une intention, et l ecran affiche
 * « a verifier » plutot qu un point qui ne designe rien.
 */
export function geocodeCandidateFor(
  name: string,
  match: GeocodeMatch | null,
  anchor: GeocodeAnchor,
): PlaceCandidate | null {
  if (match === null) return null;
  if (!isPlaceName(name)) return null;
  if (!isOnEarthAnchor(anchor)) return null;
  if (!isOnEarth(match.lat, match.lon)) return null;

  const distanceKm = haversineKm(
    { lat: anchor.lat, lon: anchor.lon },
    { lat: match.lat, lon: match.lon },
  );
  if (distanceKm > GEOCODE_REACH_KM) return null;

  return {
    id: match.id,
    // Le nom du FOURNISSEUR, jamais celui de la requete : l ecran affiche ce
    // que la source a designe, pas ce que le redacteur avait ecrit.
    name: match.name,
    category: 'geocode',
    lat: match.lat,
    lon: match.lon,
    description: null,
    region: null,
    country: match.country,
    pricePerNight: null,
    phone: null,
    website: null,
    // La position vient d une source reelle, mais d une source qui s'est deja
    // trompee sur les sommets : elle n est pas verifiee par le depot.
    isVerifiable: false,
  };
}
