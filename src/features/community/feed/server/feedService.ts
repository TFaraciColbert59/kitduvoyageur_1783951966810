/**
 * LKDV Feed V1 - Server Feed Service Orchestrator
 *
 * Implements the end-to-end recommendation pipeline:
 * 1. User context & candidate retrieval (Supabase or Candidate Pool generator)
 * 2. Privacy & content feedback filtering
 * 3. Multi-signal utility scoring formula
 * 4. Deterministic diversity reranking
 * 5. Explanatory transparency metadata generation
 * 6. User interaction state decoration (saved, liked, reaction)
 * 7. Cursor pagination
 */

import type {
  FeedCandidateItem,
  FeedContext,
  FeedTab,
  FeedV1Item,
  FeedV1Response,
  RerankOptions,
  UserInteractions,
} from '../types/feed.types';
import { calculateUtilityScore } from '../domain/scoringEngine';
import { rerankWithDiversity } from '../domain/diversityReranker';
import { generateTransparencyMetadata } from '../domain/transparencyGenerator';
import { mergeCandidatePools, type PoolCandidatesMap } from '../domain/candidatePools';
import { applyFeedbackFilter, type UserFeedbackContext } from './feedbackFilter';
import { buildCandidateItem, type RawPostRecord, type RawAuthorRecord, type RawCarnetRecord } from './candidateBuilder';

export interface GetFeedOptions {
  tab?: FeedTab;
  userId?: string | null;
  lat?: number | null;
  lng?: number | null;
  massif?: string | null;
  limit?: number;
  cursor?: string | null;
  referenceTime?: Date;
  rerankOptions?: RerankOptions;
  // Optional pre-loaded candidates or injected Supabase client
  candidates?: FeedCandidateItem[];
  supabaseClient?: any;
}

interface CursorPayload {
  offset: number;
}

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset } satisfies CursorPayload)).toString('base64');
}

export function decodeCursor(cursor?: string | null): number {
  if (!cursor) return 0;
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed = JSON.parse(raw) as CursorPayload;
    return typeof parsed.offset === 'number' && parsed.offset >= 0 ? parsed.offset : 0;
  } catch {
    return 0;
  }
}

/**
 * Pure pipeline executor:
 * Takes candidates, user context, and feed options to produce a finalized FeedV1Response.
 */
export function generateFeedFromCandidates(
  candidates: FeedCandidateItem[],
  context: FeedContext = {},
  options: GetFeedOptions = {}
): FeedV1Response {
  const tab: FeedTab = options.tab ?? 'pour-toi';
  const rawLimit = options.limit != null ? Number(options.limit) : 20;
  const limit = Number.isFinite(rawLimit) ? Math.min(50, Math.max(1, rawLimit)) : 20;
  const offset = decodeCursor(options.cursor);
  const now = options.referenceTime ?? new Date();

  // 1. Tab-specific filtering
  let poolCandidates = [...candidates];

  if (tab === 'abonnements') {
    poolCandidates = poolCandidates.filter(
      (c) =>
        c.signals.social.isAuthorFollowed ||
        (c.originPools && c.originPools.includes('follows')) ||
        (context.followedAuthorIds && context.followedAuthorIds.has(c.authorId))
    );
  } else if (tab === 'autour-de-moi') {
    poolCandidates = poolCandidates.filter(
      (c) =>
        c.signals.geo.matchesMassif ||
        c.signals.geo.matchesRegion ||
        (c.originPools && c.originPools.includes('geo')) ||
        (c.signals.geo.distanceKm != null && c.signals.geo.distanceKm <= 100)
    );
  } else if (tab === 'clubs') {
    poolCandidates = poolCandidates.filter(
      (c) =>
        c.signals.social.sharesClubMembership ||
        (c.originPools && c.originPools.includes('clubs'))
    );
  }

  // 2. Feedback filtering (hide, report, less_like_this)
  const feedbackContext: UserFeedbackContext = {
    hiddenPostIds: context.hiddenPostIds,
    blockedAuthorIds: context.blockedAuthorIds,
    hiddenCarnetIds: context.hiddenCarnetIds,
    reportedCarnetIds: context.reportedCarnetIds,
    lessLikeThisPostIds: context.lessLikeThisPostIds,
    lessLikeThisAuthorIds: context.lessLikeThisAuthorIds,
    lessLikeThisCarnetIds: context.lessLikeThisCarnetIds,
  };
  const filteredCandidates = applyFeedbackFilter(poolCandidates, feedbackContext);

  // 3. Multi-signal utility scoring
  const scoredCandidates = filteredCandidates.map((c) => calculateUtilityScore(c, now));

  // 4. Deterministic diversity reranking
  const rerankedCandidates = rerankWithDiversity(scoredCandidates, options.rerankOptions);

  // 5. Pagination slicing
  const slicedCandidates = rerankedCandidates.slice(offset, offset + limit);
  const hasMore = offset + limit < rerankedCandidates.length;
  const nextCursor = hasMore ? encodeCursor(offset + limit) : undefined;

  // 6. Metadata generation & User interactions decoration
  const items: FeedV1Item[] = slicedCandidates.map((scoredItem) => {
    const transparency = generateTransparencyMetadata(scoredItem);

    const userInteractions: UserInteractions = {
      isSaved: false,
      isLiked: false,
    };

    return {
      post: scoredItem,
      transparency,
      userInteractions,
    };
  });

  return {
    items,
    nextCursor,
    hasMore,
  };
}

