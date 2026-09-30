/**
 * Chantier configurateur — l'échelle d'une aventure, de 1 h à un mois.
 *
 * Module PUR. Un seul préparateur sert une course d'une heure et un voyage de
 * trente jours : ce qui change, c'est la PROFONDEUR (questions posées,
 * sections montrées, stratégie de génération), pas le modèle de plan.
 *
 * La durée n'est pas le seul critère : une sortie courte en terrain engagé
 * (alpinisme, ski de randonnée, eau) demande plus de préparation qu'un
 * séjour urbain simple. Le terrain relève donc la profondeur, jamais l'inverse.
 */
import { activityById } from '../catalog';
import type { AdventurePrepDraft } from '../types';

export type AdventureScale = 'sortie' | 'journee' | 'itinerance' | 'voyage';

export const ADVENTURE_SCALE_LABELS: Readonly<Record<AdventureScale, string>> = {
  sortie: 'Sortie',
  journee: 'Journée',
  itinerance: 'Itinérance',
  voyage: 'Voyage',
};

/** Sections du préparateur, dans l'ordre d'affichage. */
export type PrepSection =
  | 'parcours'
  | 'conditions'
  | 'essentiels'
  | 'sac'
  | 'eau_repas'
  | 'nuitees'
  | 'groupe'
  | 'budget'
  | 'transports'
  | 'reservations'
  | 'documents'
  | 'hors_ligne';

/** Questions qui peuvent changer la proposition (jamais posées pour la forme). */
export type PrepQuestion =
  | 'depart'
  | 'duree'
  | 'heure_retour'
  | 'effort'
  | 'participants'
  | 'acces'
  | 'dates'
  | 'nuitees'
  | 'budget'
  | 'regions'
  | 'rythme'
  | 'contraintes_fixes';

/**
 * Stratégie de génération IA :
 * - `direct`  : un appel borné produit le plan complet (courte durée) ;
 * - `ossature_puis_jours` : un squelette (liaisons, nuitées) puis
 *   l'enrichissement des jours à la demande — jamais un méga-prompt de 30 jours.
 */
export type GenerationStrategy = 'direct' | 'ossature_puis_jours';

export interface ScaleProfile {
  scale: AdventureScale;
  /** Terrain engagé : relève les exigences même pour une sortie courte. */
  engagedTerrain: boolean;
  questions: readonly PrepQuestion[];
  sections: readonly PrepSection[];
  generation: GenerationStrategy;
  /** Nombre de jours enrichis dans le premier passage IA. */
  initialDetailedDays: number;
  /** Le rail des jours n'a de sens qu'à partir de deux jours. */
  showDayRail: boolean;
  /** Au-delà de 10 jours, le rail se regroupe par semaine. */
  groupDaysByWeek: boolean;
  /** Météo : prévision si l'horizon la couvre, sinon tendance assumée. */
  weatherMode: 'prevision' | 'prevision_puis_tendance';
}

/** Catégories où une erreur d'appréciation coûte cher, quelle que soit la durée. */
const ENGAGED_CATEGORIES = new Set(['neige_montagne', 'eau']);
const ENGAGED_ACTIVITIES = new Set(['alpinisme', 'escalade', 'parapente', 'plongee-autonome']);

const WEATHER_FORECAST_DAYS = 7;

function hasEngagedTerrain(draft: AdventurePrepDraft): boolean {
  const ids = [draft.activities.primary, ...draft.activities.extra].filter(
    (id): id is string => Boolean(id)
  );
  return ids.some((id) => {
    if (ENGAGED_ACTIVITIES.has(id)) return true;
    const activity = activityById(id);
    return activity ? ENGAGED_CATEGORIES.has(activity.category) : false;
  });
}

/**
 * Durée effective en heures : la durée saisie en jours prime ; sinon la durée
 * suggérée par l'activité principale. `null` si rien ne permet de la connaître.
 */
export function effectiveDurationHours(draft: AdventurePrepDraft): number | null {
  const days = draft.calendar.durationDays;
  if (typeof days === 'number' && Number.isFinite(days) && days >= 1) {
    // Un jour déclaré n'est pas 24 h d'effort : on garde la journée comme unité.
    return days === 1 ? 10 : days * 24;
  }
  const primary = activityById(draft.activities.primary);
  return primary ? primary.suggestedDurationHours : null;
}

function isTravel(draft: AdventurePrepDraft): boolean {
  const primary = activityById(draft.activities.primary);
  return primary?.category === 'voyage_sejour';
}

export function resolveAdventureScale(draft: AdventurePrepDraft): AdventureScale {
  const days = draft.calendar.durationDays;
  const hasNights = draft.activities.nights.length > 0;
  if (typeof days === 'number' && days >= 8) return 'voyage';
  if (isTravel(draft) && typeof days === 'number' && days >= 2) return 'voyage';
  if ((typeof days === 'number' && days >= 2) || hasNights) return 'itinerance';
  const hours = effectiveDurationHours(draft);
  if (hours !== null && hours <= 3) return 'sortie';
  return 'journee';
}

const BASE_SECTIONS: Readonly<Record<AdventureScale, readonly PrepSection[]>> = {
  sortie: ['parcours', 'conditions', 'essentiels'],
  journee: ['parcours', 'conditions', 'sac', 'eau_repas', 'groupe'],
  itinerance: ['parcours', 'conditions', 'sac', 'eau_repas', 'nuitees', 'groupe', 'budget', 'hors_ligne'],
  voyage: [
    'parcours',
    'transports',
    'nuitees',
    'reservations',
    'conditions',
    'sac',
    'groupe',
    'budget',
    'documents',
    'hors_ligne',
  ],
};

const BASE_QUESTIONS: Readonly<Record<AdventureScale, readonly PrepQuestion[]>> = {
  sortie: ['depart', 'duree', 'heure_retour', 'effort'],
  journee: ['depart', 'participants', 'acces', 'heure_retour'],
  itinerance: ['dates', 'nuitees', 'participants', 'budget'],
  voyage: ['regions', 'dates', 'rythme', 'contraintes_fixes', 'budget'],
};

function withSection(list: readonly PrepSection[], section: PrepSection): PrepSection[] {
  return list.includes(section) ? [...list] : [...list, section];
}

/** Profil complet : ce que le préparateur demande, montre et génère. */
export function scaleProfile(draft: AdventurePrepDraft): ScaleProfile {
  const scale = resolveAdventureScale(draft);
  const engagedTerrain = hasEngagedTerrain(draft);
  const days = Math.max(1, Math.round(draft.calendar.durationDays ?? 1));

  let sections: PrepSection[] = [...BASE_SECTIONS[scale]];
  if (engagedTerrain) {
    // Terrain engagé : sac complet et hors ligne, même pour une heure.
    sections = withSection(sections, 'sac');
    sections = withSection(sections, 'hors_ligne');
    sections = sections.filter((section) => section !== 'essentiels');
  }
  if (draft.group.adults + draft.group.children > 1) {
    sections = withSection(sections, 'groupe');
  }

  const generation: GenerationStrategy = days > 5 ? 'ossature_puis_jours' : 'direct';

  return {
    scale,
    engagedTerrain,
    questions: BASE_QUESTIONS[scale],
    sections,
    generation,
    initialDetailedDays: generation === 'direct' ? days : Math.min(3, days),
    showDayRail: days >= 2,
    groupDaysByWeek: days > 10,
    weatherMode: days > WEATHER_FORECAST_DAYS ? 'prevision_puis_tendance' : 'prevision',
  };
}
