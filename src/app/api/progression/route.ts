import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { getProgressionProfile } from '@/features/progression/server/progressionService';

export const dynamic = 'force-dynamic';

/**
 * Réponse privée par utilisateur : cache navigateur court autorisé, jamais
 * partagé par un proxy (`private`) ; `Vary: Cookie` évite tout mélange de
 * sessions sur un cache intermédiaire mal configuré.
 */
const PROFILE_CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
  Vary: 'Cookie',
} as const;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const limited = await enforceRateLimit(user.id, {
      scope: 'progression-profile',
      limit: 120,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const profile = await getProgressionProfile(user.id);
    return NextResponse.json({ success: true, profile }, { headers: PROFILE_CACHE_HEADERS });
  } catch (err) {
    const message = 'Erreur interne de progression'; console.error('[API /api/progression]', err);
    console.error('[API /api/progression] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
