/**
 * Continuite du voyage : chaque journee commence LA OU la precedente s est
 * terminee, et une journee qui bouge perd ses mesures perimees.
 *
 * Une aventure est un SEUL deplacement. Un programme qui fait dormir au
 * Bourguin le soir 1 et qui reparait a Chamonix le matin 2 n est pas un
 * programme, c est deux programmes colles : le kilometrage.routes alors un
 * aller-retour que personne n aura fait, et l utilisateur voit un trajet de
 * 40 km dans la nuit.
 *
 * Ce module ne propose rien et n invente AUCUN lieu. Il ne fait que
 * raccrocher une journee a la precedente, en reutilisant une position DEJA
 * mesuree, et en remettant les mesures de la journee deplacee a « a
 * verifier » plutot que de laisser un chiffre perime a l'ecran.
 */

import { de } from './frenchText';
import { createStep, daySteps, renumberByDay } from './itinerary';
import { haversineKm } from './routing';
import type {
  AdventurePrepDraft,
  DayTotals,
  ItineraryModel,
  ItineraryStep,
} from '../types';

/**
 * Distance a vol d'oiseau au dela de laquelle deux journees ne se suivent plus.
 *
 * En dessous, les journees sont voisins : la trecho a vol d'oiseau mesuree
 * laisse une marge reelle de marche ou de route, et rewrire le titre n'aurait
 * rien de plus honnete. Au dela, le programme a oublie ou il dormait, et le
 * rattrapage est une correction, pas une invention.
 */
export const CONTINUITY_LEG_KM = 20;

/**
 * Distance sous laquelle le programme EST deja arrive.
 *
 * Ce seuil n'a pas le meme role que le precedent : il ne detecte pas une
 * rupture entre deux journees, il repond a une seule question, « etes-vous
 * la? ». Traverser un parking ne justifie pas d'ajouter une etape de retour ;
 * un refuge a quinze kilometres, si.
 */
export const ARRIVEE_TOLERANCE_KM = 1;

/** Une journee dont plus rien n'est mesure : mieux vaut « a verifier » que faux. */
const INCONNU: DayTotals = {
  distanceKm: null,
  movingMin: null,
  activityMin: null,
  elevGainM: null,
  elevLossM: null,
};

/** Somme stricte : une journee inconnue rend le total inconnu, jamais partiel. */
function sommeConnue(values: readonly (number | null)[]): number | null {
  if (values.length === 0) return null;
  if (values.some((value) => value === null)) return null;
  return values.reduce<number>((acc, value) => acc + (value as number), 0);
}

function positionOf(step: ItineraryStep | null | undefined) {
  if (!step || step.lat === null || step.lon === null) return null;
  return { lat: step.lat, lon: step.lon };
}

/** Les etapes reellement situees d une journee, dans l ordre du programme. */
function situees(model: ItineraryModel, day: number): ItineraryStep[] {
  return daySteps(model, day).filter((step) => step.lat !== null && step.lon !== null);
}

/** Ou la journee s est terminee : la derniere position atteinte. */
function finDeJournee(model: ItineraryModel, day: number): ItineraryStep | null {
  const etapes = situees(model, day);
  return etapes.length > 0 ? etapes[etapes.length - 1] : null;
}

/** Ou la journee commence : son premier `trajet`, sinon sa premiere etape. */
function debutDeJournee(model: ItineraryModel, day: number): ItineraryStep | null {
  const etapes = situees(model, day);
  return etapes.find((step) => step.kind === 'trajet') ?? etapes[0] ?? null;
}

/** Recompose le total du voyage : il reste la somme de ses journees. */
function totaliser(perDay: readonly DayTotals[]): DayTotals {
  return {
    distanceKm: sommeConnue(perDay.map((day) => day.distanceKm)),
    movingMin: sommeConnue(perDay.map((day) => day.movingMin)),
    activityMin: sommeConnue(perDay.map((day) => day.activityMin)),
    elevGainM: sommeConnue(perDay.map((day) => day.elevGainM)),
    elevLossM: sommeConnue(perDay.map((day) => day.elevLossM)),
  };
}

