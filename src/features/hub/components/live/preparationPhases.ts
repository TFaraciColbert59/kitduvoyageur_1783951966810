// Hub live (§4.5) — cœur pur du rail de préparation. Module neutre (ni 'use
// client' ni 'use server') : partagé par le composant client
// ActivityPreparationStatus et par l'aperçu dev, sans référence client.
import type {
  ActivityArrivalCounts,
  ActivityPreparationPhase,
} from './useActivityLiveArrivals';

export interface PreparationPhaseDef {
  key: ActivityPreparationPhase;
  label: string;
}

/** Ordre canonique du rail (spec §4.5). */
export const PREPARATION_PHASES: readonly PreparationPhaseDef[] = [
  { key: 'waiting', label: 'Analyse' },
  { key: 'itinerary', label: 'Itinéraire' },
  { key: 'moments', label: 'Moments' },
  { key: 'affiliation', label: 'Transports & hébergements' },
  { key: 'kit', label: 'Kit' },
  { key: 'done', label: 'Finitions' },
];

/** Ressort snappy de la coche (§4.5 : 500/25). */
export const RAIL_CHECK_SPRING = { stiffness: 500, damping: 25 } as const;

/** Anti-rafale haptique : au plus une `success` par 800 ms toutes instances. */
export const SUCCESS_HAPTIC_INTERVAL_MS = 800;

/** Nombre de phases terminées : `done` = les 6, sinon l'index de la phase. */
export function completedPhaseCount(phase: ActivityPreparationPhase): number {
  if (phase === 'done') return PREPARATION_PHASES.length;
  const index = PREPARATION_PHASES.findIndex((definition) => definition.key === phase);
  return index < 0 ? 0 : index;
}

/** Compteurs de démonstration de l'aperçu dev — jamais utilisés en prod. */
export function fixtureCountsForPhase(phase: ActivityPreparationPhase): ActivityArrivalCounts {
  switch (phase) {
    case 'waiting':
      return { steps: 0, moments: 0, affiliation: 0, kit: 0 };
    case 'itinerary':
      return { steps: 3, moments: 0, affiliation: 0, kit: 0 };
    case 'moments':
      return { steps: 3, moments: 2, affiliation: 0, kit: 0 };
    case 'affiliation':
      return { steps: 3, moments: 2, affiliation: 1, kit: 0 };
    case 'kit':
      return { steps: 3, moments: 2, affiliation: 1, kit: 4 };
    case 'done':
      return { steps: 3, moments: 2, affiliation: 1, kit: 4 };
  }
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

const PHASE_IN_PROGRESS: Record<ActivityPreparationPhase, string> = {
  waiting: 'Analyse en cours',
  itinerary: 'Itinéraire en cours',
  moments: 'Moments en cours',
  affiliation: 'Transports & hébergements en cours',
  kit: 'Kit en cours',
  done: 'Préparation prête',
};

/** Texte annoncé par la région `aria-live` du rail. */
export function preparationAnnouncement(
  phase: ActivityPreparationPhase,
  counts: ActivityArrivalCounts
): string {
  if (phase === 'done') return 'Préparation prête';
  if (phase === 'waiting') return PHASE_IN_PROGRESS.waiting;
  if (phase === 'itinerary') {
    return counts.steps > 0
      ? plural(counts.steps, 'étape ajoutée', 'étapes ajoutées')
      : PHASE_IN_PROGRESS.itinerary;
  }
  if (phase === 'moments') {
    return counts.moments > 0
      ? plural(counts.moments, 'moment ajouté', 'moments ajoutés')
      : PHASE_IN_PROGRESS.moments;
  }
  if (phase === 'affiliation') {
    return counts.affiliation > 0
      ? plural(
          counts.affiliation,
          'transport & hébergement ajouté',
          'transports & hébergements ajoutés'
        )
      : PHASE_IN_PROGRESS.affiliation;
  }
  return counts.kit > 0
    ? plural(counts.kit, 'élément de kit ajouté', 'éléments de kit ajoutés')
    : PHASE_IN_PROGRESS.kit;
}
