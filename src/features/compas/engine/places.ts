/**
 * Lieux du Compas : lecture PURE des réponses Photon (OpenStreetMap). Un lieu
 * n'existe pour le Compas que si la carte le connaît : nom, position, code
 * pays ISO. Ce qu'une IA propose comme étape et que la carte ne retrouve pas
 * près de la destination est écarté, jamais deviné.
 */

export interface CompasPlace {
  name: string;
  lat: number;
  lon: number;
  /** Code pays ISO 3166-1 alpha-2, en majuscules. */
  countryCode: string | null;
  country: string | null;
  /** Nature OSM : country, state, city, village, peak… */
  kind: string;
  /** Lieu habité (ville, village, hameau) : là où l'on dort, à préférer pour une étape. */
  settlement?: boolean;
  /** Emprise [ouest, nord, est, sud] quand la carte la donne (pays, régions). */
  extent: [number, number, number, number] | null;
}

const BROAD = new Set(['country', 'state', 'region', 'county', 'district']);
const SETTLEMENTS = new Set([
  'city',
  'town',
  'village',
  'hamlet',
  'locality',
  'suburb',
  'isolated_dwelling',
  'neighbourhood',
  'quarter',
]);

export function parsePhoton(payload: unknown): CompasPlace[] {
  const features =
    payload && typeof payload === 'object' && Array.isArray((payload as { features?: unknown }).features)
      ? ((payload as { features: unknown[] }).features as Array<Record<string, unknown>>)
      : [];
  const out: CompasPlace[] = [];
  for (const f of features) {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const g = (f.geometry ?? {}) as { coordinates?: unknown };
    const c = Array.isArray(g.coordinates) ? g.coordinates : null;
    const lon = Number(c?.[0]);
    const lat = Number(c?.[1]);
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const ext = Array.isArray(p.extent) && p.extent.length === 4 ? p.extent.map(Number) : null;
    out.push({
      name,
      lat,
      lon,
      countryCode: typeof p.countrycode === 'string' ? p.countrycode.toUpperCase() : null,
      country: typeof p.country === 'string' ? p.country : null,
      kind: String(p.type ?? p.osm_value ?? 'place'),
      settlement: p.osm_key === 'place' && SETTLEMENTS.has(String(p.osm_value)),
      extent:
        ext && ext.every((n) => Number.isFinite(n))
          ? (ext as [number, number, number, number])
          : null,
    });
  }
  return out;
}

const toRad = (d: number) => (d * Math.PI) / 180;

/** Distance orthodromique en km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rayon raisonnable autour d'une destination : son emprise, sinon 60 km. */
export function destinationRadiusKm(place: CompasPlace): number {
  if (place.extent) {
    const [w, n, e, s] = place.extent;
    const diag = distanceKm({ lat: n, lon: w }, { lat: s, lon: e });
    return Math.min(1500, Math.max(60, diag / 2 + 30));
  }
  return BROAD.has(place.kind) ? 400 : 60;
}

/**
 * Meilleure correspondance : dans le pays voulu s'il est connu, à une distance
 * plausible d'un point de référence (une étape reste dans la destination,
 * près de la veille), un village de préférence, puis l'ordre de pertinence de
 * la carte. Null si rien ne convient.
 */
export function pickPlace(
  candidates: CompasPlace[],
  opts: { countryCode?: string | null; near?: { lat: number; lon: number } | null; maxKm?: number } = {}
): CompasPlace | null {
  let list = candidates;
  if (opts.countryCode) list = list.filter((c) => c.countryCode === opts.countryCode);
  const near = opts.near;
  const ranked = list
    .map((c, i) => ({ c, i, d: near ? distanceKm(near, c) : 0 }))
    // La distance ne sert qu'à écarter l'impossible : parmi le possible, l'ordre
    // de pertinence de la carte décide (le plus proche homonyme est souvent faux).
    .filter((x) => opts.maxKm == null || x.d <= opts.maxKm)
    // Un village plutôt qu'un hôtel ou un sommet du même nom ; puis la pertinence.
    .sort((a, b) => Number(Boolean(b.c.settlement)) - Number(Boolean(a.c.settlement)) || a.i - b.i);
  return ranked[0]?.c ?? null;
}

/** Distance plausible d'une étape à la suivante, selon le moyen de déplacement. */
export function maxLegKm(move: string, first: boolean, destinationKm: number): number {
  if (first) return destinationKm;
  switch (move) {
    case 'marche':
      return 40;
    case 'velo':
      return 150;
    case 'voiture':
    case 'bus':
    case 'train':
      return 700;
    case 'vol':
    case 'bateau':
      return destinationKm * 2;
    default:
      return 25;
  }
}
