import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { LruCache, quantizeCoord, sanitizeHttpsUrl } from '@/lib/explorer/edgeCache';
import {
  buildWeatherAdviceFr,
  describeWmoWeatherCode,
  formatCompassDirectionFr,
} from '@/features/explorer-v2/poiTaxonomy';

export const revalidate = 1800;

const querySchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().max(180).optional(),
  kind: z.string().max(60).optional(),
  subtype: z.string().max(60).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  ele_m: z.coerce.number().optional(),
  potable: z.string().optional(),
  capacity: z.coerce.number().optional(),
});

export interface PoiPracticalItem {
  key: string;
  label: string;
  value: string;
  href?: string;
  tone?: 'good' | 'warn' | 'neutral';
}

export interface PoiDetailPayload {
  id: string;
  elevationM: number | null;
  locationLabel: string | null;
  address: string | null;
  summary: string | null;
  imageUrl: string | null;
  galleryImages: string[];
  wikiUrl: string | null;
  osmUrl: string | null;
  population: number | null;
  weather: {
    tempC: number | null;
    feelsLikeC: number | null;
    windKmh: number | null;
    precipMm: number | null;
    label: string;
    symbol: 'sun' | 'cloud' | 'rain' | 'snow' | 'storm';
    advice: string | null;
    sunriseHm: string | null;
    sunsetHm: string | null;
  } | null;
  practical: PoiPracticalItem[];
  sources: string[];
}

const DETAIL_CACHE = new LruCache<PoiDetailPayload>(400);
const DETAIL_TTL_MS = 12 * 60 * 60_000;
const USER_AGENT = 'LeKitDuVoyageur-Explorer/2.0 (https://lekitduvoyageur.fr)';

async function fetchJsonWithTimeout<T>(url: string, timeoutMs: number): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseOsmId(rawId: string): { type: 'node' | 'way' | 'relation'; num: string } | null {
  const m = /^([nwr])(\d+)$/i.exec(rawId.trim());
  if (!m) return null;
  const prefix = m[1].toLowerCase();
  return {
    type: prefix === 'n' ? 'node' : prefix === 'w' ? 'way' : 'relation',
    num: m[2],
  };
}

