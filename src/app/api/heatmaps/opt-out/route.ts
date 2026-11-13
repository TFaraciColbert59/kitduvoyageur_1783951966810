import type { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { optOutFromGlobalHeatmap } from '@/features/heatmaps/consent';
import { heatmapErrorResponse, heatmapJson } from '@/lib/heatmaps/http';
import { parseOptOutBody } from '@/lib/heatmaps/query';
import {
  loadEffectivePreferences,
  savePreferences,
} from '@/lib/heatmaps/preferencesRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/heatmaps/opt-out — opt-out strict de la heatmap mondiale (K7.06).
 *
 * Révoque immédiatement la contribution globale. `revokeAllAggregates: true`
 * coupe aussi les finalités S6.17 (recommandations et mobilité), sur demande
 * explicite uniquement.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const limited = await enforceRateLimit(auth.user.id, {
    scope: 'heatmaps-opt-out',
    limit: 20,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const parsed = parseOptOutBody(await request.json().catch(() => null));
  if (!parsed.ok) {
    return heatmapJson({ error: parsed.error, code: parsed.code }, 400);
  }

  try {
    const now = new Date().toISOString();
    const current = await loadEffectivePreferences(auth.supabase, auth.user.id);
    const next = optOutFromGlobalHeatmap(current, {
      revokeAllAggregates: parsed.value.revokeAllAggregates,
      now,
    });
    const preferences = await savePreferences(auth.supabase, next);
    return heatmapJson({ preferences, revokedAt: now });
  } catch (error) {
    return heatmapErrorResponse(error);
  }
}
