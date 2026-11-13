import { badRequest, invalidJson, json, readJson, serverError } from '../../_http';
import {
  enqueueFlyoverJob,
  flyoverJobBodySchema,
  listFlyoverJobs,
} from '@/components/media-sharing/server/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/media-sharing/flyover/jobs
 * Enfile un rendu idempotent (même trace + même masque + même préréglage).
 * Une trace privée est annulée par le contrat, jamais rendue.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return invalidJson();

  const parsed = flyoverJobBodySchema.safeParse(body.value);
  if (!parsed.success) return badRequest(parsed.error);

  try {
    const result = enqueueFlyoverJob(parsed.data);
    return json(result, result.deduplicated ? 200 : 201);
  } catch (error) {
    return serverError('flyover/jobs', error);
  }
}

/** GET /api/media-sharing/flyover/jobs?trackId=… — jobs actifs d'une trace. */
export async function GET(request: Request) {
  const trackId = new URL(request.url).searchParams.get('trackId');
  if (!trackId) {
    return json({ error: 'trackId requis', code: 'missing_track_id' }, 400);
  }

  return json({ trackId, jobs: listFlyoverJobs(trackId) });
}
