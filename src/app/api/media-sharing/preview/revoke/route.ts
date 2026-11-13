import { badRequest, invalidJson, json, readJson, serverError } from '../../_http';
import {
  revokePreviewBodySchema,
  revokePreviewLink,
} from '@/components/media-sharing/server/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/media-sharing/preview/revoke
 * K5.28 : révocation immédiate. Le `ownerId` est vérifié par le store ; un
 * lien inconnu ou appartenant à un autre propriétaire retourne 404.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return invalidJson();

  const parsed = revokePreviewBodySchema.safeParse(body.value);
  if (!parsed.success) return badRequest(parsed.error);

  try {
    const revoked = revokePreviewLink(parsed.data);
    if (!revoked) {
      return json(
        { error: 'Lien introuvable ou non autorisé', code: 'preview_not_found' },
        404,
      );
    }
    return json({ ok: true, linkId: parsed.data.linkId });
  } catch (error) {
    return serverError('preview/revoke', error);
  }
}
