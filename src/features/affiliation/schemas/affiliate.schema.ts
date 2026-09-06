import { z } from 'zod';

export const affiliateCategorySchema = z.enum([
  'flight',
  'hotel',
  'activity',
  'insurance',
  'esim',
  'transport',
  'gear',
]);

export const createAffiliateLinkSchema = z.object({
  slug: z.string().min(3).max(120).regex(/^[a-z0-9-]+$/),
  partner_id: z.string().uuid(),
  category: affiliateCategorySchema,
  country_code: z.string().length(2).toUpperCase().optional().nullable(),
  title: z.string().min(3).max(150),
  destination_name: z.string().max(100).optional().nullable(),
  target_url: z.string().url().refine((val) => val.startsWith('https://'), {
    message: 'L’URL partenaire doit obligatoirement utiliser HTTPS',
  }),
  tracking_params: z.record(z.string(), z.string()).default({}),
  is_active: z.boolean().default(true),
});

export const affiliatePostbackPayloadSchema = z.object({
  partner_slug: z.string().min(2),
  sub_id: z.string().min(1),
  amount_cents: z.number().int().min(0),
  currency: z.string().length(3).default('EUR'),
  status: z.enum(['pending', 'confirmed', 'rejected']),
  raw_payload: z.record(z.string(), z.unknown()).optional(),
});

export type CreateAffiliateLinkInput = z.input<typeof createAffiliateLinkSchema>;
export type AffiliatePostbackPayload = z.infer<typeof affiliatePostbackPayloadSchema>;
