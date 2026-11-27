import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  buildApiMeta,
  clampBbox,
  emptyFeatureCollection,
  LruCache,
  quantizeBbox,
  safeFetchJson,
  sanitizeHttpsUrl,
  type ExplorerApiMeta,
  type GeoJsonFeatureCollection,
  type GeoJsonPointFeature,
} from '@/lib/explorer/edgeCache';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 180_000; // 3 minutes
const CACHE_CONTROL_OK = 'public, s-maxage=180, stale-while-revalidate=600';

const querySchema = z.object({
  south: z.coerce.number().min(-90).max(90),
  west: z.coerce.number().min(-180).max(180),
  north: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  country: z
    .string()
    .trim()
    .regex(/^[a-zA-Z-]{2,32}$/)
    .optional(),
});

export interface HazardAlertItem {
  id: string;
  event: string;
  severity: string;
  urgency: string | null;
  certainty: string | null;
  headline: string;
  description: string | null;
  areaDesc: string | null;
  onset: string | null;
  expires: string | null;
  awarenessLevel: string | null;
  awarenessType: string | null;
  webUrl: string | null;
  source: string;
}

export interface HazardsPayload {
  fires: GeoJsonFeatureCollection;
  earthquakes: GeoJsonFeatureCollection;
  floods: GeoJsonFeatureCollection;
  alerts: HazardAlertItem[];
  meta: ExplorerApiMeta;
}

const hazardsCache = new LruCache<Omit<HazardsPayload, 'meta'>>(128, 30 * 60_000);

const METEOALARM_SLUGS: Record<string, string> = {
  FR: 'france',
  FRANCE: 'france',
  ES: 'spain',
  SPAIN: 'spain',
  IT: 'italy',
  ITALY: 'italy',
  CH: 'switzerland',
  SWITZERLAND: 'switzerland',
  DE: 'germany',
  GERMANY: 'germany',
  BE: 'belgium',
  BELGIUM: 'belgium',
  AT: 'austria',
  AUSTRIA: 'austria',
  PT: 'portugal',
  PORTUGAL: 'portugal',
  NL: 'netherlands',
  NETHERLANDS: 'netherlands',
  GB: 'united-kingdom',
  UK: 'united-kingdom',
  NO: 'norway',
  NORWAY: 'norway',
  SE: 'sweden',
  SWEDEN: 'sweden',
  PL: 'poland',
  POLAND: 'poland',
  GR: 'greece',
  GREECE: 'greece',
  IE: 'ireland',
  IRELAND: 'ireland',
  LU: 'luxembourg',
  LUXEMBOURG: 'luxembourg',
  CZ: 'czechia',
  HR: 'croatia',
  SI: 'slovenia',
  RO: 'romania',
  FI: 'finland',
  DK: 'denmark',
  IS: 'iceland',
};

function overlapsMetropolitanFrance(
  south: number,
  west: number,
  north: number,
  east: number,
): boolean {
  return south <= 51.5 && north >= 41.0 && west <= 10.0 && east >= -5.5;
}

function resolveMeteoAlarmSlug(
  country: string | undefined,
  south: number,
  west: number,
  north: number,
  east: number,
): string | null {
  if (country) {
    const key = country.toUpperCase();
    if (METEOALARM_SLUGS[key]) return METEOALARM_SLUGS[key];
    return null;
  }
  if (overlapsMetropolitanFrance(south, west, north, east)) {
    return 'france';
  }
  return null;
}

interface EonetResponse {
  events?: Array<{
    id?: string;
    title?: string;
    link?: string;
    sources?: Array<{ id?: string; url?: string }>;
    geometry?: Array<{
      date?: string;
      type?: string;
      coordinates?: unknown;
      magnitudeValue?: number;
      magnitudeUnit?: string;
    }>;
  }>;
}

interface UsgsResponse {
  features?: Array<{
    id?: string;
    geometry?: { type?: string; coordinates?: number[] };
    properties?: {
      mag?: number | null;
      place?: string | null;
      time?: number | null;
      title?: string | null;
      url?: string | null;
      tsunami?: number | null;
      alert?: string | null;
    };
  }>;
}

