/**
 * LKDV Feed V1 - Candidate Signal Types
 *
 * Types representing the signals used by the multi-signal utility scoring engine:
 * Intent (0.30), Utility (0.25), Quality (0.20), Geo (0.15), Social (0.10),
 * Freshness decay, and Negative feedback penalty.
 */

export interface IntentSignal {
  /** Post content or carnet destination matches user's planned trip destination / country code */
  matchesDestination: boolean;
  /** Activity (trekking, bivouac, etc.) matches planned trip activity */
  matchesActivity: boolean;
  /** Destination name matched (for transparency display) */
  matchedDestinationName?: string;
  /** ISO date of planned trip start */
  tripStartDate?: string;
  /** Number of days remaining until planned trip start */
  daysUntilTrip?: number;
  /** Imminence multiplier (1.2 if trip starts within 14 days, capped at 1.0 on score) */
  imminenceMultiplier?: number;
}

export interface UtilitySignal {
  /** Linked carnet exists and is officially verified */
  hasVerifiedCarnet: boolean;
  /** Linked carnet title or destination */
  linkedCarnetTitle?: string;
  /** Post or linked carnet contains GPS track (map points, gpx, elevation profile) */
  hasGpsTrack: boolean;
  /** Post is marked as 'tip' or contains verified field/safety/weather notes */
  isTipOrSafety: boolean;
  /** Mentions verified gear, backpack configuration or packlist */
  hasVerifiedGear: boolean;
}

export interface QualitySignal {
  /** Author trust score from public_profiles (0 to 100, defaults to 50 if null) */
  authorTrustScore?: number | null;
  /** Author loyalty level (ambassadeur, guide, expert, standard) */
  authorLoyaltyLevel?: 'ambassadeur' | 'guide' | 'expert' | string | null;
  /** Content is substantial (>= 150 chars or verified high-res photo) */
  hasSubstantialContent: boolean;
}

export interface GeoSignal {
  /** Explicit massif name match with user's home territory / active focus (e.g. Chartreuse, Vercors) */
  matchesMassif: boolean;
  /** Name of matched massif */
  matchedMassifName?: string;
  /** Regional zone match (e.g. Alpes du Nord, Pyrénées) */
  matchesRegion: boolean;
  /** Distance in kilometers from user location (if coordinates provided and location not excluded) */
  distanceKm?: number | null;
  /** True if author withheld coordinates via snapshot_exclude_location */
  excludeLocation?: boolean;
}

export interface SocialSignal {
  /** Current user follows the post author */
  isAuthorFollowed: boolean;
  /** Current user shares one or more active clubs with post author */
  sharesClubMembership: boolean;
  /** Name of shared club (for transparency explanation) */
  sharedClubName?: string;
}

export interface FeedbackSignal {
  /** User marked this post or author with 'less_like_this' */
  hasLessLikeThisFeedback: boolean;
  /** Post is explicitly hidden by user */
  isPostHidden: boolean;
  /** Author is blocked / reported by user */
  isAuthorBlocked: boolean;
}

export interface CandidateSignals {
  intent: IntentSignal;
  utility: UtilitySignal;
  quality: QualitySignal;
  geo: GeoSignal;
  social: SocialSignal;
  feedback: FeedbackSignal;
}
