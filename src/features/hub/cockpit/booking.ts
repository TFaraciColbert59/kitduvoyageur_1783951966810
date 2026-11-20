import { buildStepBookingLink } from '@/features/affiliation/engine/stepBookingLink';
import type { PublicBooking } from '@/features/booking/server/bookingPersistence';
import type { CockpitReservation } from './model';
import type { HubAdventureData } from '../server/getHubAdventureData';
import type { TripStep } from '@/features/trips/types/trip.types';

type ReservationStep = Pick<TripStep, 'id' | 'title' | 'day_number'> &
  Partial<Pick<TripStep, 'location_name' | 'accommodation_name' | 'transport_mode' | 'metadata'>>;
type ReservationTrip = { destination_name: string | null; steps: ReservationStep[] };

function dateField(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) return null;
  const date = value.slice(0, 10);
  const parsed = new Date(date);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

const BOOKING_TITLES: Record<string, string> = {
  flight: 'Vol', hotel: 'Hébergement', car: 'Véhicule', activity: 'Activité',
};

export function buildCockpitReservations(
  { trip, bookingByStepId }: Pick<HubAdventureData, 'bookingByStepId'> & { trip: ReservationTrip | null },
  rows: Pick<PublicBooking, 'id' | 'vertical' | 'status' | 'metadata'>[],
): CockpitReservation[] {
  if (!trip) return [];
  const bookings: CockpitReservation[] = rows
    .filter(({ status }) => ['draft', 'pending', 'held'].includes(status))
    .map(({ id, vertical, status, metadata }) => ({
      id,
      title: typeof metadata.title === 'string' && metadata.title.trim() ? metadata.title : BOOKING_TITLES[vertical] ?? 'Réservation',
      status: status === 'draft' ? 'À réserver' : 'En attente',
      due: dateField(metadata.due_at),
      when: dateField(metadata.start_date),
      stepId: typeof metadata.step_id === 'string' ? metadata.step_id : undefined,
    }));
  const covered = new Set(rows
    .filter(({ status }) => ['draft', 'pending', 'held', 'confirmed'].includes(status))
    .map(({ metadata }) => metadata.step_id));
  for (const step of trip.steps) {
    if (covered.has(step.id) || step.metadata?.booking_status === 'confirmed' || step.metadata?.booking_required === false) continue;
    const required = step.metadata?.booking_required === true;
    const suggestFromItinerary = Boolean(step.accommodation_name) || ['plane', 'train', 'bus', 'boat'].includes(step.transport_mode ?? '');
    if (!required && !suggestFromItinerary) continue;
    const suggestion = buildStepBookingLink({
      accommodationName: step.accommodation_name,
      transportMode: step.transport_mode,
      dayNumber: step.day_number,
    }, { destinationName: step.location_name ?? trip.destination_name ?? '' });
    bookings.push({
      id: `step-${step.id}`,
      title: suggestion?.label ?? step.title,
      status: required ? 'À réserver' : 'À vérifier',
      due: dateField(step.metadata?.booking_due_at),
      stepId: step.id,
      partnerSlug: bookingByStepId[step.id]?.slug,
    });
  }
  return bookings.sort((a, b) =>
    (a.due ?? '9999').localeCompare(b.due ?? '9999') ||
    (a.when ?? '9999').localeCompare(b.when ?? '9999') || a.title.localeCompare(b.title, 'fr') || a.id.localeCompare(b.id));
}
