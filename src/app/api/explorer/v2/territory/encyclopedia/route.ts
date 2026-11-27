import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { pgrest } from '@/lib/explorer-v2/pgrest';
import {
  buildApiMeta,
  LruCache,
  quantizeCoord,
  safeFetchJson,
  sanitizeHttpsUrl,
  type ExplorerApiMeta,
} from '@/lib/explorer/edgeCache';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 900_000; // 15 minutes
const CACHE_CONTROL_OK = 'public, s-maxage=900, stale-while-revalidate=3600';

export type TerritoryScale =
  | 'world'
  | 'continent'
  | 'country'
  | 'region'
  | 'city'
  | 'sector';

const querySchema = z.object({
  scale: z
    .enum(['world', 'continent', 'country', 'region', 'city', 'sector'])
    .default('sector'),
  id: z.string().trim().max(120).optional(),
  name: z.string().trim().max(140).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  iso: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((v) => v.toUpperCase())
    .optional(),
});

export interface TerritorialEncyclopediaEntry {
  id: string;
  scale: TerritoryScale;
  name: string;
  iso: string | null;
  coordinates: { lat: number; lng: number } | null;
  wiki: {
    title: string;
    description: string | null;
    extract: string;
    thumbnailUrl: string | null;
    pageUrl: string | null;
  } | null;
  practical: {
    capital: string | null;
    continent: string | null;
    currencyCode: string | null;
    currencyName: string | null;
    languages: string[];
    timezone: string | null;
    phoneCode: string | null;
    areaKm2: number | null;
    emergencyNumbers: Record<string, string> | null;
    plugTypes: string[];
    drivingSide: string | null;
    units: string | null;
  } | null;
  weather: {
    observedAt: string;
    temperatureC: number | null;
    windMs: number | null;
    humidityPct: number | null;
    cloudPct: number | null;
    symbol: string | null;
    precipNext1hMm: number | null;
    source: 'met-no';
  } | null;
  biodiversity: {
    totalSpecies: number;
    topSpecies: Array<{
      taxonId: number;
      commonName: string;
      scientificName: string;
      iconicTaxon: string;
      observationCount: number;
      photoUrl: string | null;
      threatened: boolean;
    }>;
  };
  hazardsSummary: {
    activeWildfires: number;
    activeAlerts: number;
    highestSeverity: string | null;
    headlines: string[];
  };
  community: {
    publicCarnetsCount: number;
    publicClubsCount: number;
  };
}

export interface TerritorialEncyclopediaPayload {
  entry: TerritorialEncyclopediaEntry;
  meta: ExplorerApiMeta;
}

const encyclopediaCache = new LruCache<TerritorialEncyclopediaEntry>(128, 6 * 60 * 60_000);

interface WikiSummaryUpstream {
  title?: string;
  description?: string;
  extract?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
}

interface WikiGeoSearchUpstream {
  query?: {
    geosearch?: Array<{ title?: string }>;
  };
}

interface CountryRow {
  iso_a2: string;
  name: string;
  continent: string | null;
  capital: string | null;
  currency_code: string | null;
  currency_name: string | null;
  phone_code: string | null;
  timezone: string | null;
  languages: string[] | null;
  area_km2: number | null;
}

interface PracticalRow {
  iso_a2: string;
  emergency_numbers: Record<string, string> | null;
  plug_types: string[] | null;
  driving_side: string | null;
  units: string | null;
}

interface MetNoCompactResponse {
  properties?: {
    timeseries?: Array<{
      time?: string;
      data?: {
        instant?: {
          details?: {
            air_temperature?: number;
            wind_speed?: number;
            relative_humidity?: number;
            cloud_area_fraction?: number;
          };
        };
        next_1_hours?: {
          summary?: { symbol_code?: string };
          details?: { precipitation_amount?: number };
        };
      };
    }>;
  };
}

interface INatCountsResponse {
  total_results?: number;
  results?: Array<{
    count?: number;
    taxon?: {
      id?: number;
      name?: string;
      preferred_common_name?: string;
      iconic_taxon_name?: string;
      threatened?: boolean;
      default_photo?: { square_url?: string; medium_url?: string };
    };
  }>;
}

interface EonetResponse {
  events?: Array<{
    title?: string;
    geometry?: Array<{ coordinates?: unknown }>;
  }>;
}

