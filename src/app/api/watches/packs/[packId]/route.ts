import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import {
  getWatchPack,
  removeWatchPack,
} from '@/features/compte/server/watches';
import { handleWatchError, rejected } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PACK_ID = /^[A-Za-z0-9._:-]{1,160}$/;

/** GET /api/watches/packs/[packId] — état détaillé d'un paquet. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ packId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const packId = (await params).packId;
  if (!PACK_ID.test(packId)) {
    return rejected('invalid_pack_id', 'Identifiant de paquet invalide.');
  }
  try {
    return ok({ pack: getWatchPack(auth.user.id, packId) });
  } catch (error) {
    return handleWatchError(error);
  }
}

/** DELETE /api/watches/packs/[packId] — retire le paquet de la montre. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ packId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const packId = (await params).packId;
  if (!PACK_ID.test(packId)) {
    return rejected('invalid_pack_id', 'Identifiant de paquet invalide.');
  }
  try {
    removeWatchPack(auth.user.id, packId);
    return ok({ removed: true, packId });
  } catch (error) {
    return handleWatchError(error);
  }
}
