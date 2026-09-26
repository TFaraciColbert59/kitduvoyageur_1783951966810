import type { BookingSearchRequest, BookingVertical } from '@/features/booking/server/bookingProviderTypes';

export interface BookingSearchContext {
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
}

export interface BookingRequestBuildResult {
  request: BookingSearchRequest | null;
  error: string | null;
}

function isoAtLocalTime(date: string, hour: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Construit une requête de recherche.context ; aucune donnée n'est inventée. */
export function buildBookingRequest(
  vertical: BookingVertical,
  context: BookingSearchContext,
): BookingRequestBuildResult {
  const destination = context.destination.trim();
  const origin = context.origin.trim();
  const start = context.startDate;
  const end = context.endDate;
  const travelers = Math.max(1, Math.min(20, Math.floor(context.travelers) || 1));

  if (!destination) return { request: null, error: 'Ajoutez une destination.' };

  if (vertical === 'flight') {
    if (!origin) return { request: null, error: 'Ajoutez une ville de départ.' };
    if (!start) return { request: null, error: 'Ajoutez une date de départ.' };
    if (end && end <= start) return { request: null, error: 'La date de retour doit être après le départ.' };
    return {
      request: {
        vertical,
        origin,
        destination,
        departure: start,
        ...(end ? { return: end } : {}),
        travelers,
        currency: 'EUR',
        limit: 5,
      },
      error: null,
    };
  }

  if (vertical === 'hotel') {
    if (!start || !end) return { request: null, error: 'Ajoutez les dates de séjour.' };
    if (end <= start) return { request: null, error: 'La sortie doit être après l’arrivée.' };
    return {
      request: { vertical, destination, checkIn: start, checkOut: end, travelers, currency: 'EUR', limit: 5 },
      error: null,
    };
  }

  if (vertical === 'car') {
    const pickupAt = isoAtLocalTime(start, 10);
    const dropoffAt = isoAtLocalTime(end, 10);
    if (!pickupAt || !dropoffAt) return { request: null, error: 'Ajoutez les dates de location.' };
    if (dropoffAt <= pickupAt) return { request: null, error: 'La restitution doit être après la prise.' };
    return {
      request: { vertical, destination, pickupAt, dropoffAt, travelers, currency: 'EUR', limit: 5 },
      error: null,
    };
  }

  if (!start) return { request: null, error: 'Ajoutez une date d’activité.' };
  return {
    request: { vertical: 'activity', destination, date: start, travelers, currency: 'EUR', limit: 5 },
    error: null,
  };
}
