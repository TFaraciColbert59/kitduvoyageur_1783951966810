import type { AIRequest, AIResponse } from '../providers/types';

/**
 * Feature « trajectoire-narration » (T2 du chantier Trajectoire Vivante).
 *
 * tier FAST, et c'est un choix de conception, pas une economie : la narration
 * doit suivre le curseur. Un tier heavy raisonne pendant plusieurs secondes ;
 * pendant ce temps, l'utilisateur a deja deplace le curseur et la reponse
 * decribe une position obsolete. Une phrase de prose n'a pas besoin de
 * raisonnement long — elle a besoin d'etre rapide et fidele a l'etat.
 *
 * cache 1 h : le meme etat donne la meme phrase, et l'utilisateur backslash
 * revient souvent sur la meme zone. Mais au-dela d'une heure, la reponse est
 * reecrite : la narration est une facon de parler du plan, pas le plan.
 *
 * `maxPerUserPerDay` volontairement genereux (100) : un utilisateur qui
 * explore l'axe fait une_soixantaine de positions en dix minutes. Un plafond
 * bas ne protegerait pas le quota, il casserait l'experience.
 */
export const TRAJECTOIRE_NARRATION_SPEC = {
  tier: 'fast' as const,
  maxReasoningBudget: 0,
  cacheTtlSeconds: 3_600,
  maxPerUserPerDay: 100,
};

/**
 * Fallback : `degraded: true` et une structure vide.
 *
 * Vide et non un texte d'excuse, parce que le contrat de sortie du modele est
 * `{ headline, lines }` : renvoyer une phrase ici ferait echouer le parseur
 * chez l'appelant, qui testerait alors une reponse qui n'a pas la forme
 * attendue. Le gabarit local prend le relais cote UI — c'est lui qui affiche
 * « Modele deterministe », donc l'utilisateur sait ce qu'il lit.
 */
export async function fallbackResponse(_req: AIRequest): Promise<AIResponse> {
  return {
    text: JSON.stringify({ headline: '', lines: [] }),
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  };
}
