export type {
  LayerId,
  ConfidenceLevel,
  ProvenanceType,
  InferredConfidence,
  Inferred,
  Provenance,
  Proposal,
  TripBrief,
  Blueprint,
} from '../schemas/autoGen.schema';

export interface BlueprintFilter {
  countryCode?: string;
  season?: 'spring' | 'summer' | 'autumn' | 'winter';
  durationTier?: 'weekend' | 'week' | 'extended';
  styleTier?: 'refuge' | 'bivouac' | 'fast_light';
  budgetTier?: 'shoestring' | 'moderate';
}
