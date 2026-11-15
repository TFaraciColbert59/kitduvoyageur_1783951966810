import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api/respond';
import { badRequest } from '@/lib/rankings/http';
import { buildLeaderboardPayload } from '@/lib/rankings/builders';
import { parseLeaderboardQuery } from '@/lib/rankings/query';
import { resolveRankingsRequest } from '@/lib/rankings/requestContext';
import { loadPrivacyContext, loadRankingActivities, loadRankingProfiles } from '@/lib/rankings/serverData';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/rankings/leaderboard
 * Classement hebdomadaire ou mensuel, filtré par sport, métrique et périmètre.
 * Aucune coordonnée GPS, aucun utilisateur privé / bloqué / opt-out.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await resolveRankingsRequest(request, 'rankings-leaderboard');
    if (context.limited) return context.limited;

    const parsed = parseLeaderboardQuery(request.nextUrl.searchParams);
    if (!parsed.ok) return badRequest(parsed.error);

    // 45 jours avant la date de référence couvrent la semaine et le mois,
    // y compris quand l'API est interrogée sur une période passée.
    const activities = await loadRankingActivities(context.supabase, {
      sinceDays: 45,
      limit: 2500,
      referenceDate: parsed.value.query.referenceDate,
    });
    const profiles = await loadRankingProfiles(
      context.supabase,
      activities.map((activity) => activity.userId),
      { authenticated: Boolean(context.viewerId) }
    );
    const privacy = await loadPrivacyContext(context.supabase, context.viewerId, {
      includeClubMembers: parsed.value.query.scope === 'club',
    });

    const payload = buildLeaderboardPayload(
      activities,
      profiles,
      privacy,
      parsed.value.query,
      parsed.value.limit
    );

    return NextResponse.json(
      { success: true, data: payload },
      { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } }
    );
  } catch (error) {
    console.error('[API /api/rankings/leaderboard]', error);
    return fail('server', 'Classement indisponible.');
  }
}
