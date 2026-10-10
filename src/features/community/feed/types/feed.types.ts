/**
 * LKDV Feed V1 - Feed & Recommendation Engine Types
 */

import type { CandidateSignals } from './signals.types';

export type CandidatePoolType = 'follows' | 'clubs' | 'geo' | 'intent' | 'discovery';

export type FeedTab = 'pour-toi' | 'abonnements' | 'autour-de-moi' | 'clubs';

export type PostType = 'post' | 'tip' | 'question' | 'share' | 'event';

export interface AuthorSummary {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  trustScore?: number | null;
  loyaltyLevel?: string | null;
}

export interface LinkedCarnetSummary {
  id: string;
  title?: string;
  destination?: string;
  verified?: boolean;
  routeRating?: number | null;
  tags?: string[];
}

export interface FeedCandidateItem {
  id: string;
  authorId: string;
  content: string;
  postType: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  linkedCarnetId?: string | null;
  snapshotPayload?: Record<string, unknown> | null;
  snapshotAt?: string | null;
  snapshotExcludeLocation?: boolean;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  sharesCount?: number;
  isTrending?: boolean;
  originPools?: CandidatePoolType[];
  author?: AuthorSummary;
  linkedCarnet?: LinkedCarnetSummary;
  signals: CandidateSignals;
}

export interface ScoreBreakdown {
  total: number;
  intent: number;
  utility: number;
  quality: number;
  geo: number;
  social: number;
  freshnessDecay?: number;
  feedbackPenalty?: number;
}

export interface ScoredCandidateItem extends FeedCandidateItem {
  score: number;
  scoreBreakdown: ScoreBreakdown;
}

export type TransparencyReason =
  | 'travel_intent'
  | 'following'
  | 'territory'
  | 'club'
  | 'quality_field_proof'
  | 'discovery';

export interface RecommendationTransparency {
  primaryReason: TransparencyReason;
  explanation: string;
  badgeLabel?: string;
  scoreBreakdown: {
    total: number;
    intent: number;
    utility: number;
    quality: number;
    geo: number;
    social: number;
  };
  matchedSignals: {
    tripDestination?: string;
    massif?: string;
    clubName?: string;
    isVerifiedCarnet?: boolean;
    authorTrustScore?: number;
  };
}

export interface UserInteractions {
  isSaved: boolean;
  isLiked: boolean;
  reaction?: string;
}

export interface FeedV1Item {
  post: FeedCandidateItem;
  transparency: RecommendationTransparency;
  userInteractions: UserInteractions;
}

export interface FeedV1Response {
  items: FeedV1Item[];
  nextCursor?: string;
  hasMore?: boolean;
}

export interface ActiveTripIntent {
  id?: string;
  destinationCountryCode?: string;
  destinationName?: string;
  startDate?: string;
  endDate?: string;
  primaryActivity?: string;
}

export interface FeedContext {
  userId?: string | null;
  userLatitude?: number | null;
  userLongitude?: number | null;
  userMassif?: string | null;
  activeTrips?: ActiveTripIntent[];
  followedAuthorIds?: Set<string>;
  joinedClubIds?: Set<string>;
  authorClubMap?: Map<string, { id: string; name: string }[]>;
  hiddenPostIds?: Set<string>;
  blockedAuthorIds?: Set<string>;
  hiddenCarnetIds?: Set<string>;
  reportedCarnetIds?: Set<string>;
  lessLikeThisAuthorIds?: Set<string>;
  lessLikeThisPostIds?: Set<string>;
  lessLikeThisCarnetIds?: Set<string>;
}

export interface RerankOptions {
  maxConsecutivePerAuthor?: number; // default: 2
  maxConsecutivePerFormat?: number; // default: 2
}