interface MeteoAlarmResponse {
  warnings?: Array<{
    alert?: {
      info?: Array<{
        language?: string;
        severity?: string;
        headline?: string;
        event?: string;
        expires?: string;
      }>;
    };
  }>;
}

const ISO_TO_METEOALARM: Record<string, string> = {
  FR: 'france',
  ES: 'spain',
  IT: 'italy',
  CH: 'switzerland',
  DE: 'germany',
  BE: 'belgium',
  AT: 'austria',
  PT: 'portugal',
  NL: 'netherlands',
  GB: 'united-kingdom',
  NO: 'norway',
  SE: 'sweden',
  PL: 'poland',
  GR: 'greece',
  IE: 'ireland',
  LU: 'luxembourg',
  IS: 'iceland',
};

async function fetchWikiEntry(
  name: string | undefined,
  lat: number | undefined,
  lng: number | undefined,
): Promise<TerritorialEncyclopediaEntry['wiki']> {
  const trySummary = async (title: string) => {
    const clean = title.trim().replace(/\s+/g, '_');
    if (!clean) return null;
    const url = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}`;
    const { data } = await safeFetchJson<WikiSummaryUpstream>(url, { timeoutMs: 4000 });
    if (!data.extract) return null;
    const descLower = (data.description ?? '').toLowerCase();
    const extractLower = data.extract.toLowerCase();
    if (
      descLower.includes('homonymie') ||
      descLower.includes('disambiguation') ||
      extractLower.includes('peut faire référence à')
    ) {
      return null;
    }
    return {
      title: data.title ?? title,
      description: data.description ?? null,
      extract: data.extract,
      thumbnailUrl: sanitizeHttpsUrl(data.thumbnail?.source),
      pageUrl: sanitizeHttpsUrl(data.content_urls?.desktop?.page),
    };
  };

  if (name) {
    try {
      const direct = await trySummary(name);
      if (direct) return direct;
    } catch {
      // Fallback to geosearch below when coordinates are present
    }
  }

  if (typeof lat === 'number' && typeof lng === 'number') {
    const geoUrl =
      `https://fr.wikipedia.org/w/api.php?action=query&list=geosearch` +
      `&gscoord=${lat.toFixed(4)}|${lng.toFixed(4)}&gsradius=10000&gslimit=1&format=json`;
    const { data } = await safeFetchJson<WikiGeoSearchUpstream>(geoUrl, { timeoutMs: 4000 });
    const nearestTitle = data.query?.geosearch?.[0]?.title;
    if (nearestTitle) {
      return await trySummary(nearestTitle);
    }
  }

  return null;
}

async function fetchCountryPractical(
  iso: string | undefined,
): Promise<{ name: string | null; practical: TerritorialEncyclopediaEntry['practical'] }> {
  if (!iso) return { name: null, practical: null };
  const [countries, practicalRows] = await Promise.all([
    pgrest<CountryRow[]>(
      `countries_geo?select=iso_a2,name,continent,capital,currency_code,currency_name,phone_code,timezone,languages,area_km2&iso_a2=eq.${iso}&limit=1`,
      { revalidate: 3600 },
    ),
    pgrest<PracticalRow[]>(
      `country_practical?select=iso_a2,emergency_numbers,plug_types,driving_side,units&iso_a2=eq.${iso}&limit=1`,
      { revalidate: 86400 },
    ).catch(() => [] as PracticalRow[]),
  ]);

  const c = countries[0];
  const p = practicalRows[0];
  if (!c && !p) return { name: null, practical: null };

  return {
    name: c?.name ?? null,
    practical: {
      capital: c?.capital ?? null,
      continent: c?.continent ?? null,
      currencyCode: c?.currency_code ?? null,
      currencyName: c?.currency_name ?? null,
      languages: Array.isArray(c?.languages) ? c.languages : [],
      timezone: c?.timezone ?? null,
      phoneCode: c?.phone_code ?? null,
      areaKm2: c?.area_km2 ?? null,
      emergencyNumbers: p?.emergency_numbers ?? null,
      plugTypes: Array.isArray(p?.plug_types) ? p.plug_types : [],
      drivingSide: p?.driving_side ?? null,
      units: p?.units ?? null,
    },
  };
}

