/**
 * L'eau, par SEGMENT et non par journee.
 *
 * `waterNeeds` (consumables.ts) raisonne a la journee : une seule entree par
 * jour, ancree sur la premiere etape. C est faux pour ce que la personne doit
 * reellement faire : on ne porte pas son eau du lever au coucher, on la porte
 * d'un ravitaillement au suivant. Un segment est exactement cet intervalle.
 *
 * Regle de confiance, la meme que partout ailleurs dans ce module : ce fichier
 * ne FABRIQUE AUCUNE donnee. Il ne produit ni volume, ni distance, ni duree.
 * Il ne fait que decouper le parcours reellement produit en portions et dire
 * par quoi chacune est fermee. Ce que la base ne dit pas reste `null`, et
 * l'ecran affiche « a verifier » plutot qu'un litre invente.
 *
 * Le volume reste `null` par construction, et ce n'est pas un oubli : aucun
 * debit, aucune longueur de portee et aucun facteur d'activite ne sont
 * stockes dans le depot. Ecrire « 1,5 L » ici serait un nombre presente comme
 * une mesure. La seule maniere honnete de le remplir un jour est qu'une source
 * publiee donne la portee du segment ; le champ existe pour l'accueillir.
 */

import type { ItineraryModel, ItineraryStep, WaterNeed } from '../types';
import { daySteps } from './itinerary';

/**
 * Un bout de journee pendant lequel l eau ne peut pas etre reapprovisionnee.
 *
 * Le segment s'ouvre sur la premiere etape du jour, ou sur le ravitaillement
 * qui precede, et se ferme sur le ravitaillement suivant. La queue de journee
 * qui suit le dernier ravitaillement est un segment comme les autres : c'est
 * precisement celui-la qu on ne veut pas oublier.
 *
 * Deux invariants tiennent la decomposition :
 *
 *   - la couverture est JOINTIVE. Deux segments successifs se touchent sur
 *     l'ancre, sans trou ni recouvrement de plus d'une etape ;
 *   - l'identifiant est UNIQUE. Il vaut l'ancre du segment, donc un
 *     ravitaillement ne peut pas etre a la fois l'ancre de deux segments :
 *     le cas d'une journee qui commence par un ravitaillement est traite
 *     explicitement, sinon React recevrait deux fois la meme cle.
 */
export interface WaterSegment {
  /** Ancre stable : l'identifiant de l'etape qui ouvre le segment. */
  readonly id: string;
  readonly day: number;
  /** Etapes traversees pendant ce segment, dans l'ordre du programme. */
  readonly stepIds: readonly string[];
  /** L'etape qui ouvre le segment (depart du jour, ou ravitaillement). */
  readonly opensAtStepId: string;
  /** Le ravitaillement qui ferme le segment, ou `null` en fin de journee. */
  readonly closedByStepId: string | null;
  /** Nom reel du lieu de ravitaillement ; `null` = aucun, donc « a verifier ». */
  readonly closedByPlaceName: string | null;
  /** Fiabilite du ravitaillement qui ferme : un point non confirme reste incertain. */
  readonly confidence: 'fiable' | 'incertaine';
  /**
   * Volume a porter par personne et par segment. Toujours `null` tant qu'aucune
   * source publiee ne donne la portee : `litersPerPerson` n'est pas une
   * constante du code, c'est une mesure attendue.
   */
  readonly litersPerPerson: number | null;
}

/** Un ravitaillement n est fiable que s il a ete verifie, comme dans `consumables`. */
function isVerified(step: ItineraryStep): boolean {
  return step.state === 'confirme' || step.state === 'confirme_communaute';
}

/** Renvoyer le ravitaillement verifie s il y en a un, sinon le premier venu. */
function closingRefill(steps: readonly ItineraryStep[]): ItineraryStep | null {
  const refills = steps.filter((step) => step.kind === 'ravitaillement');
  return refills.find(isVerified) ?? refills[0] ?? null;
}

