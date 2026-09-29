/**
 * Etape 1 — profils d'ecran.
 *
 * Les ecrans 10, 11, 12 et 13 ont la MEME structure — trois blocs, une carte,
 * un appel — et ne different que par les questions posees. Toute la
 * difference est ecrite ici, dans un module pur : le composant ne fait que
 * rendre. Aucun store, aucun composant React, aucune requete ici.
 *
 * Regle de confiance : le profil change les QUESTIONS, jamais les DONNEES.
 * Un ecran ne propose que les champs qu'il sait remplir, et n'affiche jamais
 * une date, un prix ou une disponibilite qu'il n'a pas.
 */

import { activityById } from '../catalog';
import { hasEngineMinimum } from '../engine/steps';
import type { AdventurePrepDraft, ActivitySelection } from '../types';

/* ------------------------------------------------------------------ */
/* Familles de profil                                                  */
/* ------------------------------------------------------------------ */

export type StepOneProfileId = 'trajet' | 'voyage' | 'sejour' | 'local';

/**
 * Activites qui se pratiquent sur un lieu_unique : on n'y fait pas de trajet,
 * on n'y affiche donc ni arrivee ni trac« ligne ». La liste est explicite et
 * courte : ajouter une activite locale se decide ici, en un seul endroit.
 */
const LOCAL_PRACTICE: ReadonlySet<string> = new Set([
  'canoe-journee',
  'regate',
  'plongee-autonome',
  'kayak',
  'escalade',
  'parapente',
  'ski-alpin',
]);

/**
 * Le profil se lit sur l'activite PRINCIPALE seule. Ajouter un complement ne
 * doit pas faire changer les questions posees : une randonnee qui embarque un
 * road trip reste une randonnee a l'etape 1.
 */
export function stepOneProfileIdFor(selection: ActivitySelection): StepOneProfileId {
  const primary = activityById(selection.primary);
  if (!primary) return 'trajet';
  if (LOCAL_PRACTICE.has(primary.id)) return 'local';
  if (primary.metrics === 'voyage') return 'voyage';
  if (primary.metrics === 'sejour') return 'sejour';
  return 'trajet';
}

/* ------------------------------------------------------------------ */
/* Description d'un profil                                             */
/* ------------------------------------------------------------------ */

/** Ligne du bloc parcours : le libelle exact demande par la maquette. */
export interface StepOneRow {
  field: 'origin' | 'destination';
  label: string;
  icon: string;
}

/** Cellule du bloc calendrier. */
export interface StepOneCell {
  field: 'startDate' | 'duration';
  label: string;
  icon: string;
}

export interface StepOneProfile {
  id: StepOneProfileId;
  /** Une ligne sur un sejour ou une sortie locale, deux sur un trajet. */
  rows: readonly StepOneRow[];
  /** Le lieu unique des profils sejour et local ; `null` quand il y en a deux. */
  singlePlace: 'origin' | 'destination' | null;
  cells: readonly [StepOneCell, StepOneCell];
  /** Appel d'action quand tout est saisi. */
  cta: string;
}

const PROFILES: Readonly<Record<StepOneProfileId, StepOneProfile>> = {
  trajet: {
    id: 'trajet',
    rows: [
      { field: 'origin', label: 'Départ', icon: 'compass' },
      { field: 'destination', label: 'Arrivée', icon: 'flag' },
    ],
    singlePlace: null,
    cells: [
      { field: 'startDate', label: 'Date', icon: 'calendar' },
      { field: 'duration', label: 'Durée estimée', icon: 'clock' },
    ],
    cta: 'Créer mon parcours',
  },
  voyage: {
    id: 'voyage',
    rows: [
      { field: 'origin', label: 'Départ', icon: 'compass' },
      { field: 'destination', label: 'Destination', icon: 'flag' },
    ],
    singlePlace: null,
    cells: [
      { field: 'startDate', label: 'Départ', icon: 'calendar' },
      { field: 'duration', label: 'Retour ou durée', icon: 'calendar' },
    ],
    cta: 'Créer mon parcours',
  },
  sejour: {
    id: 'sejour',
    rows: [
      { field: 'origin', label: 'Lieu de départ', icon: 'compass' },
      { field: 'destination', label: 'Destination ou hébergement de base', icon: 'bed-double' },
    ],
    singlePlace: null,
    cells: [
      { field: 'startDate', label: 'Arrivée', icon: 'calendar' },
      { field: 'duration', label: 'Départ', icon: 'calendar' },
    ],
    cta: 'Créer mon parcours',
  },
  local: {
    id: 'local',
    rows: [{ field: 'origin', label: 'Lieu de pratique', icon: 'compass' }],
    singlePlace: 'origin',
    cells: [
      { field: 'startDate', label: 'Date', icon: 'calendar' },
      { field: 'duration', label: 'Durée indicative', icon: 'droplet' },
    ],
    cta: 'Préparer ma sortie',
  },
};

