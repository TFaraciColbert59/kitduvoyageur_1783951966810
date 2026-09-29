/**
 * La hauteur d un tiroir, decidee par son CONTENU.
 *
 * Le defaut etait une table `sheet -> detent` ecrite a la main. Elle a
 * immediatement menti : `participants`, `step`, `add`, `gear` et `consumables`
 * etaient forces sur 90 dvh, et un tiroir Equipement qui n'affichait que deux
 * lignes laissait 80 % de verre vide. C'est le reproche C14 : une hauteur
 * « a moitie vide » fait lire un ecran comme une panne.
 *
 * Deux decisions, une seule regle : on ne monte en `large` que lorsque le
 * contenu REMPLIT vraiment le panneau. En dessous, `auto` laisse le tiroir
 * epouser ce qu il contient.
 *
 * Cette regle est pure et testable (`detentForRows`, `detentForMeasured`).
 * La mesure reelle du DOM (`measureDrawerContent`) ne fait qu alimenter la
 * meme fonction : elle ne decide pas, elle constate. Sous `renderToStaticMarkup`
 * et avant la premiere mesure, c est le nombre de lignes reelles du brouillon
 * qui tranche — jamais une valeur codee en dur.
 */

import type { SheetDetent } from '@/components/ui';
import { buildGearNeeds } from './gear';
import { mealNeeds } from './consumables';
import { waterSegments } from './consumablesBySegment';
import { stepById } from './itinerary';
import type { AdventurePrepDraft } from '../types';

/**
 * A partir de combien de lignes un tiroir remplit-il un panneau de 90 dvh ?
 *
 * Mesure, pas estimation : sur un ecran de 844 px de haut, 90 dvh font
 * environ 760 px de panneau, une ligne de liste du gabarit en fait 56 px
 * chrome compris. Douze lignes y consomment presque tout.
 */
export const FILLING_ROWS = 12;

/**
 * Version mesuree du meme seuil : au-dela de 55 % de la hauteur visible, le
 * contenu occupe le tiroir. En dessous, un `large` laisserait plus de vide
 * que de contenu — exactement le reproche C14.
 */
export const FILL_RATIO = 0.55;

/** Mesure reelle du contenu, quand le DOM est disponible. */
export interface DrawerMeasurement {
  readonly contentHeightPx: number;
  readonly viewportHeightPx: number;
}

/**
 * `large` seulement si le contenu remplit. Sinon `auto`.
 *
 * Une mesure absente ou non finie vaut « pas mesure » : on rend alors
 * `null` plutot que de trancher sur une division par zero.
 */
export function detentForMeasured(measurement: DrawerMeasurement | null): SheetDetent | null {
  if (!measurement) return null;
  const { contentHeightPx, viewportHeightPx } = measurement;
  if (!Number.isFinite(contentHeightPx) || !Number.isFinite(viewportHeightPx)) return null;
  if (viewportHeightPx <= 0) return null;
  return contentHeightPx >= viewportHeightPx * FILL_RATIO ? 'large' : 'auto';
}

/** Le meme arbitrage, compte en lignes reelles plutot qu en pixels. */
export function detentForRows(rows: number): SheetDetent {
  if (!Number.isFinite(rows) || rows <= 0) return 'auto';
  return rows >= FILLING_ROWS ? 'large' : 'auto';
}

/**
 * La mesure prime quand elle existe : elle voit le rendu reel. Sinon on compte.
 */
export function detentFor(
  rows: number,
  measurement: DrawerMeasurement | null = null,
): SheetDetent {
  return detentForMeasured(measurement) ?? detentForRows(rows);
}

/**
 * Mesure un contenu de tiroir dans le navigateur.
 *
 * `null` partout ou la mesure n'a pas de sens (SSR, element absent, hauteur
 * nulle) : l'appelant retombe alors sur le comptage, qui ne depend que du
 * brouillon.
 */
export function measureDrawerContent(
  element: { scrollHeight: number; getBoundingClientRect(): { height: number } } | null,
  viewportHeightPx: number,
): DrawerMeasurement | null {
  if (!element) return null;
  if (!Number.isFinite(viewportHeightPx) || viewportHeightPx <= 0) return null;
  return {
    contentHeightPx: Math.max(element.scrollHeight, element.getBoundingClientRect().height),
    viewportHeightPx,
  };
}

