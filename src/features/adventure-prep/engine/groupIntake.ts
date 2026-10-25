/**
 * Ce que le preparateur sait reellement du groupe — et ce qu il ne sait pas.
 *
 * `GroupBlock` porte cinq champs : mode, adultes, enfants, animaux, invites
 * nommes. Ce module les rassemble en un seul point de lecture, et — surtout —
 * il NOMME les trous plutot que de les laisser silencieux.
 *
 * Pourquoi cette insistence. Le preparateur promet des regles et des
 * equipements, donc des personnes. Un regime alimentaire, une allergie, un
 * traitement : ce sont des informations qui changent un parcours, et le
 * parcours est ecrit par un tiers. Les recevoir sans les transmettre a l IA
 * serait une faute grave ; les transmettre en les INVENTANT le serait plus
 * encore. Ni l un ni l autre n est possible aujourd hui : rien ne les collecte.
 *
 * Donc rien ne les invente, et le trou est une donnee de premiere classe
 * (`regimeAlimentaire: null` + `NOT_COLLECTED_GROUP_FIELDS`) que l ecran peut
 * afficher et un test peut verifier. Un champ `null` silencieux serait
 * exactement le defaut qu on cherche a eviter : il se lit comme « on a cherche
 * et on n a rien trouve », alors que la vraie information est « personne n a
 * jamais pose la question ».
 *
 * `hasPets` fait exception : il EST collecte, il est cable et il est transmis.
 * C est le seul « signe particulier » que l application connaisse aujourd hui.
 */

import type { AdventurePrepDraft } from '../types';

/** Un champ que le groupe n apporte pas, et la raison de ce trou. */
export interface NotCollectedField {
  /** Identifiant stable, citable par l ecran et par un test. */
  readonly cle: string;
  /** Ce qui manque, en une ligne lisible. */
  readonly libelle: string;
  /** Pourquoi ce n est pas deja collecte — pas une excuse, une trace. */
  readonly pourquoi: string;
}

/**
 * Ce que `GroupBlock` ne porte pas. Liste fermee et intentionnelle : y ajouter
 * une entree est un acte produit (le champ doit exister dans le schema ET dans
 * le tiroir avant), pas une simple documentation.
 */
export const NOT_COLLECTED_GROUP_FIELDS: readonly NotCollectedField[] = [
  {
    cle: 'regime_alimentaire',
    libelle: 'Regime alimentaire',
    pourquoi:
      "Aucun champ dans GroupBlock. Ni vegetarien, ni vegan, ni sans gluten, ni allergie : rien n entre dans le brouillon, donc rien ne peut etre transmis a l IA.",
  },
  {
    cle: 'signes_particuliers',
    libelle: 'Signes particuliers et suivi medical',
    pourquoi:
      "Aucun champ dans GroupBlock. Aucun traitement, aucune intolerance, aucun besoin specifique : la seule donnee de cette nature aujourd hui est hasPets, qui est cable et transmis.",
  },
];

/** Ce que le brouillon dit du groupe, une fois les trous nommes. */
export interface GroupIntake {
  readonly members: readonly string[];
  readonly hasPets: boolean;
  /** Toujours `null` tant que le champ n existe pas. Jamais une valeur devinee. */
  readonly regimeAlimentaire: null;
  /** Toujours `null` tant que le champ n existe pas. Jamais une valeur devinee. */
  readonly signesParticuliers: null;
  /** Les trous, citables. */
  readonly nonCollecte: readonly NotCollectedField[];
}

/**
 * L intake du groupe, en lecture seule.
 *
 * Les noms invites sont la seule donnee NOMINATIVE du groupe : ce sont des
 * prenoms saisis, pas des participants devines. Ils sont ici bruts ; leur mise
 * en forme pour un tiers est une autre question, et vit dans la construction du
 * prompt, ou chaque champ est neutralise separement.
 */
export function groupIntake(draft: AdventurePrepDraft): GroupIntake {
  return {
    members: draft.group.knownMembers,
    hasPets: draft.group.hasPets,
    regimeAlimentaire: null,
    signesParticuliers: null,
    nonCollecte: NOT_COLLECTED_GROUP_FIELDS,
  };
}
