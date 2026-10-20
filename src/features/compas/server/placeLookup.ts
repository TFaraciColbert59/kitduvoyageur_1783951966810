import 'server-only';
import { createHash } from 'node:crypto';
import { parseIslandContour, type IslandContour } from '../engine/islands';
import { aliasMatches, distanceKm, homonymsFarApart, nameCore, parseNominatim, parsePhoton, isNotablePlace, pickCommune, pickDestination, pickNatural, isNonLatinRegion, looseRank, plausibleLooseMatch, subPlaceQueries, type CompasPlace } from '../engine/places';
import { canonicalCountryName } from '../engine/countryNames';
import { cached, coordKey } from './sharedCache';
import { geoapifyReverse, geoapifySearch } from './geoapify';
import { nominatimJson } from './locationIq';
import { geoRiversEnabled, referentialRiver } from './geoRivers';
import { geoAreasEnabled, referentialArea } from './geoAreas';
import { geoMassifsEnabled, referentialMassif, referentialNaturalRegion } from './geoMassifs';
import { massifPlace } from '../engine/geoMassifs';
import { riverExtent } from '../engine/geoRivers';
import type { GeoAreaRow } from '../engine/geoAreas';
import { photonSlot } from '@/lib/siteSlot';
import { appUserAgent } from '@/lib/userAgent';
import { getRequestLocale } from '@/lib/i18n/serverLocale';
import { languageCacheKey, photonLang } from './mapLanguage';

/**
 * Recherche d'un lieu sur la carte (Photon, puis Nominatim — par LocationIQ
 * quand sa clé existe —, puis Geoapify ;
 * toujours des données OpenStreetMap), dans la langue de l'interface (`mapLanguage.ts`,
 * PLAN-100 6.4 ; le français par défaut, adresses et clés de cache d'avant). Mémoire courte côté serveur : une même étape n'est cherchée
 * qu'une fois. Réseau en panne → null, jamais un lieu deviné.
 */

/** Les lieux bougent peu : une recherche est partagée une semaine. */
const PLACE_TTL_S = 7 * 86_400;
const TIMEOUT_MS = 8000;
/** Arrêts de bus, routes, commerces, bâtiments : jamais une destination ni une étape. */
const NOISE = ['highway', 'amenity', 'shop', 'railway', 'public_transport', 'building', 'office', 'craft']
  .map((t) => `&osm_tag=!${t}`)
  .join('');

export const plain = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Clé de cache d'une recherche : sa forme simple, ou, pour un nom sans lettre
 * latine (« Москва », « 東京 »), l'empreinte du texte entier. `plain` les
 * réduisait tous à « » : une même clé partagée par toutes ces recherches.
 */
export const queryKey = (v: string) =>
  plain(v) ||
  `u:${createHash('sha256').update(v.normalize('NFKC').toLowerCase().trim()).digest('hex').slice(0, 24)}`;

/** Un nouvel essai, une fois, après cette attente, quand le débit est limité (créneau du site plein, 429) : une panne, elle, passe au service suivant tout de suite. */
const RETRY_DELAY_MS = 1200;

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown | null> {
  // Créneau du site plein : plusieurs essais courts (aucun appel à la carte tant qu'il n'y a pas de créneau) ;
  // 429, erreur du serveur ou coupure : un seul nouvel essai, avant de passer au service suivant (moins précis).
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const r = await fetchJsonOnce(url, headers);
    if (r.ok || !r.retry) return r.data;
    if (r.reason !== 'slot' && attempt >= 1) return r.data;
    await new Promise((resolve) => setTimeout(resolve, r.reason === 'slot' ? 450 : RETRY_DELAY_MS));
  }
  return null;
}

async function fetchJsonOnce(
  url: string,
  headers: Record<string, string>
): Promise<{ ok: boolean; data: unknown | null; retry: boolean; reason?: 'slot' | 'rate' | 'fail' }> {
  // Photon public (plan 1.3) : créneau partagé par tout le site, et l'application
  // nommée. Sans créneau : comme une panne, le service suivant répond.
  if (url.startsWith('https://photon.komoot.io/')) {
    if (!(await photonSlot())) {
      console.warn('[compas] Photon : créneau du site plein');
      return { ok: false, data: null, retry: true, reason: 'slot' };
    }
    headers = { ...headers, 'User-Agent': NOMINATIM_UA };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal, cache: 'no-store' });
    if (!res.ok) {
      console.warn('[compas] carte', new URL(url).host, res.status);
      return { ok: false, data: null, retry: res.status === 429 || res.status >= 500, reason: res.status === 429 ? 'rate' : 'fail' };
    }
    return { ok: true, data: await res.json(), retry: false };
  } catch (err) {
    console.warn('[compas] carte injoignable', new URL(url).host, err instanceof Error ? err.message : 'erreur');
    return { ok: false, data: null, retry: true, reason: 'fail' };
  } finally {
    clearTimeout(timer);
  }
}

