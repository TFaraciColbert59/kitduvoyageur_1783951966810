import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import {
  createOutingShareLink,
  getActiveOutingShareLink,
  revokeAllOutingShareLinks,
} from '@/features/compte/server/privacyZones';
import { loadOutingDetail } from '@/features/compte/server/sorties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();
const CreateShareBody = z
  .object({
    ttlHours: z.number().positive().max(24 * 365).nullable().optional(),
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
    const shareLink = await getActiveOutingShareLink(auth.supabase, auth.user.id, parsedId.data);
    return ok({ shareLink });
  } catch {
    return fail('server', 'Impossible de charger le lien de partage.');
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await context.params).id);
  if (!parsedId.success) return fail('not_found', 'Sortie introuvable.');

  const body = CreateShareBody.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return fail('bad_request', 'Durée de validité invalide.');

  try {
    const detail = await loadOutingDetail(auth.supabase, auth.user.id, parsedId.data);
    if (!detail || !detail.canEdit) return fail('not_found', 'Sortie introuvable.');
    if (detail.visibility === 'private') {
      return fail(
        'conflict',
        'Passe d’abord cette sortie sur « Abonnés » ou « Public » avant de générer un lien.'
      );
    }
    const created = await createOutingShareLink(
      auth.supabase,
      auth.user.id,
      parsedId.data,
      body.data.ttlHours ?? null
    );
    return ok(
      {
        shareLink: created.summary,
        sharePath: `/api/compte/sorties/${parsedId.data}?share=${encodeURIComponent(created.token)}`,
        token: created.token,
      },
      201
    );
  } catch {
    return fail('server', 'Impossible de créer le lien de partage.');
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await context.params).id);
  if (!parsedId.success) return fail('not_found', 'Sortie introuvable.');

  try {
    const detail = await loadOutingDetail(auth.supabase, auth.user.id, parsedId.data);
    if (!detail || !detail.canEdit) return fail('not_found', 'Sortie introuvable.');
    await revokeAllOutingShareLinks(auth.supabase, auth.user.id, parsedId.data);
    return ok({ revoked: true });
  } catch {
    return fail('server', 'Impossible de révoquer le lien de partage.');
  }
}
