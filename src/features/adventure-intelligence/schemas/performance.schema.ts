/**
 * Schémas du Profil Terrain et de la qualité de trace (Phase 3).
 * Le profil est privé, versionné et calculé sans aucune donnée de santé connectée.
 */
import { z } from 'zod';
import { confidenceSchema, isoDateTimeSchema } from './adventurePlan.schema';

export const responseCurvePointSchema = z.object({
  x: z.number(),
  value: z.number(),
});

export const responseCurveSchema = z.object({
  points: z
    .array(responseCurvePointSchema)
    .min(1, 'Une courbe de réponse requiert au moins un point'),
  interpolate: z.enum(['linear', 'monotone']).default('linear'),
});

export const fatigueCurveSchema = z.object({
  points: z
    .array(responseCurvePointSchema)
    .min(1, 'Une courbe de fatigue requiert au moins un point'),
  decayPerHour: z
    .number()
    .min(0, 'decayPerHour doit être compris entre 0 et 1')
    .max(1, 'decayPerHour doit être compris entre 0 et 1')
    .default(0),
});

export const pauseModelSchema = z.object({
  pauseMinutesPerHour: z.number().min(0, 'pauseMinutesPerHour doit être positif ou nul').default(0),
  pauseMinutesPerAscentM: z.number().min(0, 'pauseMinutesPerAscentM doit être positif ou nul').default(0),
  minPauseMinutes: z.number().min(0, 'minPauseMinutes doit être positif ou nul').default(0),
});

export const CALIBRATION_LEVELS = [
  'cold',
  'calibration',
  'personalization',
  'contextualization',
] as const;

export const calibrationLevelSchema = z.enum(CALIBRATION_LEVELS);

export const performanceProfileSchema = z.object({
  userId: z.string().uuid('userId doit être un UUID'),
  activityType: z.literal('hiking').default('hiking'),
  flatSpeedKmH: z.number().positive('flatSpeedKmH doit être strictement positif'),
  ascentSpeedMPerHour: z
    .number()
    .min(0, 'ascentSpeedMPerHour doit être positif ou nul'),
  descentSpeedMPerHour: z
    .number()
    .min(0, 'descentSpeedMPerHour doit être positif ou nul'),
  gradeResponse: responseCurveSchema,
  surfaceResponse: responseCurveSchema,
  fatigueCurve: fatigueCurveSchema,
  pauseModel: pauseModelSchema,
  packResponse: responseCurveSchema,
  confidence: confidenceSchema,
  sampleCount: z.number().int('sampleCount doit être un entier').min(0, 'sampleCount doit être positif ou nul').default(0),
  calibrationLevel: calibrationLevelSchema.default('cold'),
  modelVersion: z.string().min(1, 'modelVersion est requis'),
  computedAt: isoDateTimeSchema,
  validUntil: isoDateTimeSchema.optional(),
});

function unitIntervalSchema(name: string) {
  return z
    .number()
    .min(0, `${name} doit être compris entre 0 et 1`)
    .max(1, `${name} doit être compris entre 0 et 1`);
}

export const trackQualitySchema = z.object({
  overall: unitIntervalSchema('overall'),
  gpsAccuracy: unitIntervalSchema('gpsAccuracy'),
  temporalContinuity: unitIntervalSchema('temporalContinuity'),
  altitudeReliability: unitIntervalSchema('altitudeReliability'),
  plausibleMovement: unitIntervalSchema('plausibleMovement'),
  reasons: z.array(z.string()).default([]),
});

export type ResponseCurvePoint = z.infer<typeof responseCurvePointSchema>;
export type ResponseCurve = z.infer<typeof responseCurveSchema>;
export type FatigueCurve = z.infer<typeof fatigueCurveSchema>;
export type PauseModel = z.infer<typeof pauseModelSchema>;
export type CalibrationLevel = z.infer<typeof calibrationLevelSchema>;
export type PerformanceProfile = z.infer<typeof performanceProfileSchema>;
export type TrackQuality = z.infer<typeof trackQualitySchema>;
