import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { loadModerationState } from '@/features/compte/server/reseau';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z.object({ targetId: z.string().uuid() });

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const parsed = Query.safeParse({ targetId: url.searchParams.get('targetId') });
  if (!parsed.success) return fail('not_found', 'Profil inconnu.');
  try {
    const state = await loadModerationState(auth.supabase, auth.user.id, parsed.data.targetId);
    return ok(state);
  } catch {
    return fail('server', 'L’état de sécurité de ce profil est momentanément indisponible.');
  }
}