function extractHm(iso?: string | null): string | null {
  if (!iso || typeof iso !== 'string') return null;
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}h${m[2]}` : null;
}

function parseOsmTagsToPractical(
  tags: Record<string, string>,
  fallbackPotable: boolean | null,
  fallbackCapacity: number | null,
): {
  practical: PoiPracticalItem[];
  eleM: number | null;
  description: string | null;
  wikipediaTag: string | null;
  population: number | null;
} {
  const practical: PoiPracticalItem[] = [];
  const push = (
    key: string,
    label: string,
    value: string,
    opts?: { href?: string; tone?: 'good' | 'warn' | 'neutral' },
  ) => {
    if (!value.trim()) return;
    practical.push({ key, label, value: value.trim(), ...opts });
  };

  // Altitude from OSM tag
  const eleRaw = tags.ele ? Number.parseFloat(tags.ele.replace(',', '.')) : NaN;
  const eleM = Number.isFinite(eleRaw) ? Math.round(eleRaw) : null;

  // Population
  const popRaw = tags.population ? Number.parseInt(tags.population.replace(/\s+/g, ''), 10) : NaN;
  const population = Number.isFinite(popRaw) && popRaw > 0 ? popRaw : null;

  // Capacity / beds
  const capRaw = tags.beds ?? tags.capacity ?? (fallbackCapacity != null ? String(fallbackCapacity) : '');
  if (capRaw) {
    const isHut = tags.tourism === 'alpine_hut' || tags.tourism === 'wilderness_hut';
    push('capacity', isHut ? 'Couchages' : 'Capacité', isHut ? `${capRaw} places` : `${capRaw}`, {
      tone: 'neutral',
    });
  }

  // Water potability & seasonality
  if (tags.drinking_water === 'yes' || tags.amenity === 'drinking_water' || fallbackPotable === true) {
    push('water', 'Eau', 'Potable (vérifiée OSM)', { tone: 'good' });
  } else if (tags.drinking_water === 'no') {
    push('water', 'Eau', 'Non potable — à filtrer / bouillir', { tone: 'warn' });
  } else if (tags.natural === 'spring') {
    push('water', 'Eau', 'Source naturelle (filtrage conseillé)', { tone: 'warn' });
  }
  if (tags.seasonal === 'yes' || tags.intermittent === 'yes') {
    push('seasonal', 'Débit', 'Saisonnier / intermittent (peut être à sec en été)', { tone: 'warn' });
  }
  if (tags.bottle === 'yes') {
    push('bottle', 'Gourde', 'Remplissage facile', { tone: 'good' });
  }

  // Refuge / shelter / camp equipment
  if (tags.operator) push('operator', 'Gestionnaire', tags.operator);
  if (tags.network) push('network', 'Réseau', tags.network);
  if (tags.opening_hours) push('hours', 'Horaires', tags.opening_hours);
  if (tags.reservation === 'required') {
    push('reservation', 'Réservation', 'Obligatoire', { tone: 'warn' });
  } else if (tags.reservation === 'yes' || tags.reservation === 'recommended') {
    push('reservation', 'Réservation', 'Conseillée', { tone: 'neutral' });
  }
  if (tags.fee === 'no') {
    push('fee', 'Accès', 'Gratuit', { tone: 'good' });
  } else if (tags.fee === 'yes') {
    push('fee', 'Accès', 'Payant', { tone: 'neutral' });
  }
  if (tags.fireplace === 'yes' || tags.heating === 'yes') {
    push('heating', 'Chauffage', 'Poêle / cheminée disponible', { tone: 'good' });
  }
  if (tags.mattress === 'yes') {
    push('mattress', 'Couchage', 'Matelas sur place', { tone: 'good' });
  }
  if (tags.toilets === 'yes') {
    push('toilets', 'Sanitaires', 'Toilettes sur place', { tone: 'good' });
  }
  if (tags.shower === 'yes') {
    push('shower', 'Douche', 'Disponible', { tone: 'good' });
  }
  if (tags.shelter === 'yes') {
    push('shelter', 'Abri', 'Abrité de la pluie', { tone: 'good' });
  }
  if (tags.bench === 'yes') {
    push('bench', 'Repos', 'Banc disponible', { tone: 'neutral' });
  }
  if (tags.tents === 'yes') {
    push('tents', 'Tentes', 'Autorisées', { tone: 'good' });
  }
  if (tags.openfire === 'no') {
    push('openfire', 'Feu', 'Feu interdit', { tone: 'warn' });
  } else if (tags.openfire === 'yes') {
    push('openfire', 'Feu', 'Foyer autorisé', { tone: 'neutral' });
  }
  if (tags.wheelchair === 'yes') {
    push('wheelchair', 'Accessibilité', 'Accessible PMR', { tone: 'good' });
  }
  if (tags.surface) {
    const surfaceFr: Record<string, string> = {
      asphalt: 'Bitume',
      paved: 'Revêtu',
      gravel: 'Gravier',
      dirt: 'Terre',
      grass: 'Herbe',
      rock: 'Roche',
      sand: 'Sable',
      wood: 'Bois',
    };
    push('surface', 'Sol', surfaceFr[tags.surface.toLowerCase()] ?? tags.surface);
  }
  if (tags.prominence) {
    push('prominence', 'Proéminence', `${tags.prominence} m`);
  }
  const orientation = formatCompassDirectionFr(tags.direction);
  if (orientation) {
    push('direction', 'Orientation panorama', orientation);
  }
  const rawLines = tags.route_ref ?? tags.lines ?? (tags.highway === 'bus_stop' || tags.railway === 'station' ? tags.ref : undefined);
  if (rawLines) {
    const cleanLines = rawLines
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6)
      .join(' · ');
    if (cleanLines) {
      push('lines', 'Lignes desservies', cleanLines);
    }
  }

  // Contact links (strictly validated)
  const rawWebsite = tags.website ?? tags['contact:website'] ?? tags.url;
  const safeWeb = sanitizeHttpsUrl(rawWebsite);
  if (safeWeb) {
    let host = safeWeb;
    try {
      host = new URL(safeWeb).hostname.replace(/^www\./, '');
    } catch {
      /* keep url */
    }
    push('website', 'Site officiel', host, { href: safeWeb, tone: 'good' });
  }
  const rawPhone = tags.phone ?? tags['contact:phone'];
  if (rawPhone && /^[+\d\s().-]{6,25}$/.test(rawPhone.trim())) {
    push('phone', 'Téléphone', rawPhone.trim(), {
      href: `tel:${rawPhone.replace(/[^\d+]/g, '')}`,
      tone: 'neutral',
    });
  }

  const description =
    tags['description:fr'] ?? tags.description ?? tags.note ?? tags.inscription ?? null;
  const wikipediaTag = tags['wikipedia:fr'] ?? tags.wikipedia ?? null;

  return { practical, eleM, description, wikipediaTag, population };
}

async function fetchWikiSummary(
  lat: number,
  lng: number,
  name: string | undefined,
  wikipediaTag: string | null,
): Promise<{ extract: string | null; imageUrl: string | null; wikiUrl: string | null }> {
  // 1. Direct Wikipedia tag from OSM (highest precision!)
  if (wikipediaTag && wikipediaTag.includes(':')) {
    const [langRaw, ...rest] = wikipediaTag.split(':');
    const lang = langRaw.toLowerCase() === 'en' ? 'en' : 'fr';
    const title = rest.join(':').trim();
    if (title) {
      const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const data = await fetchJsonWithTimeout<{
        extract?: string;
        thumbnail?: { source?: string };
        content_urls?: { desktop?: { page?: string } };
      }>(url, 2600);
      if (data?.extract) {
        const rawImg = sanitizeHttpsUrl(data.thumbnail?.source) ?? null;
        return {
          extract: data.extract,
          imageUrl: rawImg && !COMMONS_REJECT_RE.test(rawImg) ? rawImg : null,
          wikiUrl: sanitizeHttpsUrl(data.content_urls?.desktop?.page) ?? null,
        };
      }
    }
  }

  // 2. Geo-constrained Wikipedia search (prevents wrong homonyms!)
  const cleanName = (name ?? '').trim();
  const genericNames = new Set([
    'point d’eau potable',
    "point d'eau potable",
    'source naturelle',
    'abri',
    'parking',
    'arrêt de bus',
    'gare',
    'point de vue',
    'départ de sentier',
    'point d’intérêt',
  ]);
  if (!cleanName || cleanName.length < 3 || genericNames.has(cleanName.toLowerCase())) {
    return { extract: null, imageUrl: null, wikiUrl: null };
  }

  const geoQs = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'geosearch',
    ggscoord: `${lat.toFixed(5)}|${lng.toFixed(5)}`,
    ggsradius: '1200',
    ggslimit: '6',
    prop: 'extracts|pageimages|info',
    exintro: '1',
    explaintext: '1',
    exsentences: '3',
    piprop: 'thumbnail',
    pithumbsize: '640',
    inprop: 'url',
  });

  const normTokens = extractSignificantPlaceTokens(cleanName);
  if (normTokens.length === 0) {
    return { extract: null, imageUrl: null, wikiUrl: null };
  }

  const findGeoMatch = async (lang: 'fr' | 'en') => {
    const geoRes = await fetchJsonWithTimeout<{
      query?: {
        pages?: Array<{
          title?: string;
          extract?: string;
          thumbnail?: { source?: string };
          fullurl?: string;
        }>;
      };
    }>(`https://${lang}.wikipedia.org/w/api.php?${geoQs.toString()}`, 2600);

    const pages = geoRes?.query?.pages ?? [];
    const matched = pages.find((p) => {
      const t = (p.title ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return normTokens.some((tok) => t.includes(tok));
    });

    if (matched?.extract) {
      const rawImg = sanitizeHttpsUrl(matched.thumbnail?.source) ?? null;
      return {
        extract: matched.extract.trim(),
        imageUrl: rawImg && !COMMONS_REJECT_RE.test(rawImg) ? rawImg : null,
        wikiUrl: sanitizeHttpsUrl(matched.fullurl) ?? null,
      };
    }
    return null;
  };

  const frHit = await findGeoMatch('fr');
  if (frHit) return frHit;

  const enHit = await findGeoMatch('en');
  if (enHit) return enHit;

  return { extract: null, imageUrl: null, wikiUrl: null };
}

