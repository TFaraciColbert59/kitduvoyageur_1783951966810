/**
 * Schémas de prédiction personnelle (Phase 3) — segment et route.
 * P50/P90 toujours ordonnés ; aucune précision trompeuse (ADR-AI-004).
 */
import { z } from 'zod';
import { confidenceSchema, engineWarningSchema, isoDateTimeSchema } from './adventurePlan.schema';

export const predictionFactorSchema = z.object({
  code: z.string().min(1, 'factor.code est requis'),
  label: z.string().min(1, 'factor.label est requis'),
  impact: z.enum(['increase', 'decrease', 'neutral']),
  weight: z
    .number()
    .min(0, 'factor.weight doit être compris entre 0 et 1')
    .max(1, 'factor.weight doit être compris entre 0 et 1')
    .optional(),
});

export const segmentPredictionSchema = z
  .object({
    segmentId: z.number().int('segmentId doit être un entier').positive('segmentId doit être positif'),
    durationP50Seconds: z.number().positive('durationP50Seconds doit être strictement positif'),
    durationP90Seconds: z.number().positive('durationP90Seconds doit être strictement positif'),
    paceRangeMinPerKm: z.tuple([
      z.number().min(0, 'paceRangeMinPerKm doit être positif ou nul'),
      z.number().min(0, 'paceRangeMinPerKm doit être positif ou nul'),
    ]),
    effortScore: z.number().min(0).max(100),
    personalDifficulty: z.number().min(0).max(100),
    recommendedPauseSeconds: z.number().int('recommendedPauseSeconds doit être un entier').min(0),
    confidence: confidenceSchema,
    factors: z.array(predictionFactorSchema).default([]),
  })
  .refine((prediction) => prediction.durationP50Seconds <= prediction.durationP90Seconds, {
    message: 'P50 doit être inférieur ou égal à P90',
    path: ['durationP90Seconds'],
  })
  .refine((prediction) => prediction.paceRangeMinPerKm[0] <= prediction.paceRangeMinPerKm[1], {
    message: 'paceRangeMinPerKm doit être croissant ([0] <= [1])',
    path: ['paceRangeMinPerKm'],
  });

export const routeStrategySchema = z.enum(['comfort', 'recommended', 'fast']);

export const routePredictionSchema = z
  .object({
    userId: z.string().uuid('userId doit être un UUID'),
    planId: z.string().uuid('planId doit être un UUID').optional(),
    routeId: z.number().int('routeId doit être un entier').positive().optional(),
    strategy: routeStrategySchema,
    etaP50: isoDateTimeSchema,
    etaP90: isoDateTimeSchema,
    totalDurationP50Seconds: z.number().positive('totalDurationP50Seconds doit être strictement positif'),
    totalDurationP90Seconds: z.number().positive('totalDurationP90Seconds doit être strictement positif'),
    paceP25MinPerKm: z.number().min(0).optional(),
    paceP50MinPerKm: z.number().min(0).optional(),
    paceP75MinPerKm: z.number().min(0).optional(),
    pausesSeconds: z.number().int('pausesSeconds doit être un entier').min(0).default(0),
    personalDifficulty: z.number().min(0).max(100).optional(),
    maxFatigue: z.number().min(0).max(100).optional(),
    turnaroundTime: isoDateTimeSchema.optional(),
    criticalSegmentIds: z
      .array(z.number().int('criticalSegmentIds doit contenir des entiers').positive())
      .default([]),
    warnings: z.array(engineWarningSchema).default([]),
    confidence: confidenceSchema,
    modelVersion: z.string().min(1, 'modelVersion est requis'),
    computedAt: isoDateTimeSchema,
  })
  .refine((prediction) => Date.parse(prediction.etaP50) <= Date.parse(prediction.etaP90), {
    message: 'etaP50 doit être antérieur ou égal à etaP90',
    path: ['etaP90'],
  })
  .refine((prediction) => prediction.totalDurationP50Seconds <= prediction.totalDurationP90Seconds, {
    message: 'totalDurationP50Seconds doit être inférieur ou égal à totalDurationP90Seconds',
    path: ['totalDurationP90Seconds'],
  });

export type PredictionFactor = z.infer<typeof predictionFactorSchema>;
export type SegmentPrediction = z.infer<typeof segmentPredictionSchema>;
export type RouteStrategy = z.infer<typeof routeStrategySchema>;
export type RoutePrediction = z.infer<typeof routePredictionSchema>;
