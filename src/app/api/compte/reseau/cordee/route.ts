import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { loadCordee, toggleCordee } from '@/features/compte/server/reseau';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  userId: z.string().uuid(),
  action: z.enum(['add', 'remove']),
});

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    return ok({ users: await loadCordee(auth.supabase, auth.user.id) });
  } catch {
    return fail('server', 'Impossible de charger la cordée.');
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Profil inconnu.');
  try {
    await toggleCordee(auth.supabase, auth.user.id, parsed.data.userId, parsed.data.action);
    return ok({ status: parsed.data.action });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'cordee_full') {
      return fail('conflict', 'Ta cordée est limitée à 30 personnes.');
    }
    if (message === 'self') return fail('conflict', 'Tu ne peux pas t’ajouter toi-même.');
    return fail('server', 'Impossible de modifier la cordée.');
  }
}