/**
 * Decoupe UNE journee reelle en segments d'eau.
 *
 * Exporte separement de `segmentsForDay` pour que le tiroir puisse rendre une
 * journee a la fois sans recalculer les autres.
 */
export function segmentsForDay(model: ItineraryModel, day: number): readonly WaterSegment[] {
  const steps = daySteps(model, day);
  if (steps.length === 0) return [];

  const segments: WaterSegment[] = [];
  // Un segment s'ouvre sur la premiere etape, ou sur le ravitaillement qui
  // vient de fermer le segment précédent. On garde donc l'ancre courante au
  // lieu de la recalculer : c'est elle qui donne au segment son identifiant.
  let openIndex = 0;
  let openAnchor = steps[0];

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const isRefill = step.kind === 'ravitaillement';
    // Le DERNIER ravitaillement ne ferme pas de segment : il ouvre le suivant.
    // Sans cette condition, la fin de journee disparaitrait du tiroir — et
    // c'est justement la portion qu'on emporte le plus longtemps.
    if (!isRefill || index === steps.length - 1) continue;
    // Un ravitaillement colle a l'ancre ne ferme rien non plus : la portion
    // qu'il fermerait serait vide (une seule etape, deux fois la meme). C'est
    // le cas de TOUTE journee qui commence par un ravitaillement — on s'y est
    // deja ravitaille en arrivant, la portion a porter s'ouvre donc la.
    // Sans cette garde, cette journee etait decoupee en [r] puis [r..fin],
    // deux segments de MEME identifiant : React perdait des lignes, et l'ancre
    // n'etait plus univoque.
    if (index === openIndex) continue;

    segments.push(makeSegment(day, steps, openIndex, index, openAnchor, step));
    openIndex = index;
    openAnchor = step;
  }

  // Queue de journee : du dernier ravitaillement (ou du depart) jusqu au bout.
  segments.push(makeSegment(day, steps, openIndex, steps.length - 1, openAnchor, null));
  return segments;
}

function makeSegment(
  day: number,
  steps: readonly ItineraryStep[],
  fromIndex: number,
  toIndex: number,
  openAnchor: ItineraryStep,
  close: ItineraryStep | null,
): WaterSegment {
  const slice = steps.slice(fromIndex, toIndex + 1);
  return {
    id: openAnchor.id,
    day,
    stepIds: slice.map((step) => step.id),
    opensAtStepId: openAnchor.id,
    closedByStepId: close ? close.id : null,
    closedByPlaceName: close ? close.placeName : null,
    // Pas de ravitaillement = rien n'est verifie : le segment reste incertain,
    // meme si le reste de la journee est confirme.
    confidence: close && isVerified(close) ? 'fiable' : 'incertaine',
    litersPerPerson: null,
  };
}

/** Tous les segments du programme, journee par journee. */
export function waterSegments(model: ItineraryModel | null): readonly WaterSegment[] {
  if (!model) return [];
  const segments: WaterSegment[] = [];
  for (let day = 1; day <= model.days; day += 1) {
    segments.push(...segmentsForDay(model, day));
  }
  return segments;
}

/**
 * Adapte un segment au type que le tiroir consomme deja.
 *
 * `WaterNeed` est le contrat de l'ecran ; le segment n'en est qu'une lecture
 * plus fine. On evite ainsi d avoir deux formats pour la meme eau.
 */
export function segmentAsWaterNeed(segment: WaterSegment): WaterNeed {
  return {
    stepId: segment.id,
    litersPerPerson: segment.litersPerPerson,
    confidence: segment.confidence,
    refillPlaceName: segment.closedByPlaceName,
    alternativePlaceName: null,
  };
}

/** Les etapes d'un segment, resolues dans le modele, dans l'ordre. */
export function segmentSteps(
  model: ItineraryModel,
  segment: WaterSegment,
): readonly ItineraryStep[] {
  return daySteps(model, segment.day).filter((step) => segment.stepIds.includes(step.id));
}