/**
 * LKDV Feed V1 - Candidate Signal Builder
 *
 * Transforms raw database post records into rich FeedCandidateItems
 * with fully populated multi-signal objects based on the user's context.
 */

import type {
  FeedCandidateItem,
  FeedContext,
  AuthorSummary,
  LinkedCarnetSummary,
} from '../types/feed.types';
import type { CandidateSignals } from '../types/signals.types';

export interface RawPostRecord {
  id: string;
  author_id: string;
  content: string;
  post_type: string;
  image_url?: string | null;
  image_alt?: string | null;
  linked_carnet_id?: string | null;
  snapshot_payload?: Record<string, unknown> | null;
  snapshot_at?: string | null;
  snapshot_exclude_location?: boolean;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  is_trending?: boolean;
  created_at: string;
}

export interface RawAuthorRecord {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  trust_score?: number | null;
  loyalty_level?: string | null;
}

export interface RawCarnetRecord {
  id: string;
  title?: string | null;
  destination?: string | null;
  verified?: boolean | null;
  route_rating?: number | null;
  tags?: string[] | null;
  map_points?: unknown;
}

/**
 * Computes Haversine great-circle distance between two GPS coordinates in km.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Known French mountain massifs for keyword matching.
 */
const KNOWN_MASSIFS = [
  'chartreuse',
  'vercors',
  'mont-blanc',
  'belledonne',
  'écrins',
  'ecrins',
  'bauges',
  'vanoise',
  'mercantour',
  'pyrenees',
  'pyrénées',
  'vosges',
  'jura',
  'massif central',
  'aravis',
  'queyras',
  'beaufortain',
];

/**
 * Builds candidate signals from raw post data and feed context.
 */
export function buildCandidateSignals(
  post: RawPostRecord,
  author?: RawAuthorRecord | null,
  carnet?: RawCarnetRecord | null,
  context: FeedContext = {}
): CandidateSignals {
  const contentLower = (post.content || '').toLowerCase();
  const carnetDest = (carnet?.destination || '').toLowerCase();

  // 1. Intent Signals
  let matchesDestination = false;
  let matchesActivity = false;
  let matchedDestinationName: string | undefined;
  let tripStartDate: string | undefined;
  let daysUntilTrip: number | undefined;

  if (context.activeTrips && context.activeTrips.length > 0) {
    for (const trip of context.activeTrips) {
      const tripDest = (trip.destinationName || '').toLowerCase();
      const tripCountry = (trip.destinationCountryCode || '').toLowerCase();
      const tripActivity = (trip.primaryActivity || '').toLowerCase();

      // Check destination match
      if (
        (tripDest && (contentLower.includes(tripDest) || carnetDest.includes(tripDest))) ||
        (tripCountry && contentLower.includes(tripCountry))
      ) {
        matchesDestination = true;
        matchedDestinationName = trip.destinationName || carnet?.destination || undefined;
      }

      // Check activity match
      if (tripActivity && (contentLower.includes(tripActivity) || carnet?.tags?.some(t => t.toLowerCase().includes(tripActivity)))) {
        matchesActivity = true;
      }

      // Trip date & imminence
      if (trip.startDate) {
        tripStartDate = trip.startDate;
        const tripDateMs = new Date(trip.startDate).getTime();
        const diffMs = tripDateMs - Date.now();
        const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 3600 * 24)));
        daysUntilTrip = diffDays;
      }
    }
  }

  // 2. Utility Signals
  const hasVerifiedCarnet = Boolean(carnet?.verified);
  const snapshot = post.snapshot_payload as Record<string, unknown> | null | undefined;
  const hasGpsTrack = Boolean(
    snapshot?.map_points ||
    snapshot?.gps_trace ||
    carnet?.map_points
  );
  const isTipOrSafety =
    post.post_type === 'tip' ||
    /s[ée]curit[ée]|m[ée]t[ée]o|refuge|bivouac|eau|danger|vigilance|itin[ée]raire|conseil/i.test(post.content);
  const hasVerifiedGear =
    Boolean(snapshot?.gear) ||
    /mat[ée]riel|sac à dos|sac|packlist|[ée]quipement|tente|duvet|chaussures/i.test(post.content);

  // 3. Quality Signals
  const authorTrustScore = author?.trust_score ?? 50;
  const authorLoyaltyLevel = author?.loyalty_level ?? null;
  const hasSubstantialContent = (post.content || '').length >= 150 || Boolean(post.image_url);

  // 4. Geo Signals
  let matchesMassif = false;
  let matchedMassifName: string | undefined;
  let matchesRegion = false;
  let distanceKm: number | null = null;
  const excludeLocation = Boolean(post.snapshot_exclude_location);

  // Check massif
  if (context.userMassif) {
    const userMassifLower = context.userMassif.toLowerCase();
    if (contentLower.includes(userMassifLower) || carnetDest.includes(userMassifLower)) {
      matchesMassif = true;
      matchedMassifName = context.userMassif;
    }
  } else {
    // Detect known massif from content
    for (const m of KNOWN_MASSIFS) {
      if (contentLower.includes(m) || carnetDest.includes(m)) {
        matchedMassifName = m.charAt(0).toUpperCase() + m.slice(1);
        break;
      }
    }
  }

  // Check coordinate distance if user provided lat/lng
  if (
    !excludeLocation &&
    context.userLatitude != null &&
    context.userLongitude != null &&
    snapshot?.latitude != null &&
    snapshot?.longitude != null
  ) {
    const postLat = Number(snapshot.latitude);
    const postLng = Number(snapshot.longitude);
    if (!Number.isNaN(postLat) && !Number.isNaN(postLng)) {
      distanceKm = calculateHaversineDistanceKm(
        context.userLatitude,
        context.userLongitude,
        postLat,
        postLng
      );
      if (distanceKm <= 50) {
        matchesRegion = true;
      }
    }
  }

  // 5. Social Signals
  const isAuthorFollowed = Boolean(
    context.followedAuthorIds && context.followedAuthorIds.has(post.author_id)
  );

  let sharesClubMembership = false;
  let sharedClubName: string | undefined;

  if (
    context.joinedClubIds &&
    context.joinedClubIds.size > 0 &&
    context.authorClubMap
  ) {
    const authorClubs = context.authorClubMap.get(post.author_id);
    if (authorClubs && authorClubs.length > 0) {
      for (const club of authorClubs) {
        if (context.joinedClubIds.has(club.id)) {
          sharesClubMembership = true;
          sharedClubName = club.name;
          break;
        }
      }
    }
  }

  // 6. Feedback Signals
  const linkedCarnetId = post.linked_carnet_id || carnet?.id;
  const isCarnetHidden = Boolean(
    linkedCarnetId &&
      ((context.hiddenCarnetIds && context.hiddenCarnetIds.has(linkedCarnetId)) ||
        (context.reportedCarnetIds && context.reportedCarnetIds.has(linkedCarnetId)))
  );
  const isPostHidden = Boolean(
    (context.hiddenPostIds && context.hiddenPostIds.has(post.id)) || isCarnetHidden
  );
  const isAuthorBlocked = Boolean(
    context.blockedAuthorIds && context.blockedAuthorIds.has(post.author_id)
  );
  const hasLessLikeThisFeedback = Boolean(
    (context.lessLikeThisPostIds && context.lessLikeThisPostIds.has(post.id)) ||
      (context.lessLikeThisAuthorIds && context.lessLikeThisAuthorIds.has(post.author_id)) ||
      (linkedCarnetId && context.lessLikeThisCarnetIds && context.lessLikeThisCarnetIds.has(linkedCarnetId))
  );

  return {
    intent: {
      matchesDestination,
      matchesActivity,
      matchedDestinationName,
      tripStartDate,
      daysUntilTrip,
      imminenceMultiplier: daysUntilTrip !== undefined && daysUntilTrip <= 14 ? 1.2 : 1.0,
    },
    utility: {
      hasVerifiedCarnet,
      linkedCarnetTitle: carnet?.title || undefined,
      hasGpsTrack,
      isTipOrSafety,
      hasVerifiedGear,
    },
    quality: {
      authorTrustScore,
      authorLoyaltyLevel,
      hasSubstantialContent,
    },
    geo: {
      matchesMassif,
      matchedMassifName,
      matchesRegion,
      distanceKm,
      excludeLocation,
    },
    social: {
      isAuthorFollowed,
      sharesClubMembership,
      sharedClubName,
    },
    feedback: {
      hasLessLikeThisFeedback,
      isPostHidden,
      isAuthorBlocked,
    },
  };
}

