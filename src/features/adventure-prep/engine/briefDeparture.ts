/**
 * Le lieu de départ écrit dans l'invitation libre (« au départ de
 * Villard-de-Lans », « depuis Chamonix »).
 *
 * L'écran promettait « L'IA complètera : lieu de départ » ; rien ne le faisait,
 * et un parcours sans départ reste sans carte ni distances. On ne retient
 * qu'un NOM PROPRE (majuscule initiale) introduit par une tournure de départ :
 * « au départ du lac » ne désigne aucun lieu cherchable et reste ignoré. Le
 * nom trouvé est ensuite cherché comme une commune ; sans correspondance sûre,
 * rien n'est posé.
 */

import { haversineKm, type GeoPoint } from './routing';

const INTRO = /(?:au\s+d[ée]part\s+de|d[ée]part\s+(?:de|depuis)|en\s+partant\s+de|depuis)\s+/giu;

/** Mots qui terminent le nom de lieu (minuscules, après une espace). */
const STOP = new Set([
  'pour', 'avec', 'et', 'en', 'vers', 'jusqu', 'jusque', 'nuit', 'nuits', 'sur', 'dans', 'à', 'au',
  'aux', 'le', 'la', 'les', 'un', 'une', 'deux', 'trois', 'quatre', 'cinq', 'puis', 'retour', 'par',
  'ou', 'mais', 'avant', 'après', 'tranquille',
]);

/** Particules qui restent dans un nom composé écrit avec des espaces. */
const LINKS = new Set(['de', 'du', 'des', 'd', 'sur', 'en', 'la', 'le', 'les', 'l']);

export function departureFromBrief(brief: string | null | undefined): string | null {
  if (!brief) return null;
  for (const m of brief.matchAll(INTRO)) {
    const rest = brief.slice((m.index ?? 0) + m[0].length);
    const name = properName(rest);
    if (name) return name;
  }
  return null;
}

function properName(rest: string): string | null {
  // Mots successifs : un nom commence par une majuscule ; les particules
  // (« de », « sur »…) ne restent que si un mot à majuscule suit.
  const words = rest.split(/\s+/);
  const kept: string[] = [];
  let pending: string[] = [];
  for (const raw of words) {
    const word = raw.replace(/[,.;:!?)»"]+$/u, '');
    const ended = word !== raw;
    if (!word) break;
    if (/^\p{Lu}/u.test(word)) {
      kept.push(...pending, word);
      pending = [];
    } else if (kept.length > 0 && LINKS.has(word.toLowerCase().replace(/['’]$/u, ''))) {
      pending.push(word);
    } else {
      break;
    }
    if (ended) break;
    if (kept.length > 0 && STOP.has(word.toLowerCase())) break;
  }
  const name = kept.join(' ').trim();
  return name.length >= 2 && name.length <= 60 ? name : null;
}

/** Ce que la recherche de lieu rend, réduit à ce que le choix lit. */
export interface DepartureCandidate {
  name: string;
  lat: number;
  lon: number;
  precision: 'commune' | 'inexact';
}

/** Deux réponses à moins de cette distance désignent la même commune. */
const SAME_PLACE_KM = 5;

/**
 * La commune à poser comme départ, ou `null`.
 *
 * Seule une COMMUNE du MÊME nom compte. Des homonymes (« Saint-Pierre ») ne
 * sont départagés que par l'arrivée déjà choisie : la plus proche l'emporte.
 * Sans arrivée, deux homonymes restent une question, et rien n'est posé.
 */
export function pickNamedDeparture<T extends DepartureCandidate>(
  name: string,
  matches: readonly T[],
  destination: GeoPoint | null
): T | null {
  const same = matches.filter((m) => m.precision === 'commune' && samePlaceName(m.name, name));
  if (same.length === 0) return null;
  const distinct = same.filter(
    (m, i) => same.findIndex((o) => haversineKm(o, m) < SAME_PLACE_KM) === i
  );
  if (distinct.length === 1) return distinct[0];
  if (!destination) return null;
  return distinct.reduce((best, m) =>
    haversineKm(m, destination) < haversineKm(best, destination) ? m : best
  );
}

/** Même nom à la casse, aux accents, aux tirets et aux espaces près. */
export function samePlaceName(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[-'’\s]+/g, ' ')
      .trim();
  return norm(a) === norm(b);
}
