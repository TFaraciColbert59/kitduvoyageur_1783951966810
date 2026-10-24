import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { addComment, deleteComment } from '@/features/compte/server/sorties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();
const Body = z.object({ body: z.string().trim().min(1).max(1000) }).strict();
const DeleteBody = z.object({ commentId: z.string().uuid() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await params).id);
  if (!parsedId.success) return fail('not_found', 'Sortie introuvable.');
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Commentaire invalide.');
  try {
    await addComment(auth.supabase, auth.user.id, parsedId.data, parsed.data.body);
    return ok({ status: 'created' }, 201);
  } catch {
    return fail('server', 'Impossible d’envoyer ce commentaire.');
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsedId = Id.safeParse((await params).id);
  if (!parsedId.success) return fail('not_found', 'Sortie introuvable.');
  const parsed = DeleteBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Commentaire introuvable.');
  try {
    await deleteComment(auth.supabase, auth.user.id, parsed.data.commentId);
    return ok({ status: 'deleted' });
  } catch {
    return fail('server', 'Impossible de supprimer ce commentaire.');
  }
}
