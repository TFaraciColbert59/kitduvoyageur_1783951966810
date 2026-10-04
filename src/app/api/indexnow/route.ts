import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { submitUrls, submitSitemap } from '@/lib/seo/indexnow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_URLS = 50;

/**
 * POST /api/indexnow
 *
 * Soumet des URLs à IndexNow (équivalent Next.js du package laravel-index-now).
 *
 * Corps acceptés :
 *  - { "url": "https://lekitduvoyageur.fr/chemin" }
 *  - { "urls": ["https://lekitduvoyageur.fr/a", "https://lekitduvoyageur.fr/b"] }
 *  - { "action": "sitemap" }  → soumet toutes les URLs du sitemap.xml (bootstrap)
 *
 * Seules les URLs HTTPS du même hôte que NEXT_PUBLIC_SITE_URL sont transmises
 * à l'API IndexNow (la clé reste côté serveur).
 */
export async function POST(req: NextRequest) {
  // IndexNow consomme un quota clé serveur : réservé aux admins.
  const gate = await requireAdmin('config.write');
  if (!gate.ok) return gate.response;

  const limited = await enforceRateLimit(gate.ctx.user.id, {
    scope: 'indexnow',
    limit: 10,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  try {
    const contentType = req.headers.get('content-type') || '';
    let urls: string[] = [];

    if (contentType.includes('application/json')) {
      const data: unknown = await req.json();

      if (typeof data === 'object' && data !== null && 'action' in data) {
        const action = (data as { action?: unknown }).action;
        if (action === 'sitemap') {
          const result = await submitSitemap();
          return NextResponse.json(result, { status: result.ok ? 200 : 502 });
        }
      }

      if (typeof data === 'object' && data !== null) {
        const body = data as { url?: unknown; urls?: unknown };
        if (typeof body.url === 'string') {
          urls = [body.url];
        } else if (Array.isArray(body.urls)) {
          urls = body.urls.filter((x: unknown): x is string => typeof x === 'string');
        }
      }
    }

    if (urls.length === 0 || urls.length > MAX_URLS) {
      return NextResponse.json(
        { error: `Corps attendu : { url }, { urls[1..${MAX_URLS}] } ou { action: "sitemap" }` },
        { status: 400 }
      );
    }

    const result = await submitUrls(urls);
    return NextResponse.json(result, { status: result.ok ? 200 : result.status || 502 });
  } catch {
    return NextResponse.json({ error: 'Erreur IndexNow' }, { status: 500 });
  }
}
