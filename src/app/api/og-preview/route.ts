import { NextRequest, NextResponse } from 'next/server';
import { isBlockedRequestTarget } from '@/lib/security/urlSafety';

export const dynamic = 'force-dynamic';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 2;

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL requise' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'URL invalide' }, { status: 400 });
    }

    if (isBlockedRequestTarget(parsedUrl.toString())) {
      return NextResponse.json({ error: 'Adresse non autorisée' }, { status: 403 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    let res: Response | null = null;
    let currentUrl = parsedUrl;

    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
        if (isBlockedRequestTarget(currentUrl.toString())) {
          return NextResponse.json({ error: 'Adresse non autorisée' }, { status: 403 });
        }

        const response = await fetch(currentUrl.toString(), {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': 'LKDV-LinkPreviewBot/1.0 (+https://kitduvoyageur.fr)',
            Accept: 'text/html,application/xhtml+xml',
          },
        });

        if (REDIRECT_STATUSES.has(response.status)) {
          const location = response.headers.get('location');
          if (!location) {
            return NextResponse.json({ error: 'Redirection invalide' }, { status: 502 });
          }
          try {
            currentUrl = new URL(location, currentUrl);
          } catch {
            return NextResponse.json({ error: 'Redirection invalide' }, { status: 502 });
          }
          continue;
        }

        res = response;
        break;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res) {
      return NextResponse.json({ error: 'Trop de redirections' }, { status: 502 });
    }

    if (!res.ok) {
      return NextResponse.json({ error: 'Erreur de réponse serveur' }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return NextResponse.json({ error: 'Format non supporté' }, { status: 400 });
    }

    // Limiter la lecture HTML aux 100 premiers KB
    const reader = res.body?.getReader();
    let html = '';
    if (reader) {
      let readBytes = 0;
      const decoder = new TextDecoder();
      while (readBytes < 102400) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        readBytes += value.length;
        html += decoder.decode(value, { stream: true });
      }
      reader.cancel().catch(() => {});
    } else {
      html = await res.text();
    }

    const getMetaTag = (property: string): string | null => {
      const match =
        html.match(new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
        html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i')) ||
        html.match(new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
        html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${property}["']`, 'i'));
      return match ? match[1].trim() : null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    const title = getMetaTag('og:title') || getMetaTag('twitter:title') || (titleMatch ? titleMatch[1].trim() : null);
    const description = getMetaTag('og:description') || getMetaTag('twitter:description') || getMetaTag('description');
    const image = getMetaTag('og:image') || getMetaTag('twitter:image');
    const siteName = getMetaTag('og:site_name');

    if (!title && !description && !image) {
      return NextResponse.json({ error: 'Aucune métadonnée OpenGraph trouvée' }, { status: 404 });
    }

    return NextResponse.json({
      title: title || currentUrl.hostname,
      description: description || null,
      image: image || null,
      siteName: siteName || currentUrl.hostname,
      domain: currentUrl.hostname.replace(/^www\./, ''),
      url: currentUrl.toString(),
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return NextResponse.json({ error: 'Délai d\'attente dépassé (3s max)' }, { status: 540 });
    }
    return NextResponse.json({ error: 'Erreur de traitement' }, { status: 500 });
  }
}
