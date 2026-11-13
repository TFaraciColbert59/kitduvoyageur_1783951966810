import { badRequest, invalidJson, json, readJson, serverError } from '../_http';
import {
  computeGallery,
  galleryBodySchema,
} from '@/components/media-sharing/server/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/media-sharing/gallery
 * K5.06 / S1.21 : galerie géolocalisée, audience fail-closed, EXIF retirés.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return invalidJson();

  const parsed = galleryBodySchema.safeParse(body.value);
  if (!parsed.success) return badRequest(parsed.error);

  try {
    return json(computeGallery(parsed.data));
  } catch (error) {
    return serverError('gallery', error);
  }
}
