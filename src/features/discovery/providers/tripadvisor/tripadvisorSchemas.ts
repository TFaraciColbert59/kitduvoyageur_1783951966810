// src/features/discovery/providers/tripadvisor/tripadvisorSchemas.ts
// Schémas Zod des réponses BRUTES Tripadvisor (Content API).
//
// ⚠️ Vérification live en attente : la clé fournie renvoie un 403
// « explicit deny » (restriction de clé / entitlement), aussi les champs de
// Location Details sont validés de façon défensive (tous optionnels/lenient).
// La forme de /location/search est, elle, confirmée par l'OpenAPI public.
import { z } from 'zod';

const swappableString = z.union([z.string(), z.number()]);

export const taAddressSchema = z
  .object({
    street1: z.string().nullish(),
    street2: z.string().nullish(),
    city: z.string().nullish(),
    state: z.string().nullish(),
    country: z.string().nullish(),
    postalcode: z.string().nullish(),
    address_string: z.string().nullish(),
  })
  .passthrough();

export const taSearchItemSchema = z
  .object({
    location_id: swappableString,
    name: z.string(),
    distance: z.string().nullish(),
    bearing: z.string().nullish(),
    address_obj: taAddressSchema.nullish(),
  })
  .passthrough();

export const taSearchResponseSchema = z
  .object({
    data: z.array(taSearchItemSchema).default([]),
  })
  .passthrough();

const taLocalizedNameSchema = z
  .object({
    name: z.string().nullish(),
    localized_name: z.string().nullish(),
  })
  .passthrough();

const taPhotoSchema = z
  .object({
    images: z
      .object({
        original: z.object({ url: z.string().nullish() }).passthrough().nullish(),
        large: z.object({ url: z.string().nullish() }).passthrough().nullish(),
        medium: z.object({ url: z.string().nullish() }).passthrough().nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

export const taLocationDetailsSchema = z
  .object({
    location_id: swappableString.nullish(),
    name: z.string().nullish(),
    description: z.string().nullish(),
    web_url: z.string().nullish(),
    rating: swappableString.nullish(),
    num_reviews: swappableString.nullish(),
    rating_image_url: z.string().nullish(),
    latitude: swappableString.nullish(),
    longitude: swappableString.nullish(),
    address_obj: taAddressSchema.nullish(),
    category: taLocalizedNameSchema.nullish(),
    subcategory: z.array(taLocalizedNameSchema).nullish(),
    cuisine: z.array(taLocalizedNameSchema).nullish(),
    photo: taPhotoSchema.nullish(),
  })
  .passthrough();

export type TaSearchItem = z.infer<typeof taSearchItemSchema>;
export type TaLocationDetails = z.infer<typeof taLocationDetailsSchema>;
