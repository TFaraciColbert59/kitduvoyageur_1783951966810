import type { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { updateAggregateContributionPreferences } from '@/features/heatmaps/consent';
import { heatmapErrorResponse, heatmapJson } from '@/lib/heatmaps/http';
import { parsePreferencesPatch } from '@/lib/heatmaps/query';
import {
  loadEffectivePreferences,
  savePreferences,
} from '@/lib/heatmaps/preferencesRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/heatmaps/preferences — préférences granulaires (S6.17), fail-closed. */
export async function GET(): Promise<NextResponse> {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const preferences = await loadEffectivePreferences(auth.supabase, auth.user.id);
    return heatmapJson({ preferences });
  } catch (error) {
    return heatmapErrorResponse(error);
  }
}

/**
 * PATCH /api/heatmaps/preferences
 *
 * Corps : `{ globalHeatmapOptOut?, globalHeatmap?, routeRecommendations?,
 * mobilityAggregates? }`. L'utilisateur est celui de la session ; le corps ne
 * peut jamais désigner un autre `userId`.
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const limited = await enforceRateLimit(auth.user.id, {
    scope: 'heatmaps-preferences',
    limit: 30,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const parsed = parsePreferencesPatch(await request.json().catch(() => null));
  if (!parsed.ok) {
    return heatmapJson({ error: parsed.error, code: parsed.code }, 400);
  }

  try {
    const current = await loadEffectivePreferences(auth.supabase, auth.user.id);
    const next = updateAggregateContributionPreferences(current, parsed.value);
    const preferences = await savePreferences(auth.supabase, next);
    return heatmapJson({ preferences });
  } catch (error) {
    return heatmapErrorResponse(error);
  }
}
