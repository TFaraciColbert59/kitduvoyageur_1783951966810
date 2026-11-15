import { badRequest, invalidJson, json, readJson, serverError } from '../_http';
import {
  computeFlyover,
  flyoverBodySchema,
} from '@/components/media-sharing/server/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/media-sharing/flyover
 * K5.12 / S3.20 : timeline caméra déterministe depuis la projection masquée.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return invalidJson();

  const parsed = flyoverBodySchema.safeParse(body.value);
  if (!parsed.success) return badRequest(parsed.error);

  try {
    return json(computeFlyover(parsed.data));
  } catch (error) {
    return serverError('flyover', error);
  }
}
