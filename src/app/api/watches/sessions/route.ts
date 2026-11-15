import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import {
  ingestWatchSessionBatch,
  listWatchSessions,
} from '@/features/compte/server/watches';
import {
  WatchSessionBatchEnvelopeSchema,
  WatchSessionBulkSchema,
} from '@/features/compte/server/watches/validation';
import { handleWatchError, readJson, rejected } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/watches/sessions — séances rapprochées côté téléphone. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    return ok(listWatchSessions(auth.user.id));
  } catch (error) {
    return handleWatchError(error);
  }
}

/**
 * POST /api/watches/sessions
 *
 * Accepte un lot (`WatchSessionBatchEnvelope`), une enveloppe `{ batch }` ou
 * un lot de lots `{ batches }`. Le rejeu est idempotent : même `batchId` ou
 * mêmes `(watchSessionId, seq)` ne créent jamais de doublon.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const raw = await readJson(request);
  const bulk = WatchSessionBulkSchema.safeParse(raw);
  if (bulk.success) {
    try {
      const results = bulk.data.batches.map((batch) =>
        ingestWatchSessionBatch(auth.user.id, batch),
      );
      return ok({
        acks: results.map((result) => result.ack),
        sessions: results.map((result) => result.session),
        replayed: results.filter((result) => result.replayed).length,
      });
    } catch (error) {
      return handleWatchError(error);
    }
  }

  const parsed = WatchSessionBatchEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    return rejected(
      'invalid_batch',
      parsed.error.issues[0]?.message ?? 'Lot de séance montre invalide.',
    );
  }
  const batch = 'batch' in parsed.data ? parsed.data.batch : parsed.data;

  try {
    return ok(ingestWatchSessionBatch(auth.user.id, batch));
  } catch (error) {
    return handleWatchError(error);
  }
}
