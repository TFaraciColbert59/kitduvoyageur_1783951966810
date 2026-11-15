import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import {
  ActivityIdSchema,
  createSupabaseLifecycleService,
  CropSchema,
} from '@/features/compte/server/lifecycle';
import { handleLifecycleError, rejected } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/activities/lifecycle/[id]/crop
 * Aperçu (`previewOnly: true`) ou application d'un recadrage. L'aperçu
 * recalcule les statistiques sans écrire ; l'application conserve
 * `originalPoints` intact et journalise une révision idempotente.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const id = ActivityIdSchema.safeParse((await params).id);
  if (!id.success) return rejected('invalid_activity_id', 'Identifiant d’activité invalide.');

  const body = CropSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return rejected('invalid_crop', body.error.issues[0]?.message ?? 'Recadrage invalide.');
  }

  try {
    const service = createSupabaseLifecycleService(auth.supabase);
    const outcome = await service.crop(auth.user.id, id.data, body.data);
    if (outcome.ok === false) return rejected(outcome.code, outcome.error);
    return ok({ preview: outcome.preview, record: outcome.record });
  } catch (error) {
    return handleLifecycleError(error);
  }
}

/**
 * DELETE /api/activities/lifecycle/[id]/crop
 * Restaure la géométrie brute d'origine (réversible, nouvelle révision).
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const id = ActivityIdSchema.safeParse((await params).id);
  if (!id.success) return rejected('invalid_activity_id', 'Identifiant d’activité invalide.');

  try {
    const service = createSupabaseLifecycleService(auth.supabase);
    const record = await service.restoreGeometry(auth.user.id, id.data);
    return ok({ record });
  } catch (error) {
    return handleLifecycleError(error);
  }
}