/**
 * Raccroche chaque journee a la precedente, sur des positions deja mesurees.
 *
 * Renvoie un NOUVEAU modele. Sans rupture, et sans arrivee a rejoindre en
 * aller simple, il rend le modele INCHANGE : une correction qui n'a rien a
 * corriger ne doit pas se voir.
 */
export function enforceDayContinuity(
  model: ItineraryModel,
  draft: AdventurePrepDraft,
): ItineraryModel {
  const jours = Math.max(0, Math.trunc(model.days));
  const deplacees = new Set<number>();
  let steps = model.steps;

  // 1. Chaque journee demarre la ou la precedente s est terminee.
  for (let day = 2; day <= jours; day += 1) {
    const veille = finDeJournee(model, day - 1);
    const debut = debutDeJournee(model, day);
    const depuis = positionOf(veille);
    const vers = positionOf(debut);
    if (!depuis || !vers || !veille || !debut) continue;
    if (haversineKm(depuis, vers) <= CONTINUITY_LEG_KM) continue;
    // Sans nom de lieu, on ne peut pas nommer le depart : on laisse tel quel
    // plutot que d'ecrire un titre qui ne designe rien.
    const nom = veille.placeName;
    if (!nom) continue;
    steps = steps.map((step) =>
      step.id === debut.id
        ? { ...step, lat: depuis.lat, lon: depuis.lon, placeName: nom, title: `Départ ${de(nom)}` }
        : step,
    );
    deplacees.add(day);
  }

  // 2. En aller simple, la derniere journee se termine SUR l arrivee.
  const retour = versArrivee(model, draft, steps);
  if (retour) {
    steps = [...steps, retour];
    deplacees.add(jours);
  }

  if (deplacees.size === 0) return model;
  return {
    ...model,
    steps: renumberByDay(steps),
    perDay: model.perDay.map((day, index) =>
      deplacees.has(index + 1) ? { ...INCONNU } : day,
    ),
    totals: totaliser(model.perDay.map((day, index) => (deplacees.has(index + 1) ? INCONNU : day))),
  };
}

/**
 * L etape de retour quand le programme s'arrete ailleurs que l'arrivee.
 *
 * `null` des que la forme du voyage ne demande pas de retour, que l'arrivee
 * n'est pas connue, ou que la derniere journee y est DEJA : on n'ajoute une
 * etape que lorsqu'il manque vraiment quelque chose.
 */
function versArrivee(
  model: ItineraryModel,
  draft: AdventurePrepDraft,
  steps: readonly ItineraryStep[],
): ItineraryStep | null {
  if (draft.route.shape !== 'aller_simple') return null;
  const arrivee = draft.route.destination;
  if (!arrivee) return null;
  const jour = Math.max(0, Math.trunc(model.days));
  const derniere = finDeJournee({ ...model, steps }, jour);
  const ici = positionOf(derniere);
  if (!ici) return null;
  if (haversineKm(ici, arrivee) <= ARRIVEE_TOLERANCE_KM) return null;
  const freres = steps.filter((step) => step.day === jour);
  const etape = createStep(`d${jour}-trajet-retour`, jour, freres.length, 'trajet', {
    title: `Retour ${de(arrivee.name)}`,
    placeName: arrivee.name,
    reason: 'Retour : trajet et horaires à vérifier',
    state: 'a_reserver',
  });
  // L arrivee est un lieu REEL deja choisi par l utilisateur : on l ancre
  // directement. Sans cela l etape resterait sans position et ne recevrait
  // ni distance, ni meteo, alors que les deux sont mesurables.
  return { ...etape, lat: arrivee.lat, lon: arrivee.lon };
}