/** L'application nommée auprès des cartes ouvertes (Photon, Nominatim ou LocationIQ). */
const NOMINATIM_UA = appUserAgent('Compas, preparation de voyage');
/**
 * Une requête Nominatim, une à la fois, par le client commun du site
 * (`locationIq.ts` : LocationIQ avec la clé, 2 requêtes/s pour tout le site ;
 * sans clé, Nominatim public à 1 requête/s, repli de développement). Rend les
 * lignes brutes au format `jsonv2` (le contour d'une île, `geojson`, compris).
 */
async function nominatimRows(url: string): Promise<Array<Record<string, unknown>> | null> {
  const payload = await nominatimJson(url, { userAgent: NOMINATIM_UA, timeoutMs: TIMEOUT_MS });
  if (payload == null) return null;
  // La recherche renvoie une liste, le géocodage inverse un seul lieu.
  return (Array.isArray(payload) ? payload : [payload]) as Array<Record<string, unknown>>;
}
/** Les lieux d'une requête Nominatim (voir `nominatimRows`). */
function nominatimQueued(url: string): Promise<CompasPlace[] | null> {
  return nominatimRows(url).then((rows) => (rows == null ? null : parseNominatim(rows)));
}
function nominatim(query: string, limit: number, lang: string): Promise<CompasPlace[] | null> {
  return nominatimQueued(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=${limit}&accept-language=${lang}`
  );
}

/** La langue de l'interface de la requête en cours (`fr` hors requête) : celle des noms rendus par la carte. */
const mapLang = (): Promise<string> => getRequestLocale();

/**
 * Photon d'abord (rapide, sans quota strict) ; s'il ne répond pas, Nominatim
 * (même carte OpenStreetMap), une requête par seconde. Les deux en panne → null.
 */
async function search(
  query: string,
  limit: number,
  near?: { lat: number; lon: number } | null
): Promise<CompasPlace[] | null> {
  // Partagé entre tous (mémoire puis Supabase) : Photon et Nominatim ne sont
  // interrogés qu'une fois par recherche. Une panne (null) n'est pas gardée.
  // `near` : les homonymes proches d'abord (« Le Tour » le hameau de Chamonix,
  // pas le lieu-dit du Var) ; sans repli Nominatim, qui ignore ce biais.
  const bias = near ? `&lat=${near.lat.toFixed(3)}&lon=${near.lon.toFixed(3)}&location_bias_scale=0.5` : '';
  // « v4 » : seules les réponses de Photon sont gardées. Avant, le repli (Nominatim, Geoapify) l'était aussi, sous
  // la même clé : un mauvais résultat de repli (le sommet américain pour « Machu Picchu ») restait servi à tous
  // pendant des semaines (constat C-020). Les clés « v3 » ne sont plus lues.
  const key = near ? `v4:near:${coordKey(near.lat, near.lon, 1)}:${limit}:${queryKey(query)}` : `v4:${limit}:${queryKey(query)}`;
  const lang = await mapLang();
  let fallback: CompasPlace[] | null = null;
  const fromPhoton = await cached('place', languageCacheKey(key, lang), PLACE_TTL_S, async () => {
    const photon = await fetchJson(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}&lang=${photonLang(lang)}${bias}${NOISE}`,
      { Accept: 'application/json' }
    );
    if (photon != null) {
      // Une liste vide n'est jamais gardée (null) : la carte a pu mal répondre, on réessaiera.
      const list = parsePhoton(photon);
      return list.length ? list : null;
    }
    // Photon muet : Nominatim, puis Geoapify (offre gratuite) en dernier secours. Servi, jamais gardé.
    let list = near ? null : await nominatim(query, Math.min(limit, 8), lang);
    if (list == null) list = await geoapifySearch(query, limit, lang);
    fallback = list && list.length ? list : null;
    return null;
  });
  return fromPhoton ?? fallback;
}

