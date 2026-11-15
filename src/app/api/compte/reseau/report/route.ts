import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { invalidateUserCache } from '@/lib/perf/userMemo';
import { readReseauError, reportUser } from '@/features/compte/server/reseau';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  userId: z.string().uuid(),
  categoryId: z.string().min(1).max(64),
  details: z.string().max(2000).optional(),
  groupId: z.string().uuid().optional(),
});

function reportFailure(error: unknown): ReturnType<typeof fail> {
  switch (readReseauError(error, 'report_failed')) {
    case 'authentication_required':
      return fail('unauthorized', 'Session requise.');
    case 'self':
      return fail('conflict', 'Impossible de signaler son propre profil.');
    case 'target_not_found':
      return fail('not_found', 'Profil inconnu.');
    case 'invalid_category':
      return fail('conflict', 'Motif de signalement inconnu.');
    default:
      return fail('server', 'Le signalement n’a pas pu être enregistré.');
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Signalement incomplet.');
  try {
    const result = await reportUser(
      auth.supabase,
      auth.user.id,
      parsed.data.userId,
      parsed.data.categoryId,
      parsed.data.details,
      parsed.data.groupId
    );
    invalidateUserCache(auth.user.id);
    return ok(result);
  } catch (error) {
    return reportFailure(error);
  }
}
