/**
 * Task 8 — Liens de réservation par étape (pur, déterministe).
 *
 * Ce module ne construit JAMAIS d'URL : il expose seulement l'intention de
 * réservation (`category`, `label`, `searchTerms`). L'URL de suivi `/go/<slug>`
 * reste construite au rendu par les composants d'affiliation existants
 * (`AffiliateLinkCard`), qui portent `rel="sponsored nofollow"`.
 *
 * Les restaurants sont volontairement exclus : aucun programme d'affiliation
 * associé (documenté dans la spec §4.4).
 */

export type StepBookingCategory = 'hotel' | 'flight';

export interface StepBookingSuggestion {
  category: StepBookingCategory;
  label: string;
  searchTerms: string;
}

export interface StepBookingInput {
  accommodationName?: string | null;
  transportMode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  dayNumber: number;
}

export interface StepBookingContext {
  destinationName: string;
  startDate?: string | null;
  endDate?: string | null;
}

/** Modes de transport couverts par le comparateur vols/train (Aviasales). */
const FLIGHT_TRANSPORT_MODES = new Set(['plane', 'train']);

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Dérive une intention de réservation affiliée depuis une étape de voyage.
 * - `accommodation_name` → catégorie `hotel` (Booking), recherche hébergement + destination.
 * - `transport_mode` `plane` | `train` → catégorie `flight`, recherche destination.
 * - sinon `null` (rien à réserver, rien n'est inventé).
 */
export function buildStepBookingLink(
  step: StepBookingInput,
  context: StepBookingContext
): StepBookingSuggestion | null {
  const destination = normalize(context.destinationName);
  const accommodation = normalize(step.accommodationName);

  if (accommodation) {
    return {
      category: 'hotel',
      label: `Hébergement — ${accommodation}`,
      searchTerms: [accommodation, destination].filter(Boolean).join(' '),
    };
  }

  const mode = normalize(step.transportMode).toLowerCase();
  if (FLIGHT_TRANSPORT_MODES.has(mode)) {
    const modeLabel = mode === 'train' ? 'Train' : 'Vol';
    return {
      category: 'flight',
      label: destination ? `${modeLabel} vers ${destination}` : modeLabel,
      searchTerms: destination,
    };
  }

  return null;
}

export interface StepBookingSource extends StepBookingInput {
  id: string;
}

/** Indexe les intentions de réservation par id d'étape (les étapes vides sont omises). */
export function buildBookingByStepId(
  steps: readonly StepBookingSource[],
  context: StepBookingContext
): Record<string, StepBookingSuggestion> {
  const out: Record<string, StepBookingSuggestion> = {};

  for (const step of steps) {
    const suggestion = buildStepBookingLink(step, context);
    if (suggestion) {
      out[step.id] = suggestion;
    }
  }

  return out;
}
