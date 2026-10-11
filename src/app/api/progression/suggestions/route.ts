import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { suggestMissions } from '@/features/progression/server/missionSuggestions';

export const dynamic = 'force-dynamic';

/**
 * T17 — Suggestions de missions (catalogue fermé). Sélection déterministe
 * côté serveur ; aucun montant ni éligibilité ne vient du client. Aucun
 * fournisseur IA n'est branché par défaut : la réponse reste valide.
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
      scope: 'progression-suggestions',
      limit: 30,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const suggestions = await suggestMissions(user.id);
    return NextResponse.json({ success: true, suggestions }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error('[API /api/progression/suggestions]', err);
    return NextResponse.json({ success: false, error: 'Erreur interne' }, { status: 500 });
  }
}
