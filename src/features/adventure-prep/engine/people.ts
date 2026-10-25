/**
 * Ce que le tiroir Participants sait dire, et ce qu il ne sait pas.
 *
 * Deux des trois colonnes de F9 n ont pas la meme source. « Confirmes » vient
 * de `group.knownMembers`, qui est une donnee saisie et reelle. « Materiel
 * partage » se derive des besoins de l activite et de ce que la personne a
 * reellement attribue. « Invites » n a AUCUNE source : le lien d invitation
 * est signe, emis une fois, et nulle part dans le depot.
 *
 * Ce module ne comble donc pas le trou. Il expose les deux colonnes qui ont
 * une donnee, et le tiroir affiche un etat honnete pour la troisieme. Ecrire
 * une liste d invites — meme vide, meme « 0 invite » — ferait croire a un
 * suivi que l application n assure pas.
 *
 * La colonne « partage » lit `resolvedGear`, pas `buildGearNeeds` : c'est
 * `resolvedGear` qui rapproche les besoins derives des saisies de
 * `draft.gear`, donc la seule source ou un porteur REEL existe. Lire les
 * besoins bruts rendait l attribution inatteignable — le badge « Porte par »
 * et le tri par etat n auraient jamais eu de donnee a afficher.
 *
 * Regle de confiance : `soloHeadcount` n est pas une estimation, c est
 * `adults + children`, les deux champs reels du brouillon.
 */

import { resolvedGear } from './gear';
import type { AdventurePrepDraft, GearNeed } from '../types';

/** L'effectif REEL saisi : adultes + enfants, jamais une estimation. */
export function headcountOf(draft: AdventurePrepDraft): number {
  return draft.group.adults + draft.group.children;
}

/** L attribut d'un objet de materiel, tel qu il est reellement saisi. */
export type ShareState = 'attribue' | 'a-attribuer';

export interface SharedGearItem {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly ownerId: string | null;
  readonly state: ShareState;
}

/**
 * Le materiel dont le GROUPE doit decider qui le porte.
 *
 * La regle est courte parce qu elle est la seule defendable : un objet porte
 * par une personne designee est attribue ; un objet sans designee est une
 * decision de groupe qui reste a prendre. Rien d autre n entre ici — ni un
 * poids devine, ni un « probablement transporte par X ».
 *
 * Quand la personne part SEULE, la colonne n a rien a dire : il n y a personne
 * avec qui partager. L app le dit plutot que d afficher une liste de decisions
 * qui n existent pas.
 */
export function sharedGear(draft: AdventurePrepDraft): readonly SharedGearItem[] {
  if (headcountOf(draft) <= 1) return [];
  return resolvedGear(draft)
    .map((item: GearNeed) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      ownerId: item.ownerId,
      state: (item.ownerId !== null ? 'attribue' : 'a-attribuer') as ShareState,
    }))
    // Ce qui reste a decider passe avant, par ordre alphabetique : la
    // decision a prendre est en haut, pas en bas du tiroir.
    .sort((a, b) => (a.state === b.state ? a.name.localeCompare(b.name) : a.state === 'attribue' ? 1 : -1));
}

/** Le nombre de decisions de partage encore ouvertes. */
export function pendingShareCount(draft: AdventurePrepDraft): number {
  return sharedGear(draft).filter((item) => item.state === 'a-attribuer').length;
}