const COMMONS_REJECT_RE =
  /\.(svg|pdf|ogv|ogg|webm|tif|tiff|gif)$|(blason|coat[_ ]of[_ ]arms|armoiries|carte|map|plan|cadastre|logo|flag|drapeau|diagram|icon|svg|auto|voiture|rallye|salon|peugeot|renault|citroen|ferrari|porsche|bmw|audi|mercedes|volkswagen|ford|toyota|moto|avion|airbus|boeing|concert|football|rugby|portrait|tombe|cimetiere|plaque)/i;

const GENERIC_PLACE_STOPWORDS = new Set([
  'france', 'paris', 'saint', 'sainte', 'grand', 'grande', 'petit', 'petite',
  'haut', 'haute', 'basse', 'refuge', 'cabane', 'abri', 'source', 'fontaine',
  'parking', 'gare', 'arret', 'route', 'chemin', 'sentier', 'village', 'hameau',
  'ville', 'point', 'place', 'mont', 'montagne', 'piste', 'photo', 'image',
  'centre', 'nord', 'ouest', 'commune', 'quartier', 'lieu', 'bois', 'foret',
]);

function extractSignificantPlaceTokens(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !GENERIC_PLACE_STOPWORDS.has(t));
}

async function fetchCommonsExactFile(commonsTag: string): Promise<string | null> {
  const trimmed = commonsTag.trim();
  if (!/^File:/i.test(trimmed)) return null;
  const qs = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    titles: trimmed,
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '640',
  });
  const data = await fetchJsonWithTimeout<{
    query?: { pages?: Array<{ imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string }> }> };
  }>(`https://commons.wikimedia.org/w/api.php?${qs.toString()}`, 2200);
  const info = data?.query?.pages?.[0]?.imageinfo?.[0];
  if (!info) return null;
  if (info.mime && !/^image\/(jpeg|jpg|webp|png)$/i.test(info.mime)) return null;
  return sanitizeHttpsUrl(info.thumburl ?? info.url) ?? null;
}

