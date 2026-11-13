import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import { ingestWatchPackChunk } from '@/features/compte/server/watches';
import { WatchOfflinePackChunkSchema } from '@/features/compte/server/watches/validation';
import { handleWatchError, readJson, rejected } from '../../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PACK_ID = /^[A-Za-z0-9._:-]{1,160}$/;

/**
 * POST /api/watches/packs/[packId]/chunks
 * Reçoit un bloc ordonné et idempotent. Un bloc rejoué ou hors ordre ne fait
 * jamais reculer `ackedChunkIndex`.
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

  const raw = await readJson(request);
  const candidate =
    raw && typeof raw === 'object' && 'chunk' in raw
      ? (raw as { chunk: unknown }).chunk
      : raw;
  const parsed = WatchOfflinePackChunkSchema.safeParse(candidate);
  if (!parsed.success) {
    return rejected(
      'invalid_chunk',
      parsed.error.issues[0]?.message ?? 'Bloc de paquet invalide.',
    );
  }
  if (parsed.data.packId !== packId) {
    return rejected('pack_mismatch', 'Le bloc ne correspond pas au paquet demandé.', 409);
  }

  try {
    return ok(ingestWatchPackChunk(auth.user.id, parsed.data));
  } catch (error) {
    return handleWatchError(error);
  }
}
