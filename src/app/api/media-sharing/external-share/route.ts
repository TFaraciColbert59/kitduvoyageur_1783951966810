import { badRequest, invalidJson, json, readJson, serverError } from '../_http';
import {
  computeExternalShare,
  externalShareBodySchema,
} from '@/components/media-sharing/server/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/media-sharing/external-share
 * K5.27 / S5.25 : embed web, carte sportive et sticker transparent.
 * Le contrat refuse toute trace non publique (`audience_not_public`).
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return invalidJson();

  const parsed = externalShareBodySchema.safeParse(body.value);
  if (!parsed.success) return badRequest(parsed.error);

  try {
    const origin = new URL(request.url).origin;
    const payload = computeExternalShare({
      ...parsed.data,
      options: {
        ...parsed.data.options,
        baseUrl: parsed.data.options?.baseUrl ?? origin,
      },
    });
    return json(payload);
  } catch (error) {
    return serverError('external-share', error);
  }
}
