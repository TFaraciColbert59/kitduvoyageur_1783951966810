/**
 * Compas — le poste « Formalités » (visa, autorisation) d'une personne, calculé à la LECTURE.
 *
 * VIE PRIVÉE (PLAN-100 4.1, lot Z1) : ce poste dépend de la NATIONALITÉ (barème pour un ressortissant
 * français, seulement si la table passeport × destination dit qu'un visa ou une autorisation est
 * requis). Rangé comme dépense du voyage (`trip_expenses`, `trips.metadata`), sa seule présence, son
 * titre et sa base « ressortissant français » diraient la nationalité du lanceur à tous les lecteurs
 * du voyage et, pour un voyage public, à n'importe qui. Le voyage ne le range donc jamais : la
 * préparation n'écrit que les postes qui ne dépendent de personne, et la ligne de la personne qui
 * regarde se calcule ici, avec SON profil (`getCompasData`), puis s'affiche à part du budget, hors
 * du total rangé. Module pur.
 */

import { entryFees, formalitiesBasis } from './costs';
import { entryFor, type EntryRequirement } from './entry';
import { abroadCosts } from './travel';
import type { TravellerContext } from './traveller';

export interface ReaderFormalities {
  /** « Formalités : ESTA (40 $) ». */
  title: string;
  /** € par personne (barème) : ce que coûte la formalité à CE lecteur, la seule chose qu'on sache de lui. */
  perPerson: number;
  party: number;
  /**
   * € pour le groupe SI toutes les personnes ont la nationalité du lecteur : le profil des autres membres
   * est privé, on ne peut pas dire combien d'entre elles sont concernées. À ne jamais présenter comme
   * « le montant pour toi » (c'est `perPerson`).
   */
  amount: number;
  currency: 'EUR';
  /** Le barème, pour qui, la date de la table, et le fait que la ligne n'est pas dans le total rangé. */
  basis: string;
}

/**
 * La ligne « Formalités » de CE lecteur, ou null : sans nationalité française connue (rien d'affirmé),
 * si on sait qu'il est déjà dans le pays, si la table ne dit pas qu'un visa ou une autorisation est
 * requis, ou si le barème ne chiffre pas ce pays.
 */
export function readerFormalities(input: {
  countryCode: string | null | undefined;
  /** Faux : départ déjà dans le pays ; null : on ne sait pas. */
  abroad: boolean | null;
  party: number;
  reader: Pick<TravellerContext, 'nationality'>;
  find: (passport: string, destination: string) => EntryRequirement | null;
}): ReaderFormalities | null {
  const entry = entryFor(input.find, input.reader.nationality, input.countryCode, input.abroad);
  if (!abroadCosts(input.abroad, input.reader, entry).formalities) return null;
  const fee = entryFees(input.countryCode);
  if (!fee) return null;
  const party = Number.isFinite(input.party) && input.party >= 1 ? Math.round(input.party) : 1;
  return {
    title: `Formalités : ${fee.detail}`,
    perPerson: fee.eur,
    party,
    amount: fee.eur * party,
    currency: 'EUR',
    basis: `${formalitiesBasis(entry?.verified)} · calculé pour toi à l’ouverture, non compté dans le total du voyage`,
  };
}

// La dépense « Formalités » d'une préparation d'avant ce verrou (reconnue, retirée de l'affichage) :
// module à part, sans dépendance, que la lecture des voyages de `lib/` importe aussi.
export { isStoredFormalities, withoutStoredFormalities } from './storedFormalities';
