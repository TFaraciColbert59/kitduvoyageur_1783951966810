import { NextRequest, NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';
import { SITE_CONTACT_URL } from '@/lib/userAgent';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit/clientIp';
import {
  parsePublicHttpUrl,
  assertHostResolvesPublic,
  type Lookup,
} from '@/lib/security/publicNetwork';

export const dynamic = 'force-dynamic';

const FETCH_TIMEOUT_MS = 3000;
const MAX_HTML_BYTES = 102400;
const MAX_REDIRECTS = 3;

const resolveAll: Lookup = async (hostname) => {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
};

/**
 * A-215 — aperçu de lien durci :
 *   - hôte (littéral ou résolu) validé public à CHAQUE saut ;
 *   - redirections suivies manuellement (max 3), chacune revalidée
 *     (contre le DNS-rebinding et le 302 vers le réseau interne) ;
 *   - timeout, taille lue et type de contenu bornés.
 */
export async function POST(req: NextRequest) {
  // Proxy sortant public : borne par IP avant toute résolution DNS.
  const limited = await enforceRateLimit(clientIpFromHeaders(req.headers), {
    scope: 'og-preview',
    limit: 20,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL requise' }, { status: 400 });
    }

    const parsed = parsePublicHttpUrl(url);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    let current = parsed.url;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const hostCheck = await assertHostResolvesPublic(current.hostname, resolveAll);
      if (!hostCheck.ok) {
        const failure = hostCheck as { status: number; error: string };
        return NextResponse.json({ error: failure.error }, { status: failure.status });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetch(current.toString(), {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': `LKDV-LinkPreviewBot/1.0 (+${SITE_CONTACT_URL})`,
            Accept: 'text/html,application/xhtml+xml',
          },
        });
      } finally {
        clearTimeout(timeoutId);
      }

      // Redirection : revalider la cible avant de la suivre.
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) {
          return NextResponse.json({ error: 'Redirection sans cible' }, { status: 400 });
        }
        if (hop === MAX_REDIRECTS) {
          return NextResponse.json({ error: 'Trop de redirections' }, { status: 400 });
        }
        const next = parsePublicHttpUrl(new URL(location, current).toString());
        if (!next.ok) {
          return NextResponse.json({ error: next.error }, { status: next.status });
        }
        current = next.url;
        continue;
      }

      if (!res.ok) {
        return NextResponse.json({ error: 'Erreur de réponse serveur' }, { status: 502 });
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        return NextResponse.json({ error: 'Format non supporté' }, { status: 400 });
      }

      // Limiter la lecture HTML aux 100 premiers KB.
      const reader = res.body?.getReader();
      let html = '';
      if (reader) {
        let readBytes = 0;
        const decoder = new TextDecoder();
        while (readBytes < MAX_HTML_BYTES) {
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
        title: title || current.hostname,
        description: description || null,
        image: image || null,
        siteName: siteName || current.hostname,
        domain: current.hostname.replace(/^www\./, ''),
        url: current.toString(),
      });
    }

    return NextResponse.json({ error: 'Trop de redirections' }, { status: 400 });
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'AbortError') {
      return NextResponse.json({ error: 'Délai d\'attente dépassé (3s max)' }, { status: 540 });
    }
    return NextResponse.json({ error: 'Erreur de traitement' }, { status: 500 });
  }
}
