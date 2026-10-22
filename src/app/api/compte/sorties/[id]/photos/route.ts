import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { addPhoto, deletePhoto } from '@/features/compte/server/sorties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();
const AddBody = z
  .object({
    storagePath: z.string().trim().min(1).max(600),
    caption: z.string().trim().max(200).optional(),
  })
  .strict();
const DeleteBody = z.object({ photoId: z.string().uuid() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await params).id);
  if (!parsedId.success) return fail('not_found', 'Sortie introuvable.');
  const parsed = AddBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Photo invalide.');
  try {
    await addPhoto(
      auth.supabase,
      auth.user.id,
      parsedId.data,
      parsed.data.storagePath,
      parsed.data.caption
    );
    return ok({ status: 'created' }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'invalid_path') return fail('conflict', 'Chemin de photo invalide.');
    if (message === 'not_found') return fail('not_found', 'Sortie introuvable.');
    return fail('server', 'Impossible d’ajouter cette photo.');
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await params).id);
  if (!parsedId.success) return fail('not_found', 'Sortie introuvable.');
  const parsed = DeleteBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Photo introuvable.');
  try {
    await deletePhoto(auth.supabase, auth.user.id, parsedId.data, parsed.data.photoId);
    return ok({ status: 'deleted' });
  } catch {
    return fail('server', 'Impossible de supprimer cette photo.');
  }
}
