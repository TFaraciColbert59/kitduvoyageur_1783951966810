import { z } from 'zod';
import {
  CART_IDEMPOTENCY_METADATA_KEY,
  CART_LINE_KINDS,
  CART_MAX_LINES,
  CART_MAX_QUANTITY_PER_LINE,
  isCartLineKind,
  type CartLineKind,
  type CartLineMetadata,
  type CartMetadataValue,
} from '../cartTypes';

export const cartLineKindSchema = z.enum(CART_LINE_KINDS);

/** UUID : `ref_id` pointe `shop_products.id` ou `bookings.id`. */
export const cartReferenceIdSchema = z.string().uuid();
export const cartLineIdSchema = z.string().uuid();
export const cartTripIdSchema = z.string().uuid();
export const cartUserIdSchema = z.string().uuid();
export const cartCurrencySchema = z.string().regex(/^[A-Z]{3}$/, 'Devise ISO 4217 attendue');

const boundedText = (max: number) => z.string().trim().max(max);
const nonEmptyText = (max: number) => z.string().trim().min(1).max(max);

/**
 * URL http(s) uniquement. `z.string().url()` accepte `javascript:` — d'où
 * le refus explicite des autres schémas, sinon unpartner peut injecter une
 * URL cliquable `javascript:` dans le panier.
 */
const httpUrlSchema = (max = 600) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => /^https?:\/\/[^\s]+$/i.test(value), 'URL http(s) attendue');

/** Valeur de métadonnée plate : jamais d'objet imbriqué, jamais de fonction. */
export const cartMetadataValueSchema: z.ZodType<CartMetadataValue> = z.union([
  z.string().max(600),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const cartMetadataSchema = z.record(z.string(), cartMetadataValueSchema);

/**
 * Allowlist d'affichage par type de ligne. Zod supprime les clés inconnues :
 * un client ne peut pas écrire `token`, `apiKey` ou une URL `javascript:`.
 */
export const productCartMetadataSchema = z.object({
  slug: nonEmptyText(160).optional(),
  title: nonEmptyText(200).optional(),
  brand: boundedText(120).optional(),
  category: boundedText(80).optional(),
  image: httpUrlSchema().optional(),
  imageAlt: boundedText(200).optional(),
  weightG: z.number().int().min(0).max(100_000).optional(),
});

export const bookingCartMetadataSchema = z.object({
  title: nonEmptyText(200).optional(),
  vertical: z.enum(['flight', 'hotel', 'car', 'activity']).optional(),
  provider: z.enum(['routestack', 'viator', 'affiliate']).optional(),
  status: z
    .enum(['draft', 'pending', 'held', 'confirmed', 'cancelled', 'expired', 'failed', 'refunded'])
    .optional(),
  deeplink: httpUrlSchema(1000).optional(),
  requiresRevalidation: z.boolean().optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
});

/**
 * Nettoie les métadonnées fournies par le client pour un `kind` donné.
 * Retourne un objet immutable : aucune clé hors allowlist ne survit.
 */
export function sanitizeCartMetadata(
  kind: CartLineKind,
  metadata: unknown
): CartLineMetadata {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) return {};
  const allowlist = kind === 'product' ? productCartMetadataSchema : bookingCartMetadataSchema;
  const safe: CartLineMetadata = {};
  // Rejet CHAMP par CHAMP : une entrée illicite (objet imbriqué, URL
  // javascript:, token) disparaît sans faire tomber les libellés valides.
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (!cartMetadataValueSchema.safeParse(value).success) continue;
    const field = allowlist.safeParse({ [key]: value });
    if (field.success) Object.assign(safe, field.data as CartLineMetadata);
  }
  return safe;
}

/** Clé d'idempotence : jeton opaque client, jamais un secret. */
export const cartIdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(120)
  .regex(/^[A-Za-z0-9._:-]+$/, 'Clé d\'idempotence invalide');

/** Corps `POST /api/trips/:tripId/cart-lines`. */
export const addCartLineSchema = z
  .object({
    kind: cartLineKindSchema,
    refId: cartReferenceIdSchema,
    quantity: z.number().int().min(1).max(CART_MAX_QUANTITY_PER_LINE).default(1),
    metadata: cartMetadataSchema.optional(),
    idempotencyKey: cartIdempotencyKeySchema.optional(),
  })
  .strict();

/** Corps `PATCH /api/trips/:tripId/cart-lines/:lineId`. */
export const updateCartLineSchema = z
  .object({
    quantity: z.number().int().min(1).max(CART_MAX_QUANTITY_PER_LINE).optional(),
    metadata: cartMetadataSchema.optional(),
  })
  .strict()
  .refine((value) => value.quantity !== undefined || value.metadata !== undefined, {
    message: 'Quantité ou métadonnées attendues.',
  });

export const cartQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(CART_MAX_LINES).default(CART_MAX_LINES),
});

export type AddCartLineInput = z.infer<typeof addCartLineSchema>;
export type UpdateCartLineInput = z.infer<typeof updateCartLineSchema>;

export { CART_IDEMPOTENCY_METADATA_KEY, CART_MAX_LINES, CART_MAX_QUANTITY_PER_LINE, isCartLineKind };
