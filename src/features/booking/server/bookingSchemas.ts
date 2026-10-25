import { z } from 'zod';
import { BOOKING_PROVIDER_ERROR_CODES, BookingProviderError } from './bookingProviderErrors';
import type { BookingSearchRequest } from './bookingProviderTypes';

const dateSchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Date calendaire attendue au format YYYY-MM-DD');
const dateTimeSchema = z.string().datetime({ offset: true });
const travelersSchema = z.number().int().min(1).max(20).default(1);
const currencySchema = z.string().regex(/^[A-Z]{3}$/).default('EUR');
const limitSchema = z.number().int().min(1).max(20).default(5);

const common = {
  travelers: travelersSchema,
  currency: currencySchema,
  limit: limitSchema,
};

const flightSchema = z
  .object({
    ...common,
    vertical: z.literal('flight'),
    origin: z.string().trim().min(2).max(120),
    destination: z.string().trim().min(2).max(120),
    departure: dateSchema,
    return: dateSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.return && value.return <= value.departure) {
      context.addIssue({ code: 'custom', path: ['return'], message: 'Le retour doit être après le départ.' });
    }
  });

const hotelSchema = z
  .object({
    ...common,
    vertical: z.literal('hotel'),
    destination: z.string().trim().min(2).max(120),
    checkIn: dateSchema,
    checkOut: dateSchema,
  })
  .superRefine((value, context) => {
    if (value.checkOut <= value.checkIn) {
      context.addIssue({ code: 'custom', path: ['checkOut'], message: 'La sortie doit être après l’arrivée.' });
    }
  });

const carSchema = z
  .object({
    ...common,
    vertical: z.literal('car'),
    destination: z.string().trim().min(2).max(120),
    pickupAt: dateTimeSchema,
    dropoffAt: dateTimeSchema,
  })
  .superRefine((value, context) => {
    if (value.dropoffAt <= value.pickupAt) {
      context.addIssue({ code: 'custom', path: ['dropoffAt'], message: 'Le retour doit être après le départ.' });
    }
  });

const activitySchema = z.object({
  ...common,
  vertical: z.literal('activity'),
  destination: z.string().trim().min(2).max(120),
  date: dateSchema,
});

export const bookingSearchRequestSchema = z.discriminatedUnion('vertical', [
  flightSchema,
  hotelSchema,
  carSchema,
  activitySchema,
]);

export function validateBookingSearchRequest(request: BookingSearchRequest): BookingSearchRequest {
  const parsed = bookingSearchRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new BookingProviderError({
      code: BOOKING_PROVIDER_ERROR_CODES.validation,
      message: 'Requête de réservation invalide.',
      cause: parsed.error,
    });
  }
  return parsed.data as BookingSearchRequest;
}
