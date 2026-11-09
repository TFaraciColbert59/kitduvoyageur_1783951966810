import { brickStatus } from '@/lib/env';
import { guard, jsonOk, nowIso, methodNotAllowed, requestRef } from '@/server/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/health — état des briques, version, horodatage.
 * Aucune valeur d'environnement, aucun secret : seulement des booléens prêts/pas prêts.
 */
export async function GET(): Promise<Response> {
  const ref = requestRef();
  return guard(async () => {
    const bricks = brickStatus().map((brick) => ({
      id: brick.id,
      label: brick.label,
      ready: brick.ready,
      fallback: brick.fallback
    }));
    const ready = bricks.filter((brick) => brick.ready).length;
    return jsonOk({
      ok: true,
      service: 'lkdv-control',
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.npm_package_version ?? '0.1.0',
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
      time: nowIso(),
      bricks,
      summary: { ready, disabled: bricks.length - ready, total: bricks.length },
      request_ref: ref
    });
  }, ref);
}

export async function POST(): Promise<Response> {
  return methodNotAllowed('GET');
}