async function fetchCommonsGeoPhotos(lat: number, lng: number, name?: string): Promise<string[]> {
  const tokens = extractSignificantPlaceTokens(name);
  // Strict relevance gate: never grab random unrelated nearby photos when the POI has no distinctive name!
  if (tokens.length === 0) return [];

  const qs = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'geosearch',
    ggscoord: `${lat.toFixed(5)}|${lng.toFixed(5)}`,
    ggsradius: '900',
    ggsnamespace: '6',
    ggslimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '640',
  });
  const data = await fetchJsonWithTimeout<{
    query?: {
      pages?: Array<{
        title?: string;
        imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string }>;
      }>;
    };
  }>(`https://commons.wikimedia.org/w/api.php?${qs.toString()}`, 2400);

  const photos: string[] = [];
  for (const page of data?.query?.pages ?? []) {
    const title = page.title ?? '';
    if (COMMONS_REJECT_RE.test(title)) continue;
    const normTitle = title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    // STRICT: Filename must actually reference this place (prevents random nearby car shows/events!)
    if (!tokens.some((tok) => normTitle.includes(tok))) continue;
    const info = page.imageinfo?.[0];
    if (!info) continue;
    if (info.mime && !/^image\/(jpeg|jpg|webp|png)$/i.test(info.mime)) continue;
    const safe = sanitizeHttpsUrl(info.thumburl ?? info.url);
    if (safe && !COMMONS_REJECT_RE.test(safe) && !photos.includes(safe)) {
      photos.push(safe);
    }
    if (photos.length >= 4) break;
  }
  return photos;
}

