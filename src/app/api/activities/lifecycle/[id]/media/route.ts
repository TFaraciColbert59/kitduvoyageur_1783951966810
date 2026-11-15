import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import {
  ActivityIdSchema,
  createSupabaseLifecycleService,
  MediaSchema,
} from '@/features/compte/server/lifecycle';
import { handleLifecycleError, rejected } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/activities/lifecycle/[id]/media
 * Gestion homogène des médias : ajout, retrait, réordonnancement, légende,
 * couverture (K5.04). L'état retourné est celui du contrat, jamais un état
 * optimiste non persisté.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const id = ActivityIdSchema.safeParse((await params).id);
  if (!id.success) return rejected('invalid_activity_id', 'Identifiant d’activité invalide.');

  const body = MediaSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return rejected('invalid_media', body.error.issues[0]?.message ?? 'Action média invalide.');
  }

  try {
    const service = createSupabaseLifecycleService(auth.supabase);
    const outcome = await service.editMedia(auth.user.id, id.data, body.data.action);
    if (outcome.ok === false) return rejected(outcome.code, outcome.error);
    return ok({ record: outcome.record });
  } catch (error) {
    return handleLifecycleError(error);
  }
}
