import { badRequest, invalidJson, json, readJson, serverError } from '../_http';
import {
  createPreviewBodySchema,
  createPreviewLink,
  previewMetadata,
} from '@/components/media-sharing/server/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/media-sharing/preview
 * K5.28 : crée un lien révocable. Le jeton brut n'est retourné qu'ici ; le
 * store ne conserve que son SHA-256 et la géométrie simplifiée.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return invalidJson();

  const parsed = createPreviewBodySchema.safeParse(body.value);
  if (!parsed.success) return badRequest(parsed.error);

  try {
    const created = createPreviewLink(parsed.data);
    const origin = new URL(request.url).origin;
    return json(
      {
        token: created.rawToken,
        url: `${origin}/apercu/${encodeURIComponent(created.rawToken)}`,
        record: previewMetadata(created.record),
      },
      201,
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'protected_preview_owner_mismatch') {
      return json(
        {
          error: "Le propriétaire du lien ne correspond pas à la trace",
          code: 'owner_mismatch',
        },
        403,
      );
    }
    return serverError('preview', error);
  }
}
