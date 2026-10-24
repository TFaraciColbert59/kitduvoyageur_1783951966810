import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { toggleKudos } from '@/features/compte/server/sorties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Id = z.string().uuid();

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Id.safeParse((await params).id);
  if (!parsed.success) return fail('not_found', 'Sortie introuvable.');
  try {
    return ok(await toggleKudos(auth.supabase, auth.user.id, parsed.data));
  } catch {
    return fail('server', 'Impossible d’enregistrer ce kudos.');
  }
}
