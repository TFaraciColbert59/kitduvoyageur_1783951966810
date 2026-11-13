import { badRequest, invalidJson, json, readJson, serverError } from '../_http';
import {
  computeReplay,
  replayBodySchema,
} from '@/components/media-sharing/server/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/media-sharing/replay
 * S3.21 : manifeste Activity Replay. Une trace privée retourne un manifeste
 * vide, sans points ni URL de secours.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return invalidJson();

  const parsed = replayBodySchema.safeParse(body.value);
  if (!parsed.success) return badRequest(parsed.error);

  try {
    return json(computeReplay(parsed.data));
  } catch (error) {
    return serverError('replay', error);
  }
}
