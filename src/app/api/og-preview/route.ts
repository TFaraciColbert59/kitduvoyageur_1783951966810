import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function isPrivateIp(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname;

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local')
    ) {
      return true;
    }

    // Check private IPv4 ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    if (match) {
      const [, p1, p2] = match.map(Number);
      if (p1 === 10) return true;
      if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
      if (p1 === 192 && p2 === 168) return true;
      if (p1 === 169 && p2 === 254) return true; // Link-local
    }

    return false;
  } catch {
    return true;
  }
}

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

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'Protocole non supporté' }, { status: 400 });
    }

    if (isPrivateIp(url)) {
      return NextResponse.json({ error: 'Adresse privée non autorisée' }, { status: 403 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'LKDV-LinkPreviewBot/1.0 (+https://kitduvoyageur.fr)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    clearTimeout(timeoutId);

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
      title: title || parsedUrl.hostname,
      description: description || null,
      image: image || null,
      siteName: siteName || parsedUrl.hostname,
      domain: parsedUrl.hostname.replace(/^www\./, ''),
      url: parsedUrl.toString(),
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return NextResponse.json({ error: 'Délai d\'attente dépassé (3s max)' }, { status: 540 });
    }
    return NextResponse.json({ error: 'Erreur de traitement' }, { status: 500 });
  }
}