/**
 * La destination nommée par la personne, seulement si la carte la connaît sous
 * ce nom (pays, région, ville, île…). Un massif ou un parc que la carte ne
 * nomme pas renvoie null : l'appelant demande alors au spécialiste sa ville
 * de base (`lookupBase`).
 */
export async function lookupDestination(query: string): Promise<CompasPlace | null> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return null;
  const found = (await search(q, 8)) ?? [];
  const pick = pickDestination(found, q);
  // Homonymes éloignés : le lieu le plus connu qui porte ce nom (ou l'un de
  // ses autres noms) l'emporte — « Mont Rose » est le massif des Alpes.
  if (pick && homonymsFarApart(found, q)) {
    const known = (await stageAliasCandidates(q, null)).find((p) => p.landmark || (p.settlementRank ?? 0) >= 2);
    // Le premier résultat est déjà une ville au moins aussi importante que l'homonyme « connu » : il reste
    // (« Naples » est la ville d'Italie, pas un hameau français ; constat C-011). « Mont Rose » (une colline
    // pour premier résultat) est encore remplacé par le massif.
    const pickIsBigger = isNotablePlace(pick) || (Boolean(pick.settlement) && (pick.settlementRank ?? 0) >= (known?.settlementRank ?? 0));
    if (known && !pickIsBigger && distanceKm(known, pick) > 50) return { ...known, name: q };
    // Homonymes lointains sans lieu notable (« Alsace » : un quartier de Los
    // Angeles, la carte nommant la région « Collectivité européenne
    // d'Alsace ») : pas de tirage au sort, l'appelant cherche autrement.
    if (!isNotablePlace(pick)) return null;
  }
  return pick;
}

/** Un lieu de base réel (ville, village) dans un pays donné, pour ancrer une destination. */
export async function lookupBase(name: string, countryCode: string | null): Promise<CompasPlace | null> {
  const q = name.trim().slice(0, 80);
  if (q.length < 2) return null;
  const found = (await search(q, 8)) ?? [];
  const inCountry = countryCode ? found.filter((p) => p.countryCode === countryCode) : found;
  return inCountry.find((p) => p.settlement) ?? inCountry[0] ?? null;
}

/**
 * Dernier recours : le premier lieu habité ou naturel qui porte ce nom. Un résultat dont le nom
 * ne ressemble pas à la demande est refusé (« Highlands écossais » ne devient pas un lieu belge) :
 * mieux vaut « lieu introuvable » qu'un faux lieu.
 */
export async function lookupLoose(query: string): Promise<CompasPlace | null> {
  // « Jordanie Petra et Wadi Rum » : le pays dit en tête est le pays du lieu (« Wadi Rum » existe aussi en Égypte).
  const leadCountry = canonicalCountryName(query.trim().split(/[\s,]+/)[0] ?? '');
  const inLeadCountry = (p: CompasPlace) => !leadCountry || !p.country || plain(p.country) === plain(leadCountry);
  const pickFrom = async (q: string): Promise<CompasPlace | null> => {
    const found = ((await search(q.trim().slice(0, 80), 8)) ?? []).filter((p) => plausibleLooseMatch(p, q) && inLeadCountry(p));
    // Le mieux classé (pays, région, lieu naturel, ville) ; à égalité, l'ordre de la carte.
    const best = [...found].sort((x, y) => looseRank(x) - looseRank(y))[0] ?? null;
    // Une région que la carte ne nomme qu'en écriture locale garde le nom dit par la personne.
    return best && isNonLatinRegion(best, q) ? { ...best, name: q.trim().slice(0, 80) } : best;
  };
  const whole = await pickFrom(query);
  if (whole) return whole;
  // « Jordanie Petra et Wadi Rum » : la carte ne connaît pas le tout, mais connaît « Wadi Rum » (constat C-014).
  // Deux morceaux au plus, du plus long au plus court : jamais une rafale de requêtes pour un seul lieu.
  for (const part of subPlaceQueries(query).slice(0, 2)) {
    const found = await pickFrom(part);
    if (found) return found;
  }
  return null;
}

/**
 * Les lieux de la carte qui portent ce nom, dans le pays du voyage (le choix
 * du bon, près de l'étape précédente, se fait ensuite). Réseau en panne → [].
 */
