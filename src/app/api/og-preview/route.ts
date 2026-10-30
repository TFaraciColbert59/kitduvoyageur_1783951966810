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
 *     (bloque les cibles privées ; ne garantit pas le DNS pinning) ;
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
    const controller = new AbortController();
    const deadline = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        'abort',
        () => {
          reject(new DOMException('Deadline exceeded', 'AbortError'));
        },
        { once: true }
      );
    });
    const bounded = <T>(operation: Promise<T>): Promise<T> => Promise.race([operation, deadline]);
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
        const hostCheck = await bounded(assertHostResolvesPublic(current.hostname, resolveAll));
        if (!hostCheck.ok) {
          const failure = hostCheck as { status: number; error: string };
          return NextResponse.json({ error: failure.error }, { status: failure.status });
        }

        let res: Response | undefined;
        let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        try {
          const request = fetch(current.toString(), {
            signal: controller.signal,
            redirect: 'manual',
            headers: {
              'User-Agent': `LKDV-LinkPreviewBot/1.0 (+${SITE_CONTACT_URL})`,
              Accept: 'text/html,application/xhtml+xml',
            },
          });
          // Dispose even if an upstream ignores abort and resolves after our deadline.
          void request.then(
            (response) => {
              if (controller.signal.aborted) void response.body?.cancel().catch(() => {});
            },
            () => {}
          );
          res = await bounded(request);

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
          if (
            !contentType.includes('text/html') &&
            !contentType.includes('application/xhtml+xml')
          ) {
            return NextResponse.json({ error: 'Format non supporté' }, { status: 400 });
          }

          // Limiter la lecture HTML aux 100 premiers KB.
          reader = res.body?.getReader();
          let html = '';
          if (reader) {
            let readBytes = 0;
            const decoder = new TextDecoder();
            while (readBytes < MAX_HTML_BYTES) {
              const { done, value } = await bounded(reader.read());
              if (done || !value) break;
              const chunk = value.subarray(0, MAX_HTML_BYTES - readBytes);
              readBytes += chunk.byteLength;
              html += decoder.decode(chunk, { stream: true });
            }
            html += decoder.decode();
          }

          const getMetaTag = (property: string): string | null => {
            const match =
              html.match(
                new RegExp(
                  `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`,
                  'i'
                )
              ) ||
              html.match(
                new RegExp(
                  `<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`,
                  'i'
                )
              ) ||
              html.match(
                new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i')
              ) ||
              html.match(
                new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${property}["']`, 'i')
              );
            return match ? match[1].trim() : null;
          };

          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

          const title =
            getMetaTag('og:title') ||
            getMetaTag('twitter:title') ||
            (titleMatch ? titleMatch[1].trim() : null);
          const description =
            getMetaTag('og:description') ||
            getMetaTag('twitter:description') ||
            getMetaTag('description');
          const image = getMetaTag('og:image') || getMetaTag('twitter:image');
          const siteName = getMetaTag('og:site_name');

          if (!title && !description && !image) {
            return NextResponse.json(
              { error: 'Aucune métadonnée OpenGraph trouvée' },
              { status: 404 }
            );
          }

          return NextResponse.json({
            title: title || current.hostname,
            description: description || null,
            image: image || null,
            siteName: siteName || current.hostname,
            domain: current.hostname.replace(/^www\./, ''),
            url: current.toString(),
          });
        } finally {
          // Cancellation can itself stall: never extend the request budget awaiting it.
          if (reader) void reader.cancel().catch(() => {});
          else if (res?.body) void res.body.cancel().catch(() => {});
        }
      }

      return NextResponse.json({ error: 'Trop de redirections' }, { status: 400 });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'AbortError') {
      return NextResponse.json({ error: "Délai d'attente dépassé (3s max)" }, { status: 540 });
    }
    return NextResponse.json({ error: 'Erreur de traitement' }, { status: 500 });
  }
}
