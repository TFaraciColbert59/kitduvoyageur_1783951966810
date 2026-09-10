// src/features/discovery/providers/viator/viatorSchemas.ts
// Schémas Zod des réponses BRUTES Viator Partner API (/products/search).
// Champs non garantis optionnels ; inconnus tolérés.
import { z } from 'zod';

const viatorImageSchema = z
  .object({
    imageSource: z.string().nullish(),
    isCover: z.boolean().nullish(),
    caption: z.string().nullish(),
    variants: z
      .array(
        z
          .object({
            url: z.string().nullish(),
            width: z.number().nullish(),
            height: z.number().nullish(),
          })
          .passthrough()
      )
      .nullish(),
  })
  .passthrough();

const viatorReviewsSchema = z
  .object({
    totalReviews: z.number().nullish(),
    combinedAverageRating: z.number().nullish(),
  })
  .passthrough();

const viatorPricingSchema = z
  .object({
    summary: z
      .object({
        fromPrice: z.number().nullish(),
        fromPriceBeforeDiscount: z.number().nullish(),
      })
      .passthrough()
      .nullish(),
    currency: z.string().nullish(),
  })
  .passthrough();

const viatorDurationSchema = z
  .object({
    fixedDurationInMinutes: z.number().nullish(),
    variableDurationFromMinutes: z.number().nullish(),
    variableDurationToMinutes: z.number().nullish(),
  })
  .passthrough();

export const viatorProductSchema = z
  .object({
    productCode: z.string(),
    title: z.string(),
    description: z.string().nullish(),
    images: z.array(viatorImageSchema).nullish(),
    reviews: viatorReviewsSchema.nullish(),
    pricing: viatorPricingSchema.nullish(),
    duration: viatorDurationSchema.nullish(),
    productUrl: z.string().nullish(),
    destinations: z
      .array(z.object({ ref: z.string().nullish(), primary: z.boolean().nullish() }).passthrough())
      .nullish(),
    flags: z.array(z.string()).nullish(),
  })
  .passthrough();

export const viatorSearchResponseSchema = z
  .object({
    // Enveloppe validée ; chaque produit est validé individuellement (tolérance
    // aux entrées partielles sans casser toute la réponse).
    products: z.array(z.unknown()).default([]),
    totalCount: z.number().nullish(),
  })
  .passthrough();

export type ViatorProductRaw = z.infer<typeof viatorProductSchema>;
