import type { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { heatmapErrorResponse, heatmapJson } from '@/lib/heatmaps/http';
import { getPersonalHeatmap } from '@/lib/heatmaps/personalService';
import { parsePersonalHeatmapQuery } from '@/lib/heatmaps/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/heatmaps/personal?sport=all&period=last_30_days
 *
 * Heatmap privée du propriétaire (K3.08, S3.19). `ownerUserId` et
 * `viewerUserId` viennent tous deux de la session : aucun identifiant
 * utilisateur n'est accepté en paramètre. La réponse peut inclure une
 * comparaison avec `comparePeriod`.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const limited = await enforceRateLimit(auth.user.id, {
    scope: 'heatmaps-personal',
    limit: 60,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const parsed = parsePersonalHeatmapQuery(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return heatmapJson({ error: parsed.error, code: parsed.code }, 400);
  }

  try {
    const { result, comparison } = await getPersonalHeatmap(
      auth.supabase,
      auth.user.id,
      parsed.value
    );

    if (!result.authorized || !result.layer) {
      return heatmapJson(
        { error: 'Heatmap personnelle réservée au propriétaire.', code: 'forbidden' },
        403
      );
    }

    return heatmapJson({ layer: result.layer, comparison });
  } catch (error) {
    return heatmapErrorResponse(error);
  }
}
