import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { getProgressionHistory } from '@/features/progression/server/progressionService';

export const dynamic = 'force-dynamic';

/**
 * T11 — Historique privé paginé : gains confirmés (événements canoniques
 * post-commit) et intentions en attente, strictement séparés. Lecture du
 * compte authentifié uniquement ; aucun montant n'est calculé ici.
 *
 * Curseur (before, beforeId) issu de `nextCursor` de la page précédente.
 * Réponse jamais mise en cache (états d'attente évolutifs).
 */
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } as const;
const HISTORY_LIMIT_MAX = 50;

function parseIsoTimestamp(value: string | null): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const limited = await enforceRateLimit(user.id, {
      scope: 'progression-history',
      limit: 60,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const params = request.nextUrl.searchParams;
    const rawLimit = Number(params.get('limit'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), HISTORY_LIMIT_MAX)
      : 20;
    const before = parseIsoTimestamp(params.get('before'));
    const beforeId = (params.get('beforeId') ?? '').trim() || null;

    const history = await getProgressionHistory(user.id, {
      limit,
      before,
      beforeId: before && beforeId ? beforeId : null,
    });

    return NextResponse.json({ success: true, ...history }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error('[API /api/progression/history]', err);
    return NextResponse.json({ success: false, error: 'Erreur interne' }, { status: 500 });
  }
}
