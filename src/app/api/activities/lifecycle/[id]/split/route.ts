import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import {
  ActivityIdSchema,
  createSupabaseLifecycleService,
  SplitSchema,
} from '@/features/compte/server/lifecycle';
import { handleLifecycleError, rejected } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/activities/lifecycle/[id]/split
 * Fractionne une séance en tronçons indépendants (S1.22) : le parent garde son
 * identifiant historique pour le premier tronçon, les suivants sont liés par
 * `parentActivityId` / `parentRevision` / `splitPartIndex`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const id = ActivityIdSchema.safeParse((await params).id);
  if (!id.success) return rejected('invalid_activity_id', 'Identifiant d’activité invalide.');

  const body = SplitSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return rejected('invalid_split', body.error.issues[0]?.message ?? 'Fractionnement invalide.');
  }

  try {
    const service = createSupabaseLifecycleService(auth.supabase);
    const outcome = await service.split(auth.user.id, id.data, body.data);
    if (outcome.ok === false) return rejected(outcome.code, outcome.error);
    return ok({
      parentRecord: outcome.parentRecord,
      parts: outcome.parts,
      projectionEvent: outcome.projectionEvent,
      idempotentReplay: outcome.idempotentReplay,
    });
  } catch (error) {
    return handleLifecycleError(error);
  }
}
