import { badRequest, invalidJson, json, readJson, serverError } from '../_http';
import {
  computeFlyby,
  flybyBodySchema,
} from '@/components/media-sharing/server/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/media-sharing/flyby
 * S3.22 : croisements consentis. Le contrat exclut les traces privées, les
 * utilisateurs bloqués et les candidats sans `flybyConsent`.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return invalidJson();

  const parsed = flybyBodySchema.safeParse(body.value);
  if (!parsed.success) return badRequest(parsed.error);

  try {
    return json(computeFlyby(parsed.data));
  } catch (error) {
    return serverError('flyby', error);
  }
}
