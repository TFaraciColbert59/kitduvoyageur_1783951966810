import { json, serverError } from '../../_http';
import { resolvePreviewLink } from '@/components/media-sharing/server/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Context {
  params: Promise<{ token: string }>;
}

const STATUS_BY_REASON = {
  not_found: 404,
  revoked: 410,
  expired: 410,
  mask_invalidated: 409,
} as const;

/**
 * GET /api/media-sharing/preview/[token]?mv=maskVersion
 * K5.28 : résolution fail-closed. Un lien révoqué, expiré ou dont le masque a
 * changé retourne `preview: null` et ne divulgue aucune coordonnée.
 */
export async function GET(request: Request, context: Context) {
  const { token } = await context.params;
  const currentMaskVersion =
    new URL(request.url).searchParams.get('mv') ?? undefined;

  try {
    const resolution = resolvePreviewLink(token, currentMaskVersion);
    if (resolution.ok) return json(resolution);
    return json(resolution, STATUS_BY_REASON[resolution.reason]);
  } catch (error) {
    return serverError('preview/[token]', error);
  }
}
