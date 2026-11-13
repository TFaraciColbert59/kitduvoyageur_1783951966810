import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import {
  ActivityIdSchema,
  createSupabaseLifecycleService,
  MetadataPatchSchema,
} from '@/features/compte/server/lifecycle';
import { handleLifecycleError, rejected } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/activities/lifecycle/[id]
 * Fiche détaillée post-séance : trace active, trace d'origine, statistiques,
 * capteurs, provenance, corrections et journal de révisions.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const id = ActivityIdSchema.safeParse((await params).id);
  if (!id.success) return rejected('invalid_activity_id', 'Identifiant d’activité invalide.');

  try {
    const service = createSupabaseLifecycleService(auth.supabase);
    const record = await service.get(auth.user.id, id.data);
    return ok({ record });
  } catch (error) {
    return handleLifecycleError(error);
  }
}

/**
 * PATCH /api/activities/lifecycle/[id]
 * Édition des métadonnées, du sport, de la variante, de la visibilité, du
 * matériel et des tags (K5.04, S1.20). `expectedRevision` permet un
 * compare-and-set optimiste.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const id = ActivityIdSchema.safeParse((await params).id);
  if (!id.success) return rejected('invalid_activity_id', 'Identifiant d’activité invalide.');

  const body = MetadataPatchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return rejected('invalid_patch', body.error.issues[0]?.message ?? 'Modification invalide.');
  }

  const { expectedRevision, ...patch } = body.data;
  try {
    const service = createSupabaseLifecycleService(auth.supabase);
    const outcome = await service.editMetadata(auth.user.id, id.data, patch, {
      expectedRevision,
    });
    if (outcome.ok === false) return rejected(outcome.code, outcome.error);
    return ok({
      record: outcome.record,
      sportChanged: outcome.sportChanged,
      projectionEvent: outcome.projectionEvent,
    });
  } catch (error) {
    return handleLifecycleError(error);
  }
}
