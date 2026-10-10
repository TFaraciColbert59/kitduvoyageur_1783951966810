/**
 * LKDV Feed V1 - Pure Functional Utility Scoring Engine
 *
 * Implements the deterministic multi-signal utility scoring formula:
 * S_total = max(0, min(1, [0.30 * S_intent + 0.25 * S_utility + 0.20 * S_quality + 0.15 * S_geo + 0.10 * S_social] * F_freshness - P_feedback))
 *
 * Invariant: Utility + Intent + Quality + Geo = 0.90 >> Social (0.10)
 */

import type { FeedCandidateItem, ScoredCandidateItem, ScoreBreakdown } from '../types/feed.types';

export const FEED_WEIGHTS = {
  intent: 0.30,
  utility: 0.25,
  quality: 0.20,
  geo: 0.15,
  social: 0.10,
} as const;

export const FRESHNESS_DECAY_RATE = 0.015;
export const EVERGREEN_UTILITY_THRESHOLD = 0.80;
export const EVERGREEN_FRESHNESS_FLOOR = 0.40;
export const LESS_LIKE_THIS_PENALTY = 0.35;

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export interface CalculatedSubScores {
  intent: number;
  utility: number;
  quality: number;
  geo: number;
  social: number;
  freshnessDecay: number;
  feedbackPenalty: number;
}

/**
 * Calculates individual sub-scores for a candidate item.
 * Pure function: deterministic, no side effects.
 */
export function calculateSubScores(
  candidate: FeedCandidateItem,
  referenceTime?: Date
): CalculatedSubScores {
  const { intent, utility, quality, geo, social, feedback } = candidate.signals;

  // 1. Intent score (0.30)
  let rawIntent = 0;
  if (intent.matchesDestination) rawIntent += 0.70;
  if (intent.matchesActivity) rawIntent += 0.30;
  
  const imminence = intent.imminenceMultiplier ?? (
    intent.daysUntilTrip !== undefined && intent.daysUntilTrip <= 14 ? 1.2 : 1.0
  );
  const intentScore = clamp01(rawIntent * imminence);

  // 2. Utility score (0.25)
  let rawUtility = 0;
  if (utility.hasVerifiedCarnet) rawUtility += 0.40;
  if (utility.hasGpsTrack) rawUtility += 0.25;
  if (utility.isTipOrSafety) rawUtility += 0.20;
  if (utility.hasVerifiedGear) rawUtility += 0.15;
  const utilityScore = clamp01(rawUtility);

  // 3. Quality score (0.20)
  const trustScoreValue = quality.authorTrustScore != null
    ? Math.min(100, Math.max(0, quality.authorTrustScore))
    : 50;
  const trustPart = (trustScoreValue / 100) * 0.60;

  let loyaltyPart = 0.05;
  if (quality.authorLoyaltyLevel === 'ambassadeur' || quality.authorLoyaltyLevel === 'guide') {
    loyaltyPart = 0.25;
  } else if (quality.authorLoyaltyLevel === 'expert') {
    loyaltyPart = 0.15;
  }

  const contentPart = quality.hasSubstantialContent ? 0.15 : 0;
  const qualityScore = clamp01(trustPart + loyaltyPart + contentPart);

  // 4. Geo score (0.15)
  let geoScore = 0;
  if (geo.matchesMassif) {
    geoScore = 1.00;
  } else if (geo.distanceKm != null && !geo.excludeLocation) {
    const dist = Math.max(0, geo.distanceKm);
    geoScore = clamp01(Math.exp(-dist / 100));
  } else if (geo.matchesRegion) {
    geoScore = 0.60;
  }

  // 5. Social score (0.10)
  let rawSocial = 0;
  if (social.isAuthorFollowed) rawSocial += 0.70;
  if (social.sharesClubMembership) rawSocial += 0.30;
  const socialScore = clamp01(rawSocial);

  // 6. Freshness decay
  const now = referenceTime ?? new Date();
  const created = new Date(candidate.createdAt);
  const diffHours = Math.max(0, (now.getTime() - created.getTime()) / (1000 * 3600));
  let decay = 1 / (1 + FRESHNESS_DECAY_RATE * diffHours);

  // Evergreen protection for high-utility items (verified carnets with safety notes)
  if (utilityScore >= EVERGREEN_UTILITY_THRESHOLD) {
    decay = Math.max(EVERGREEN_FRESHNESS_FLOOR, decay);
  }
  const freshnessDecay = clamp01(decay);

  // 7. Negative feedback penalty
  const feedbackPenalty = feedback.hasLessLikeThisFeedback ? LESS_LIKE_THIS_PENALTY : 0;

  return {
    intent: intentScore,
    utility: utilityScore,
    quality: qualityScore,
    geo: geoScore,
    social: socialScore,
    freshnessDecay,
    feedbackPenalty,
  };
}

/**
 * Calculates total utility score and returns candidate enriched with score breakdown.
 * Formula:
 * S_total = max(0, min(1, [0.30 * S_intent + 0.25 * S_utility + 0.20 * S_quality + 0.15 * S_geo + 0.10 * S_social] * F_freshness - P_feedback))
 */
export function calculateUtilityScore(
  candidate: FeedCandidateItem,
  referenceTime?: Date
): ScoredCandidateItem {
  const subScores = calculateSubScores(candidate, referenceTime);

  const weightedSum =
    FEED_WEIGHTS.intent * subScores.intent +
    FEED_WEIGHTS.utility * subScores.utility +
    FEED_WEIGHTS.quality * subScores.quality +
    FEED_WEIGHTS.geo * subScores.geo +
    FEED_WEIGHTS.social * subScores.social;

  const totalBeforePenalty = weightedSum * subScores.freshnessDecay;
  const finalTotal = clamp01(totalBeforePenalty - subScores.feedbackPenalty);

  const breakdown: ScoreBreakdown = {
    total: Math.round(finalTotal * 10000) / 10000,
    intent: Math.round(subScores.intent * 10000) / 10000,
    utility: Math.round(subScores.utility * 10000) / 10000,
    quality: Math.round(subScores.quality * 10000) / 10000,
    geo: Math.round(subScores.geo * 10000) / 10000,
    social: Math.round(subScores.social * 10000) / 10000,
    freshnessDecay: Math.round(subScores.freshnessDecay * 10000) / 10000,
    feedbackPenalty: subScores.feedbackPenalty,
  };

  return {
    ...candidate,
    score: breakdown.total,
    scoreBreakdown: breakdown,
  };
}

/**
 * Batch score a list of candidates deterministically.
 */
export function scoreCandidates(
  candidates: FeedCandidateItem[],
  referenceTime?: Date
): ScoredCandidateItem[] {
  return candidates.map((candidate) => calculateUtilityScore(candidate, referenceTime));
}
