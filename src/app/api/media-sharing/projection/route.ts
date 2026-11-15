import { badRequest, invalidJson, json, readJson, serverError } from '../_http';
import {
  buildProjectionFromRaw,
  rawTrackInputSchema,
} from '@/components/media-sharing/server/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/media-sharing/projection
 * Construit la projection publiable : les points dans une zone de
 * confidentialité sont retirés avant tout calcul de distance ou d'altimétrie.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return invalidJson();

  const parsed = rawTrackInputSchema.safeParse(body.value);
  if (!parsed.success) return badRequest(parsed.error);

  try {
    return json(buildProjectionFromRaw(parsed.data));
  } catch (error) {
    return serverError('projection', error);
  }
}
