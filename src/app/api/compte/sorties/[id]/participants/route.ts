import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { addParticipant, removeParticipant } from '@/features/compte/server/sorties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();
const AddBody = z.object({ handle: z.string().trim().min(1).max(60) }).strict();
const DeleteBody = z.object({ participantId: z.string().uuid() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await params).id);
  if (!parsedId.success) return fail('not_found', 'Sortie introuvable.');
  const parsed = AddBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Profil invalide.');
  try {
    await addParticipant(auth.supabase, auth.user.id, parsedId.data, parsed.data.handle);
    return ok({ status: 'added' }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'not_found') return fail('not_found', 'Aucun profil avec ce handle.');
    if (message === 'self') return fail('conflict', 'Tu es déjà sur cette sortie.');
    return fail('server', 'Impossible d’ajouter ce compagnon.');
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await params).id);
  if (!parsedId.success) return fail('not_found', 'Sortie introuvable.');
  const parsed = DeleteBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Participant introuvable.');
  try {
    await removeParticipant(auth.supabase, auth.user.id, parsedId.data, parsed.data.participantId);
    return ok({ status: 'removed' });
  } catch {
    return fail('server', 'Impossible de retirer ce compagnon.');
  }
}