export async function stageCandidates(
  name: string,
  ctx: { countryCode: string | null; country: string | null },
  near?: { lat: number; lon: number } | null
): Promise<CompasPlace[]> {
  const q = name.trim().slice(0, 80);
  if (q.length < 2) return [];
  const [found, close] = await Promise.all([
    search(ctx.country ? `${q}, ${ctx.country}` : q, 10).then(async (r) => r ?? (await search(q, 10)) ?? []),
    near ? search(q, 10, near).then((r) => r ?? []) : Promise.resolve([] as CompasPlace[]),
  ]);
  // Les lieux proches de la destination d'abord, puis le reste du pays, sans doublon.
  const merged = [...close];
  for (const p of found) if (!merged.some((m) => Math.abs(m.lat - p.lat) < 1e-3 && Math.abs(m.lon - p.lon) < 1e-3)) merged.push(p);
  return ctx.countryCode ? merged.filter((p) => p.countryCode === ctx.countryCode) : merged;
}

/**
 * Dernier recours pour une étape introuvable : Nominatim connaît les autres
 * noms d'un lieu (anglais, ancien, alternatif : « Machu Picchu Pueblo » =
 * Aguas Calientes). Seulement les lieux dont un nom est celui cherché.
 */
export async function stageAliasCandidates(name: string, countryCode: string | null): Promise<CompasPlace[]> {
  const q = name.trim().slice(0, 80);
  if (q.length < 3) return [];
  const cc = countryCode ? `&countrycodes=${countryCode.toLowerCase()}` : '';
  const lang = await mapLang();
  const found = await cached('place', languageCacheKey(`alias:v1:${countryCode ?? 'any'}:${queryKey(q)}`, lang), PLACE_TTL_S, () =>
    nominatimQueued(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&namedetails=1&limit=5&accept-language=${lang}${cc}`
    )
  );
  return (found ?? []).filter((p) => aliasMatches(p, q));
}

/**
 * Le massif qui porte le nom d'une entité administrative (« Vosges » le
 * département → le massif des Vosges ; « Jura » → le massif du Jura). Pour une
 * activité à pied, c'est là qu'on randonne. Seulement un lieu naturel du même
 * nom, à moins de 150 km : sinon null (on garde l'entité administrative).
 * Avant la carte, le référentiel des massifs GeoNames s'il est allumé (plan 3.3) : un point, sans
 * emprise (GeoNames n'en donne pas) ; rien ou panne → exactement la recherche d'avant.
 */
export async function lookupMassif(name: string, near: { lat: number; lon: number }): Promise<CompasPlace | null> {
  const q = name.trim().slice(0, 60);
  if (q.length < 3) return null;
  if (geoMassifsEnabled()) {
    const row = await referentialMassif(q, near).catch(() => null);
    if (row) return massifPlace(row);
  }
  const lang = await mapLang();
  const found = await cached('place', languageCacheKey(`massif:v1:${queryKey(q)}`, lang), PLACE_TTL_S, () =>
    nominatimQueued(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`massif ${q}`)}&format=jsonv2&addressdetails=1&namedetails=1&limit=5&accept-language=${lang}`
    )
  );
  return (
    (found ?? []).find(
      (p) => p.landmark && p.extent && nameCore(p.name) === nameCore(q) && distanceKm(p, near) <= 150
    ) ?? null
  );
}

/** Le lieu d'un point GPS (commune, pays) : sert à savoir d'où l'on part. */
export async function lookupReverse(lat: number, lon: number): Promise<CompasPlace | null> {
  // « v2 » : les entrées d'avant la localité (ville, bourg) ne sont plus servies.
  const lang = await mapLang();
  const places = await cached('reverse', languageCacheKey(`v2:${coordKey(lat, lon, 2)}`, lang), 30 * 86_400, async () => {
    const payload = await fetchJson(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=1&lang=${photonLang(lang)}`, {
      Accept: 'application/json',
    });
    const photon = payload == null ? [] : parsePhoton(payload);
    if (photon.length) return photon;
    // Photon muet (depuis certains serveurs) : Nominatim, même carte, à l'échelle de la commune.
    const fromNominatim = await nominatimQueued(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&addressdetails=1&zoom=14&accept-language=${lang}`
    );
    if (fromNominatim?.length) return fromNominatim;
    // Les deux muets : Geoapify (offre gratuite), à l'échelle de la commune.
    return geoapifyReverse(lat, lon, lang);
  });
  return places?.[0] ?? null;
}

