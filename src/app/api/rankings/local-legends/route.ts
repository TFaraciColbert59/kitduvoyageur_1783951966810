import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api/respond';
import { badRequest } from '@/lib/rankings/http';
import { buildLocalLegendsPayload } from '@/lib/rankings/builders';
import { loadLegendDataset, loadLegendTargetName } from '@/lib/rankings/legendData';
import { parseLegendsQuery } from '@/lib/rankings/query';
import { resolveRankingsRequest } from '@/lib/rankings/requestContext';
import { loadPrivacyContext, loadRankingProfiles } from '@/lib/rankings/serverData';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/rankings/local-legends?targetType=route&targetId=…
 * Fenêtre glissante de 90 jours, minimum de passages, exclusion P01 / S6.19.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await resolveRankingsRequest(request, 'rankings-local-legends');
    if (context.limited) return context.limited;

    const parsed = parseLegendsQuery(request.nextUrl.searchParams);
    if (!parsed.ok) return badRequest(parsed.error);
    const input = parsed.value;

    const targetSinceIso = new Date(
      Date.parse(input.referenceDate) - input.windowDays * 86_400_000
    ).toISOString();

    const dataset = await loadLegendDataset(context.supabase, {
      sinceDays: input.windowDays + 1,
      limit: 4000,
      referenceDate: input.referenceDate,
      targetSinceIso,
    });
    const profiles = await loadRankingProfiles(
      context.supabase,
      dataset.activities.map((activity) => activity.userId),
      { authenticated: Boolean(context.viewerId) }
    );
    const privacy = await loadPrivacyContext(context.supabase, context.viewerId);
    const selectedTargetName = input.targetId
      ? await loadLegendTargetName(context.supabase, input.targetType, input.targetId)
      : undefined;

    const payload = buildLocalLegendsPayload(
      dataset.activities,
      profiles,
      privacy,
      dataset.targets,
      input,
      selectedTargetName
    );

    return NextResponse.json(
      { success: true, data: payload },
      { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } }
    );
  } catch (error) {
    console.error('[API /api/rankings/local-legends]', error);
    return fail('server', 'Local Legends indisponible.');
  }
}
