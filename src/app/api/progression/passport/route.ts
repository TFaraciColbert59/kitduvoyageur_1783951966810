import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { listUserDiscoveries } from '@/features/progression/server/discoveries';

export const dynamic = 'force-dynamic';

/**
 * T19 — Passeport privé : souvenirs datés (identifiants canoniques seulement,
 * aucune trace, aucun document d'identité, aucune coordonnée exacte).
 * Vue privée par défaut ; l'export/suppression du compte couvrent ces lignes
 * (T44).
 */
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } as const;

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
      scope: 'progression-passport',
      limit: 60,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const discoveries = await listUserDiscoveries(user.id);
    return NextResponse.json(
      { success: true, discoveries, visibility: 'private' },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error('[API /api/progression/passport]', err);
    return NextResponse.json({ success: false, error: 'Erreur interne' }, { status: 500 });
  }
}