export function stepOneProfile(id: StepOneProfileId): StepOneProfile {
  return PROFILES[id];
}

/* ------------------------------------------------------------------ */
/* Champs demandes                                                    */
/* ------------------------------------------------------------------ */

export type StepOneFieldKey = 'activity' | 'origin' | 'destination' | 'startDate' | 'duration';

/**
 * L'ecran ne demande que les champs de son profil. Un sejour ne demande pas de
 * lieu de depart, une sortie locale ne demande pas d'arrivee : afficher une
 * question inutile puis la compter comme manquante serait un bug produit.
 */
export function stepOneAskedFields(
  draft: AdventurePrepDraft,
  id: StepOneProfileId
): readonly StepOneFieldKey[] {
  const profile = PROFILES[id];
  const asked: StepOneFieldKey[] = ['activity'];
  // L arrivee reste toujours une question posee : la forme du parcours s en
  // deduit. Ne pas la demander reviendrait a demander « boucle ou aller
  // simple », exactement ce que l utilisateur a refuse.
  for (const row of profile.rows) asked.push(row.field);
  asked.push('startDate', 'duration');
  return asked;
}

function isMissing(draft: AdventurePrepDraft, field: StepOneFieldKey): boolean {
  switch (field) {
    case 'activity':
      // « Partir librement » ferme le catalogue sans exiger d activity : une
      // invite libre en tient lieu. La licenciaire ne doit pas ressurgir.
      return !draft.activities.primary && !draft.pickerDismissed;
    case 'origin':
      return !draft.route.origin;
    case 'destination':
      return !draft.route.destination;
    case 'startDate':
      return draft.calendar.startDate === null;
    case 'duration':
      return !draft.calendar.durationDays || draft.calendar.durationDays <= 0;
  }
}

/* ------------------------------------------------------------------ */
/* Phrase « Il manque : … »                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_LABELS: Readonly<Record<StepOneFieldKey, string>> = {
  activity: 'activité',
  origin: 'lieu de départ',
  destination: 'lieu d’arrivée',
  startDate: 'date',
  duration: 'temps disponible',
};

/**
 * Libelles propres a chaque ecran. Plusieurs champs partagent un libelle
 * (« dates », « dates du sejour ») : la ligne les regroupe alors en un seul.
 */
const PROFILE_LABELS: Readonly<
  Record<StepOneProfileId, Readonly<Partial<Record<StepOneFieldKey, string>>>>
> = {
  trajet: {},
  voyage: { destination: 'destination', startDate: 'dates', duration: 'dates' },
  sejour: {
    destination: 'lieu de base',
    startDate: 'dates du séjour',
    duration: 'dates du séjour',
  },
  local: { origin: 'lieu de pratique', startDate: 'date', duration: 'durée' },
};

/**
 * Phrase unique « Il manque : destination, dates », ou `null` quand tout est
 * saisi. Les valeurs sont listees dans l'ordre du rendu et regroupees : ce que
 * l'utilisateur veut savoir, c'est QUOI corriger.
 */
