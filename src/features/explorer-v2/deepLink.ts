/**
 * Explorer v2 — Universal URL Deep-Link Parser & Builder.
 *
 * Single source of truth shared between server (`src/app/explorer/page.tsx`)
 * and client (`ExplorerV2.tsx`) for every `/explorer?...` entry point across
 * Le Kit du Voyageur (POIs, routes, trails, kits, search, countries, carnets,
 * sorties, stages, planner, GPX, routing destinations).
 */

export type DeepLinkParamInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

export interface ExplorerDeepLink {
  lat: number | null;
  lng: number | null;
  zoom: number | null;
  hasExplicitLocation: boolean;
  poi: string | null;
  routeId: string | null;
  trail: string | null;
  kitId: string | null;
  query: string | null;
  country: string | null;
  category: string | null;
  mode: string | null;
  to: string | null;
  toCoords: [number, number] | null;
  carnet: string | null;
  sortie: string | null;
  stage: string | null;
  planner: string | null;
  gpx: string | null;
  scene: string | null;
}

export type ExplorerInitialDeepLink = ExplorerDeepLink;

const MAX_PARAM_LENGTH = 160;
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;

const COUNTRY_CENTROIDS: Readonly<Record<string, { center: [number, number]; zoom: number }>> = {
  FR: { center: [2.2137, 46.2276], zoom: 5.4 },
  CH: { center: [8.2275, 46.8182], zoom: 7.1 },
  IT: { center: [12.5674, 41.8719], zoom: 5.5 },
  ES: { center: [-3.7492, 40.4637], zoom: 5.5 },
  PT: { center: [-8.2245, 39.3999], zoom: 6.2 },
  DE: { center: [10.4515, 51.1657], zoom: 5.5 },
  AT: { center: [14.5501, 47.5162], zoom: 6.6 },
  BE: { center: [4.4699, 50.5039], zoom: 7.2 },
  NL: { center: [5.2913, 52.1326], zoom: 7.0 },
  GB: { center: [-2.8948, 54.7024], zoom: 5.4 },
  IE: { center: [-8.2439, 53.4129], zoom: 6.4 },
  NO: { center: [8.4689, 60.472], zoom: 4.8 },
  SE: { center: [18.6435, 60.1282], zoom: 4.7 },
  FI: { center: [25.7482, 61.9241], zoom: 4.9 },
  IS: { center: [-19.0208, 64.9631], zoom: 5.8 },
  GR: { center: [21.8243, 39.0742], zoom: 6.0 },
  HR: { center: [15.2, 45.1], zoom: 6.5 },
  SI: { center: [14.9955, 46.1512], zoom: 7.6 },
  PL: { center: [19.1451, 51.9194], zoom: 5.6 },
  MA: { center: [-7.0926, 31.7917], zoom: 5.5 },
  NP: { center: [84.124, 28.3949], zoom: 6.5 },
  JP: { center: [138.2529, 36.2048], zoom: 5.2 },
  US: { center: [-98.5795, 39.8283], zoom: 3.8 },
  CA: { center: [-106.3468, 56.1304], zoom: 3.5 },
  CL: { center: [-71.543, -35.6751], zoom: 4.5 },
  AR: { center: [-63.6167, -38.4161], zoom: 4.2 },
  NZ: { center: [174.886, -40.9006], zoom: 5.4 },
  AU: { center: [133.7751, -25.2744], zoom: 4.0 },
};

function readRawParam(params: DeepLinkParamInput, key: string): string | null {
  if (!params) return null;
  if (params instanceof URLSearchParams) {
    return params.get(key);
  }
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === 'string' ? value : null;
}

function sanitizeStringParam(raw: string | null, maxLen = MAX_PARAM_LENGTH): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(CONTROL_CHARS_RE, '').trim();
  if (!cleaned) return null;
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