/**
 * Le centre de la COMMUNE où se trouve la personne (plan 2.10) : la commune lue à l'adresse
 * de son point arrondi (`here`, `lookupReverse`), retrouvée par son nom près de ce point.
 * Ce qui s'écrit sur le voyage est ce centre, jamais le point lui-même. Rien de sûr : null.
 */
export async function lookupCommune(here: CompasPlace | null, near: { lat: number; lon: number }): Promise<CompasPlace | null> {
  const name = here?.locality ?? (here?.settlement ? here.name : null);
  if (!name || name.trim().length < 2) return null;
  const found = (await search(name.trim().slice(0, 80), 8, near)) ?? [];
  return pickCommune(found, name, here?.countryCode ?? null, near);
}

/**
 * La rivière du référentiel `geo_rivers` (plan 3.6) en lieu du Compas : son centre, son emprise
 * (`riverExtent`, l'ordre de `CompasPlace.extent`), étiquetée `waterway=river` pour que la descente
 * en canoë suive son tracé. Le référentiel ne dit pas le pays : `countryCode` reste null.
 * Interrupteur éteint : null sans toucher au référentiel ; base muette ou nom inconnu : null.
 */
async function referentialRiverPlace(
  name: string,
  near: { lat: number; lon: number } | null | undefined
): Promise<CompasPlace | null> {
  if (!geoRiversEnabled()) return null;
  const row = await referentialRiver(name, near).catch(() => null);
  if (!row) return null;
  return {
    name: row.name,
    lat: row.lat,
    lon: row.lon,
    countryCode: null,
    country: null,
    kind: 'river',
    landmark: true,
    osmTag: 'waterway=river',
    extent: riverExtent(row),
  };
}

/**
 * La rivière de ce nom dans le pays. Le référentiel `geo_rivers` d'abord, s'il est allumé.
 * Sinon la carte (Photon), qui ne la donne souvent
 * qu'avec son article : « Tarn » rend des plans d'eau, « Le Tarn » la rivière
 * entière (de même « La Dordogne », « L'Ardèche »). Rien : null.
 * `near` départage les homonymes du référentiel (celle dont l'emprise contient le lieu visé).
 * `referential` : « only » interroge le référentiel seul (rien → null, sans carte) ; « skip » la
 * carte seule (le référentiel déjà interrogé par l'appelant).
 */
