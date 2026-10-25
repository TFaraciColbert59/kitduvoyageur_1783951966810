// Hub live (§4.5) — cœur pur du rail de préparation. Module neutre (ni 'use
// client' ni 'use server') : partagé par le composant client
// ActivityPreparationStatus, le pont realtime, le chargeur serveur du hub et
// l'aperçu dev, sans référence client.
//
// Fix round final — le rail ne se termine jamais sur un voyage enrichi : le job
// LLM n'écrit aucune dépense (affiliation) et les compteurs serveur manquaient.
// Ce module porte donc : le calcul de bassin par ligne (une étape portant
// hébergement/transport nourrit `affiliation`), la fusion compteurs serveur +
// bus live, et la phase dérivée qui rend `done` dès que l'enrichissement est
// terminé côté serveur.

export type ActivityPreparationPhase =
  | 'waiting'
  | 'itinerary'
  | 'moments'
  | 'affiliation'
  | 'kit'
  | 'done';

/** Bassins d'arrivées du rail de préparation. */
export type ActivityArrivalBucket = 'steps' | 'moments' | 'affiliation' | 'kit';

export interface ActivityArrivalCounts {
  /** trip_steps → itinéraire. */
  steps: number;
  /** trip_pois → moments de la carte. */
  moments: number;
  /** trip_expenses + trip_steps portant hébergement/transport → affiliation. */
  affiliation: number;
  /** trip_items + trip_checklist_items → kit. */
  kit: number;
}

export const EMPTY_ARRIVAL_COUNTS: ActivityArrivalCounts = {
  steps: 0,
  moments: 0,
  affiliation: 0,
  kit: 0,
};

/** État d'enrichissement serveur (`trips.metadata.enrichment_status`). */
export type EnrichmentStatus = 'pending' | 'done' | 'failed';

export function isEnrichmentStatus(value: unknown): value is EnrichmentStatus {
  return value === 'pending' || value === 'done' || value === 'failed';
}

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

/** Mappe une table du bus vers son bassin (null = ignorée). */
export function bucketForTable(table: string): ActivityArrivalBucket | null {
  switch (table) {
    case 'trip_steps':
      return 'steps';
    case 'trip_pois':
      return 'moments';
    case 'trip_expenses':
      return 'affiliation';
    case 'trip_items':
    case 'trip_checklist_items':
      return 'kit';
    default:
      return null;
  }
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Mappe une ligne realtime vers son bassin. Une étape portant un hébergement ou
 * un mode de transport nourrit `affiliation` (signal « Transports &
 * hébergements ») ; les autres étapes nourrissent `itinerary`.
 */
export function bucketForRow(
  table: string,
  row?: { accommodation_name?: unknown; transport_mode?: unknown } | null
): ActivityArrivalBucket | null {
  if (table === 'trip_steps') {
    const accommodation = isNonEmptyString(row?.accommodation_name);
    const transport = isNonEmptyString(row?.transport_mode);
    return accommodation || transport ? 'affiliation' : 'steps';
  }
  return bucketForTable(table);
}

/** Arrivée minimale nécessaire au comptage (bus window ou ligne BDD). */
export interface BucketedArrival {
  table: string;
  bucket?: ActivityArrivalBucket | null;
}

/** Bassin d'une arrivée : `bucket` explicite prioritaire, sinon la table. */
export function bucketForArrival(arrival: BucketedArrival): ActivityArrivalBucket | null {
  return arrival.bucket ?? bucketForTable(arrival.table);
}

/**
 * Seuils exacts de dérivation de la phase (ordre du rail §4.5) :
 * 1. aucun bassin > 0 → `waiting` ;
 * 2. les quatre bassins > 0 → `done` (préparation servie intégralement) ;
 * 3. sinon la phase = dernier bassin servi, du plus avancé au moins avancé :
 *    `kit` > 0 → kit (y compris arrivée hors ordre), sinon `affiliation` > 0,
 *    sinon `moments` > 0, sinon `itinerary` (steps > 0).
 */
export function derivePreparationPhase(counts: ActivityArrivalCounts): ActivityPreparationPhase {
  const { steps, moments, affiliation, kit } = counts;

  if (steps <= 0 && moments <= 0 && affiliation <= 0 && kit <= 0) return 'waiting';
  if (steps > 0 && moments > 0 && affiliation > 0 && kit > 0) return 'done';
  if (kit > 0) return 'kit';
  if (affiliation > 0) return 'affiliation';
  if (moments > 0) return 'moments';
  return 'itinerary';
}

/**
 * Fusion des compteurs serveur (état réel au premier paint) et des arrivées du
 * bus live : max par bassin — un rafraîchissement serveur ne double jamais un
 * compteur déjà couvert par le bus, et une arrivée nouvelle avance la phase.
 */
export function mergePreparationCounts(
  server: ActivityArrivalCounts,
  live: ActivityArrivalCounts
): ActivityArrivalCounts {
  return {
    steps: Math.max(server.steps, live.steps),
    moments: Math.max(server.moments, live.moments),
    affiliation: Math.max(server.affiliation, live.affiliation),
    kit: Math.max(server.kit, live.kit),
  };
}

/**
 * Phase du rail pour un état de préparation : `done` dès que l'enrichissement
 * serveur est terminé (même sans dépense — le job LLM n'écrit aucun montant),
 * sinon dérivation par bassins (les quatre > 0 → done).
 */
export function preparationPhase(
  counts: ActivityArrivalCounts,
  enrichmentStatus: EnrichmentStatus | null | undefined
): ActivityPreparationPhase {
  if (enrichmentStatus === 'done') return 'done';
  return derivePreparationPhase(counts);
}
