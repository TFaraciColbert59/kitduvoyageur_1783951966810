import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { deleteOuting, loadOutingDetail, updateOuting } from '@/features/compte/server/sorties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();
const Patch = z
  .object({
    title: z.string().trim().max(120).optional(),
    notes: z.string().max(2000).optional(),
    visibility: z.enum(['private', 'collective_anonymized']).optional(),
  })
  .strict();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Id.safeParse((await params).id);
  if (!parsed.success) return fail('not_found', 'Sortie introuvable.');
  try {
    const detail = await loadOutingDetail(auth.supabase, auth.user.id, parsed.data);
    if (!detail) return fail('not_found', 'Sortie introuvable.');
    return ok(detail);
  } catch {
    return fail('server', 'Impossible de charger cette sortie.');
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await params).id);
  if (!parsedId.success) return fail('not_found', 'Sortie introuvable.');
  const body = Patch.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail('not_found', 'Modification invalide.');
  try {
    await updateOuting(auth.supabase, auth.user.id, parsedId.data, body.data);
    return ok({ status: 'updated' });
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return fail('not_found', 'Sortie introuvable.');
    }
    return fail('server', 'Impossible de modifier cette sortie.');
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Id.safeParse((await params).id);
  if (!parsed.success) return fail('not_found', 'Sortie introuvable.');
  try {
    await deleteOuting(auth.supabase, auth.user.id, parsed.data);
    return ok({ status: 'deleted' });
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return fail('not_found', 'Sortie introuvable.');
    }
    return fail('server', 'Impossible de supprimer cette sortie.');
  }
}
