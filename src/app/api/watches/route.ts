import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import { getWatchRuntimeInfo, getWatchStatus } from '@/features/compte/server/watches';
import { handleWatchError } from './_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/watches
 * Point d'entrée de la surface montres : diagnostic natif, matrice et état
 * du registre de synchronisation du compte.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    return ok({
      ...getWatchStatus(auth.user.id),
      runtime: getWatchRuntimeInfo(),
    });
  } catch (error) {
    return handleWatchError(error);
  }
}