interface MeteoAlarmResponse {
  warnings?: Array<{
    uuid?: string;
    alert?: {
      identifier?: string;
      sent?: string;
      info?: Array<{
        language?: string;
        event?: string;
        severity?: string;
        urgency?: string;
        certainty?: string;
        headline?: string;
        description?: string;
        onset?: string;
        expires?: string;
        web?: string;
        parameter?: Array<{ valueName?: string; value?: string }>;
        area?: Array<{ areaDesc?: string }>;
      }>;
    };
  }>;
}

interface HubEauStationsResponse {
  data?: Array<{
    code_station?: string;
    libelle_station?: string;
    libelle_cours_eau?: string;
    libelle_commune?: string;
    code_departement?: string;
    longitude_station?: number;
    latitude_station?: number;
    en_service?: boolean;
    date_maj_station?: string;
  }>;
}

interface HubEauObservationsTrResponse {
  data?: Array<{
    code_station?: string;
    date_obs?: string;
    resultat_obs?: number;
    grandeur_hydro?: string;
  }>;
}

const MAX_HYDRO_OBS_AGE_MS = 48 * 3_600_000; // 48 h live observations only
const EARTHQUAKE_WINDOW_MS = 7 * 86_400_000; // Last 7 days only

function extractPointCoords(coords: unknown): [number, number] | null {
  if (!Array.isArray(coords)) return null;
  if (
    typeof coords[0] === 'number' &&
    typeof coords[1] === 'number' &&
    Number.isFinite(coords[0]) &&
    Number.isFinite(coords[1])
  ) {
    return [coords[0], coords[1]];
  }
  if (Array.isArray(coords[0])) {
    return extractPointCoords(coords[0]);
  }
  return null;
}

