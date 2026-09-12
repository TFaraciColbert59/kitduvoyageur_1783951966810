'use client';

// Hub live (§4.5) — bus d'arrivées d'activité. Les événements sont émis par
// ActivityLiveBridge (canal Supabase dédié `hub-live-bridge`) sur window :
//   CustomEvent('lkdv:activity-arrival', { detail: { table, id, eventType } })
// Le hook déduplique par couple table:id (Set) puis dérive la phase de
// préparation. Aucun abonnement realtime supplémentaire : un seul canal dédié.
// T10 fix — `eventType` distingue INSERT (reveal de rangée) et UPDATE (écho
// d'une action locale : compteurs/phase seulement, jamais de reveal).
import { useEffect, useMemo, useState } from 'react';

export interface ActivityArrival {
  /** Nom réel de la table publique (trip_steps, trip_pois, …). */
  table: string;
  /** Id de la ligne insérée/mise à jour. */
  id: string;
  /**
   * T10 fix — type d'événement realtime. Seuls les INSERT déclenchent un
   * reveal de rangée ; un UPDATE (écho de sa propre action) met à jour les
   * compteurs/phase sans animer une rangée déjà à l'écran.
   */
  eventType: ActivityArrivalEventType;
}

export type ActivityArrivalEventType = 'INSERT' | 'UPDATE';

export type ActivityPreparationPhase =
  'waiting' | 'itinerary' | 'moments' | 'affiliation' | 'kit' | 'done';

/** Bassins d'arrivées du rail de préparation. */
export interface ActivityArrivalCounts {
  /** trip_steps → itinéraire. */
  steps: number;
  /** trip_pois → moments de la carte. */
  moments: number;
  /** trip_expenses → transports & hébergements (affiliation). */
  affiliation: number;
  /** trip_items + trip_checklist_items → kit. */
  kit: number;
}

export interface ActivityArrivalState {
  seen: Set<string>;
  arrivals: ActivityArrival[];
}

export interface ActivityLiveArrivals {
  arrivals: ActivityArrival[];
  phase: ActivityPreparationPhase;
}

export const ACTIVITY_ARRIVAL_EVENT = 'lkdv:activity-arrival';

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

/** Mappe une table du bus vers son bassin (null = ignorée). */
export function bucketForTable(table: string): keyof ActivityArrivalCounts | null {
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

export function countArrivals(arrivals: readonly ActivityArrival[]): ActivityArrivalCounts {
  const counts: ActivityArrivalCounts = { steps: 0, moments: 0, affiliation: 0, kit: 0 };
  for (const arrival of arrivals) {
    const bucket = bucketForTable(arrival.table);
    if (bucket) counts[bucket] += 1;
  }
  return counts;
}

/** Clé de déduplication : un id peut exister dans plusieurs tables. */
export function arrivalKey(arrival: ActivityArrival): string {
  return `${arrival.table}:${arrival.id}`;
}

/**
 * T10 fix — seuls les INSERT révèlent une rangée. Un UPDATE doit continuer à
 * nourrir la phase/les compteurs (arrivée comptée) mais jamais animer une
 * rangée déjà rendue (écho de l'action locale, focus préservé).
 */
export function shouldRevealArrival(arrival: ActivityArrival): boolean {
  return arrival.eventType === 'INSERT';
}

export function createArrivalState(): ActivityArrivalState {
  return { seen: new Set<string>(), arrivals: [] };
}

/**
 * Réducteur pur : renvoie l'état inchangé (même référence) si l'id a déjà
 * été vu — aucune ré-émission.
 */
export function recordActivityArrival(
  state: ActivityArrivalState,
  arrival: ActivityArrival
): ActivityArrivalState {
  const key = arrivalKey(arrival);
  if (state.seen.has(key)) return state;
  const seen = new Set(state.seen);
  seen.add(key);
  return { seen, arrivals: [...state.arrivals, arrival] };
}

/** Garde de forme pour les détails d'événement window non fiables. */
export function isActivityArrival(value: unknown): value is ActivityArrival {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { table?: unknown; id?: unknown; eventType?: unknown };
  return (
    typeof candidate.table === 'string' &&
    candidate.table.length > 0 &&
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    (candidate.eventType === 'INSERT' || candidate.eventType === 'UPDATE')
  );
}

/**
 * Consomme le bus window : `{ arrivals, phase }`.
 * StrictMode-safe (listener retiré au cleanup), aucun canal realtime ici.
 */
export function useActivityLiveArrivals(): ActivityLiveArrivals {
  const [state, setState] = useState<ActivityArrivalState>(createArrivalState);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onArrival = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isActivityArrival(detail)) return;
      setState((previous) => recordActivityArrival(previous, detail));
    };

    window.addEventListener(ACTIVITY_ARRIVAL_EVENT, onArrival);
    return () => window.removeEventListener(ACTIVITY_ARRIVAL_EVENT, onArrival);
  }, []);

  const counts = useMemo(() => countArrivals(state.arrivals), [state.arrivals]);
  const phase = useMemo(() => derivePreparationPhase(counts), [counts]);

  return { arrivals: state.arrivals, phase };
}

export default useActivityLiveArrivals;
