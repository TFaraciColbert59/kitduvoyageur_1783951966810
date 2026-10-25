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
 * Il ne reste qu'une chose : une INTENTION, c est a dire une activite du
 * catalogue ou « Partir librement » qui la remplace. Sans intention, le modele
 * n a aucun sujet : il ne reste alors rien a lui demander.
 *
 * B4 a retire la seconde condition, `route.origin`. Elle existait parce que
 * `requestDraftedItinerary` court-circuitait sans depart (raison du 2026-09-28,
 * un bouton actif y promettait un clic qui n appelait meme pas l'API). La
 * cause ayant disparu, garder le garde-fou ne protégeait plus rien : il
 * refusait la MOITIE du contrat annoncee, celle ou la personne donne une
 * arrivee sans depart, ou rien du tout.
 *
 * L'absence de depart n'est donc plus un blocage, mais elle n'est pas non plus
 * un point de depart. Elle se propage telle quelle jusqu'a l ecran : le
 * parcours part d'un depart non precise, les etapes qui n ont aucun point
 * reel a quoi se rattacher deviennent des notes (`demoteOrphans`), et
 * kilometrage, meteo et budget restent « a verifier ». Aucune origine n est
 * inventeee pour combler le trou — une origine fabriquee ferait croire a une
 * position mesuree.
 *
 * CE PREDICAT EST LE SEUL. Le CTA (`canCreateStepOne`), le rail
 * (`isStepSatisfied`, `canOpenStep`, `stepCountDone`) et le clic
 * (`completeStep`) le lisent tous. Deux definitions, et l ecran finit par
 * promettre un clic que le comportement refuse.
 */
export function hasEngineMinimum(draft: AdventurePrepDraft): boolean {
  return !!draft.activities.primary || draft.pickerDismissed;
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
