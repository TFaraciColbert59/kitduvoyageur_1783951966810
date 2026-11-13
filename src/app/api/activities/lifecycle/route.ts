import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import { createSupabaseLifecycleService } from '@/features/compte/server/lifecycle';
import { parseListQuery } from '@/features/compte/server/lifecycle/validation';
import { handleLifecycleError, rejected } from './_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/activities/lifecycle
 * Historique unifié (hike_sessions + activity_sessions + surcouche A02),
 * recherche par sport/date/lieu/tags/provenance et corbeille des 30 jours.
 *
 * Paramètres : `q`, `trash=1` (corbeille seule), `includeDeleted=1`,
 * `limit` (1..200), `requestSeq` (protection contre une réponse obsolète).
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = parseListQuery(new URL(request.url).searchParams);
  if (parsed.ok === false) return rejected('invalid_query', parsed.error);

  try {
    const service = createSupabaseLifecycleService(auth.supabase);
    const result = await service.list(auth.user.id, {
      query: parsed.value.q,
      includeDeleted: parsed.value.trash === '1' || parsed.value.includeDeleted === '1',
      deletedOnly: parsed.value.trash === '1',
      limit: parsed.value.limit,
      requestSeq: parsed.value.requestSeq,
    });
    return ok(result);
  } catch (error) {
    return handleLifecycleError(error);
  }
}
