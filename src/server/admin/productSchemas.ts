import { z } from 'zod';

/**
 * Schémas produits — strictement limités aux colonnes vérifiées de
 * `shop_products` (DDL 20260715200000 + 20260715220000 + 20260715230000).
 * `transaction_type` = enum DB sans accent : achat/location/occasion/enchere.
 */

const text120 = z.string().trim().max(120);
const text500 = z.string().trim().max(500);
const strArray = z.array(z.string().trim().max(255)).max(50).default([]);

export const transactionTypeSchema = z.enum(['achat', 'location', 'occasion', 'enchere']);

export const essentialitySchema = z.enum([
  'Indispensable',
  'Recommandé',
  'Optionnel',
  'Confort',
  'Luxe',
]);

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9-]+$/, 'slug invalide (a-z, 0-9, tirets)');

const score10 = z.number().min(0).max(10).default(0);

export const productCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: slugSchema.optional(),
  brand: text120.default(''),
  model: text120.default(''),
  category: text120.default(''),
  category_main: text120.default(''),
  category_sub: text120.default(''),
  price_eur: z.number().finite().min(0).default(0),
  original_price: z.number().finite().min(0).nullable().default(null),
  savings: z.number().finite().min(0).default(0),
  price_per_day: z.number().finite().min(0).nullable().default(null),
  starting_bid: z.number().finite().min(0).nullable().default(null),
  weight_g: z.number().int().min(0).default(0),
  weight_grams: z.number().int().min(0).default(0),
  image: z.string().trim().max(2048).default(''),
  image_alt: z.string().trim().max(1024).default(''),
  rating: z.number().min(0).max(5).default(0),
  review_count: z.number().int().min(0).default(0),
  available: z.boolean().default(true),
  is_active: z.boolean().default(true),
  transaction_type: transactionTypeSchema.default('achat'),
  condition: text120.nullable().default(null),
  ends_at: z.string().datetime({ offset: true }).nullable().default(null),
  product_id: z.string().trim().max(255).nullable().default(null),
  dimensions: text500.default(''),
  materials: text500.default(''),
  warranty: text500.default(''),
  description_why: z.string().trim().max(8000).default(''),
  advantages_array: strArray,
  disadvantages_array: strArray,
  travel_types_array: strArray,
  climates_array: strArray,
  alt_premium_id: z.string().trim().max(255).nullable().default(null),
  alt_budget_id: z.string().trim().max(255).nullable().default(null),
  available_europe: z.boolean().default(true),
  available_usa: z.boolean().default(false),
  score_quality: score10,
  score_price: score10,
  score_durability: score10,
  versatility_10: score10,
  repairability_10: score10,
  source_review: text500.default(''),
  score_kdv: z.number().int().min(0).max(100).default(0),
  essentiality: essentialitySchema.default('Recommandé'),
  cabin_compatible: z.boolean().default(false),
  justification_ai: z.string().trim().max(8000).default(''),
  stock: z.number().int().min(0).default(0),
});

export const productUpdateSchema = productCreateSchema
  .omit({ stock: true })
  .partial()
  .extend({ name: z.string().trim().min(1).max(255).optional() });

export const stockMoveSchema = z.object({
  quantity_change: z.number().int().refine((n) => n !== 0, 'mouvement nul interdit'),
  movement_type: z.string().trim().min(1).max(64).default('ajustement'),
  notes: z.string().trim().max(1024).default(''),
  reference_type: z.string().trim().max(64).nullable().default(null),
  reference_id: z.string().trim().max(255).nullable().default(null),
});

export type ProductCreate = z.infer<typeof productCreateSchema>;
