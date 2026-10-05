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

/** Réponse Nominatim (jsonv2 + addressdetails), même forme que Photon. */
export function parseNominatim(payload: unknown): CompasPlace[] {
  const rows = Array.isArray(payload) ? (payload as Array<Record<string, unknown>>) : [];
  const out: CompasPlace[] = [];
  for (const r of rows) {
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : '';
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const address = (r.address ?? {}) as Record<string, unknown>;
    const bb = Array.isArray(r.boundingbox) ? r.boundingbox.map(Number) : null;
    const type = String(r.addresstype ?? r.type ?? 'place');
    out.push({
      name,
      lat,
      lon,
      countryCode: typeof address.country_code === 'string' ? address.country_code.toUpperCase() : null,
      country: typeof address.country === 'string' ? address.country : null,
      kind: type,
      settlement: SETTLEMENTS.has(type) || SETTLEMENTS.has(String(r.type)),
      // boundingbox Nominatim : [sud, nord, ouest, est] → emprise [ouest, nord, est, sud]
      extent: bb && bb.length === 4 && bb.every((n) => Number.isFinite(n)) ? [bb[2], bb[1], bb[3], bb[0]] : null,
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

const plainName = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Ferme, lieu-dit, bâtiment, quartier résidentiel : jamais une destination. */
const WEAK_KINDS = new Set(['locality', 'house', 'other', 'street']);

/**
 * La destination qu'une personne nomme : un lieu dont le nom est la requête,
 * ou commence par elle (« Chamonix » → « Chamonix-Mont-Blanc »), dans l'ordre
 * de pertinence de la carte, en écartant fermes, lieux-dits et bâtiments.
 * Un homonyme minuscule à l'autre bout du monde ne passe jamais devant la
 * ville que tout le monde entend (2026-10-05 : « Chamonix » donnait une ferme
 * d'Afrique du Sud, seule à porter exactement ce nom).
 */
export function pickDestination(candidates: CompasPlace[], query: string): CompasPlace | null {
  const want = plainName(query);
  if (!want) return null;
  const named = candidates.filter((c) => {
    const n = plainName(c.name);
    return n === want || n.startsWith(`${want} `);
  });
  return named.find((c) => !WEAK_KINDS.has(c.kind)) ?? null;
}