export async function lookupRiver(
  name: string,
  countryCode: string | null,
  opts: { near?: { lat: number; lon: number } | null; referential?: 'only' | 'skip' } = {}
): Promise<CompasPlace | null> {
  if (opts.referential !== 'skip') {
    const known = await referentialRiverPlace(name, opts.near);
    if (known || opts.referential === 'only') return known;
  }
  const bare = name.trim().replace(/^(?:(?:la|le|les)\s+|l['’]\s*)/i, '');
  if (bare.length < 2) return null;
  const variants = /^[aeiouyhàâäéèêëîïôöûüù]/i.test(bare) ? [bare, `L'${bare}`] : [bare, `Le ${bare}`, `La ${bare}`];
  for (const q of variants) {
    const p = await lookupNatural(q, countryCode, true).catch(() => null);
    if (p && /^waterway=/.test(p.osmTag ?? '')) return p;
  }
  return null;
}

/** Lieux naturels seulement (massifs, régions naturelles, parcs, réserves, rivières). */
const NATURAL_TAGS = ['natural', 'boundary:protected_area', 'boundary:national_park', 'place:region', 'leisure:nature_reserve', 'waterway:river']
  .map((t) => `&osm_tag=${t}`)
  .join('');

/** Étiquette OSM d'origine d'un espace du référentiel, celle que Photon donne au même lieu. */
const AREA_TAG: Record<GeoAreaRow['kind'], string> = {
  national_park: 'boundary=national_park',
  protected_area: 'boundary=protected_area',
  nature_reserve: 'leisure=nature_reserve',
};

/**
 * Un espace du référentiel `geo_areas` en lieu du Compas, emprise dans l'ordre de
 * `CompasPlace.extent` ([ouest, nord, est, sud]). Le référentiel ne dit pas le pays : null.
 */
function areaPlace(row: GeoAreaRow): CompasPlace {
  return {
    name: row.name,
    lat: row.lat,
    lon: row.lon,
    countryCode: null,
    country: null,
    kind: row.kind,
    landmark: true,
    osmTag: AREA_TAG[row.kind],
    extent: [row.west, row.north, row.east, row.south],
  };
}

/**
 * Le lieu naturel de ce nom dans le pays (voir `pickNatural`), pour une
 * activité de plein air dont la destination a été lue comme un quartier ou un
 * département. Avant la carte, le référentiel des parcs s'il est allumé (son
 * espace connu sous ce nom l'emporte, sans vérifier le pays qu'il ne donne pas), puis celui des
 * régions naturelles et presqu'îles (`geo_massifs`, COMPAS_GEO_MASSIFS).
 * Carte injoignable ou rien de naturel : null.
 */
export async function lookupNatural(name: string, countryCode: string | null, rivers = false): Promise<CompasPlace | null> {
  const q = name.trim().slice(0, 60);
  if (q.length < 3) return null;
  // Référentiel des parcs (plan 3.3), interrupteur allumé : l'espace connu sous ce nom, sans carte.
  if (geoAreasEnabled()) {
    const row = await referentialArea(q).catch(() => null);
    if (row) return areaPlace(row);
  }
  // Régions naturelles et presqu'îles GeoNames (plan 3.3, `RGN`, `PEN`), même interrupteur que les
  // massifs : un point, sans emprise. Pas pour une rivière (`lookupRiver` veut un cours d'eau).
  if (!rivers && geoMassifsEnabled()) {
    const row = await referentialNaturalRegion(q, countryCode).catch(() => null);
    if (row) return massifPlace(row);
  }
  const lang = await mapLang();
  const found = await cached('place', languageCacheKey(`natural:v1:${queryKey(q)}`, lang), PLACE_TTL_S, async () => {
    const payload = await fetchJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10&lang=${photonLang(lang)}${NATURAL_TAGS}`, {
      Accept: 'application/json',
    });
    const list = payload == null ? null : parsePhoton(payload);
    return list && list.length ? list : null;
  });
  return pickNatural(found ?? [], q, countryCode, rivers);
}

/** Le contour d'une île change à peine : une lecture est partagée un mois. */
const ISLAND_CONTOUR_TTL_S = 30 * 86_400;

/**
 * Le CONTOUR d'une île (polygone OpenStreetMap, une requête Nominatim ou LocationIQ avec
 * `polygon_geojson=1`, simplifié par la carte) : l'île de ce nom (`place=island`) dont le centre est le
 * plus proche de `near`, à moins de son demi-diamètre. Sert à valider les lieux de l'île : près du
 * continent du même pays (Eubée, Sicile), l'emprise de la carte englobe des lieux qui n'y sont pas.
 * Service muet, île non décrite par un polygone ou sans île de ce nom près de `near` : null (jamais un
 * contour deviné, ni un cercle).
 */
export async function lookupIslandContour(island: {
  name: string;
  near: { lat: number; lon: number };
  halfExtentKm: number;
}): Promise<IslandContour | null> {
  const name = island.name.trim().slice(0, 80);
  if (!name) return null;
  // Un contour est une géométrie, la même dans toutes les langues : recherche et clé en français,
  // partagées par tous (PLAN-100 6.4 ne change rien ici).
  const key = `v1:island:${coordKey(island.near.lat, island.near.lon, 1)}:${queryKey(name)}`;
  return cached('place', key, ISLAND_CONTOUR_TTL_S, async () => {
    const rows = await nominatimRows(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=jsonv2&polygon_geojson=1&polygon_threshold=0.003&limit=8&accept-language=fr`
    );
    if (!rows) return null;
    let best: { km: number; contour: IslandContour } | null = null;
    for (const r of rows) {
      if (r.category !== 'place' || !/^(island|islet)$/.test(String(r.type))) continue;
      const lat = Number(r.lat);
      const lon = Number(r.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const km = distanceKm(island.near, { lat, lon });
      // Une île homonyme à l'autre bout du monde n'est pas celle-ci.
      if (km > Math.max(island.halfExtentKm, 30)) continue;
      const contour = parseIslandContour(r.geojson);
      if (contour && (!best || km < best.km)) best = { km, contour };
    }
    return best?.contour ?? null;
  });
}
