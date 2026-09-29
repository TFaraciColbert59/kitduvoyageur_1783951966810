/**
 * D3 — le canal qui publie la geometrie REELLE, des qu elle existe.
 *
 * Ce fichier est un module FEUILLE : son seul import est un `import type`.
 * Ce n est pas une precaution de style, c est une contrainte de graphe.
 * `places.ts` doit publier l'etape qu il vient de localiser, et
 * `itineraryPhases.ts` — qui tire `./itinerary`, donc `places.ts` —.listen deja
 * a ce canal. Un import direct de l'un vers l'autre fermerait un cycle. Le bus
 * n'importe donc PERSONNE : chacun peut le joindre sans rien tirer derriere.
 *
 * `itineraryPhases.ts` le re-exporte, ce qui garde une seule adresse publique
 * pour le canal alors que la definition vit ici.
 */

import type { ItineraryModel } from '../types';

/**
 * Un abonne a la geometrie telle qu elle existe, pas telle qu elle sera.
 *
 * Le canal existe pour une seule raison : ItineraryStep ne monte sa carte que
 * si draft.itinerary existe, donc l'utilisateur ne voit le trace qu'APRES la
 * generation. Ce canal publie le meme modele, reellement mesure, au moment ou
 * il devient vrai — jamais une anticipation, jamais une position inventee.
 */
export type GenerationPartialListener = (model: ItineraryModel) => void;

/**
 * En dessous de ce nombre de points, un trace n'est pas un trace.
 *
 * Un point isole ne dessine pas un trajet : il dessine un point, et une
 * « carte qui se trace » qui n'affiche qu'un point unique pretendrait une
 * geometrie que personne n'a. Le seuil est donc une condition de dessin, pas
 * une mesure de completude.
 */
export const MIN_LOCATED_STEPS = 2;

const PARTIAL_LISTENERS = new Set<GenerationPartialListener>();

/**
 * Abonne un ecran a la geometrie reelle. Rend la fonction de desabonnement.
 *
 * Abonner deux fois le meme ecran est sans effet : le Set ne le compte pas
 * deux fois, donc un double montage ne double pas le rendu.
 */
export function onGenerationPartial(listener: GenerationPartialListener): () => void {
  PARTIAL_LISTENERS.add(listener);
  return () => {
    PARTIAL_LISTENERS.delete(listener);
  };
}

/** Etapes reellement localisees : une position finie, des deux cotes. */
export function locatedStepCount(model: ItineraryModel | null): number {
  if (model === null) return 0;
  return model.steps.filter(
    (step) => Number.isFinite(step.lat) && Number.isFinite(step.lon),
  ).length;
}

/**
 * Publie la geometrie, si et seulement si elle vaut d'etre dessinee.
 *
 * Un abonne qui leve n'interrompt rien : c'est un ecran, pas une frontiere. Le
 * moteur qui a produit la mesure ne peut pas echouer parce qu'un composant a
 * mal rendu.
 */
export function publishPartial(model: ItineraryModel | null): void {
  if (model === null) return;
  if (PARTIAL_LISTENERS.size === 0) return;
  if (locatedStepCount(model) < MIN_LOCATED_STEPS) return;
  for (const listener of PARTIAL_LISTENERS) {
    try {
      listener(model);
    } catch {
      // Un abonne muet n annule ni la mesure ni la generation.
    }
  }
}
