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
  /** Une boucle n'a de sens que sur un trajet : ailleurs la forme est imposée. */
  showRouteShape: boolean;
  cells: readonly [StepOneCell, StepOneCell];
  /** Appel d'action quand tout est saisi. */
  cta: string;
}

const PROFILES: Readonly<Record<StepOneProfileId, StepOneProfile>> = {
  trajet: {
    id: 'trajet',
    rows: [
      { field: 'origin', label: 'Départ', icon: 'map-pin' },
      { field: 'destination', label: 'Arrivée', icon: 'flag' },
    ],
    singlePlace: null,
    showRouteShape: true,
    cells: [
      { field: 'startDate', label: 'Date', icon: 'calendar' },
      { field: 'duration', label: 'Temps disponible', icon: 'clock' },
    ],
    cta: 'Créer mon parcours',
  },
  voyage: {
    id: 'voyage',
    rows: [
      { field: 'origin', label: 'Départ', icon: 'map-pin' },
      { field: 'destination', label: 'Destination', icon: 'flag' },
    ],
    singlePlace: null,
    showRouteShape: false,
    cells: [
      { field: 'startDate', label: 'Départ', icon: 'calendar' },
      { field: 'duration', label: 'Retour ou durée', icon: 'calendar' },
    ],
    cta: 'Créer mon parcours',
  },
  sejour: {
    id: 'sejour',
    rows: [
      { field: 'destination', label: 'Destination ou hébergement de base', icon: 'bed-double' },
    ],
    singlePlace: 'destination',
    showRouteShape: false,
    cells: [
      { field: 'startDate', label: 'Arrivée', icon: 'calendar' },
      { field: 'duration', label: 'Départ', icon: 'calendar' },
    ],
    cta: 'Créer mon parcours',
  },
  local: {
    id: 'local',
    rows: [{ field: 'origin', label: 'Lieu de pratique', icon: 'map-pin' }],
    singlePlace: 'origin',
    showRouteShape: false,
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
  id: StepOneProfileId,
): readonly StepOneFieldKey[] {
  const profile = PROFILES[id];
  const asked: StepOneFieldKey[] = ['activity'];
  for (const row of profile.rows) {
    // Sur un trajet en boucle, le retour se derive du depart : une arrivee
    // distincte n existe pas, donc elle n'est pas demandee.
    const loopHasNoEnd = id === 'trajet' && draft.route.shape === 'boucle';
    if (row.field === 'destination' && loopHasNoEnd) continue;
    asked.push(row.field);
  }
  asked.push('startDate', 'duration');
  return asked;
}

function isMissing(draft: AdventurePrepDraft, field: StepOneFieldKey): boolean {
  switch (field) {
    case 'activity':
      return !draft.activities.primary;
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
  id: StepOneProfileId,
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
 * Champs sans lesquels la generation n'a pas de sens. La date seule ne bloque
 * jamais : une aventure sans date reste realisable, elle se confirme plus tard.
 */
const BLOCKING: ReadonlySet<StepOneFieldKey> = new Set<StepOneFieldKey>([
  'activity',
  'origin',
  'destination',
  'duration',
]);

export function canCreateStepOne(draft: AdventurePrepDraft, id: StepOneProfileId): boolean {
  return stepOneAskedFields(draft, id).every(
    (field) => BLOCKING.has(field) === false || !isMissing(draft, field),
  );
}
