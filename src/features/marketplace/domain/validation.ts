import { z } from 'zod';
const cents = z.number().int().min(0).max(100000000);
export const listingSchema = z
  .object({
    item_id: z.string().uuid(),
    description: z.string().trim().min(10).max(2000),
    public_location: z.string().trim().min(2).max(100),
    price_cents: cents,
    deposit_cents: cents.optional(),
  })
  .strict();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    'Date invalide'
  );
export const requestSchema = z
  .object({ listing_id: z.string().uuid(), start_date: date.optional(), end_date: date.optional() })
  .strict()
  .refine(
    (v) =>
      (!v.start_date && !v.end_date) ||
      (!!v.start_date && !!v.end_date && v.end_date >= v.start_date),
    'Dates invalides'
  );
export const actionSchema = z
  .object({
    action: z.enum([
      'accept',
      'handover',
      'receive',
      'return',
      'complete_return',
      'cancel',
      'dispute',
    ]),
    note: z.string().trim().max(2000).optional(),
    tracking_code: z.string().trim().max(100).optional(),
  })
  .strict();
export const listingActionSchema = z
  .object({ action: z.enum(['withdraw', 'publish', 'hide']) })
  .strict();
export const reviewSchema = z
  .object({
    transaction_id: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(3).max(1000),
  })
  .strict();
export const reportSchema = z
  .object({ listing_id: z.string().uuid(), reason: z.string().trim().min(10).max(2000) })
  .strict();
export const resolveSchema = z
  .object({
    resolution: z.enum(['completed', 'cancelled']),
    note: z.string().trim().min(10).max(2000),
  })
  .strict();