export async function GET(request: Request) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-v2-poi-detail',
    limit: 60,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const sp = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    id: sp.get('id'),
    name: sp.get('name') ?? undefined,
    kind: sp.get('kind') ?? undefined,
    subtype: sp.get('subtype') ?? undefined,
    lat: sp.get('lat'),
    lng: sp.get('lng'),
    ele_m: sp.get('ele_m') ?? undefined,
    potable: sp.get('potable') ?? undefined,
    capacity: sp.get('capacity') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'paramètres invalides' }, { status: 400 });
  }

  const { id, name, lat, lng, ele_m, potable, capacity } = parsed.data;
  const cacheKey = `${id}:${quantizeCoord(lat, 3)}:${quantizeCoord(lng, 3)}`;
  const cached = DETAIL_CACHE.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=7200' },
    });
  }

  const osmRef = parseOsmId(id);
  const osmUrl = osmRef ? `https://www.openstreetmap.org/${osmRef.type}/${osmRef.num}` : null;
  const fallbackPotable = potable === 'true' ? true : potable === 'false' ? false : null;
  const fallbackCapacity = typeof capacity === 'number' && Number.isFinite(capacity) ? capacity : null;

  // Parallel real-data enrichment (OSM v0.6 + Open-Meteo + Nominatim + Wikimedia Commons Geosearch photos)
  const [osmData, meteoData, nominatimData, commonsPhotos] = await Promise.all([
    osmRef
      ? fetchJsonWithTimeout<{
          elements?: Array<{ tags?: Record<string, string> }>;
        }>(`https://api.openstreetmap.org/api/0.6/${osmRef.type}/${osmRef.num}.json`, 2800)
      : Promise.resolve(null),
    fetchJsonWithTimeout<{
      elevation?: number;
      current?: {
        temperature_2m?: number;
        apparent_temperature?: number;
        weather_code?: number;
        wind_speed_10m?: number;
        precipitation?: number;
      };
      daily?: {
        sunrise?: string[];
        sunset?: string[];
      };
    }>(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(5)}&longitude=${lng.toFixed(5)}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation&daily=sunrise,sunset&timezone=auto&forecast_days=1`,
      3000,
    ),
    fetchJsonWithTimeout<{
      display_name?: string;
      address?: {
        village?: string;
        town?: string;
        city?: string;
        municipality?: string;
        county?: string;
        state?: string;
        country?: string;
        road?: string;
        hamlet?: string;
      };
    }>(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&zoom=14&accept-language=fr`,
      2600,
    ),
    fetchCommonsGeoPhotos(lat, lng, name),
  ]);

  const osmTags = osmData?.elements?.[0]?.tags ?? {};
  const parsedOsm = parseOsmTagsToPractical(osmTags, fallbackPotable, fallbackCapacity);

  // Geo-constrained Wikipedia summary + exact OSM wikimedia_commons file if tagged
  const [wiki, osmCommonsImg] = await Promise.all([
    fetchWikiSummary(lat, lng, name, parsedOsm.wikipediaTag),
    osmTags.wikimedia_commons ? fetchCommonsExactFile(osmTags.wikimedia_commons) : Promise.resolve(null),
  ]);

  const elevationM =
    typeof ele_m === 'number' && Number.isFinite(ele_m)
      ? Math.round(ele_m)
      : parsedOsm.eleM ??
        (typeof meteoData?.elevation === 'number' && Number.isFinite(meteoData.elevation)
          ? Math.round(meteoData.elevation)
          : null);

  const addr = nominatimData?.address;
  const locality = addr?.village ?? addr?.town ?? addr?.city ?? addr?.municipality ?? addr?.hamlet ?? null;
  const area = addr?.county ?? addr?.state ?? null;
  const locParts = [locality, area, addr?.country].filter(
    (part, idx, arr): part is string => Boolean(part) && arr.indexOf(part) === idx,
  );
  const locationLabel = locParts.length > 0 ? locParts.slice(0, 2).join(' · ') : null;
  const address = addr?.road && locality ? `${addr.road}, ${locality}` : null;

  let weather: PoiDetailPayload['weather'] = null;
  if (meteoData?.current) {
    const tempC =
      typeof meteoData.current.temperature_2m === 'number'
        ? Math.round(meteoData.current.temperature_2m)
        : null;
    const feelsLikeC =
      typeof meteoData.current.apparent_temperature === 'number'
        ? Math.round(meteoData.current.apparent_temperature)
        : null;
    const windKmh =
      typeof meteoData.current.wind_speed_10m === 'number'
        ? Math.round(meteoData.current.wind_speed_10m)
        : null;
    const precipMm =
      typeof meteoData.current.precipitation === 'number' ? meteoData.current.precipitation : null;
    const desc = describeWmoWeatherCode(meteoData.current.weather_code);
    weather = {
      tempC,
      feelsLikeC,
      windKmh,
      precipMm,
      label: desc.label,
      symbol: desc.symbol,
      advice: buildWeatherAdviceFr(tempC, windKmh, precipMm, desc.symbol),
      sunriseHm: extractHm(meteoData.daily?.sunrise?.[0]),
      sunsetHm: extractHm(meteoData.daily?.sunset?.[0]),
    };
  }

  const osmDirectImg = sanitizeHttpsUrl(osmTags.image) ?? null;
  const galleryImages: string[] = [];
  for (const candidate of [osmDirectImg, osmCommonsImg, wiki.imageUrl, ...commonsPhotos]) {
    if (candidate && !galleryImages.includes(candidate)) {
      galleryImages.push(candidate);
    }
    if (galleryImages.length >= 4) break;
  }
  const bestImageUrl = galleryImages[0] ?? null;

  const sources: string[] = [];
  if (Object.keys(osmTags).length > 0) sources.push('OpenStreetMap');
  if (meteoData) sources.push('Open-Meteo');
  if (wiki.extract || wiki.imageUrl) sources.push('Wikipédia');
  if (commonsPhotos.length > 0 || osmCommonsImg) sources.push('Wikimedia Commons');
  if (nominatimData) sources.push('Nominatim');

  const payload: PoiDetailPayload = {
    id,
    elevationM,
    locationLabel,
    address,
    summary: wiki.extract ?? parsedOsm.description,
    imageUrl: bestImageUrl,
    galleryImages,
    wikiUrl: wiki.wikiUrl,
    osmUrl,
    population: parsedOsm.population,
    weather,
    practical: parsedOsm.practical,
    sources,
  };

  DETAIL_CACHE.set(cacheKey, payload, DETAIL_TTL_MS);

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=7200' },
  });
}
