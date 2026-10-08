import 'server-only';
import { createHash } from 'node:crypto';
import { aliasMatches, distanceKm, homonymsFarApart, nameCore, parseNominatim, parsePhoton, isNotablePlace, pickDestination, pickNatural, type CompasPlace } from '../engine/places';
import { cached, coordKey } from './sharedCache';
import { geoapifyReverse, geoapifySearch } from './geoapify';
import { locationIqKey, locationIqSlot, locationIqUrl, normalizeLocationIq } from './locationIq';
import { photonSlot } from '@/lib/siteSlot';

/**
 * Recherche d'un lieu sur la carte (Photon, puis Nominatim — par LocationIQ
 * quand sa clé existe —, puis Geoapify ;
 * toujours des données OpenStreetMap), en
 * français. Mémoire courte côté serveur : une même étape n'est cherchée
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

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown | null> {
  // Photon public (plan 1.3) : créneau partagé par tout le site, et l'application
  // nommée. Sans créneau : comme une panne, le service suivant répond.
  if (url.startsWith('https://photon.komoot.io/')) {
    if (!(await photonSlot())) {
      console.warn('[compas] Photon : créneau du site plein');
      return null;
    }
    headers = { ...headers, 'User-Agent': NOMINATIM_UA };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal, cache: 'no-store' });
    if (!res.ok) {
      console.warn('[compas] carte', new URL(url).host, res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[compas] carte injoignable', new URL(url).host, err instanceof Error ? err.message : 'erreur');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Nominatim exige au plus une requête par seconde et un User-Agent identifiant l'application. */
const NOMINATIM_UA = 'kitduvoyageur/1.0 (Compas, preparation de voyage; koosmoweb.fr)';
let nominatimChain: Promise<unknown> = Promise.resolve();
/**
 * Une requête Nominatim, une à la fois. Avec la clé LocationIQ (même moteur,
 * usage commercial autorisé), elle part chez LocationIQ (2 requêtes/s) ; sans,
 * chez Nominatim (1 requête/s, trafic d'application déconseillé).
 */
function nominatimQueued(url: string): Promise<CompasPlace[] | null> {
  const key = locationIqKey();
  const viaLocationIq = key ? locationIqUrl(url, key) : null;
  const run = nominatimChain.then(async () => {
    // LocationIQ : 2 requêtes/s pour tout le site (créneau partagé en base).
    if (viaLocationIq && !(await locationIqSlot())) {
      console.warn('[compas] LocationIQ : pas de créneau libre, service suivant');
      return null;
    }
    const payload = viaLocationIq
      ? await fetchJson(viaLocationIq, { Accept: 'application/json' })
      : await fetchJson(url, { Accept: 'application/json', 'User-Agent': NOMINATIM_UA });
    await new Promise((r) => setTimeout(r, viaLocationIq ? 550 : 1100));
    if (payload == null) return null;
    // La recherche renvoie une liste, le géocodage inverse un seul lieu.
    return parseNominatim(viaLocationIq ? normalizeLocationIq(payload) : Array.isArray(payload) ? payload : [payload]);
  });
  nominatimChain = run.catch(() => null);
  return run;
}
function nominatim(query: string, limit: number): Promise<CompasPlace[] | null> {
  return nominatimQueued(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=${limit}&accept-language=fr`
  );
}

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
  // « v3 » : lieux lus avec leur taille et leur étiquette OSM, absentes des entrées d'avant.
  const key = near ? `v3:near:${coordKey(near.lat, near.lon, 1)}:${limit}:${queryKey(query)}` : `v3:${limit}:${queryKey(query)}`;
  return cached('place', key, PLACE_TTL_S, async () => {
    const photon = await fetchJson(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}&lang=fr${bias}${NOISE}`,
      { Accept: 'application/json' }
    );
    // Une liste vide n'est jamais gardée (null) : la carte a pu mal répondre, on réessaiera.
    let list = photon != null ? parsePhoton(photon) : near ? null : await nominatim(query, Math.min(limit, 8));
    // Photon et Nominatim muets : Geoapify (offre gratuite) en dernier secours.
    if (list == null) list = await geoapifySearch(query, limit);
    return list && list.length ? list : null;
  });
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
    if (known && distanceKm(known, pick) > 50) return { ...known, name: q };
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

/** Dernier recours : le premier lieu habité ou naturel qui porte ce nom. */
export async function lookupLoose(query: string): Promise<CompasPlace | null> {
  const found = (await search(query.trim().slice(0, 80), 8)) ?? [];
  return found.find((p) => p.settlement) ?? found[0] ?? null;
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
  const found = await cached('place', `alias:v1:${countryCode ?? 'any'}:${queryKey(q)}`, PLACE_TTL_S, () =>
    nominatimQueued(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&namedetails=1&limit=5&accept-language=fr${cc}`
    )
  );
  return (found ?? []).filter((p) => aliasMatches(p, q));
}

/**
 * Le massif qui porte le nom d'une entité administrative (« Vosges » le
 * département → le massif des Vosges ; « Jura » → le massif du Jura). Pour une
 * activité à pied, c'est là qu'on randonne. Seulement un lieu naturel du même
 * nom, à moins de 150 km : sinon null (on garde l'entité administrative).
 */
export async function lookupMassif(name: string, near: { lat: number; lon: number }): Promise<CompasPlace | null> {
  const q = name.trim().slice(0, 60);
  if (q.length < 3) return null;
  const found = await cached('place', `massif:v1:${queryKey(q)}`, PLACE_TTL_S, () =>
    nominatimQueued(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`massif ${q}`)}&format=jsonv2&addressdetails=1&namedetails=1&limit=5&accept-language=fr`
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
  const places = await cached('reverse', `v2:${coordKey(lat, lon, 2)}`, 30 * 86_400, async () => {
    const payload = await fetchJson(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=1&lang=fr`, {
      Accept: 'application/json',
    });
    const photon = payload == null ? [] : parsePhoton(payload);
    if (photon.length) return photon;
    // Photon muet (depuis certains serveurs) : Nominatim, même carte, à l'échelle de la commune.
    const fromNominatim = await nominatimQueued(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&addressdetails=1&zoom=14&accept-language=fr`
    );
    if (fromNominatim?.length) return fromNominatim;
    // Les deux muets : Geoapify (offre gratuite), à l'échelle de la commune.
    return geoapifyReverse(lat, lon);
  });
  return places?.[0] ?? null;
}

/**
 * La rivière de ce nom dans le pays. La carte (Photon) ne la donne souvent
 * qu'avec son article : « Tarn » rend des plans d'eau, « Le Tarn » la rivière
 * entière (de même « La Dordogne », « L'Ardèche »). Rien : null.
 */
export async function lookupRiver(name: string, countryCode: string | null): Promise<CompasPlace | null> {
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

/**
 * Le lieu naturel de ce nom dans le pays (voir `pickNatural`), pour une
 * activité de plein air dont la destination a été lue comme un quartier ou un
 * département. Carte injoignable ou rien de naturel : null.
 */
export async function lookupNatural(name: string, countryCode: string | null, rivers = false): Promise<CompasPlace | null> {
  const q = name.trim().slice(0, 60);
  if (q.length < 3) return null;
  const found = await cached('place', `natural:v1:${queryKey(q)}`, PLACE_TTL_S, async () => {
    const payload = await fetchJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10&lang=fr${NATURAL_TAGS}`, {
      Accept: 'application/json',
    });
    const list = payload == null ? null : parsePhoton(payload);
    return list && list.length ? list : null;
  });
  return pickNatural(found ?? [], q, countryCode, rivers);
}
