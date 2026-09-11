/**
 * Schémas Zod de l'AdventurePlan (source de vérité, ADR-AI-001).
 * Zod 4 — messages d'erreur en français, types inférés exportés.
 */
import { z } from 'zod';
import { ProvenanceTypeEnum } from '@/features/trips/schemas/autoGen.schema';
import type { AdventurePlanSections } from '../domain/adventurePlan';

/** Date ISO 8601 complète (avec fuseau `Z` ou décalage) — en français. */
export const isoDateTimeSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/,
    'Date ISO 8601 invalide (attendu : AAAA-MM-JJTHH:MM:SSZ)'
  );

export const confidenceSchema = z.object({
  score: z
    .number()
    .min(0, 'score doit être compris entre 0 et 1')
    .max(1, 'score doit être compris entre 0 et 1'),
  level: z.enum(['high', 'medium', 'low']),
  sampleCount: z.number().int('sampleCount doit être un entier').min(0, 'sampleCount doit être positif ou nul'),
  method: z.string().min(1, 'method est requis'),
  reasons: z.array(z.string()).default([]),
});

export const provenanceSchema = z.object({
  source: ProvenanceTypeEnum,
  sourceRef: z.string().min(1, 'sourceRef ne peut pas être vide').optional(),
  observedAt: isoDateTimeSchema.optional(),
  freshnessSeconds: z.number().int('freshnessSeconds doit être un entier').min(0).optional(),
  notes: z.string().optional(),
});

export const assumptionSchema = z.object({
  id: z.string().min(1, 'assumption.id est requis'),
  label: z.string().min(1, 'assumption.label est requis'),
  detail: z.string().optional(),
  confidence: confidenceSchema.optional(),
});

export const engineWarningSchema = z.object({
  code: z.string().min(1, 'warning.code est requis'),
  message: z.string().min(1, 'warning.message est requis'),
  severity: z.enum(['info', 'warning', 'critical']),
});

export const planImpactSchema = z.object({
  id: z.string().min(1, 'impact.id est requis'),
  section: z.string().min(1, 'impact.section est requis'),
  label: z.string().min(1, 'impact.label est requis'),
  severity: z.enum(['info', 'warning', 'critical']),
});

export function alternativeSchema<T extends z.ZodType>(inner: T) {
  return z.object({
    id: z.string().min(1, 'alternative.id est requis'),
    label: z.string().min(1, 'alternative.label est requis'),
    value: inner,
    tradeoffs: z.array(z.string()).default([]),
    impacts: z.array(planImpactSchema).default([]),
  });
}

/** `PlanValue<T>` : valeur + confiance + provenance + cycle de vie. */
export function planValueSchema<T extends z.ZodType>(inner: T) {
  return z
    .object({
      value: inner,
      confidence: confidenceSchema,
      provenance: z.array(provenanceSchema).default([]),
      assumptions: z.array(assumptionSchema).default([]),
      warnings: z.array(engineWarningSchema).default([]),
      impacts: z.array(planImpactSchema).default([]),
      computedAt: isoDateTimeSchema,
      validUntil: isoDateTimeSchema.optional(),
    })
    .refine(
      (planValue) =>
        planValue.validUntil === undefined ||
        Date.parse(planValue.validUntil) >= Date.parse(planValue.computedAt),
      {
        message: 'validUntil doit être postérieur ou égal à computedAt',
        path: ['validUntil'],
      }
    );
}

export const adventureIntentSchema = z.object({
  rawInput: z.string().min(1, 'L’intention brute est requise'),
  summary: z.string().optional(),
  activities: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
});

export const planParticipantSchema = z.object({
  id: z.string().min(1, 'participant.id est requis'),
  displayName: z.string().min(1, 'participant.displayName est requis'),
  role: z.enum(['owner', 'member', 'guest']).default('member'),
  profileId: z.string().uuid('participant.profileId doit être un UUID').optional(),
});

export const adventureDatesSchema = z.object({
  start: isoDateTimeSchema.optional(),
  end: isoDateTimeSchema.optional(),
  flexible: z.boolean().default(false),
});