export function stepOneMissingSummary(
  draft: AdventurePrepDraft,
  id: StepOneProfileId
): string | null {
  const asked = stepOneAskedFields(draft, id);
  const labels: string[] = [];
  for (const field of asked) {
    if (!isMissing(draft, field)) continue;
    const label = PROFILE_LABELS[id][field] ?? DEFAULT_LABELS[field];
    if (!labels.includes(label)) labels.push(label);
  }
  return labels.length === 0 ? null : `Il manque : ${labels.join(', ')}`;
}

/**
 * Champs sans lesquels la generation n'a pas de sens : l INTENTION et le DEPART.
 *
 * Les deux sont lus par `hasEngineMinimum` (engine/steps.ts), qui est le seul
 * verdict_shared par le CTA, le rail et le clic. Les lister ici ne les rend pas
 * bloquants : `ENGINE_BLOCKING` reflete la condition du moteur, et
 * `canCreateStepOne` appelle `blockedByEngine` — donc la liste ne peut pas
 * diverger du comportement.
 *
 * Tous les autres ont un presoeur identifie, et c est
 * precisement la difference entre « la personne ne peut pas avancer » et
 * « l IA n'a pas encore tranche » :
 *
 *   - la DATE : proposee par l IA puis badgee (P0.15). Elle ne peut donc pas
 *     etre exigee, sans quoi on refuserait un parcours qui existe deja ;
 *   - l arrivee : son absence signifie une boucle, pas un trou ;
 *   - l activite du catalogue : « Partir librement » promet un parcours sans
 *     elle, et l invite libre en tient lieu (E02-18) ;
 *   - la DUREE : lue dans le brief (P0.18), puis proposee par l IA a defaut de
 *     choix. Toute la chaine existe — briefRequestedDays, suggestDurationDays,
 *     effectiveDays qui etend le plan a la duree proposee, et le validateur
 *     qui refuse une journee vide plutot que de l afficher. La bloquer
 *     revenait a interdire un chemin deja construit.
 *
 * Mesure du 2026-09-28 qui a ouvert ce fichier : depart et arrivee reellement
 * geocodes, le CTA « Creer mon parcours » restait mort, et les deux seules
 * choses manquantes annoncees etaient « date » et « temps disponible » — dont
 * aucune n'est un obstacle, puisque la consigne dit explicitement que le
 * moment se choisit sans question.
 *
 * Le depart, lui, reste bloquant PARCE QUE le generateur n invente pas de
 * point de depart : requestDraftedItinerary rend une proposition vide sans
 * origin, donc un CTA actif deviendrait un bouton mort — exactement ce que
 * AN7 interdit. Ce n'est pas une contrainte de formulaire, c'est une limite
 * reelle du moteur — meme raison pour l INTENTION : sans activite ET sans
 * « Partir librement », il n y a rien a quoi le modele repondre.
 *
 * En pratique withDefaultOrigin propose deja la position
 * GPS de la personne : le champ ne reste vide que si la geolocalisation est
 * refusee, et la ligne « Il manque : lieu de depart » dit alors quoi faire.
 */
const ENGINE_BLOCKING: readonly StepOneFieldKey[] = ['activity'];

/**
 * Repartition des champs manquants entre ce qui BLOQUE et ce que l IA prend.
 *
 * AN7 : la ligne unique melangeait les deux. L ecran annoncait un arret la ou
 * le CTA etait actif, et l utilisateur ne pouvait plus savoir ce qu il avait a
 * corriger. On mesure une fois, on presente deux fois.
 */
export interface StepOneMissing {
  /** Sans au moins un de ces champs, la generation n a pas de sens. */
  blocking: string[];
  /** Facultatifs : l IA les tranche (date, arrivee, activite du catalogue). */
  optional: string[];
}

