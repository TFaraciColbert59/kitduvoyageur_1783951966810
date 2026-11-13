import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api/respond';
import { buildChallengesPayload } from '@/lib/rankings/builders';
import { resolveRankingsRequest } from '@/lib/rankings/requestContext';
import {
  loadChallengeCatalog,
  loadPrivacyContext,
  loadRankingActivities,
  loadRankingProfiles,
} from '@/lib/rankings/serverData';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/rankings/challenges
 * Catalogue des défis + progression du spectateur + classement du défi.
 * Un défi non mesurable par une activité GPS est renvoyé `trackable: false`
 * avec `progress: null` (jamais un zéro inventé).
 */
export async function GET(request: NextRequest) {
  try {
    const context = await resolveRankingsRequest(request, 'rankings-challenges');
    if (context.limited) return context.limited;

    const [catalog, activities] = await Promise.all([
      loadChallengeCatalog(context.supabase),
      loadRankingActivities(context.supabase, { sinceDays: 365, limit: 3000 }),
    ]);
    const profiles = await loadRankingProfiles(
      context.supabase,
      activities.map((activity) => activity.userId),
      { authenticated: Boolean(context.viewerId) }
    );
    const privacy = await loadPrivacyContext(context.supabase, context.viewerId);

    return NextResponse.json(
      {
        success: true,
        data: buildChallengesPayload(
          catalog,
          activities,
          profiles,
          privacy,
          context.viewerId
        ),
      },
      { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } }
    );
  } catch (error) {
    console.error('[API /api/rankings/challenges]', error);
    return fail('server', 'Défis indisponibles.');
  }
}
