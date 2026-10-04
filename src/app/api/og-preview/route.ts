import { lookup } from 'node:dns/promises';
import { NextRequest, NextResponse } from 'next/server';

import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_URL_LENGTH = 2048;
const MAX_REDIRECTS = 2;
const FETCH_TIMEOUT_MS = 3000;
const MAX_BYTES = 102_400;

/** Plages interdites : privées, link-local, loopback, métadonnées cloud, IPv6 locales. */
function isBlockedIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    return false;
  }
  const low = ip.toLowerCase();
  // IPv4-mappée ::ffff:a.b.c.d → juger la partie v4.
  const mapped = low.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isBlockedIp(mapped[1]);
  if (low === '::1' || low === '::') return true;
  if (low.startsWith('fc') || low.startsWith('fd')) return true; // unique-local fc00::/7
  if (low.startsWith('fe80')) return true; // link-local
  if (low.startsWith('ff')) return true; // multicast
  // Décimal/octal/hex déguisés : bloquer tout ce qui ressemble à un nombre pur.
  if (/^[0-9a-fx.]+$/i.test(ip) && !ip.includes(':') && !v4) return true;
  return false;
}

/** Valide protocole + résout le DNS et refuse toute adresse privée. */
async function resolveSafeUrl(raw: string): Promise<URL | null> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  try {
    const records = await lookup(parsed.hostname, { all: true });
    if (records.length === 0) return null;
    if (records.some((r) => isBlockedIp(r.address))) return null;
  } catch {
    return null;
  }
  return parsed;
}

function getMetaTag(html: string, property: string): string | null {
  const patterns = [
    `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`,
    `<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`,
    `<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`,
    `<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${property}["']`,
  ];
  for (const p of patterns) {
    const match = html.match(new RegExp(p, 'i'));
    if (match) return match[1].trim().slice(0, 1024);
  }
  return null;
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(req.headers), {
    scope: 'og-preview',
    limit: 30,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const url =
    typeof raw === 'object' && raw !== null
      ? (raw as { url?: unknown }).url
      : undefined;
  if (typeof url !== 'string' || url.length === 0 || url.length > MAX_URL_LENGTH) {
    return NextResponse.json({ error: 'URL requise (≤2048 caractères)' }, { status: 400 });
  }

  try {
    // Suivi manuel des redirections : chaque cible est re-validée (DNS + IP).
    let current = await resolveSafeUrl(url);
    if (!current) {
      return NextResponse.json({ error: 'URL refusée' }, { status: 403 });
    }

    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        res = await fetch(current.toString(), {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': 'LKDV-LinkPreviewBot/1.0 (+https://lekitduvoyageur.fr)',
            Accept: 'text/html,application/xhtml+xml',
          },
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        await res.arrayBuffer().catch(() => null);
        if (!location) {
          return NextResponse.json({ error: 'Redirection invalide' }, { status: 400 });
        }
        const next = await resolveSafeUrl(new URL(location, current).toString());
        if (!next) {
          return NextResponse.json({ error: 'Redirection refusée' }, { status: 403 });
        }
        current = next;
        res = null;
        continue;
      }
      break;
    }
    if (!res) {
      return NextResponse.json({ error: 'Trop de redirections' }, { status: 400 });
    }

    if (!res.ok) {
      return NextResponse.json({ error: 'Erreur de réponse serveur' }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return NextResponse.json({ error: 'Format non supporté' }, { status: 400 });
    }

    const reader = res.body?.getReader();
    let html = '';
    if (reader) {
      let readBytes = 0;
      const decoder = new TextDecoder();
      while (readBytes < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        readBytes += value.length;
        html += decoder.decode(value, { stream: true });
      }
      reader.cancel().catch(() => {});
    } else {
      html = await res.text();
    }

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title =
      getMetaTag(html, 'og:title') ||
      getMetaTag(html, 'twitter:title') ||
      (titleMatch ? titleMatch[1].trim().slice(0, 300) : null);
    const description =
      getMetaTag(html, 'og:description') ||
      getMetaTag(html, 'twitter:description') ||
      getMetaTag(html, 'description');
    const image = getMetaTag(html, 'og:image') || getMetaTag(html, 'twitter:image');
    const siteName = getMetaTag(html, 'og:site_name');

    if (!title && !description && !image) {
      return NextResponse.json({ error: 'Aucune métadonnée trouvée' }, { status: 404 });
    }

    return NextResponse.json({
      title: title || current.hostname,
      description: description || null,
      image: image || null,
      siteName: siteName || current.hostname,
      domain: current.hostname.replace(/^www\./, ''),
      url: current.toString(),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: "Délai dépassé (3s max)" }, { status: 504 });
    }
    return NextResponse.json({ error: 'Erreur de traitement' }, { status: 500 });
  }
}
