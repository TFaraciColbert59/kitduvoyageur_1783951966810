import { NextRequest, NextResponse } from 'next/server';
import { submitUrls, submitSitemap } from '@/lib/seo/indexnow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  try {
    const contentType = req.headers.get('content-type') || '';
    let urls: string[] = [];

    if (contentType.includes('application/json')) {
      const data = await req.json();

      if (data?.action === 'sitemap') {
        const result = await submitSitemap();
        return NextResponse.json(result, { status: result.ok ? 200 : 502 });
      }

      if (typeof data?.url === 'string') {
        urls = [data.url];
      } else if (Array.isArray(data?.urls)) {
        urls = data.urls.filter((x: unknown) => typeof x === 'string');
      }
    }

    if (urls.length === 0) {
      return NextResponse.json(
        { error: 'Corps attendu : { url }, { urls: [...] } ou { action: "sitemap" }' },
        { status: 400 }
      );
    }

    const result = await submitUrls(urls);
    return NextResponse.json(result, { status: result.ok ? 200 : result.status || 502 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erreur IndexNow' }, { status: 500 });
  }
}
