import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { listUserDiscoveries } from '@/features/progression/server/discoveries';

export const dynamic = 'force-dynamic';

/**
 * T20 — Couche personnelle de la carte : identifiants territoriaux uniquement
 * (aucune coordonnée, aucune géométrie). Charge bornée (100 entités) pour la
 * mémoire mobile ; réservée au propriétaire connecté, jamais dans une vue
 * publique.
 */
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } as const;
const MAX_ENTITIES = 100;

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
      scope: 'progression-discoveries',
      limit: 60,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const all = await listUserDiscoveries(user.id);
    const discoveries = all.slice(0, MAX_ENTITIES);
    return NextResponse.json(
      { success: true, discoveries, truncated: all.length > MAX_ENTITIES },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error('[API /api/progression/discoveries]', err);
    return NextResponse.json({ success: false, error: 'Erreur interne' }, { status: 500 });
  }
}
