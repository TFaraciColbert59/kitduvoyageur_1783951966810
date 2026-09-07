import { z } from 'zod';

export const LayerIdEnum = z.enum([
  'skeleton',
  'itinerary',
  'major_transport',
  'local_transport',
  'accommodations',
  'food_water',
  'kit',
  'poi',
  'budget',
  'compliance',
  'safety',
  'know_how',
]);

export type LayerId = z.infer<typeof LayerIdEnum>;

export const ConfidenceLevelEnum = z.enum(['high', 'medium', 'low']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelEnum>;

export const ProvenanceTypeEnum = z.enum([
  'measured',
  'official',
  'community',
  'computed',
  'estimated',
  'suggested',
]);
export type ProvenanceType = z.infer<typeof ProvenanceTypeEnum>;

export const InferredConfidenceEnum = z.enum(['stated', 'inferred', 'defaulted']);
export type InferredConfidence = z.infer<typeof InferredConfidenceEnum>;

export function createInferredSchema<T extends z.ZodTypeAny>(schema: T) {
  return z.object({
    value: schema,
    confidence: InferredConfidenceEnum,
    evidence: z.string().optional(),
  });
}

export type Inferred<T> = {
  value: T;
  confidence: InferredConfidence;
  evidence?: string;
};

export const ProvenanceSchema = z.object({
  source: ProvenanceTypeEnum,
  sourceRef: z.string().optional(),
  observedAt: z.string().optional(),
});

export type Provenance = z.infer<typeof ProvenanceSchema>;

// Base proposal schema definition
export const BaseProposalSchema = z.object({
  id: z.string(),
  layer: LayerIdEnum,
  slotId: z.string(),
  value: z.any(),
  provenance: ProvenanceSchema,
  confidence: ConfidenceLevelEnum,
  verifyUrl: z.string().optional(),
  rationale: z.string(),
  tradeoffs: z.array(z.string()).optional(),
  locked: z.boolean().default(false),
  editedByUser: z.boolean().default(false),
  impacts: z.array(z.string()).default([]),
});

export type Proposal<T = any> = z.infer<typeof BaseProposalSchema> & {
  value: T;
  alternatives: Proposal<T>[];
};

export const ProposalSchema: z.ZodType<Proposal> = BaseProposalSchema.extend({
  alternatives: z.lazy(() => z.array(ProposalSchema).default([])),
});

// TripBrief Schema definitions
export const TripStyleEnum = z.enum([
  'hiking',
  'trekking',
  'bivouac',
  'van',
  'cultural',
  'bikepacking',
  'trail',
  'fast_light',
  'mixed',
]);

export const BudgetTierEnum = z.enum(['shoestring', 'moderate', 'comfort']);

export const TransportModeEnum = z.enum([
  'foot',
  'bike',
  'train',
  'bus',
  'car',
  'plane',
  'ferry',
]);

export const TripBriefSchema = z.object({
  rawInput: z.string(),
  destinations: createInferredSchema(
    z.array(
      z.object({
        country: z.string(),
        region: z.string().optional(),
      })
    )
  ),
  duration: createInferredSchema(
    z.object({
      days: z.number().int().positive(),
      flexible: z.boolean().default(false),
    })
  ),
  window: createInferredSchema(
    z.object({
      start: z.string().optional(),
      end: z.string().optional(),
      month: z.number().int().min(1).max(12).optional(),
    })
  ),
  party: createInferredSchema(
    z.object({
      adults: z.number().int().min(1),
      minors: z.number().int().default(0),
      ages: z.array(z.number()).optional(),
    })
  ),
  budget: createInferredSchema(
    z.object({
      totalEur: z.number().positive().optional(),
      perDayEur: z.number().positive().optional(),
      tier: BudgetTierEnum.default('moderate'),
    })
  ),
  style: createInferredSchema(z.array(TripStyleEnum)),
  intensity: createInferredSchema(
    z.object({
      dailyKmMax: z.number().positive(),
      dailyGainMax: z.number().positive(),
      restEvery: z.number().int().positive(),
    })
  ),
  constraints: createInferredSchema(z.array(z.string())),
  mobility: createInferredSchema(
    z.object({
      modes: z.array(TransportModeEnum),
      ownsVehicle: z.boolean().default(false),
      licence: z.boolean().default(false),
    })
  ),
  departure: createInferredSchema(
    z.object({
      from: z.string().optional(),
    })
  ),
  fromProfile: z.object({
    ownedGear: z.array(z.string()).default([]),
    pastTrips: z.array(z.string()).default([]),
    crews: z.array(z.string()).default([]),
    units: z.enum(['metric', 'imperial']).default('metric'),
    homeAirports: z.array(z.string()).default(['PAR']),
  }),
});

export type TripBrief = z.infer<typeof TripBriefSchema>;

export const SeasonEnum = z.enum(['spring', 'summer', 'autumn', 'winter']);
export const DurationTierEnum = z.enum(['weekend', 'week', 'extended']);
export const StyleTierEnum = z.enum(['refuge', 'bivouac', 'fast_light']);

export const BlueprintSchema = z.object({
  id: z.string(),
  countryCode: z.string(),
  pole: z.string(),
  season: SeasonEnum,
  durationTier: DurationTierEnum,
  styleTier: StyleTierEnum,
  budgetTier: z.enum(['shoestring', 'moderate']),
  title: z.string(),
  summary: z.string(),
  layers: z.object({
    skeleton: ProposalSchema,
    itinerary: ProposalSchema,
    major_transport: ProposalSchema.optional(),
    local_transport: ProposalSchema.optional(),
    accommodations: ProposalSchema,
    food_water: ProposalSchema,
    kit: ProposalSchema,
    poi: ProposalSchema.optional(),
    budget: ProposalSchema,
    compliance: ProposalSchema,
    safety: ProposalSchema,
    know_how: ProposalSchema,
  }),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;