/**
 * Server-side Feed Service entry point.
 * Queries Supabase when a client is provided, or executes with fallback candidates.
 */
export async function getFeedV1(options: GetFeedOptions): Promise<FeedV1Response> {
  const {
    tab = 'pour-toi',
    userId,
    lat,
    lng,
    massif,
    limit = 20,
    cursor,
    supabaseClient,
    candidates: providedCandidates,
  } = options;

  // 1. If pre-loaded candidates are passed directly, use them
  if (providedCandidates && providedCandidates.length > 0) {
    const context: FeedContext = {
      userId,
      userLatitude: lat,
      userLongitude: lng,
      userMassif: massif,
    };
    return generateFeedFromCandidates(providedCandidates, context, options);
  }

  // 2. If Supabase client is available, query database
  let client = supabaseClient;
  if (!client && typeof window === 'undefined') {
    try {
      const { createClient } = await import('@/lib/supabase/server');
      client = await createClient();
    } catch {
      // Graceful fallback if server context cannot initialize cookies
      client = null;
    }
  }

  if (!client) {
    // Return empty feed gracefully if no database connection
    return {
      items: [],
      hasMore: false,
    };
  }

  try {
    // A. Query User Context (follows, feedback, trips, clubs, saves, likes)
    const context: FeedContext = {
      userId,
      userLatitude: lat,
      userLongitude: lng,
      userMassif: massif,
      followedAuthorIds: new Set<string>(),
      joinedClubIds: new Set<string>(),
      authorClubMap: new Map<string, { id: string; name: string }[]>(),
      hiddenPostIds: new Set<string>(),
      blockedAuthorIds: new Set<string>(),
      hiddenCarnetIds: new Set<string>(),
      reportedCarnetIds: new Set<string>(),
      lessLikeThisAuthorIds: new Set<string>(),
      lessLikeThisPostIds: new Set<string>(),
      lessLikeThisCarnetIds: new Set<string>(),
      activeTrips: [],
    };

    const savedPostIds = new Set<string>();
    const likedPostInteractions = new Map<string, string>(); // postId -> reaction
    const userClubNames = new Map<string, string>();

    if (userId) {
      const [followsRes, clubsRes, feedbackRes, tripsRes, savesRes, likesRes] = await Promise.allSettled([
        client.from('user_follows').select('following_id').eq('follower_id', userId),
        client.from('club_members').select('club_id, clubs(id, name)').eq('user_id', userId),
        client.from('content_feedback').select('target_type, target_id, feedback_type').eq('user_id', userId),
        client.from('trips').select('destination_country_code, destination_name, start_date, primary_activity').eq('user_id', userId),
        client.from('post_saves').select('post_id').eq('user_id', userId),
        client.from('post_likes').select('post_id, reaction').eq('user_id', userId),
      ]);

      if (followsRes.status === 'fulfilled' && followsRes.value.data) {
        followsRes.value.data.forEach((r: { following_id: string }) => context.followedAuthorIds?.add(r.following_id));
      }

      if (clubsRes.status === 'fulfilled' && clubsRes.value.data) {
        clubsRes.value.data.forEach((r: any) => {
          if (r.club_id) {
            context.joinedClubIds?.add(r.club_id);
            if (r.clubs) {
              const name = typeof r.clubs === 'object' && !Array.isArray(r.clubs) ? r.clubs.name : (Array.isArray(r.clubs) ? r.clubs[0]?.name : undefined);
              if (name) userClubNames.set(r.club_id, String(name));
            }
          }
        });
      }

      if (feedbackRes.status === 'fulfilled' && feedbackRes.value.data) {
        feedbackRes.value.data.forEach((fb: { target_type: string; target_id: string; feedback_type: string }) => {
          if (fb.feedback_type === 'hide') {
            if (fb.target_type === 'post') context.hiddenPostIds?.add(fb.target_id);
            if (fb.target_type === 'author') context.blockedAuthorIds?.add(fb.target_id);
            if (fb.target_type === 'carnet') context.hiddenCarnetIds?.add(fb.target_id);
          } else if (fb.feedback_type === 'report') {
            if (fb.target_type === 'post') context.hiddenPostIds?.add(fb.target_id);
            if (fb.target_type === 'author') context.blockedAuthorIds?.add(fb.target_id);
            if (fb.target_type === 'carnet') context.reportedCarnetIds?.add(fb.target_id);
          } else if (fb.feedback_type === 'less_like_this') {
            if (fb.target_type === 'post') context.lessLikeThisPostIds?.add(fb.target_id);
            if (fb.target_type === 'author') context.lessLikeThisAuthorIds?.add(fb.target_id);
            if (fb.target_type === 'carnet') context.lessLikeThisCarnetIds?.add(fb.target_id);
          }
        });
      }

      if (tripsRes.status === 'fulfilled' && tripsRes.value.data) {
        context.activeTrips = tripsRes.value.data.map((t: any) => ({
          destinationCountryCode: t.destination_country_code,
          destinationName: t.destination_name,
          startDate: t.start_date,
          primaryActivity: t.primary_activity,
        }));
      }

      if (savesRes.status === 'fulfilled' && savesRes.value.data) {
        savesRes.value.data.forEach((s: { post_id: string }) => savedPostIds.add(s.post_id));
      }

      if (likesRes.status === 'fulfilled' && likesRes.value.data) {
        likesRes.value.data.forEach((l: { post_id: string; reaction: string }) => {
          likedPostInteractions.set(l.post_id, l.reaction);
        });
      }
    }

    // B. Fetch Candidates
    const postsQuery = client
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: rawPosts, error: postsError } = await postsQuery;
    if (postsError || !rawPosts || rawPosts.length === 0) {
      return { items: [], hasMore: false };
    }

    // C. Fetch related authors, carnets, and mutual club memberships
    const authorIds = Array.from(new Set(rawPosts.map((p: RawPostRecord) => p.author_id)));
    const carnetIds = Array.from(
      new Set(rawPosts.map((p: RawPostRecord) => p.linked_carnet_id).filter(Boolean))
    );

    const [authorsRes, carnetsRes] = await Promise.allSettled([
      authorIds.length > 0
        ? client.from('public_profiles').select('id, full_name, avatar_url, trust_score, loyalty_level').in('id', authorIds)
        : Promise.resolve({ data: [] }),
      carnetIds.length > 0
        ? client.from('carnets').select('id, title, destination, verified, route_rating, tags, map_points').in('id', carnetIds)
        : Promise.resolve({ data: [] }),
    ]);

    const authorsMap = new Map<string, RawAuthorRecord>();
    if (authorsRes.status === 'fulfilled' && authorsRes.value.data) {
      authorsRes.value.data.forEach((a: RawAuthorRecord) => authorsMap.set(a.id, a));
    }

    const carnetsMap = new Map<string, RawCarnetRecord>();
    if (carnetsRes.status === 'fulfilled' && carnetsRes.value.data) {
      carnetsRes.value.data.forEach((c: RawCarnetRecord) => carnetsMap.set(c.id, c));
    }

    // Query mutual club membership between context.joinedClubIds and post authors
    if (userId && context.joinedClubIds && context.joinedClubIds.size > 0 && authorIds.length > 0) {
      try {
        const joinedClubIdArray = Array.from(context.joinedClubIds);
        let memberQuery = client
          .from('club_members')
          .select('club_id, user_id, clubs(id, name)');

        if (typeof memberQuery?.in === 'function') {
          memberQuery = memberQuery.in('club_id', joinedClubIdArray);
          if (typeof memberQuery?.in === 'function') {
            memberQuery = memberQuery.in('user_id', authorIds);
          }
        }

        const { data: memberRows } = await memberQuery;
        if (memberRows && Array.isArray(memberRows)) {
          for (const row of memberRows) {
            const clubId = row.club_id;
            let clubName = userClubNames.get(clubId) || 'Club';
            if (row.clubs) {
              if (typeof row.clubs === 'object' && !Array.isArray(row.clubs) && row.clubs.name) {
                clubName = String(row.clubs.name);
              } else if (Array.isArray(row.clubs) && row.clubs[0]?.name) {
                clubName = String(row.clubs[0].name);
              }
            }
            const currentList = context.authorClubMap?.get(row.user_id) || [];
            currentList.push({ id: clubId, name: clubName });
            context.authorClubMap?.set(row.user_id, currentList);
          }
        }
      } catch (err) {
        console.warn('[FeedService] Unable to resolve author clubs:', err);
      }
    }

    // D. Build candidate items & organize across the 5 candidate pools
    const rawCandidateItems: FeedCandidateItem[] = rawPosts.map((post: RawPostRecord) => {
      const author = authorsMap.get(post.author_id);
      const carnet = post.linked_carnet_id ? carnetsMap.get(post.linked_carnet_id) : undefined;
      return buildCandidateItem(post, author, carnet, context);
    });

    const pools: PoolCandidatesMap = {
      follows: [],
      clubs: [],
      geo: [],
      intent: [],
      discovery: [],
    };

    for (const item of rawCandidateItems) {
      let inSpecificPool = false;
      if (item.signals.social.isAuthorFollowed) {
        pools.follows!.push({ ...item, originPools: ['follows'] });
        inSpecificPool = true;
      }
      if (item.signals.social.sharesClubMembership) {
        pools.clubs!.push({ ...item, originPools: ['clubs'] });
        inSpecificPool = true;
      }
      if (
        item.signals.geo.matchesMassif ||
        item.signals.geo.matchesRegion ||
        (item.signals.geo.distanceKm != null && item.signals.geo.distanceKm <= 100)
      ) {
        pools.geo!.push({ ...item, originPools: ['geo'] });
        inSpecificPool = true;
      }
      if (item.signals.intent.matchesDestination || item.signals.intent.matchesActivity) {
        pools.intent!.push({ ...item, originPools: ['intent'] });
        inSpecificPool = true;
      }
      // Discovery pool captures verified carnets, GPS tracks, tips, trending, or general discovery
      if (
        item.signals.utility.hasVerifiedCarnet ||
        item.signals.utility.hasGpsTrack ||
        item.signals.utility.isTipOrSafety ||
        item.isTrending ||
        !inSpecificPool
      ) {
        pools.discovery!.push({ ...item, originPools: ['discovery'] });
      }
    }

    const candidates: FeedCandidateItem[] = mergeCandidatePools(pools);

    // E. Execute feed pipeline
    const feedResponse = generateFeedFromCandidates(candidates, context, {
      tab,
      limit,
      cursor,
      userId,
      lat,
      lng,
      massif,
    });

    // F. Populate user interaction flags
    feedResponse.items.forEach((item) => {
      item.userInteractions.isSaved = savedPostIds.has(item.post.id);
      item.userInteractions.isLiked = likedPostInteractions.has(item.post.id);
      item.userInteractions.reaction = likedPostInteractions.get(item.post.id);
    });

    return feedResponse;
  } catch (err) {
    console.error('[FeedService] Error generating feed:', err);
    return { items: [], hasMore: false };
  }
}
