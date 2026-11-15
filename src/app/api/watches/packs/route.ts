import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import {
  getWatchPack,
  listWatchPacks,
  stageWatchPack,
} from '@/features/compte/server/watches';
import { WatchStagePackSchema } from '@/features/compte/server/watches/validation';
import { handleWatchError, readJson, rejected } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/watches/packs[?packId=] — paquets hors ligne et stockage libre. */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const packId = new URL(request.url).searchParams.get('packId');
  try {
    if (packId) return ok({ pack: getWatchPack(auth.user.id, packId) });
    return ok(listWatchPacks(auth.user.id));
  } catch (error) {
    return handleWatchError(error);
  }
}

/**
 * POST /api/watches/packs
 *
 * Prépare un manifeste de paquet hors ligne. Le paquet n'est jamais annoncé
 * `available` à la création : il reste `queued` jusqu'à réception de tous les
 * blocs et vérification du checksum.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = WatchStagePackSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return rejected(
      'invalid_pack',
      parsed.error.issues[0]?.message ?? 'Manifeste de paquet invalide.',
    );
  }

  const envelope = parsed.data as {
    manifest?: Parameters<typeof stageWatchPack>[1];
    totalChunks?: number;
  };
  const manifest = envelope.manifest ?? (parsed.data as Parameters<typeof stageWatchPack>[1]);
  const totalChunks = envelope.manifest
    ? (envelope.totalChunks ?? Math.max(1, manifest.resources.length))
    : Math.max(1, manifest.resources.length);

  try {
    return ok({ pack: stageWatchPack(auth.user.id, manifest, totalChunks) }, 201);
  } catch (error) {
    return handleWatchError(error);
  }
}
