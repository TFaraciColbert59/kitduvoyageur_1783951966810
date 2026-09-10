// src/features/discovery/schemas/discovery.schema.ts
import { z } from 'zod';
import type { DiscoveryCategory } from '../types/discovery.types';

export const DISCOVERY_CATEGORIES = ['attractions', 'restaurants', 'hotels'] as const;

/**
 * Périmètre v1 — plafonds de résultats par catégorie.
 * Toute requête est bornée : aucun appel « sans limite » possible.
 */
export const CATEGORY_LIMITS: Record<DiscoveryCategory, number> = {
  attractions: 6,
  restaurants: 6,
  hotels: 4,
};

/** Clés de requête autorisées sur la route interne (protection anti-proxy ouvert). */
export const DISCOVERY_QUERY_KEYS = ['countryCode', 'category', 'section', 'limit'] as const;

export const DISCOVERY_SECTIONS = ['destinations', 'activites', 'gastronomie', 'hebergements'] as const;

export const discoveryQuerySchema = z.object({
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'Code pays ISO A2 invalide')
    .transform((value) => value.toUpperCase()),
  category: z.enum(DISCOVERY_CATEGORIES),
  section: z.enum(DISCOVERY_SECTIONS).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>;

/** Applique le plafond contractuel v1 : ni dépassement, ni appel non borné. */
export function resolveLimit(category: DiscoveryCategory, requested?: number): number {
  const cap = CATEGORY_LIMITS[category];
  if (requested == null || !Number.isFinite(requested)) return cap;
  return Math.max(1, Math.min(cap, Math.floor(requested)));
}

export const discoveryItemSchema = z.object({
  id: z.string().min(1),
  provider: z.enum(['tripadvisor', 'viator']),
  type: z.enum(DISCOVERY_CATEGORIES),
  name: z.string().min(1),
  description: z.string().nullable(),
  countryCode: z.string().length(2),
  city: z.string().nullable(),
  address: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  rating: z.number().nullable(),
  reviewCount: z.number().int().nullable(),
  photoUrl: z.string().nullable(),
  ratingImageUrl: z.string().nullable(),
  tripadvisorUrl: z.string().nullable(),
  category: z.string().nullable(),
  isBookable: z.boolean(),
  bookingMode: z.enum(['external', 'in_app']).nullable().optional(),
  bookingProvider: z.string().nullable().optional(),
  // Champs affiliés optionnels (Viator).
  affiliateUrl: z.string().nullable().optional(),
  priceFrom: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  freeCancellation: z.boolean().nullable().optional(),
  productCode: z.string().nullable().optional(),
  durationMinutes: z.number().int().nullable().optional(),
});

export const discoveryItemsSchema = z.array(discoveryItemSchema);
