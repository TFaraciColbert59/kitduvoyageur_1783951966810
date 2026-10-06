import 'server-only';
import { parseNominatim, parsePhoton, pickDestination, type CompasPlace } from '../engine/places';
import { cached, coordKey } from './sharedCache';

/**
 * Recherche d'un lieu sur la carte (Photon, données OpenStreetMap), en
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

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown | null> {
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
const NOMINATIM_UA = 'kitduvoyageur/1.0 (Compas, preparation de voyage)';
let nominatimChain: Promise<unknown> = Promise.resolve();
function nominatimQueued(url: string): Promise<CompasPlace[] | null> {
  const run = nominatimChain.then(async () => {
    const payload = await fetchJson(url, { Accept: 'application/json', 'User-Agent': NOMINATIM_UA });
    await new Promise((r) => setTimeout(r, 1100));
    // La recherche renvoie une liste, le géocodage inverse un seul lieu.
    return payload == null ? null : parseNominatim(Array.isArray(payload) ? payload : [payload]);
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
async function search(query: string, limit: number): Promise<CompasPlace[] | null> {
  // Partagé entre tous (mémoire puis Supabase) : Photon et Nominatim ne sont
  // interrogés qu'une fois par recherche. Une panne (null) n'est pas gardée.
  return cached('place', `${limit}:${plain(query)}`, PLACE_TTL_S, async () => {
    const photon = await fetchJson(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}&lang=fr${NOISE}`,
      { Accept: 'application/json' }
    );
    return photon != null ? parsePhoton(photon) : await nominatim(query, Math.min(limit, 8));
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
  return pickDestination(found, q);
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
  ctx: { countryCode: string | null; country: string | null }
): Promise<CompasPlace[]> {
  const q = name.trim().slice(0, 80);
  if (q.length < 2) return [];
  const found = (await search(ctx.country ? `${q}, ${ctx.country}` : q, 10)) ?? (await search(q, 10)) ?? [];
  return ctx.countryCode ? found.filter((p) => p.countryCode === ctx.countryCode) : found;
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
    return nominatimQueued(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&addressdetails=1&zoom=14&accept-language=fr`
    );
  });
  return places?.[0] ?? null;
}
