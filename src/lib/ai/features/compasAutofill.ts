import type { AIRequest, AIResponse } from '../providers/types';

/**
 * Feature « compas-autofill » — le spécialiste senior de la préparation.
 *
 * Le moteur (`features/compas/engine/autofill.ts`) a déjà choisi les nuits,
 * mesuré le trajet, trouvé le matériel et lu les prix en base. Le modèle
 * relit ces faits comme un préparateur expérimenté : il chiffre ce que la base
 * ne connaît pas (repas, hébergement sans prix) et signale ce qui manque.
 * Sa réponse est bornée par `sanitizeAdvice` : un chiffre hors limites est
 * ignoré et le repli déterministe s'applique.
 *
 * tier `heavy` (raisonnement utile pour chiffrer), cache 0 : chaque voyage est unique.
 */

export const COMPAS_AUTOFILL_SPEC = {
  tier: 'heavy' as const,
  maxReasoningBudget: 2000,
  cacheTtlSeconds: 0,
  maxPerUserPerDay: 20,
};

export function buildCompasAutofillSystem(): string {
  return [
    'Tu es le specialiste senior de la preparation de voyages et d activites outdoor d une application francaise.',
    'Une application t envoie les faits deja calcules (lieu, dates, groupe, nuits, trajet mesure, materiel, prix lus en base).',
    'Ta mission : completer le chiffrage et relire la preparation comme un professionnel.',
    'Regles imperatives :',
    '1. Reponds UNIQUEMENT par un objet JSON : {"meals_eur_per_person_day": number|null, "lodging_eur_per_person_night": number|null, "notes": string[]}.',
    '2. meals_eur_per_person_day : cout realiste des repas par personne et par jour pour CE lieu, CETTE saison et CES nuits (refuge en demi-pension, bivouac auto-prepare, hebergement en ville).',
    '3. lodging_eur_per_person_night : prix moyen realiste d une nuit pour les nuits « hebergement » sans prix connu, dans CETTE region ; null s il n y en a pas.',
    '4. notes : 0 a 3 conseils d action courts en francais, chacun utile et fonde sur les faits (objet introuvable a se procurer, nuit a reserver, trajet long, altitude, saison). Ne repete pas les faits, ne decris pas le lieu, ne contredis jamais les listes de materiel. Pas de reassurance, pas de score. Mieux vaut aucune note qu une note vague.',
    '5. N invente aucun lieu, produit, horaire ni prix de partenaire. Si tu ne sais pas, mets null.',
  ].join('\n');
}

export function buildCompasAutofillPrompt(facts: string): string {
  return `Faits :\n${facts}\n\nRenvoie le JSON demande.`;
}

export async function fallbackResponse(_req: AIRequest): Promise<AIResponse> {
  // Le Compas détecte `degraded` et garde le chiffrage déterministe.
  return {
    text: '{}',
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  };
}