/**
 * Builds a complete FeedCandidateItem from raw database components.
 */
export function buildCandidateItem(
  post: RawPostRecord,
  author?: RawAuthorRecord | null,
  carnet?: RawCarnetRecord | null,
  context: FeedContext = {}
): FeedCandidateItem {
  const authorSummary: AuthorSummary | undefined = author
    ? {
        id: author.id,
        fullName: author.full_name || 'Voyageur LKDV',
        avatarUrl: author.avatar_url,
        trustScore: author.trust_score ?? 50,
        loyaltyLevel: author.loyalty_level,
      }
    : undefined;

  const carnetSummary: LinkedCarnetSummary | undefined = carnet
    ? {
        id: carnet.id,
        title: carnet.title || undefined,
        destination: carnet.destination || undefined,
        verified: Boolean(carnet.verified),
        routeRating: carnet.route_rating,
        tags: carnet.tags || [],
      }
    : undefined;

  const signals = buildCandidateSignals(post, author, carnet, context);

  return {
    id: post.id,
    authorId: post.author_id,
    content: post.content,
    postType: post.post_type,
    imageUrl: post.image_url,
    imageAlt: post.image_alt,
    linkedCarnetId: post.linked_carnet_id,
    snapshotPayload: post.snapshot_payload,
    snapshotAt: post.snapshot_at,
    snapshotExcludeLocation: post.snapshot_exclude_location,
    createdAt: post.created_at,
    likesCount: post.likes_count ?? 0,
    commentsCount: post.comments_count ?? 0,
    sharesCount: post.shares_count ?? 0,
    isTrending: post.is_trending ?? false,
    author: authorSummary,
    linkedCarnet: carnetSummary,
    signals,
  };
}