async function fetchMetNoWeather(
  lat: number | undefined,
  lng: number | undefined,
): Promise<TerritorialEncyclopediaEntry['weather']> {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const url =
    `https://api.met.no/weatherapi/locationforecast/2.0/compact` +
    `?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;
  const { data } = await safeFetchJson<MetNoCompactResponse>(url, { timeoutMs: 5000 });
  const first = data.properties?.timeseries?.[0];
  if (!first?.time) return null;
  const instant = first.data?.instant?.details;
  const next1h = first.data?.next_1_hours;

  return {
    observedAt: first.time,
    temperatureC: instant?.air_temperature ?? null,
    windMs: instant?.wind_speed ?? null,
    humidityPct: instant?.relative_humidity ?? null,
    cloudPct: instant?.cloud_area_fraction ?? null,
    symbol: next1h?.summary?.symbol_code ?? null,
    precipNext1hMm: next1h?.details?.precipitation_amount ?? null,
    source: 'met-no',
  };
}

async function fetchTopBiodiversity(
  lat: number | undefined,
  lng: number | undefined,
): Promise<TerritorialEncyclopediaEntry['biodiversity']> {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { totalSpecies: 0, topSpecies: [] };
  }
  const params = new URLSearchParams({
    lat: quantizeCoord(lat, 2).toFixed(2),
    lng: quantizeCoord(lng, 2).toFixed(2),
    radius: '25',
    per_page: '6',
    locale: 'fr',
  });
  const url = `https://api.inaturalist.org/v1/observations/species_counts?${params.toString()}`;
  const { data } = await safeFetchJson<INatCountsResponse>(url, { timeoutMs: 5000 });

  const topSpecies: TerritorialEncyclopediaEntry['biodiversity']['topSpecies'] = [];
  for (const row of data.results ?? []) {
    const t = row.taxon;
    if (!t || typeof t.id !== 'number' || !t.name) continue;
    topSpecies.push({
      taxonId: t.id,
      commonName: t.preferred_common_name?.trim() || t.name,
      scientificName: t.name,
      iconicTaxon: t.iconic_taxon_name ?? 'Unknown',
      observationCount: typeof row.count === 'number' ? row.count : 0,
      photoUrl: sanitizeHttpsUrl(t.default_photo?.medium_url ?? t.default_photo?.square_url),
      threatened: Boolean(t.threatened),
    });
  }

  return {
    totalSpecies: data.total_results ?? topSpecies.length,
    topSpecies,
  };
}

async function fetchHazardsSummary(
  lat: number | undefined,
  lng: number | undefined,
  iso: string | undefined,
): Promise<TerritorialEncyclopediaEntry['hazardsSummary']> {
  const slug = iso ? ISO_TO_METEOALARM[iso] : undefined;
  const [eonetRes, maRes] = await Promise.allSettled([
    typeof lat === 'number' && typeof lng === 'number'
      ? safeFetchJson<EonetResponse>(
          'https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&limit=50',
          { timeoutMs: 4500 },
        )
      : Promise.resolve(null),
    slug
      ? safeFetchJson<MeteoAlarmResponse>(
          `https://feeds.meteoalarm.org/api/v1/warnings/feeds-${encodeURIComponent(slug)}`,
          { timeoutMs: 4500 },
        )
      : Promise.resolve(null),
  ]);

  let activeWildfires = 0;
  const headlines: string[] = [];

  if (
    eonetRes.status === 'fulfilled' &&
    eonetRes.value &&
    typeof lat === 'number' &&
    typeof lng === 'number'
  ) {
    for (const ev of eonetRes.value.data.events ?? []) {
      const geom = ev.geometry?.[ev.geometry.length - 1];
      const coords = geom?.coordinates;
      if (
        Array.isArray(coords) &&
        typeof coords[0] === 'number' &&
        typeof coords[1] === 'number' &&
        Math.abs(coords[1] - lat) <= 1.5 &&
        Math.abs(coords[0] - lng) <= 2.0
      ) {
        activeWildfires += 1;
        if (ev.title && headlines.length < 3) headlines.push(ev.title);
      }
    }
  }

  let activeAlerts = 0;
  let highestSeverity: string | null = null;
  const severityRank: Record<string, number> = {
    Extreme: 4,
    Severe: 3,
    Moderate: 2,
    Minor: 1,
  };
  let maxRank = 0;

  if (maRes.status === 'fulfilled' && maRes.value) {
    const nowMs = Date.now();
    for (const w of (maRes.value.data.warnings ?? []).slice(0, 30)) {
      const infos = w.alert?.info ?? [];
      const info =
        infos.find((i) => i.language?.toLowerCase().startsWith('fr')) ?? infos[0];
      if (!info) continue;
      if (info.expires) {
        const expMs = Date.parse(info.expires);
        if (Number.isFinite(expMs) && expMs < nowMs) continue;
      }
      activeAlerts += 1;
      const sev = info.severity ?? '';
      const rank = severityRank[sev] ?? 0;
      if (rank > maxRank) {
        maxRank = rank;
        highestSeverity = sev;
      }
      const line = info.headline ?? info.event;
      if (line && headlines.length < 4 && !headlines.includes(line)) {
        headlines.push(line);
      }
    }
  }

  return {
    activeWildfires,
    activeAlerts,
    highestSeverity,
    headlines,
  };
}

