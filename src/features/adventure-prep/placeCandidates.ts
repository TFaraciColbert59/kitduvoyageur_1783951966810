/**
 * Fusion des candidats de lieu proposes par l'ecran de recherche.
 *
 * Deux origines, une seule regle : la liste affichee est une PISTE, pas une
 * verite. Un lieu deja connu de la personne passe avant un lieu trouve par le
 * reseau, parce qu'il correspond a son histoire et pas a une approximation de
 * fournisseur. Un doublon n'est montre qu'une fois.
 *
 * Aucune coordonnee n'est inventee ici : `PlaceRef` garde (0, 0) quand la
 * personne saisit un lieu a la main, et l'ecran continue d'afficher « a
 * verifier ». Ce module ne fait que trier, dedoublonner et etiqueter.
 */

import type { GeocodeMatch } from './geocodeService';
import type { PlaceRef } from './types';

export type PlaceCandidateSource = 'remembered' | 'geocoded';

export type PlaceCandidatePrecision = 'commune' | 'inexact' | 'unknown';

export interface PlaceCandidate {
  readonly place: PlaceRef;
  readonly source: PlaceCandidateSource;
  readonly precision: PlaceCandidatePrecision;
  /** Region / departement, uniquement pour les resultats du reseau. */
  readonly context: string | null;
  /** Phrase courte a afficher quand l'ancre n'est pas une commune. */
  readonly hint: string | null;
}

export interface PlaceCandidatesInput {
  readonly recent: readonly PlaceRef[];
  readonly matches: readonly GeocodeMatch[];
  readonly hasQuery: boolean;
  readonly query?: string;
}

/** Minuscules sans accent : deux fautes de frappe ne doivent pas dupliquer un lieu. */
function norm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Identite d'un lieu : nom + pays. Deux homonymes de pays differents restent distincts. */
function placeKey(name: string, country: string): string {
  return `${norm(name)}|${norm(country)}`;
}

function toPlace(match: GeocodeMatch): PlaceRef {
  return {
    id: match.id,
    name: match.name,
    country: match.country,
    lat: match.lat,
    lon: match.lon,
  };
}

const INEXACT_HINT = 'Ancre approximative — confirme le lieu avant de partir sur cette piste.';
const UNVERIFIED_HINT = 'Coordonnées à vérifier — le parcours ne partira pas de ce point.';

export function placeCandidates({
  recent,
  matches,
  hasQuery,
  query = '',
}: PlaceCandidatesInput): readonly PlaceCandidate[] {
  const needle = norm(query);
  const out: PlaceCandidate[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const key = placeKey(match.name, match.country);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      place: toPlace(match),
      source: 'geocoded',
      precision: match.precision,
      context: match.context || null,
      hint: match.precision === 'inexact' ? INEXACT_HINT : null,
    });
  }

  for (const place of recent) {
    const key = placeKey(place.name, place.country);
    if (seen.has(key)) continue;
    if (hasQuery && needle.length > 0) {
      if (!norm(`${place.name} ${place.country}`).includes(needle)) continue;
    }
    seen.add(key);
    const unverified = place.lat === 0 || place.lon === 0;
    out.push({
      place,
      source: 'remembered',
      precision: unverified ? 'unknown' : 'commune',
      context: null,
      hint: unverified ? UNVERIFIED_HINT : null,
    });
  }

  return out;
}
