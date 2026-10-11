/**
 * Compas — la préférence « sans voiture » (PLAN-100 4.4).
 *
 * Posée par la phrase (« sans voiture », « en transports en commun ») ou à
 * l'écran, rangée avec les autres réglages du projet (`metadata.compas.prefs`).
 * Elle écarte la voiture, personnelle ou de location, des moyens proposés : le
 * trajet d'approche (train par règle de réseau, avion si le séjour est trop court
 * pour la route, sinon non chiffré et dit), les déplacements entre étapes (en bus,
 * au barème) et le budget (ni carburant ni location).
 *
 * « Transports en commun » ne se dit que pour une zone qui en montre : une gare,
 * une gare routière ou un embarcadère lus sur la carte autour des étapes. Sinon :
 * « non évalué », jamais « il n'y en a pas ».
 *
 * Pur : aucune donnée n'est importée, la lecture des points se fait côté serveur.
 */

import { STAGE_POI_RADIUS_M } from './stagePois';

/** Activités dont la voiture est le moyen même : la préférence n'y est pas appliquée, et c'est dit. */
const CAR_ACTIVITIES = new Set(['roadtrip', 'vanlife']);

export const CAR_FREE_CONFLICT_NOTE =
  'Sans voiture : un road trip ou un van se fait en voiture, la préférence n’est pas appliquée à cet itinéraire. Change l’activité ou retire « sans voiture ».';

/** La préférence s'applique-t-elle ? Sinon, la note à dire quand elle est posée mais écartée. */
export function carFreeOf(
  prefs: { carFree?: boolean | null } | null | undefined,
  activity: string | null | undefined
): { on: boolean; note: string | null } {
  if (prefs?.carFree !== true) return { on: false, note: null };
  if (CAR_ACTIVITIES.has(activity ?? '')) return { on: false, note: CAR_FREE_CONFLICT_NOTE };
  return { on: true, note: null };
}

/**
 * Les déplacements entre étapes en voiture passent en bus (comptés au barème des
 * transports sur place, une estimation) ; marche, vélo, train, bateau et vol ne
 * bougent pas. Ne modifie pas la liste reçue.
 */
export function carFreeStages<T extends { move: string }>(stages: readonly T[]): { stages: T[]; converted: number } {
  let converted = 0;
  const out = stages.map((s) => {
    if (s.move !== 'voiture') return s;
    converted += 1;
    return { ...s, move: 'bus' };
  });
  return { stages: out, converted };
}

/** Dit une fois ce que la conversion a fait (rien à dire sans déplacement en voiture). */
export function carFreeStagesNote(converted: number): string | null {
  if (converted <= 0) return null;
  return `Sans voiture : ${converted} déplacement${converted > 1 ? 's' : ''} entre étapes compté${converted > 1 ? 's' : ''} en bus (estimation du barème, pas un horaire) ; vérifie les lignes dans Résa · Trajets.`;
}

export interface TransitPoint {
  category: string | null;
  name: string | null;
  distanceM: number;
}

export interface TransitSignal {
  status: 'reperes' | 'non_evalue';
  text: string;
}

const RADIUS = `${String(STAGE_POI_RADIUS_M / 1000).replace('.', ',')} km`;

/**
 * Ce que la zone montre en transports en commun. `pois` : les points lus autour des
 * étapes (null : rien n'a été lu) ; `complete` : tous les lieux d'étape ont été lus.
 * La catégorie « transport » est une gare, une gare routière ou un embarcadère (OpenStreetMap) ;
 * les simples arrêts de bus ne sont pas lus.
 */
export function transitSignal(input: { pois: readonly TransitPoint[] | null; complete: boolean }): TransitSignal {
  const stops = (input.pois ?? []).filter((p) => p.category === 'transport').sort((a, b) => a.distanceM - b.distanceM);
  if (stops.length > 0) {
    const names = [...new Set(stops.map((p) => p.name).filter((n): n is string => !!n))].slice(0, 2);
    const what = names.length
      ? `${names.join(' et ')}, lu${names.length > 1 ? 's' : ''} sur la carte`
      : 'une gare, une gare routière ou un embarcadère est lu sur la carte';
    return {
      status: 'reperes',
      text: `Transports en commun : ${what} à moins de ${RADIUS} d’une étape. Horaires et prix dans Résa · Trajets.`,
    };
  }
  if (!input.complete)
    return {
      status: 'non_evalue',
      text: 'Transports en commun non évalués : les gares et gares routières autour des étapes ne sont pas encore lues sur la carte.',
    };
  return {
    status: 'non_evalue',
    text: `Transports en commun non évalués : aucune gare ni gare routière lue à moins de ${RADIUS} des étapes (les simples arrêts de bus ne sont pas lus sur la carte).`,
  };
}
