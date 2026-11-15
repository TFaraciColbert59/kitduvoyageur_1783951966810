import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import {
  readOutingTracePrivacy,
  upsertOutingTracePrivacy,
} from '@/features/compte/server/privacyZones';
import { loadOutingDetail } from '@/features/compte/server/sorties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();
const TracePrivacySchema = z
  .object({
    hideStartM: z.number().int().min(0).max(5000),
    hideEndM: z.number().int().min(0).max(5000),
    hideAll: z.boolean(),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await context.params).id);
  if (!parsedId.success) return fail('not_found', 'Sortie introuvable.');

  try {
    const detail = await loadOutingDetail(auth.supabase, auth.user.id, parsedId.data);
    if (!detail || !detail.canEdit) return fail('not_found', 'Sortie introuvable.');
    const rule = await readOutingTracePrivacy(auth.supabase, parsedId.data);
    return ok({
      tracePrivacy: rule ?? {
        sessionId: parsedId.data,
        userId: auth.user.id,
        hideStartM: 0,
        hideEndM: 0,
        hideAll: false,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch {
    return fail('server', 'Impossible de lire le masquage de trace.');
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await context.params).id);
  if (!parsedId.success) return fail('not_found', 'Sortie introuvable.');

  const body = TracePrivacySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail('bad_request', 'Paramètres de masquage invalides.');

  try {
    const detail = await loadOutingDetail(auth.supabase, auth.user.id, parsedId.data);
    if (!detail || !detail.canEdit) return fail('not_found', 'Sortie introuvable.');

    const tracePrivacy = await upsertOutingTracePrivacy(
      auth.supabase,
      auth.user.id,
      parsedId.data,
      body.data
    );
    return ok({ tracePrivacy });
  } catch {
    return fail('server', 'Impossible d’enregistrer le masquage de trace.');
  }
}
