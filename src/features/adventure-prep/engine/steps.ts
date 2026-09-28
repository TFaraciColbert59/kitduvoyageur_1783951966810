import { PREP_STEPS, type AdventurePrepDraft, type PrepStepId } from '../types';

export function stepPosition(id: PrepStepId): number {
  return PREP_STEPS.indexOf(id) + 1;
}

/**
 * Le catalogue d activites est-il encore a l ecran ?
 *
 * Choisir une activite suffit a le quitter, mais ce n est pas obligatoire :
 * l invite libre et le bouton « Partir librement » valent aussi. Sans cela le
 * bouton ne fermait jamais l ecran et le parcours demeurait bloque.
 */
export function isPicking(draft: AdventurePrepDraft): boolean {
  return draft.activities.primary === null && !draft.pickerDismissed;
}

/**
 * Le strict necessaire du MOTEUR — et lui seul.
 *
 * `requestDraftedItinerary` ne lit que deux choses : une INTENTION (une
 * activite du catalogue, ou « Partir librement » qui la remplace) et
 * `route.origin`. Sans depart il renvoie une proposition vide sans jamais
 * appeler le modele : un bouton actif y deviendrait un bouton mort. Tout le
 * reste se complete sans la personne — l arrivee deduit la forme du parcours,
 * la date et la duree sont proposees puis badgees (P0.15, P0.18) — et ne peut
 * donc pas bloquer.
 *
 * CE PREDICAT EST LE SEUL. Le CTA (`canCreateStepOne`), le rail
 * (`isStepSatisfied`, `canOpenStep`, `stepCountDone`) et le clic
 * (`completeStep`) le lisent tous. Deux definitions, et l ecran finit par
 * promettre un clic que le comportement refuse — ce que la mesure du
 * 2026-09-28 a vu : depart propose par la geolocalisation, aucune date, aucune
 * duree, « Creer mon parcours » actif… et un clic qui ne changeait rien, sans
 * meme appeler l'API.
 */
export function hasEngineMinimum(draft: AdventurePrepDraft): boolean {
  return (!!draft.activities.primary || draft.pickerDismissed) && !!draft.route.origin;
}

/** Une etape est satisfaite quand les reponses necessaires sont saisies. */
export function isStepSatisfied(draft: AdventurePrepDraft, id: PrepStepId): boolean {
  if (id === 'destination') return hasEngineMinimum(draft);
  if (id === 'itinerary') return draft.itinerary !== null;
  return false;
}

/**
 * L etape a-t-elle quelque chose a_montrer ?
 *
 * Reponse differente de isStepSatisfied, qui repond a « les reponses sont-elles
 * saisies ? ». Le recapitulatif de l etape 3 ne possede aucune reponse
 * propre : il est DERIVE de l itineraire. Comme isStepSatisfied renvoie false
 * en permanence pour departure, le rail peignait un lien vert (canOpenStep) que
 * le comportement refusait (isStepSatisfied) - un segment qui a l air
 * cliquable et qui n epondait pas. Une seule predicate pour la peinture ET
 * pour le clic rend ce mensonge impossible par construction.
 */
export function hasStepContent(draft: AdventurePrepDraft, id: PrepStepId): boolean {
  if (id === 'departure') return draft.itinerary !== null;
  return isStepSatisfied(draft, id);
}

export function canOpenStep(draft: AdventurePrepDraft, id: PrepStepId): boolean {
  const index = PREP_STEPS.indexOf(id);
  if (index <= 0) return true;
  return isStepSatisfied(draft, PREP_STEPS[index - 1]);
}

export function firstUnsatisfiedStep(draft: AdventurePrepDraft): PrepStepId {
  return PREP_STEPS.find((id) => !isStepSatisfied(draft, id)) ?? 'departure';
}

export function stepCountDone(draft: AdventurePrepDraft): number {
  const done = new Set<PrepStepId>(draft.completedSteps);
  for (const id of PREP_STEPS) {
    if (isStepSatisfied(draft, id)) done.add(id);
  }
  return done.size;
}

export interface PrepProgress {
  current: number;
  total: number;
  label: string;
}

/** Progression en mots : « Étape 2 sur 3 », jamais « 66 % ». */
export function progressOf(draft: AdventurePrepDraft): PrepProgress {
  const current = stepPosition(draft.currentStep);
  return { current, total: PREP_STEPS.length, label: `Étape ${current} sur ${PREP_STEPS.length}` };
}
