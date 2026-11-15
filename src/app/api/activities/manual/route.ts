import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import {
  createManualActivitySession,
  createSupabaseManualActivityDeps,
  type CreateManualActivityRequest,
} from '@/features/compte/server/manualActivity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/activities/manual
 * S1.08 / S1.12 — Création idempotente d'une activité saisie manuellement
 * (incluant natation piscine et rééducation).
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as CreateManualActivityRequest | null;
  if (!body || typeof body !== 'object') {
    return fail('invalid_payload', 'Corps JSON invalide pour la saisie manuelle.');
  }

  try {
    const deps = createSupabaseManualActivityDeps(auth.supabase);
    const outcome = await createManualActivitySession(deps, auth.user.id, body);
    if (!outcome.ok) {
      return fail('bad_request', outcome.error);
    }
    return ok({
      ok: true,
      id: outcome.id,
      record: outcome.record,
      deduplicated: outcome.deduplicated,
    });
  } catch (error) {
    return fail(
      'server',
      error instanceof Error ? error.message : 'Impossible d’enregistrer cette activité.',
    );
  }
}