async function fetchCommunityCounts(
  iso: string | undefined,
): Promise<TerritorialEncyclopediaEntry['community']> {
  const carnetFilter = iso
    ? `&country_iso=in.(${iso.toLowerCase()},${iso.toUpperCase()})`
    : '';
  const clubFilter = iso
    ? `&country_iso=in.(${iso.toLowerCase()},${iso.toUpperCase()})`
    : '';

  const [carnets, clubs] = await Promise.all([
    pgrest<Array<{ id: string }>>(
      `carnets?select=id&visibility=eq.public${carnetFilter}&limit=200`,
      { revalidate: 600 },
    ).catch(() => [] as Array<{ id: string }>),
    pgrest<Array<{ id: string }>>(
      `clubs?select=id&privacy=in.(open,public)${clubFilter}&limit=200`,
      { revalidate: 600 },
    ).catch(() => [] as Array<{ id: string }>),
  ]);

  return {
    publicCarnetsCount: carnets.length,
    publicClubsCount: clubs.length,
  };
}

export async function GET(request: Request) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-v2-territory-encyclopedia',
    limit: 45,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const sp = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    scale: sp.get('scale') ?? undefined,
    id: sp.get('id') ?? undefined,
    name: sp.get('name') ?? undefined,
    lat: sp.get('lat') ?? undefined,
    lng: sp.get('lng') ?? undefined,
    iso: sp.get('iso') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Paramètres de territoire invalides',
        meta: buildApiMeta({
          source: 'explorer-v2-territory-encyclopedia',
          attribution: 'Wikipédia, MET Norway, iNaturalist, NASA EONET, MeteoAlarm, LKDV',
          stale: false,
          warning: 'Paramètres invalides',
        }),
      },
      { status: 400 },
    );
  }

  const { scale, id, name, lat, lng, iso } = parsed.data;
  const qLat = typeof lat === 'number' ? quantizeCoord(lat, 2) : null;
  const qLng = typeof lng === 'number' ? quantizeCoord(lng, 2) : null;
  const cacheKey = `${scale}|${iso ?? ''}|${(name ?? id ?? '').toLowerCase()}|${qLat ?? ''},${qLng ?? ''}`;

  const fresh = encyclopediaCache.getEntry(cacheKey);
  if (fresh && !fresh.isExpired) {
    return NextResponse.json(
      {
        entry: fresh.value,
        meta: buildApiMeta({
          source: 'explorer-v2-territory-encyclopedia',
          attribution: 'Wikipédia (CC BY-SA), MET Norway (CC BY 4.0), iNaturalist, NASA EONET, MeteoAlarm, LKDV',
          stale: false,
          fetchedAtMs: fresh.fetchedAt,
          ttlMs: CACHE_TTL_MS,
        }),
      },
      { headers: { 'Cache-Control': CACHE_CONTROL_OK } },
    );
  }

  const isWorldScale = scale === 'world';
  const effectiveIso = isWorldScale ? undefined : iso;

  const [wikiRes, countryRes, weatherRes, bioRes, hazardsRes, communityRes] =
    await Promise.allSettled([
      isWorldScale
        ? Promise.resolve({
            title: 'Terre · Vue globale',
            description: '7 continents · 195 pays · Tous les biomes',
            extract:
              'Explore la planète par échelle — des massifs alpins aux archipels océaniques : sentiers balisés, risques naturels en direct, biodiversité Pokédex et récits de la communauté.',
            thumbnailUrl: null,
            pageUrl: null,
          })
        : fetchWikiEntry(name, lat, lng),
      isWorldScale
        ? Promise.resolve({
            name: 'Monde',
            practical: {
              capital: null,
              continent: '7 continents · 195 pays',
              currencyCode: null,
              currencyName: null,
              languages: [],
              timezone: 'UTC',
              phoneCode: null,
              areaKm2: 510_100_000,
              emergencyNumbers: { universal: '112' },
              plugTypes: [],
              drivingSide: null,
              units: 'metric',
            },
          })
        : fetchCountryPractical(effectiveIso),
      fetchMetNoWeather(lat, lng),
      fetchTopBiodiversity(lat, lng),
      fetchHazardsSummary(lat, lng, effectiveIso),
      fetchCommunityCounts(effectiveIso),
    ]);

  const warnings: string[] = [];
  const wiki =
    wikiRes.status === 'fulfilled'
      ? wikiRes.value
      : (warnings.push('Wikipédia indisponible'), null);
  const countryInfo =
    countryRes.status === 'fulfilled'
      ? countryRes.value
      : (warnings.push('Infos pratiques pays indisponibles'), { name: null, practical: null });
  const weather =
    weatherRes.status === 'fulfilled'
      ? weatherRes.value
      : (warnings.push('Météo MET Norway indisponible'), null);
  const biodiversity =
    bioRes.status === 'fulfilled'
      ? bioRes.value
      : (warnings.push('Biodiversité indisponible'), { totalSpecies: 0, topSpecies: [] });
  const hazardsSummary =
    hazardsRes.status === 'fulfilled'
      ? hazardsRes.value
      : (warnings.push('Vigilances indisponibles'),
        { activeWildfires: 0, activeAlerts: 0, highestSeverity: null, headlines: [] });
  const community =
    communityRes.status === 'fulfilled'
      ? communityRes.value
      : { publicCarnetsCount: 0, publicClubsCount: 0 };

  const allFailed =
    wikiRes.status === 'rejected' &&
    weatherRes.status === 'rejected' &&
    bioRes.status === 'rejected' &&
    hazardsRes.status === 'rejected';

  if (allFailed) {
    const staleEntry = encyclopediaCache.getStale(cacheKey);
    if (staleEntry) {
      return NextResponse.json(
        {
          entry: staleEntry.value,
          meta: buildApiMeta({
            source: 'explorer-v2-territory-encyclopedia',
            attribution: 'Wikipédia (CC BY-SA), MET Norway (CC BY 4.0), iNaturalist, NASA EONET, MeteoAlarm, LKDV',
            stale: true,
            fetchedAtMs: staleEntry.fetchedAt,
            warning: 'Sources encyclopédiques indisponibles — fiche en cache',
          }),
        },
        { status: 200, headers: { 'Cache-Control': CACHE_CONTROL_OK } },
      );
    }
  }

  const resolvedName =
    name ||
    wiki?.title ||
    countryInfo.name ||
    (iso ? `Territoire ${iso}` : 'Secteur exploré');

  const entry: TerritorialEncyclopediaEntry = {
    id: id || `${scale}:${(iso ?? resolvedName).toLowerCase().replace(/\s+/g, '-')}`,
    scale,
    name: resolvedName,
    iso: iso ?? null,
    coordinates:
      typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null,
    wiki,
    practical: countryInfo.practical,
    weather,
    biodiversity,
    hazardsSummary,
    community,
  };

  const saved = encyclopediaCache.set(cacheKey, entry, CACHE_TTL_MS);

  return NextResponse.json(
    {
      entry,
      meta: buildApiMeta({
        source: 'explorer-v2-territory-encyclopedia',
        attribution: 'Wikipédia (CC BY-SA), MET Norway (CC BY 4.0), iNaturalist, NASA EONET, MeteoAlarm, LKDV',
        stale: false,
        fetchedAtMs: saved.fetchedAt,
        ttlMs: CACHE_TTL_MS,
        warning: warnings.length > 0 ? warnings.join(' · ') : undefined,
      }),
    },
    { headers: { 'Cache-Control': CACHE_CONTROL_OK } },
  );
}
