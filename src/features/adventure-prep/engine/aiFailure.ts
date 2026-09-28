import type { AIFailureReason } from '@/lib/ai/providers/types';

/**
 * Pourquoi on retente, et quoi dire quand on n'a pas reussi.
 *
 * Mesure du 2026-09-28, meme brouillon, provider NVIDIA : 45 010 ms, puis
 * 2 682 ms, puis 1 473 ms. Le service ne casse pas, il DECROCHE. Un reessai
 * unique cible sur le seul delai transforme donc un cul-de-sac de 45 s en
 * reponse en ~2 s — et ne coute rien quand le service est reellement mort.
 *
 * Ce module est PUR : ni reseau, ni `window`, ni Date. Il tourne donc dans le
 * bundle navigateur comme dans un test sans DOM, ce qui rend chaque phrase
 * AFFICHEE verifiable sans jamais interroger le provider.
 */

/**
 * Le seul aleas qui merite un second essai.
 *
 * Le quota ne se retente pas (il repartirait echouer, pour un cout nul) et une
 * reponse illisible ne se retente pas non plus : le modele a bien repondu, c'est
 * sa reponse qui ne vaut rien, et la repasser produirait le meme Schema vide.
 */
export function shouldRetryAfterFailure(reason: AIFailureReason | null | undefined): boolean {
  return reason === 'delai_depasse';
}

/**
 * Une phrase par cause, jamais un texte partage.
 *
 * L'utilisateur doit pouvoir distinguer « le service a ete lent » de « le
 * quota du jour est epuise » : seule la premiere se resout en reessayant
 * immediatement, seule la seconde se resout demain. Un message unique pour les
 * deux l'obligerait a deviner laquelle des deux attendre.
 */
const MESSAGES: Record<AIFailureReason, string> = {
  delai_depasse:
    "L’assistant n’a pas répondu à temps. Ton parcours a été construit par le moteur par règles, et il est complet : les prix et les disponibilités restent à vérifier. Tu peux relancer l’enrichissement quand tu veux.",
  quota_epuise:
    "Les quotas d’assistant du jour sont épuisés. Ton parcours a été construit par le moteur par règles, et il est complet. Ils repartent demain.",
  provider_indisponible:
    "Le service d’assistant ne répond pas. Ton parcours a été construit par le moteur par règles, et il est complet : tu peux continuer à tout ajuster à la main.",
  reponse_invalide:
    "La réponse de l’assistant n’était pas exploitable. Ton parcours a été construit par le moteur par règles, et il est complet.",
};

/**
 * La phrase a afficher, ou `null` quand rien n'a degrade.
 *
 * `null` pour une cause inconnue est VOLONTAIRE : afficher un texte devine
 * serait exactement le mensonge que ce module remplace. L'appelant retombe
 * alors sur son message generique, qui ne pretend rien de plus.
 */
export function describeAiFailure(reason: AIFailureReason | null | undefined): string | null {
  return reason ? MESSAGES[reason] ?? null : null;
}