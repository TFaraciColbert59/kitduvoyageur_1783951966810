import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import { verifyWatchPack } from '@/features/compte/server/watches';
import { WatchVerifyPackSchema } from '@/features/compte/server/watches/validation';
import { handleWatchError, readJson, rejected } from '../../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PACK_ID = /^[A-Za-z0-9._:-]{1,160}$/;

/**
 * POST /api/watches/packs/[packId]/verify
 * Vérifie le checksum et les ressources avant `available`/`degraded`. Une
 * révision précédente valide est restaurée si le nouveau checksum échoue.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ packId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const packId = (await params).packId;
  if (!PACK_ID.test(packId)) {
    return rejected('invalid_pack_id', 'Identifiant de paquet invalide.');
  }

  const parsed = WatchVerifyPackSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return rejected(
      'invalid_checksum',
      parsed.error.issues[0]?.message ?? 'Somme de contrôle invalide.',
    );
  }
  const checksum = parsed.data.checksumSha256 ?? parsed.data.actualChecksumSha256 ?? '';

  try {
    return ok({
      pack: verifyWatchPack(auth.user.id, packId, checksum),
    });
  } catch (error) {
    return handleWatchError(error);
  }
}
