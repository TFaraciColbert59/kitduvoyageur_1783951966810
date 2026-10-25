// src/features/discovery/providers/tripadvisor-terra/terraSchemas.ts
// Schémas Zod des réponses BRUTES Tripadvisor Terra (Partner API).
// Confirmés par l'OpenAPI officiel : https://docs.terra.tripadvisor.com
import { z } from 'zod';

const swappableString = z.union([z.string(), z.number()]);

export const terraTranslationSchema = z
  .object({
    language: z.string().nullish(),
    value: z.string().nullish(),
  })
  .passthrough();

export const terraTranslationWithPrimarySchema = z
  .object({
    language: z.string().nullish(),
    value: z.string().nullish(),
    primary: z.boolean().nullish(),
  })
  .passthrough();

export const terraAddressSchema = z
  .object({
    city: z.string().nullish(),
    state: z.string().nullish(),
    country_code: z.string().nullish(),
    country_name: z.string().nullish(),
    formatted: z.string().nullish(),
    postal_code: z.string().nullish(),
    street_address: z.string().nullish(),
    street_address2: z.string().nullish(),
    language: z.string().nullish(),
  })
  .passthrough();

export const terraCategorySchema = z
  .object({
    id: z.string().nullish(),
    display_name: z.string().nullish(),
    hierarchy: z.string().nullish(),
    top_level_category: z.string().nullish(),
  })
  .passthrough();

export const terraOverallRatingSchema = z
  .object({
    rating: z.number().nullish(),
    count: z.number().nullish(),
    icon_url: z.string().nullish(),
  })
  .passthrough();

export const terraTravelerRatingsSchema = z
  .object({
    overall: terraOverallRatingSchema.nullish(),
  })
  .passthrough();

export const terraUrlsSchema = z
  .object({
    official: z.string().nullish(),
    menu: z.string().nullish(),
    android_intent: z.string().nullish(),
    tripadvisor: z
      .object({
        main: z.string().nullish(),
        photos: z.string().nullish(),
        questions_answers: z.string().nullish(),
        write_review: z.string().nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

export const terraLocationSchema = z
  .object({
    id: swappableString,
    names: z.array(terraTranslationWithPrimarySchema).nullish(),
    descriptions: z.array(terraTranslationSchema).nullish(),
    addresses: z.array(terraAddressSchema).nullish(),
    coordinates: z
      .object({
        latitude: z.number().nullish(),
        longitude: z.number().nullish(),
      })
      .passthrough()
      .nullish(),
    categories: z.array(terraCategorySchema).nullish(),
    traveler_ratings: terraTravelerRatingsSchema.nullish(),
    urls: terraUrlsSchema.nullish(),
    photos: z.object({ total_count: z.number().nullish() }).passthrough().nullish(),
    status: z.object({ value: z.string().nullish() }).passthrough().nullish(),
    price_level: z.string().nullish(),
    geo: z.string().nullish(),
  })
  .passthrough();

export const terraSearchItemSchema = z
  .object({
    location: terraLocationSchema,
    matched_value: terraTranslationSchema.nullish(),
  })
  .passthrough();

export const terraSearchResponseSchema = z
  .object({
    data: z.array(terraSearchItemSchema).default([]),
    pagination: z.unknown().nullish(),
  })
  .passthrough();

export const terraPageMetadataSchema = z
  .object({
    page: z.number().nullish(),
    size: z.number().nullish(),
    total_elements: z.number().nullish(),
    total_pages: z.number().nullish(),
  })
  .passthrough();

export type TerraLocation = z.infer<typeof terraLocationSchema>;
export type TerraSearchItem = z.infer<typeof terraSearchItemSchema>;
