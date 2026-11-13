import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import {
  ActivityIdSchema,
  createSupabaseLifecycleService,
} from '@/features/compte/server/lifecycle';
import { handleLifecycleError, rejected } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/activities/lifecycle/[id]/trash
 * Corps : `{ "action": "delete" }` (soft-delete, 30 jours) ou
 * `{ "action": "restore" }` (restauration dans la fenêtre).
 *
 * Aucune ligne source n'est supprimée : la corbeille est portée par la
 * surcouche A02, réversible et auditée par révision.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const id = ActivityIdSchema.safeParse((await params).id);
  if (!id.success) return rejected('invalid_activity_id', 'Identifiant d’activité invalide.');

  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action;
  if (action !== 'delete' && action !== 'restore') {
    return rejected('invalid_action', 'Action attendue : « delete » ou « restore ».');
  }

  try {
    const service = createSupabaseLifecycleService(auth.supabase);
    if (action === 'delete') {
      const outcome = await service.softDelete(auth.user.id, id.data);
      if (outcome.ok === false) return rejected(outcome.code, outcome.error);
      return ok({
        record: outcome.record,
        alreadyDeleted: outcome.alreadyDeleted,
        projectionEvent: outcome.projectionEvent,
      });
    }
    const outcome = await service.restore(auth.user.id, id.data);
    if (outcome.ok === false) return rejected(outcome.code, outcome.error);
    return ok({ record: outcome.record, projectionEvent: outcome.projectionEvent });
  } catch (error) {
    return handleLifecycleError(error);
  }
}