export type DrawerId =
  | 'place'
  | 'calendar'
  | 'group'
  | 'preferences'
  | 'coverage'
  | 'participants'
  | 'step'
  | 'steps'
  | 'adjust'
  | 'add'
  | 'replace'
  | 'gear'
  | 'consumables'
  | 'invite';

/**
 * Combien de lignes REELLES un tiroir affiche-t-il, pour ce brouillon ?
 *
 * C'est le coeur du correctif : plus de table figee. Chaque tiroir compte ce
 * qu il va rendre, a partir des memes modules que son rendu. Un tiroir qui
 * n'a plus rien a dire produit 0 ligne et se referme sur son contenu.
 */
export interface DrawerContext {
  /** Etape ciblee par le tiroir « step » ; elle ne vit pas dans le brouillon. */
  readonly focusStepId?: string | null;
}

export function drawerRowCount(
  id: DrawerId,
  draft: AdventurePrepDraft,
  context: DrawerContext = {},
): number {
  const model = draft.itinerary;

  switch (id) {
    case 'place': {
      // Deux lignes de extremes (Depart / Arrivee) plus les lieux proposes.
      // La recherche est saisi en direct : au premier rendu la liste est
      // courte, et le tiroir doit alors rester court.
      return 2 + Math.max(1, draft.route.origin ? 1 : 0) + (draft.route.destination ? 1 : 0);
    }
    case 'calendar':
      // Depart, duree, retour : trois lignes, plus la ligne de retour suggeree.
      return 3 + (draft.calendar.returnDate ? 1 : 0);
    case 'group': {
      const members = draft.group.knownMembers.length;
      return 3 + members;
    }
    case 'preferences': {
      // 3 paliers de budget + 3 rythmes + 1 transport + interets coches +
      // contraintes, plus le resume honnete du budget.
      return 3 + 3 + 1 + draft.preferences.interests.length + draft.preferences.accessibilityNeeds.length + 1;
    }
    case 'coverage':
      return 4;
    case 'participants': {
      // Effectif, confirmes, invites, materiel partage : quatre sections, plus
      // une ligne par personne et une par materiel.
      const shared = buildGearNeeds(draft).filter(
        (item) => item.quantity > 1 || item.ownerId !== null,
      ).length;
      return 4 + draft.group.knownMembers.length + shared;
    }
    case 'step': {
      if (!model || !context.focusStepId) return 2;
      const step = stepById(model, context.focusStepId);
      if (!step) return 2;
      // Titre, lieu, horaire, raison, prix, etat. Une information absente
      // occupe malgre tout sa ligne : elle affiche « a verifier », et cette
      // ligne est justement ce qui empeche le tiroir de paraitre complet.
      return 6 + (step.price.amount !== null ? 1 : 0) + (step.startTime ? 1 : 0);
    }
    case 'steps':
      return model ? model.steps.length + 1 : 2;
    case 'adjust':
      return 6;
    case 'add':
    case 'replace':
      // Ces deux vues listent des lieux REELS ; sans resorption, la seule
      // donnee honnete est « aucune alternative ».
      return model ? Math.max(1, model.steps.length) : 1;
    case 'gear': {
      const needs = buildGearNeeds(draft);
      return needs.length + 1;
    }
    case 'consumables': {
      if (!model) return 2;
      const segments = waterSegments(model).length;
      const meals = mealNeeds(model).filter((need) => need.coveredByStepId === null).length;
      return segments + meals + 2;
    }
    case 'invite':
      return 5;
    default:
      return 1;
  }
}

/** Le nombre de lignes et la mesure, pour un tiroir donne et un brouillon donne. */
export function drawerDetent(
  id: DrawerId,
  draft: AdventurePrepDraft,
  measurement: DrawerMeasurement | null = null,
  context: DrawerContext = {},
): SheetDetent {
  return detentFor(drawerRowCount(id, draft, context), measurement);
}