/**
 * Compas — la mention « IA » (PLAN-100 5.3). Module PUR : des textes et la marque d'une
 * étape proposée par l'IA.
 *
 * Pourquoi : la personne doit savoir quand une IA intervient et quel contenu vient d'elle.
 * Source relue le 11 oct. 2026 (règlement (UE) 2024/1689, article 50) :
 * https://artificialintelligenceact.eu/article/50/
 *  - §1 : informer la personne qu'elle interagit avec un système d'IA, sauf évidence ;
 *  - §5 : l'information est donnée de façon claire et distincte, au plus tard à la première
 *    interaction ou exposition, et conforme aux exigences d'accessibilité.
 * LKDV ne tranche pas ici son statut au regard de chaque paragraphe (il s'appuie sur un modèle
 * tiers) : la mention est une pratique de transparence alignée sur §1 et §5, pas une
 * déclaration de conformité. D'où les choix :
 *  - du TEXTE (jamais une icône seule), lu par les lecteurs d'écran ;
 *  - dite AVANT la première production (démarrage de la préparation), puis sur chaque contenu ;
 *  - absente quand l'IA n'a rien produit (interrupteur `AI_MODE=off`, plan 1.7) : rien ne parle d'IA.
 */

/** Libellé d'une étape que l'IA a proposée (sa position est ensuite vérifiée sur la carte). */
export const AI_STEP_LABEL = 'Proposée par l’IA';

/** Avant et pendant la préparation : ce que l'IA peut faire, et que c'est signalé. */
export const AI_NOTICE_RUN =
  'Une IA peut t’aider à lire ta demande, proposer des étapes et rédiger des conseils. Ce qu’elle propose est signalé comme tel, et le Compas le vérifie.';

/** Préparation terminée, l'IA a contribué : où la reconnaître. */
export const AI_NOTICE_DONE =
  'L’IA a contribué à cette préparation : ses étapes portent la mention « Proposée par l’IA », ses conseils « Suggestion de l’IA ».';

/** Clé de la marque dans `trip_steps.metadata` (avec `distance`, voir `stepDistanceMetadata`). */
export const AI_PROPOSED_KEY = 'aiProposed';

/**
 * Le `metadata` d'une étape, marqué « proposée par l'IA » quand c'est le cas. Une étape
 * calculée par le Compas (lieux réels de la zone, parcours du catalogue) reste sans marque.
 */
export function withAiProposed(meta: Record<string, unknown>, aiProposed: boolean): Record<string, unknown> {
  return aiProposed ? { ...meta, [AI_PROPOSED_KEY]: true } : meta;
}

/** La marque d'une étape, lue sans rien supposer : seul `true` compte. */
export function readAiProposed(metadata: unknown): boolean {
  return (
    metadata != null &&
    typeof metadata === 'object' &&
    (metadata as Record<string, unknown>)[AI_PROPOSED_KEY] === true
  );
}

/**
 * « L'IA a produit quelque chose » : au moins un conseil GARDÉ (après les filtres de règles, de
 * tutoiement et de doublon), ou des étapes qu'elle a proposées. Une réponse reçue mais vide, illisible
 * ou entièrement écartée ne compte pas : la mention « Rédigé par l'IA » ne se montre que sur ce qui
 * est réellement venu d'elle (PLAN-100 5.3).
 */
export function aiContributed(input: { aiNotes: readonly string[]; aiStages: boolean }): boolean {
  return input.aiStages || input.aiNotes.length > 0;
}
