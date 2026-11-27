import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { LruCache, sanitizeHttpsUrl } from '@/lib/explorer/edgeCache';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  pois: z
    .array(
      z.object({
        id: z.string().min(1).max(160),
        name: z.string().min(1).max(160),
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
        kind: z.string().max(64).optional(),
      }),
    )
    .max(20),
});

const POI_CACHE = new LruCache<string | null>(2000);
const CACHE_TTL_MS = 24 * 60 * 60_000;
const UA = 'LeKitDuVoyageur-Explorer/2.0 (https://lekitduvoyageur.fr)';

const NON_PHOTO_RE =
  /\.(svg|pdf|ogv|ogg|webm|tif|tiff|gif)$|(blason|coat[_ ]of[_ ]arms|armoiries|flag[_ ]of|drapeau|logo|map|carte|location|locator|plan[_ ]de|schema|diagram|icon|picto|emblem|auto|voiture|rallye|salon|peugeot|renault|citroen|ferrari|porsche|bmw|audi|mercedes|volkswagen|ford|toyota|moto|avion|airbus|boeing|concert|football|rugby|portrait|tombe|cimetiere|plaque)/i;

const GENERIC_PLACE_STOPWORDS = new Set([
  'france', 'paris', 'saint', 'sainte', 'grand', 'grande', 'petit', 'petite',
  'haut', 'haute', 'basse', 'refuge', 'cabane', 'abri', 'source', 'fontaine',
  'parking', 'gare', 'arret', 'route', 'chemin', 'sentier', 'village', 'hameau',
  'ville', 'point', 'place', 'mont', 'montagne', 'piste', 'photo', 'image',
  'centre', 'nord', 'ouest', 'commune', 'quartier', 'lieu', 'bois', 'foret',
]);

function normalizeWikiTitle(raw: string): string {
  const primary = raw.split(/\s*\/\s*/)[0]?.trim() ?? raw.trim();
  const arrMatch = /^Paris\s+\d{1,2}\s+(.+)$/i.exec(primary);
  return arrMatch?.[1] ? arrMatch[1].trim() : primary;
}

function extractSignificantTokens(raw: string): string[] {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !GENERIC_PLACE_STOPWORDS.has(t));
}

function approxKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * 111.32;
  const dLon = (lon2 - lon1) * 111.32 * Math.cos(((lat1 + lat2) * Math.PI) / 360);
  return Math.hypot(dLat, dLon);
}

interface WikiBatchHit {
  url: string;
  lat: number | null;
  lon: number | null;
}

