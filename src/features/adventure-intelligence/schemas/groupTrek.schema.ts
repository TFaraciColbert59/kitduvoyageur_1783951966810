/**
 * A13 (S3) — Schémas Zod des payloads groupe/trek persistés dans les versions.
 *
 * Ces schémas bornent la relecture : un snapshot non conforme est ignoré en
 * bloc (jamais de résultat partiel présenté comme valide). Aucune donnée
 * d'identité ni de santé n'y a sa place — la projection publique est un
 * sous-ensemble strict.
 */
import { z } from 'zod';
import { isoDateTimeSchema } from './adventurePlan.schema';

export const stagesSourceSchema = z.enum(['trip_steps', 'blueprint_uniform']);

export const gearRedistributionSummarySchema = z.object({
  transfers: z.number().int('transfers doit être un entier').min(0, 'transfers doit être positif'),
  totalWeightKg: z.number().min(0, 'totalWeightKg doit être positif'),
  maxPerReceiverKg: z.number().min(0, 'maxPerReceiverKg doit être positif'),
});

export const groupPlanSummarySchema = z.object({
  groupPaceKmH: z.number().min(0, 'groupPaceKmH doit être positif'),
  groupDifficulty: z
    .number()
    .min(0, 'groupDifficulty doit être compris entre 0 et 100')
    .max(100, 'groupDifficulty doit être compris entre 0 et 100'),
  limitingReason: z.string().nullable(),
  separationRisk: z.object({
    level: z.enum(['low', 'medium', 'high']),
    reasons: z.array(z.string()),
  }),
  memberCount: z.number().int('memberCount doit être un entier').min(0),
  pauseEveryMinutes: z.number().int('pauseEveryMinutes doit être un entier').min(0),
  gearRedistribution: gearRedistributionSummarySchema,
  difficultyRange: z
    .object({ min: z.number(), max: z.number() })
    .nullable(),
});

export const groupPlanMetaSchema = z.object({
  stagesSource: stagesSourceSchema,
  strategy: z.enum(['comfort', 'recommended', 'fast']),
  crewId: z.string().uuid('crewId doit être un UUID').nullable(),
  tripId: z.string().uuid('tripId doit être un UUID').nullable(),
  memberCount: z.number().int('memberCount doit être un entier').min(0),
  modelVersion: z.string().min(1, 'modelVersion est requis'),
  computedAt: isoDateTimeSchema,
});

const trekAdjustmentSchema = z.object({
  kind: z.enum([
    'shorten',
    'move_km',
    'change_refuge',
    'add_night',
    'transfer_gear',
    'recovery_day',
  ]),
  label: z.string().min(1, 'adjustment.label est requis'),
  reason: z.string().min(1, 'adjustment.reason est requis'),
});

export const trekDayResultSchema = z.object({
  dayNumber: z.number().int('dayNumber doit être un entier').min(1),
  capacityPct: z.number().min(0).max(100),
  loadScore: z.number().min(0),
  difficulty: z.number().min(0).max(100),
  driftRisk: z.number().min(0),
  adjustments: z.array(trekAdjustmentSchema),
});

export const multiDayTrekResultSchema = z.object({
  daily: z.array(trekDayResultSchema),
  worstDay: z.number().int('worstDay doit être un entier').min(0),
  totalDriftRisk: z.number().min(0),
});

export const trekPlanMetaSchema = z.object({
  stagesSource: stagesSourceSchema,
  dayCount: z.number().int('dayCount doit être un entier').min(0),
  modelVersion: z.string().min(1, 'modelVersion est requis'),
  computedAt: isoDateTimeSchema,
});

export type GroupPlanSummarySchema = z.infer<typeof groupPlanSummarySchema>;
export type GroupPlanMetaSchema = z.infer<typeof groupPlanMetaSchema>;
export type MultiDayTrekResultSchema = z.infer<typeof multiDayTrekResultSchema>;
export type TrekPlanMetaSchema = z.infer<typeof trekPlanMetaSchema>;