async function fetchEonetWildfires(
  south: number,
  west: number,
  north: number,
  east: number,
): Promise<GeoJsonFeatureCollection> {
  const url =
    'https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&limit=50';
  const { data } = await safeFetchJson<EonetResponse>(url, { timeoutMs: 5000 });
  const features: GeoJsonPointFeature[] = [];

  for (const ev of data.events ?? []) {
    const latestGeom = ev.geometry?.[ev.geometry.length - 1];
    const pt = extractPointCoords(latestGeom?.coordinates);
    if (!pt) continue;
    const [lng, lat] = pt;
    if (lat < south || lat > north || lng < west || lng > east) continue;

    const rawLink = ev.sources?.[0]?.url ?? ev.link ?? null;
    features.push({
      type: 'Feature',
      id: ev.id ?? `eonet-${lat.toFixed(3)}-${lng.toFixed(3)}`,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        id: ev.id ?? null,
        title: ev.title ?? 'Feu de forêt actif',
        category: 'wildfire',
        date: latestGeom?.date ?? null,
        magnitudeValue: latestGeom?.magnitudeValue ?? null,
        magnitudeUnit: latestGeom?.magnitudeUnit ?? null,
        url: sanitizeHttpsUrl(rawLink),
        source: 'NASA EONET v3',
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

async function fetchUsgsEarthquakes(
  south: number,
  west: number,
  north: number,
  east: number,
): Promise<GeoJsonFeatureCollection> {
  const startIso = new Date(Date.now() - EARTHQUAKE_WINDOW_MS).toISOString();
  const params = new URLSearchParams({
    format: 'geojson',
    minmagnitude: '2.5',
    starttime: startIso,
    limit: '40',
    minlatitude: south.toFixed(4),
    maxlatitude: north.toFixed(4),
    minlongitude: west.toFixed(4),
    maxlongitude: east.toFixed(4),
    orderby: 'time',
  });
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?${params.toString()}`;
  const { data } = await safeFetchJson<UsgsResponse>(url, { timeoutMs: 5000 });
  const features: GeoJsonPointFeature[] = [];

  for (const feat of data.features ?? []) {
    const coords = feat.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const [lng, lat, depthKm] = coords;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const props = feat.properties ?? {};
    features.push({
      type: 'Feature',
      id: feat.id ?? `usgs-${lat.toFixed(3)}-${lng.toFixed(3)}`,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        id: feat.id ?? null,
        title: props.title ?? props.place ?? 'Séisme',
        magnitude: props.mag ?? null,
        place: props.place ?? null,
        depthKm: typeof depthKm === 'number' && Number.isFinite(depthKm) ? depthKm : null,
        time: typeof props.time === 'number' ? new Date(props.time).toISOString() : null,
        tsunami: Boolean(props.tsunami),
        alert: props.alert ?? null,
        url: sanitizeHttpsUrl(props.url),
        source: 'USGS Earthquake Hazards',
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

async function fetchMeteoAlarmWarnings(slug: string): Promise<HazardAlertItem[]> {
  const url = `https://feeds.meteoalarm.org/api/v1/warnings/feeds-${encodeURIComponent(slug)}`;
  const { data } = await safeFetchJson<MeteoAlarmResponse>(url, { timeoutMs: 5000 });
  const nowMs = Date.now();
  const alerts: HazardAlertItem[] = [];

  for (const item of (data.warnings ?? []).slice(0, 40)) {
    const infos = item.alert?.info ?? [];
    if (infos.length === 0) continue;
    const info =
      infos.find((i) => i.language?.toLowerCase().startsWith('fr')) ??
      infos.find((i) => i.language?.toLowerCase().startsWith('en')) ??
      infos[0];

    if (info.expires) {
      const expMs = Date.parse(info.expires);
      if (Number.isFinite(expMs) && expMs < nowMs) continue;
    }

    const paramMap = new Map<string, string>();
    for (const p of info.parameter ?? []) {
      if (p.valueName && p.value) {
        paramMap.set(p.valueName.toLowerCase(), p.value);
      }
    }

    const areaDesc = (info.area ?? [])
      .map((a) => a.areaDesc?.trim())
      .filter((v): v is string => Boolean(v))
      .slice(0, 5)
      .join(', ');

    alerts.push({
      id: item.alert?.identifier ?? item.uuid ?? `ma-${alerts.length}`,
      event: info.event ?? 'Alerte météorologique',
      severity: info.severity ?? 'Unknown',
      urgency: info.urgency ?? null,
      certainty: info.certainty ?? null,
      headline: info.headline ?? info.event ?? 'Vigilance météo',
      description: info.description ? info.description.slice(0, 400) : null,
      areaDesc: areaDesc || null,
      onset: info.onset ?? null,
      expires: info.expires ?? null,
      awarenessLevel: paramMap.get('awareness_level') ?? null,
      awarenessType: paramMap.get('awareness_type') ?? null,
      webUrl: sanitizeHttpsUrl(info.web),
      source: 'MeteoAlarm (EUMETNET)',
    });
  }

  return alerts.slice(0, 20);
}

async function fetchHubEauHydrometry(
  south: number,
  west: number,
  north: number,
  east: number,
): Promise<GeoJsonFeatureCollection> {
  const centerLat = (south + north) / 2;
  const centerLng = (west + east) / 2;
  const dLatKm = Math.abs(north - south) * 111.32;
  const dLngKm =
    Math.abs(east - west) * 111.32 * Math.max(0.2, Math.cos((centerLat * Math.PI) / 180));
  const halfDiagKm = Math.hypot(dLatKm, dLngKm) / 2;
  const searchDistanceKm = Math.min(45, Math.max(2, Math.ceil(halfDiagKm * 1.15)));
  const padLat = Math.max(0.005, Math.abs(north - south) * 0.12);
  const padLng = Math.max(0.006, Math.abs(east - west) * 0.12);

  const stationParams = new URLSearchParams({
    longitude: centerLng.toFixed(4),
    latitude: centerLat.toFixed(4),
    distance: String(searchDistanceKm),
    en_service: 'true',
    size: '15',
  });
  const stationUrl = `https://hubeau.eaufrance.fr/api/v2/hydrometrie/referentiel/stations?${stationParams.toString()}`;
  const { data: stationsData } = await safeFetchJson<HubEauStationsResponse>(stationUrl, {
    timeoutMs: 4500,
  });

  // Deduplicate nearby sub-sensors on the same river/station AND strictly scope to viewed viewport bbox
  const uniqueStations = new Map<
    string,
    NonNullable<HubEauStationsResponse['data']>[number]
  >();
  const seenRiverCommune = new Set<string>();
  for (const station of stationsData.data ?? []) {
    const code = station.code_station?.trim();
    const lng = station.longitude_station;
    const lat = station.latitude_station;
    if (!code || typeof lng !== 'number' || typeof lat !== 'number') continue;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (
      lat < south - padLat ||
      lat > north + padLat ||
      lng < west - padLng ||
      lng > east + padLng
    ) {
      continue;
    }
    const labelKey = `${(station.libelle_cours_eau ?? '').trim().toLowerCase()}|${(station.libelle_commune ?? station.libelle_station ?? '').trim().toLowerCase()}`;
    if (labelKey !== '|' && seenRiverCommune.has(labelKey)) continue;
    seenRiverCommune.add(labelKey);
    uniqueStations.set(code, station);
    if (uniqueStations.size >= 8) break;
  }

  if (uniqueStations.size === 0) {
    return emptyFeatureCollection();
  }

  // Query real-time Hub'Eau water height observations (`grandeur_hydro=H`) — NEVER emit static metadata rows!
  const obsParams = new URLSearchParams({
    code_entite: Array.from(uniqueStations.keys()).join(','),
    grandeur_hydro: 'H',
    size: '40',
    sort: 'desc',
  });
  const obsUrl = `https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr?${obsParams.toString()}`;
  const { data: obsData } = await safeFetchJson<HubEauObservationsTrResponse>(obsUrl, {
    timeoutMs: 4500,
  });

  const latestObsByStation = new Map<string, { dateObs: string; levelM: number }>();
  const nowMs = Date.now();
  for (const obs of obsData.data ?? []) {
    const code = obs.code_station?.trim();
    if (!code || latestObsByStation.has(code)) continue;
    const dateObs = obs.date_obs;
    const rawMm = obs.resultat_obs;
    if (!dateObs || typeof rawMm !== 'number' || !Number.isFinite(rawMm)) continue;
    const ts = Date.parse(dateObs);
    if (!Number.isFinite(ts) || nowMs - ts > MAX_HYDRO_OBS_AGE_MS) continue;
    // Hub'Eau `H` is reported in millimeters; keep sane values only
    const levelM = Number((rawMm / 1000).toFixed(2));
    if (levelM < -2 || levelM > 40) continue;
    latestObsByStation.set(code, { dateObs, levelM });
  }

  const features: GeoJsonPointFeature[] = [];
  for (const [code, obs] of latestObsByStation.entries()) {
    const station = uniqueStations.get(code);
    if (!station) continue;
    const lng = station.longitude_station!;
    const lat = station.latitude_station!;
    features.push({
      type: 'Feature',
      id: code,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        code,
        name: station.libelle_station ?? 'Station hydrométrique',
        river: station.libelle_cours_eau ?? null,
        commune: station.libelle_commune ?? null,
        department: station.code_departement ?? null,
        levelM: obs.levelM,
        inService: true,
        updatedAt: obs.dateObs,
        source: "Hub'Eau Hydrométrie TR",
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

export async function GET(request: Request) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-v2-hazards',
    limit: 60,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const sp = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    south: sp.get('south'),
    west: sp.get('west'),
    north: sp.get('north'),
    east: sp.get('east'),
    country: sp.get('country') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Paramètres géographiques invalides',
        meta: buildApiMeta({
          source: 'explorer-v2-hazards',
          attribution: "NASA EONET, USGS, MeteoAlarm, Hub'Eau",
          stale: false,
          warning: 'Paramètres bbox invalides',
        }),
      },
      { status: 400 },
    );
  }

  const { south, west, north, east, country } = parsed.data;
  const clamped = clampBbox(south, west, north, east, 20);
  const quantized = quantizeBbox(
    clamped.south,
    clamped.west,
    clamped.north,
    clamped.east,
    2,
  );
  const meteoSlug = resolveMeteoAlarmSlug(
    country,
    clamped.south,
    clamped.west,
    clamped.north,
    clamped.east,
  );
  const queryHubEau =
    (country ? country.toUpperCase() === 'FR' || country.toLowerCase() === 'france' : false) ||
    overlapsMetropolitanFrance(
      clamped.south,
      clamped.west,
      clamped.north,
      clamped.east,
    );

  const cacheKey = `${quantized.key}|${meteoSlug ?? 'none'}|${queryHubEau ? 'fr' : 'intl'}`;
  const fresh = hazardsCache.getEntry(cacheKey);
  if (fresh && !fresh.isExpired) {
    return NextResponse.json(
      {
        ...fresh.value,
        meta: buildApiMeta({
          source: 'explorer-v2-hazards',
          attribution: "NASA EONET v3, USGS, MeteoAlarm (EUMETNET), Hub'Eau",
          stale: false,
          fetchedAtMs: fresh.fetchedAt,
          ttlMs: CACHE_TTL_MS,
          warning: clamped.clamped ? 'Emprise plafonnée à 20°' : undefined,
        }),
      },
      { headers: { 'Cache-Control': CACHE_CONTROL_OK } },
    );
  }

  const [firesRes, quakesRes, alertsRes, floodsRes] = await Promise.allSettled([
    fetchEonetWildfires(clamped.south, clamped.west, clamped.north, clamped.east),
    fetchUsgsEarthquakes(clamped.south, clamped.west, clamped.north, clamped.east),
    meteoSlug ? fetchMeteoAlarmWarnings(meteoSlug) : Promise.resolve([] as HazardAlertItem[]),
    queryHubEau
      ? fetchHubEauHydrometry(clamped.south, clamped.west, clamped.north, clamped.east)
      : Promise.resolve(emptyFeatureCollection()),
  ]);

  const failures: string[] = [];
  const fires =
    firesRes.status === 'fulfilled'
      ? firesRes.value
      : (failures.push('EONET'), emptyFeatureCollection());
  const earthquakes =
    quakesRes.status === 'fulfilled'
      ? quakesRes.value
      : (failures.push('USGS'), emptyFeatureCollection());
  const alerts =
    alertsRes.status === 'fulfilled'
      ? alertsRes.value
      : (failures.push('MeteoAlarm'), []);
  const floods =
    floodsRes.status === 'fulfilled'
      ? floodsRes.value
      : (failures.push("Hub'Eau"), emptyFeatureCollection());

  const attemptedCount = 2 + (meteoSlug ? 1 : 0) + (queryHubEau ? 1 : 0);
  const allFailed = failures.length >= attemptedCount;

  if (allFailed) {
    const staleEntry = hazardsCache.getStale(cacheKey);
    if (staleEntry) {
      return NextResponse.json(
        {
          ...staleEntry.value,
          meta: buildApiMeta({
            source: 'explorer-v2-hazards',
            attribution: "NASA EONET v3, USGS, MeteoAlarm (EUMETNET), Hub'Eau",
            stale: true,
            fetchedAtMs: staleEntry.fetchedAt,
            warning: `Sources temporairement indisponibles (${failures.join(', ')}) — données en cache`,
          }),
        },
        { status: 200, headers: { 'Cache-Control': CACHE_CONTROL_OK } },
      );
    }

    return NextResponse.json(
      {
        fires: emptyFeatureCollection(),
        earthquakes: emptyFeatureCollection(),
        floods: emptyFeatureCollection(),
        alerts: [],
        meta: buildApiMeta({
          source: 'explorer-v2-hazards',
          attribution: "NASA EONET v3, USGS, MeteoAlarm (EUMETNET), Hub'Eau",
          stale: true,
          warning: `Sources indisponibles (${failures.join(', ')})`,
        }),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const payload: Omit<HazardsPayload, 'meta'> = {
    fires,
    earthquakes,
    floods,
    alerts,
  };
  const saved = hazardsCache.set(cacheKey, payload, CACHE_TTL_MS);

  const warnings: string[] = [];
  if (clamped.clamped) warnings.push('Emprise plafonnée à 20°');
  if (failures.length > 0) {
    warnings.push(`Sources partiellement indisponibles : ${failures.join(', ')}`);
  }

  return NextResponse.json(
    {
      ...payload,
      meta: buildApiMeta({
        source: 'explorer-v2-hazards',
        attribution: "NASA EONET v3, USGS, MeteoAlarm (EUMETNET), Hub'Eau",
        stale: false,
        fetchedAtMs: saved.fetchedAt,
        ttlMs: CACHE_TTL_MS,
        warning: warnings.length > 0 ? warnings.join(' · ') : undefined,
      }),
    },
    { headers: { 'Cache-Control': CACHE_CONTROL_OK } },
  );
}
