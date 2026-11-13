import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api/respond';
import { badRequest, unauthorized } from '@/lib/rankings/http';
import { buildPeersPayload } from '@/lib/rankings/builders';
import { parsePeersQuery } from '@/lib/rankings/query';
import { resolveRankingsRequest } from '@/lib/rankings/requestContext';
import {
  loadPrivacyContext,
  loadRankingActivities,
  loadRankingProfiles,
  loadSummits,
} from '@/lib/rankings/serverData';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/rankings/peers?period=weekly&sport=all
 * Comparaison avec les pairs MUTUELS uniquement (S6.19 + P01), métriques
 * absentes laissées à `null` ; les deltas correspondants restent `null`.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await resolveRankingsRequest(request, 'rankings-peers');
    if (context.limited) return context.limited;
    if (!context.viewerId) return unauthorized();

    const parsed = parsePeersQuery(request.nextUrl.searchParams);
    if (!parsed.ok) return badRequest(parsed.error);

    const privacy = await loadPrivacyContext(context.supabase, context.viewerId);
    const peerIds = Array.from(privacy.authorizedPeerIds ?? []);
    const userIds = [context.viewerId, ...peerIds];

    const [activities, peaks] = await Promise.all([
      loadRankingActivities(context.supabase, {
        sinceDays: 120,
        limit: 3000,
        userIds,
        referenceDate: parsed.value.referenceDate,
      }),
      loadSummits(context.supabase),
    ]);
    const profiles = await loadRankingProfiles(
      context.supabase,
      activities.map((activity) => activity.userId),
      { authenticated: true }
    );

    return NextResponse.json(
      {
        success: true,
        data: buildPeersPayload(
          activities,
          profiles,
          privacy,
          parsed.value,
          peaks,
          new Map<string, number>()
        ),
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('[API /api/rankings/peers]', error);
    return fail('server', 'Comparaison indisponible.');
  }
}
