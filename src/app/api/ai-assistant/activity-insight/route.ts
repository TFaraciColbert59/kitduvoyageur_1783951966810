import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { createActivityInsight } from '@/features/ai-assistant/activity/postActivityInsight';
import { createPostActivityProvider } from '@/features/ai-assistant/providers/nvidia';
import { resolveAssistantIdentity } from '@/features/ai-assistant/server/identity';
import type { HikeSessionRecord } from '@/features/ai-assistant/activity/activityFacts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  /** L'IA ne part jamais sans action explicite : le bilan déterministe suffit par défaut. */
  includeAi: z.boolean().default(false),
});

/**
 * S2.37 — POST /api/ai-assistant/activity-insight
 * Bilan post-activité privé. La ligne est lue avec le client de l'utilisateur
 * (RLS + filtre user_id), puis le service rend toujours la vue déterministe.
 * Une clé IA absente produit `provider_unconfigured`, jamais un faux chiffre.
 */
export async function POST(request: NextRequest) {
  try {
    const identity = await resolveAssistantIdentity(request);
    if (!identity) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }
    const { supabase, user } = identity;

    const limited = await enforceRateLimit(user.id, {
      scope: 'ai-assistant-activity-insight',
      limit: 20,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'sessionId invalide' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('hike_sessions')
      .select(
        'id, user_id, route_id, started_at, ended_at, distance_km, duration_seconds, elevation_gain_m, max_altitude_m, title, visibility, weather, track_quality, poi_events'
      )
      .eq('id', parsed.data.sessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Session illisible' }, { status: 503 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 });
    }

    const session = data as HikeSessionRecord & { route_id: number | null };
    if (session.route_id !== null && session.route_id !== undefined) {
      const { data: route } = await supabase
        .from('hiking_routes')
        .select('name, region')
        .eq('id', session.route_id)
        .maybeSingle();
      if (route) {
        session.route_name = route.name ?? null;
        session.region = route.region ?? null;
      }
    }

    const provider = parsed.data.includeAi ? createPostActivityProvider(user.id) : null;
    const insight = await createActivityInsight({
      session,
      includeAi: parsed.data.includeAi,
      provider,
    });
    return NextResponse.json({ insight });
  } catch (error) {
    console.error('[ai-assistant/activity-insight]', error instanceof Error ? error.message : 'erreur');
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 });
  }
}