export const adventureDestinationSchema = z.object({
  label: z.string().min(1, 'destination.label est requis'),
  countryCode: z.string().length(2, 'destination.countryCode doit contenir 2 lettres').optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const monitoringRuleSchema = z.object({
  id: z.string().min(1, 'monitoringRule.id est requis'),
  label: z.string().min(1, 'monitoringRule.label est requis'),
  kind: z.string().min(1, 'monitoringRule.kind est requis'),
  enabled: z.boolean().default(true),
});

const nullablePlanValueSchema = planValueSchema(z.unknown()).nullable().default(null);

export const adventurePlanSectionsSchema = z.object({
  transport: nullablePlanValueSchema,
  localMobility: nullablePlanValueSchema,
  accommodations: nullablePlanValueSchema,
  dailyStages: nullablePlanValueSchema,
  activityRoutes: nullablePlanValueSchema,
  terrainAnalysis: nullablePlanValueSchema,
  personalDifficulty: nullablePlanValueSchema,
  groupDifficulty: nullablePlanValueSchema,
  paceStrategies: nullablePlanValueSchema,
  foodAndWater: nullablePlanValueSchema,
  gearPlan: nullablePlanValueSchema,
  budget: nullablePlanValueSchema,
  bookings: nullablePlanValueSchema,
  documents: nullablePlanValueSchema,
  regulations: nullablePlanValueSchema,
  safetyPlan: nullablePlanValueSchema,
  offlinePackage: nullablePlanValueSchema,
  liveConditions: nullablePlanValueSchema,
  alternatives: nullablePlanValueSchema,
});

const FULL_NULL_SECTIONS: AdventurePlanSections = {
  transport: null,
  localMobility: null,
  accommodations: null,
  dailyStages: null,
  activityRoutes: null,
  terrainAnalysis: null,
  personalDifficulty: null,
  groupDifficulty: null,
  paceStrategies: null,
  foodAndWater: null,
  gearPlan: null,
  budget: null,
  bookings: null,
  documents: null,
  regulations: null,
  safetyPlan: null,
  offlinePackage: null,
  liveConditions: null,
  alternatives: null,
};

export const adventurePlanSchema = z.object({
  id: z.string().uuid('id doit être un UUID'),
  ownerId: z.string().uuid('ownerId doit être un UUID'),
  tripId: z.string().uuid('tripId doit être un UUID').optional(),
  title: z.string().min(1, 'title ne peut pas être vide').optional(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).default('draft'),
  currentVersion: z.number().int('currentVersion doit être un entier').min(0).default(0),
  intent: adventureIntentSchema,
  participants: z.array(planParticipantSchema).default([]),
  dates: adventureDatesSchema.default({ flexible: false }),
  destinations: z.array(adventureDestinationSchema).default([]),
  sections: adventurePlanSectionsSchema.default(FULL_NULL_SECTIONS),
  confidence: confidenceSchema.default({
    score: 0,
    level: 'low',
    sampleCount: 0,
    method: 'cold',
    reasons: [],
  }),
  monitoringRules: z.array(monitoringRuleSchema).default([]),
  createdAt: isoDateTimeSchema.default(() => new Date().toISOString()),
  updatedAt: isoDateTimeSchema.default(() => new Date().toISOString()),
});

export const decisionTypeSchema = z.enum([
  'payment',
  'cancellation',
  'safety_change',
  'location_share',
  'group_change',
  'other',
]);

export const decisionStatusSchema = z.enum(['proposed', 'confirmed', 'rejected', 'expired']);

export const adventureDecisionSchema = z.object({
  id: z.string().uuid('id doit être un UUID'),
  planId: z.string().uuid('planId doit être un UUID'),
  decisionType: decisionTypeSchema,
  proposal: z.string().min(1, 'proposal est requis'),
  impact: z.array(planImpactSchema).default([]),
  requiresConfirmation: z.boolean().default(true),
  status: decisionStatusSchema.default('proposed'),
  decidedBy: z.string().uuid('decidedBy doit être un UUID').optional(),
  decidedAt: isoDateTimeSchema.optional(),
  createdAt: isoDateTimeSchema,
});

export const planVersionMetaSchema = z.object({
  planId: z.string().uuid('planId doit être un UUID'),
  version: z.number().int('version doit être un entier').min(1, 'version doit être supérieure ou égale à 1'),
  reason: z.string().min(1, 'reason est requis'),
  generatedBy: z.string().min(1, 'generatedBy est requis'),
  confidence: confidenceSchema,
  createdAt: isoDateTimeSchema,
});

export type ConfidenceSchema = z.infer<typeof confidenceSchema>;
export type ProvenanceSchema = z.infer<typeof provenanceSchema>;
export type AssumptionSchema = z.infer<typeof assumptionSchema>;
export type EngineWarningSchema = z.infer<typeof engineWarningSchema>;
export type PlanImpactSchema = z.infer<typeof planImpactSchema>;
export type AdventureIntentSchema = z.infer<typeof adventureIntentSchema>;
export type PlanParticipantSchema = z.infer<typeof planParticipantSchema>;
export type AdventureDatesSchema = z.infer<typeof adventureDatesSchema>;
export type AdventureDestinationSchema = z.infer<typeof adventureDestinationSchema>;
export type MonitoringRuleSchema = z.infer<typeof monitoringRuleSchema>;
export type AdventurePlanOutput = z.infer<typeof adventurePlanSchema>;
export type AdventurePlanInput = z.input<typeof adventurePlanSchema>;
export type AdventureDecisionOutput = z.infer<typeof adventureDecisionSchema>;
export type PlanVersionMetaOutput = z.infer<typeof planVersionMetaSchema>;
