import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import {
  ActivityIdSchema,
  createSupabaseLifecycleService,
  QuickEditSchema,
} from '@/features/compte/server/lifecycle';
import { handleLifecycleError, rejected } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/activities/lifecycle/[id]/quick-edit
 * `{ action: 'apply', patch }` valide l'édition rapide post-synchronisation et
 * retire l'invite (S1.18) ; `{ action: 'dismiss' }` ferme l'invite sans
 * modifier les données durables.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const id = ActivityIdSchema.safeParse((await params).id);
  if (!id.success) return rejected('invalid_activity_id', 'Identifiant d’activité invalide.');

  const body = QuickEditSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return rejected(
      'invalid_quick_edit',
      body.error.issues[0]?.message ?? 'Édition rapide invalide.'
    );
  }

  try {
    const service = createSupabaseLifecycleService(auth.supabase);
    const outcome = await service.quickEdit(auth.user.id, id.data, body.data);
    if (outcome.ok === false) return rejected(outcome.code, outcome.error);
    return ok({ record: outcome.record });
  } catch (error) {
    return handleLifecycleError(error);
  }
}
