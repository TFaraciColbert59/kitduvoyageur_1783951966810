/**
 * Schémas d'enrichissement des segments (Phase 2).
 * `trail_segments` reste l'unique réseau (ADR-AI-002) ; les features vivent en 1:1.
 */
import { z } from 'zod';
import { ProvenanceTypeEnum } from '@/features/trips/schemas/autoGen.schema';
import { isoDateTimeSchema } from './adventurePlan.schema';

export const segmentDirectionSchema = z.enum(['forward', 'reverse', 'both']);

export const segmentDifficultyClassSchema = z
  .number()
  .int('La classe doit être un entier')
  .min(0, 'La classe doit être comprise entre 0 et 5')
  .max(5, 'La classe doit être comprise entre 0 et 5');

export const trailSegmentFeatureSchema = z.object({
  segmentId: z.number().int('segmentId doit être un entier').positive('segmentId doit être positif'),
  lengthM: z.number().min(0, 'lengthM doit être positif ou nul').default(0),
  direction: segmentDirectionSchema.default('both'),
  meanGradePct: z.number().optional(),
  maxGradePct: z.number().optional(),
  gainM: z.number().min(0, 'gainM doit être positif ou nul').optional(),
  lossM: z.number().min(0, 'lossM doit être positif ou nul').optional(),
  altitudeMinM: z.number().optional(),
  altitudeMaxM: z.number().optional(),
  surface: z.string().min(1, 'surface ne peut pas être vide').optional(),
  technicalClass: segmentDifficultyClassSchema.optional(),
  exposureClass: segmentDifficultyClassSchema.optional(),
  isolationClass: segmentDifficultyClassSchema.optional(),
  source: ProvenanceTypeEnum.default('computed'),
  computedAt: isoDateTimeSchema.default(() => new Date().toISOString()),
  updatedAt: isoDateTimeSchema.optional(),
});

export type SegmentDirection = z.infer<typeof segmentDirectionSchema>;
export type SegmentDifficultyClass = z.infer<typeof segmentDifficultyClassSchema>;
export type TrailSegmentFeature = z.infer<typeof trailSegmentFeatureSchema>;
