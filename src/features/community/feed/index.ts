/**
 * LKDV Community Feed V1 Module
 *
 * Deterministic recommendation engine, multi-signal utility scoring,
 * diversity reranking, candidate pools, and transparency explanations.
 */

// Types
export * from './types/feed.types';
export * from './types/signals.types';

// Domain Engines
export {
  calculateUtilityScore,
  calculateSubScores,
  scoreCandidates,
  clamp01,
  FEED_WEIGHTS,
  FRESHNESS_DECAY_RATE,
  EVERGREEN_UTILITY_THRESHOLD,
  EVERGREEN_FRESHNESS_FLOOR,
  LESS_LIKE_THIS_PENALTY,
  type CalculatedSubScores,
} from './domain/scoringEngine';

export {
  rerankWithDiversity,
  deterministicItemComparator,
  type RerankableItem,
} from './domain/diversityReranker';

export {
  generateTransparencyMetadata,
  resolvePrimaryReason,
} from './domain/transparencyGenerator';

export {
  mergeCandidatePools,
  mergeCandidateSignals,
  CANDIDATE_POOL_NAMES,
  type PoolCandidatesMap,
} from './domain/candidatePools';

// Server Services
export {
  applyFeedbackFilter,
  type UserFeedbackContext,
} from './server/feedbackFilter';

export {
  buildCandidateItem,
  buildCandidateSignals,
  calculateHaversineDistanceKm,
  type RawPostRecord,
  type RawAuthorRecord,
  type RawCarnetRecord,
} from './server/candidateBuilder';

export {
  getFeedV1,
  generateFeedFromCandidates,
  encodeCursor,
  decodeCursor,
  type GetFeedOptions,
} from './server/feedService';