export function stepOneMissing(draft: AdventurePrepDraft, id: StepOneProfileId): StepOneMissing {
  const asked = stepOneAskedFields(draft, id);
  const blocking: string[] = [];
  const optional: string[] = [];
  const labelOf = (field: StepOneFieldKey): string =>
    PROFILE_LABELS[id][field] ?? DEFAULT_LABELS[field];

  // Le MOTEUR d'abord, et MEME quand l ecran ne pose pas la question.
  //
  // Un sejour n'affichait pas de lieu de depart : le CTA pouvait donc s'activer
  // sans depart, et le clic ne rien faire puisque `hasEngineMinimum` est faux.
  // La regle : ce que le moteur exige est annonce, toujours ; ce que l ecran
  // demande et que l IA tranchera est annonce aussi, mais en complement.
  for (const field of ENGINE_BLOCKING) {
    if (!isMissing(draft, field)) continue;
    const label = labelOf(field);
    if (!blocking.includes(label)) blocking.push(label);
  }
  // L ACTIVITE quand le catalogue a ete ferme, meme quand l invitation libre
  // tient lieu d'intention.
  //
  // Mesure du 2026-09-28 : avec « Partir librement » et un depart, le CTA
  // devenait actif — et la ligne n'annonçait plus RIEN. Or le moteur fait
  // working : `requestDraftedItinerary` lit l'invite libre et construit un
  // parcours sans activite de catalogue. Sans cette ligne, l'ecran passe du
  // silence « il manque : X » a un silence total, et rien n'explique pourquoi.
  // C'est la meme faute que le bouton actif et mort, dans l'autre sens.
  //
  // LE DEPART n'arrete QUE si l'INTENTION manque, lui aussi.
  //
  // Le depart n'est plus lu par `hasEngineMinimum` : des qu'une intention
  // existe, le moteur construit reellement un parcours sans origine (B4), et
  // nommer le depart comme un arret serait exactement le « bouton actif et
  // mort » qu'AN7 supprime. Mais sur un brouillon VIDE, il n'y a ni sujet ni
  // point de rattachement : sans intention, l'absence d'origine redevient un
  // arret nomme. Des qu'une intention existe, elle passe en facultatif — c'est
  // l'IA (ou personne) qui la tranche, et l'ecran le dira par `optional`.
  if (isMissing(draft, 'activity') && isMissing(draft, 'origin')) {
    const label = labelOf('origin');
    if (!blocking.includes(label)) blocking.push(label);
  }

  // L ACTIVITE quand le catalogue a ete ferme ET que rien ne la bloque deja.
  // Le garde `blocking.includes` est ce qui empeche les deux listes de se
  // melanger : un meme libelle annonce comme arret ET comme complement est un
  // message qui se contredit.
  if (
    !draft.activities.primary &&
    !blocking.includes(labelOf('activity')) &&
    !optional.includes(labelOf('activity'))
  ) {
    optional.push(labelOf('activity'));
  }

  for (const field of asked) {
    if (ENGINE_BLOCKING.includes(field)) continue;
    if (!isMissing(draft, field)) continue;
    const label = labelOf(field);
    // Anti-melange : un champ deja annonce comme arret ne peut pas apparaitre
    // aussitot comme complement. Les deux lignes se contrediraient a l'ecran.
    if (blocking.includes(label)) continue;
    if (!optional.includes(label)) optional.push(label);
  }
  return { blocking, optional };
}

/**
 * Le CTA est actif exactement quand le moteur peut produire un parcours.
 *
 * `hasEngineMinimum` est la MEME condition que `isStepSatisfied(draft,
 * 'destination')` : le rail, la peinture et le clic partagent donc un seul
 * verdict. La liste `blocking` n'est plus qu'une maniere de NOMMER ce verdict
 * a l'ecran ; c'est `blockedByEngine` qui decide.
 */
export function blockedByEngine(draft: AdventurePrepDraft): boolean {
  return !hasEngineMinimum(draft);
}

export function canCreateStepOne(draft: AdventurePrepDraft): boolean {
  return !blockedByEngine(draft);
}

/**
 * Ce que l IA.complete toute seule. Annonce quand le CTA est actif, JAMAIS
 * quand il ne l est pas : promettre un complement alors qu un bloqueur subsiste
 * est precisement la confusion que AN7 supprime.
 */
export function stepOneReadySummary(
  draft: AdventurePrepDraft,
  id: StepOneProfileId
): string | null {
  const { blocking, optional } = stepOneMissing(draft, id);
  if (blocking.length > 0 || optional.length === 0) return null;
  return `L’IA complètera : ${optional.join(', ')}`;
}
