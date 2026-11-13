import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api/respond';
import { unauthorized } from '@/lib/rankings/http';
import { buildPeaksSummaryForViewer } from '@/lib/rankings/builders';
import { resolveRankingsRequest } from '@/lib/rankings/requestContext';
import { loadRankingActivities, loadSummits } from '@/lib/rankings/serverData';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/rankings/peaks — Peak Bagging du propriétaire.
 * Les traces GPS ne quittent jamais le serveur : seule la synthèse (sommets,
 * dates, distances minimales) est renvoyée.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await resolveRankingsRequest(request, 'rankings-peaks');
    if (context.limited) return context.limited;
    if (!context.viewerId) return unauthorized();

    const [activities, peaks] = await Promise.all([
      loadRankingActivities(context.supabase, {
        sinceDays: 3650,
        limit: 500,
        userIds: [context.viewerId],
        includeGps: true,
      }),
      loadSummits(context.supabase),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: buildPeaksSummaryForViewer(context.viewerId, activities, peaks),
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('[API /api/rankings/peaks]', error);
    return fail('server', 'Peak Bagging indisponible.');
  }
}
