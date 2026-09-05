import { z } from 'zod';

export const placeCategorySchema = z.enum([
  'refuge',
  'bivouac',
  'water_source',
  'viewpoint',
  'pass',
  'campground',
  'poi',
  'summit',
  'lake',
  'cave',
  'historical',
]);

export const placeSensitivitySchema = z.enum(['standard', 'sensitive', 'protected']);
export const placeSourceSchema = z.enum(['curated', 'community', 'osm']);

export const placePracticalInfoSchema = z.object({
  waterAvailable: z.boolean().optional(),
  feesRequired: z.boolean().optional(),
  bookingRequired: z.boolean().optional(),
  openingSeason: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  website: z.string().url().max(300).optional(),
  capacity: z.number().int().min(0).max(500).optional(),
  fireAllowed: z.boolean().optional(),
  electricity: z.boolean().optional(),
  wasteManagement: z.boolean().optional(),
});

export const createPlaceSchema = z.object({
  name: z.string().min(2, 'Le nom doit comporter au moins 2 caractères').max(100),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/, 'Le slug ne doit contenir que des minuscules et tirets'),
  category: placeCategorySchema,
  country_code: z.string().length(2, 'Code pays ISO à 2 lettres requis').toUpperCase(),
  region: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude_m: z.number().int().min(-500).max(9000).optional().nullable(),
  description: z.string().max(3000).optional().nullable(),
  sensitivity: placeSensitivitySchema.default('standard'),
  source: placeSourceSchema.default('community'),
  practical_info: placePracticalInfoSchema.default({}),
});

export const createPlaceReviewSchema = z.object({
  place_id: z.string().uuid('Identifiant de lieu invalide'),
  rating: z.number().int().min(1, 'La note doit être entre 1 et 5').max(5, 'La note doit être entre 1 et 5'),
  comment: z.string().min(10, 'Le commentaire doit comporter au moins 10 caractères').max(2000),
  has_field_proof: z.boolean().default(false),
  visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date YYYY-MM-DD').optional().nullable(),
});

export const createPlaceReportSchema = z.object({
  place_id: z.string().uuid(),
  reason: z.enum([
    'overcrowding',
    'environmental_damage',
    'safety_hazard',
    'inaccurate_info',
    'private_property',
    'other',
  ]),
  details: z.string().min(10, 'Merci de préciser en au moins 10 caractères').max(2000),
});

export const placeFilterSchema = z.object({
  country: z.string().length(2).optional(),
  category: placeCategorySchema.optional(),
  sensitivity: placeSensitivitySchema.optional(),
  query: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type CreatePlaceInput = z.input<typeof createPlaceSchema>;
export type CreatePlaceOutput = z.infer<typeof createPlaceSchema>;
export type CreatePlaceReviewInput = z.input<typeof createPlaceReviewSchema>;
export type CreatePlaceReportInput = z.input<typeof createPlaceReportSchema>;
export type PlaceFilterInput = z.input<typeof placeFilterSchema>;