async function fetchWikiBatch(
  lang: 'fr' | 'en',
  titles: string[],
): Promise<{ ok: boolean; hits: Map<string, WikiBatchHit> }> {
  const hits = new Map<string, WikiBatchHit>();
  if (titles.length === 0) return { ok: true, hits };

  const qs = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    prop: 'pageimages|coordinates',
    piprop: 'thumbnail',
    pithumbsize: '480',
    pilimit: '50',
    colimit: '50',
    titles: titles.join('|'),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2600);
  try {
    const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${qs.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, hits };
    const data = (await res.json()) as {
      query?: {
        normalized?: Array<{ from: string; to: string }>;
        redirects?: Array<{ from: string; to: string }>;
        pages?: Array<{
          title?: string;
          thumbnail?: { source?: string };
          coordinates?: Array<{ lat?: number; lon?: number }>;
        }>;
      };
    };

    const aliasMap = new Map<string, string>();
    for (const item of data.query?.normalized ?? []) {
      aliasMap.set(item.from.toLowerCase(), item.to.toLowerCase());
    }
    for (const item of data.query?.redirects ?? []) {
      aliasMap.set(item.from.toLowerCase(), item.to.toLowerCase());
    }

    const pageImg = new Map<string, WikiBatchHit>();
    for (const page of data.query?.pages ?? []) {
      const safe = sanitizeHttpsUrl(page.thumbnail?.source);
      if (page.title && safe && !NON_PHOTO_RE.test(safe)) {
        const coord = page.coordinates?.[0];
        pageImg.set(page.title.toLowerCase(), {
          url: safe,
          lat: typeof coord?.lat === 'number' ? coord.lat : null,
          lon: typeof coord?.lon === 'number' ? coord.lon : null,
        });
      }
    }

    for (const rawTitle of titles) {
      const k0 = rawTitle.toLowerCase();
      const k1 = aliasMap.get(k0) ?? k0;
      const k2 = aliasMap.get(k1) ?? k1;
      const hit = pageImg.get(k0) ?? pageImg.get(k1) ?? pageImg.get(k2);
      if (hit) hits.set(k0, hit);
    }
    return { ok: true, hits };
  } catch {
    return { ok: false, hits };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchStrictCommonsGeoPhoto(
  lat: number,
  lon: number,
  nameHint: string,
): Promise<{ ok: boolean; url: string | null }> {
  const tokens = extractSignificantTokens(nameHint);
  // Strict gate: never blindly pick random nearby photos when POI has no distinctive tokens!
  if (tokens.length === 0) return { ok: true, url: null };

  const qs = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'geosearch',
    ggsnamespace: '6',
    ggscoord: `${lat.toFixed(5)}|${lon.toFixed(5)}`,
    ggsradius: '900',
    ggslimit: '10',
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '480',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2400);
  try {
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${qs.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, url: null };
    const data = (await res.json()) as {
      query?: {
        pages?: Array<{
          title?: string;
          imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string }>;
        }>;
      };
    };

    for (const page of data.query?.pages ?? []) {
      const title = page.title ?? '';
      if (NON_PHOTO_RE.test(title)) continue;
      const normTitle = title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      // STRICT: filename MUST reference a significant token of this POI (zero random car-show/event leaks!)
      if (!tokens.some((tok) => normTitle.includes(tok))) continue;

      const info = page.imageinfo?.[0];
      if (!info) continue;
      if (info.mime && !/^image\/(jpeg|jpg|webp|png)$/i.test(info.mime)) continue;
      const safe = sanitizeHttpsUrl(info.thumburl ?? info.url);
      if (safe && !NON_PHOTO_RE.test(safe)) {
        return { ok: true, url: safe };
      }
    }

    return { ok: true, url: null };
  } catch {
    return { ok: false, url: null };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST /api/explorer/v2/poi-thumbs
 * Strict, geo-verified free open-data photo hydrator for visible POI cards
 * (Wikipedia FR/EN with <=25km coordinate check + strict name-matched Wikimedia Commons Geosearch).
 */
export async function POST(request: Request) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-v2-poi-thumbs',
    limit: 60,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ thumbs: {} }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ thumbs: {} }, { status: 400 });
  }

  const pois = parsed.data.pois;
  const thumbs: Record<string, string> = {};
  const uncached: Array<{ poi: (typeof pois)[number]; cacheKey: string; title: string; titleKey: string }> = [];

  for (const poi of pois) {
    const title = normalizeWikiTitle(poi.name);
    const titleKey = title.toLowerCase();
    const cacheKey = `${titleKey}@${poi.lat.toFixed(2)},${poi.lon.toFixed(2)}`;
    const cached = POI_CACHE.get(cacheKey);
    if (cached !== undefined) {
      if (typeof cached === 'string' && cached.length > 0) {
        thumbs[poi.id] = cached;
      }
      continue;
    }
    uncached.push({ poi, cacheKey, title, titleKey });
  }

  // Step 1: Parallel FR + EN Wikipedia batch with coordinate verification (rejects far homonyms!)
  if (uncached.length > 0) {
    const uniqueTitles = Array.from(new Set(uncached.map((x) => x.title)));
    const [fr, en] = await Promise.all([
      fetchWikiBatch('fr', uniqueTitles),
      fetchWikiBatch('en', uniqueTitles.slice(0, 14)),
    ]);

    const needGeo: typeof uncached = [];
    for (const item of uncached) {
      const candidate = fr.hits.get(item.titleKey) ?? en.hits.get(item.titleKey) ?? null;
      const isGeoConsistent =
        candidate !== null &&
        (candidate.lat === null ||
          candidate.lon === null ||
          approxKm(item.poi.lat, item.poi.lon, candidate.lat, candidate.lon) <= 25);

      if (candidate && isGeoConsistent) {
        POI_CACHE.set(item.cacheKey, candidate.url, CACHE_TTL_MS);
        thumbs[item.poi.id] = candidate.url;
      } else {
        needGeo.push(item);
      }
    }

    // Step 2: Strict Wikimedia Commons Geosearch (<=900m AND filename matches POI name!)
    const geoSlice = needGeo.slice(0, 10);
    if (geoSlice.length > 0) {
      const geoResults = await Promise.all(
        geoSlice.map(async (item) => {
          const res = await fetchStrictCommonsGeoPhoto(item.poi.lat, item.poi.lon, item.poi.name);
          return { item, res };
        }),
      );

      for (const { item, res } of geoResults) {
        if (res.url) {
          POI_CACHE.set(item.cacheKey, res.url, CACHE_TTL_MS);
          thumbs[item.poi.id] = res.url;
        } else if (res.ok && fr.ok && en.ok) {
          POI_CACHE.set(item.cacheKey, null, CACHE_TTL_MS);
        }
      }
    }
  }

  return NextResponse.json(
    { thumbs },
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  );
}
