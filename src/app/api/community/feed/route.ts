/**
 * API Route: GET /api/community/feed
 *
 * Feed V1 recommendation endpoint delivering personalized outdoor community content
 * partitioned across 4 tabs:
 * - 'pour-toi': Full deterministic multi-pool utility scoring & diversity reranking
 * - 'abonnements': Followed authors
 * - 'autour-de-moi': Geo & territory proximity
 * - 'clubs': Joined club stream
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFeedV1, type FeedTab } from '@/features/community/feed';

export const dynamic = 'force-dynamic';

const VALID_TABS: ReadonlySet<string> = new Set<string>([
  'pour-toi',
  'abonnements',
  'autour-de-moi',
  'clubs',
]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. Parse & validate tab parameter
    const tabParam = searchParams.get('tab') || 'pour-toi';
    const tab: FeedTab = VALID_TABS.has(tabParam)
      ? (tabParam as FeedTab)
      : 'pour-toi';

    // 2. Parse coordinates & filters
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    const lat = latParam ? parseFloat(latParam) : null;
    const lng = lngParam ? parseFloat(lngParam) : null;
    const massif = searchParams.get('massif') || null;

    // 3. Parse pagination parameters
    const limitParam = searchParams.get('limit');
    const parsed = parseInt(limitParam || '', 10);
    const limit = Number.isFinite(parsed) ? Math.min(50, Math.max(1, parsed)) : 20;
    const cursor = searchParams.get('cursor') || null;

    // 4. Authenticate session user (or proceed as guest)
    let userId: string | null = null;
    let supabase: any = null;

    try {
      supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
      }
    } catch {
      // Guest mode or unauthenticated fallback
      userId = null;
    }

    // 5. Generate feed through feed service
    const feed = await getFeedV1({
      tab,
      userId,
      lat: Number.isNaN(lat) ? null : lat,
      lng: Number.isNaN(lng) ? null : lng,
      massif,
      limit,
      cursor,
      supabaseClient: supabase,
    });

    return NextResponse.json(feed, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[/api/community/feed] Unhandled error:', error);
    return NextResponse.json(
      {
        error: 'Erreur lors du chargement du fil communautaire',
        items: [],
        hasMore: false,
      },
      { status: 500 }
    );
  }
}
