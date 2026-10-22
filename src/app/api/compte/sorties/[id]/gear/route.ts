import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { attachKitGear, removeGear } from '@/features/compte/server/sorties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();
const DeleteBody = z.object({ gearId: z.string().uuid() }).strict();

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Id.safeParse((await params).id);
  if (!parsed.success) return fail('not_found', 'Sortie introuvable.');
  try {
    await attachKitGear(auth.supabase, auth.user.id, parsed.data);
    return ok({ status: 'attached' }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'no_kit') return fail('conflict', 'Aucun kit n’est rattaché à cette sortie.');
    if (message === 'empty_kit') return fail('conflict', 'Ce kit ne contient aucun objet.');
    if (message === 'not_found') return fail('not_found', 'Sortie introuvable.');
    return fail('server', 'Impossible de rattacher le kit.');
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await params).id);
  if (!parsedId.success) return fail('not_found', 'Sortie introuvable.');
  const parsed = DeleteBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Objet introuvable.');
  try {
    await removeGear(auth.supabase, auth.user.id, parsedId.data, parsed.data.gearId);
    return ok({ status: 'removed' });
  } catch {
    return fail('server', 'Impossible de retirer cet objet.');
  }
}