function parseFiniteFloat(raw: string | null): number | null {
  if (!raw) return null;
  const parsed = Number.parseFloat(raw.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCoordsPair(raw: string | null): [number, number] | null {
  if (!raw) return null;
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(raw);
  if (!match) return null;
  const lat = Number.parseFloat(match[1]);
  const lng = Number.parseFloat(match[2]);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null;
  }
  return [lng, lat];
}

function sanitizeCountryParam(raw: string | null): string | null {
  const cleaned = sanitizeStringParam(raw, 48);
  if (!cleaned) return null;
  if (/^[a-zA-Z]{2}$/.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  return cleaned;
}

/**
 * Resolves a known ISO-2 country code (e.g. `FR`, `IS`, `CH`) into an initial
 * map center `[lng, lat]` and zoom level for SSR/initial viewport framing.
 */
export function resolveCountryCenter(
  country: string | null | undefined,
): { center: [number, number]; zoom: number } | null {
  if (!country) return null;
  const code = country.trim().toUpperCase();
  return COUNTRY_CENTROIDS[code] ?? null;
}

/**
 * Parses all supported `/explorer` deep-link parameters from either browser
 * `URLSearchParams` or Next.js server `searchParams`.
 */
export function parseExplorerDeepLink(params: DeepLinkParamInput): ExplorerDeepLink {
  const rawLat = parseFiniteFloat(readRawParam(params, 'lat'));
  const rawLng = parseFiniteFloat(readRawParam(params, 'lng') ?? readRawParam(params, 'lon'));
  const hasExplicitLocation =
    rawLat !== null &&
    rawLng !== null &&
    Math.abs(rawLat) <= 90 &&
    Math.abs(rawLng) <= 180;

  const rawZoom = parseFiniteFloat(readRawParam(params, 'z') ?? readRawParam(params, 'zoom'));
  const zoom =
    rawZoom !== null && rawZoom >= 1 && rawZoom <= 19
      ? rawZoom
      : hasExplicitLocation
        ? 12.5
        : null;

  const to = sanitizeStringParam(readRawParam(params, 'to'));

  return {
    lat: hasExplicitLocation ? rawLat : null,
    lng: hasExplicitLocation ? rawLng : null,
    zoom,
    hasExplicitLocation,
    poi: sanitizeStringParam(readRawParam(params, 'poi'), 120),
    routeId: sanitizeStringParam(
      readRawParam(params, 'routeId') ?? readRawParam(params, 'route'),
      120,
    ),
    trail: sanitizeStringParam(readRawParam(params, 'trail'), 120),
    kitId: sanitizeStringParam(readRawParam(params, 'kitId'), 120),
    query: sanitizeStringParam(readRawParam(params, 'q') ?? readRawParam(params, 'search')),
    country: sanitizeCountryParam(readRawParam(params, 'country')),
    category: sanitizeStringParam(readRawParam(params, 'category'), 64),
    mode: sanitizeStringParam(readRawParam(params, 'mode'), 40),
    to,
    toCoords: parseCoordsPair(to),
    carnet: sanitizeStringParam(readRawParam(params, 'carnet'), 120),
    sortie: sanitizeStringParam(readRawParam(params, 'sortie'), 120),
    stage: sanitizeStringParam(readRawParam(params, 'stage'), 40),
    planner: sanitizeStringParam(readRawParam(params, 'planner'), 64),
    gpx: sanitizeStringParam(readRawParam(params, 'gpx')),
    scene: sanitizeStringParam(readRawParam(params, 'scene'), 64),
  };
}

/**
 * Serializes a partial `ExplorerDeepLink` into a canonical `/explorer?...` URL.
 */
export function buildExplorerUrl(
  link: Partial<ExplorerDeepLink>,
  basePath = '/explorer',
): string {
  const sp = new URLSearchParams();

  if (
    typeof link.lat === 'number' &&
    typeof link.lng === 'number' &&
    Number.isFinite(link.lat) &&
    Number.isFinite(link.lng) &&
    Math.abs(link.lat) <= 90 &&
    Math.abs(link.lng) <= 180
  ) {
    sp.set('lat', link.lat.toFixed(5));
    sp.set('lng', link.lng.toFixed(5));
  }
  if (typeof link.zoom === 'number' && Number.isFinite(link.zoom) && link.zoom >= 1 && link.zoom <= 19) {
    sp.set('z', Number.isInteger(link.zoom) ? String(link.zoom) : link.zoom.toFixed(1));
  }

  const stringEntries: ReadonlyArray<readonly [string, string | null | undefined]> = [
    ['poi', link.poi],
    ['routeId', link.routeId],
    ['trail', link.trail],
    ['kitId', link.kitId],
    ['q', link.query],
    ['country', link.country],
    ['category', link.category],
    ['mode', link.mode],
    ['to', link.to],
    ['carnet', link.carnet],
    ['sortie', link.sortie],
    ['stage', link.stage],
    ['planner', link.planner],
    ['gpx', link.gpx],
    ['scene', link.scene],
  ];

  for (const [key, value] of stringEntries) {
    const clean = sanitizeStringParam(value ?? null);
    if (clean) sp.set(key, clean);
  }

  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
