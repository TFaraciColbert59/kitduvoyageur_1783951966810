import 'server-only';
import { parseNominatim, parsePhoton, type CompasPlace } from '../engine/places';

/**
 * Recherche d'un lieu sur la carte (Photon, données OpenStreetMap), en
 * français. Mémoire courte côté serveur : une même étape n'est cherchée
 * qu'une fois. Réseau en panne → null, jamais un lieu deviné.
 */

const cache = new Map<string, { at: number; places: CompasPlace[] }>();
const TTL_MS = 6 * 3600_000;
const TIMEOUT_MS = 8000;
/** Arrêts de bus, routes, commerces, bâtiments : jamais une destination ni une étape. */
const NOISE = ['highway', 'amenity', 'shop', 'railway', 'public_transport', 'building', 'office', 'craft']
  .map((t) => `&osm_tag=!${t}`)
  .join('');

const plain = (v: string) =>
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
function nominatim(query: string, limit: number): Promise<CompasPlace[] | null> {
  const run = nominatimChain.then(async () => {
    const payload = await fetchJson(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=${limit}&accept-language=fr`,
      { Accept: 'application/json', 'User-Agent': NOMINATIM_UA }
    );
    await new Promise((r) => setTimeout(r, 1100));
    return payload == null ? null : parseNominatim(payload);
  });
  nominatimChain = run.catch(() => null);
  return run;
}

/**
 * Photon d'abord (rapide, sans quota strict) ; s'il ne répond pas, Nominatim
 * (même carte OpenStreetMap), une requête par seconde. Les deux en panne → null.
 */
async function search(query: string, limit: number): Promise<CompasPlace[] | null> {
  const key = `${limit}:${query.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.places;
  const photon = await fetchJson(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}&lang=fr${NOISE}`,
    { Accept: 'application/json' }
  );
  const places = photon != null ? parsePhoton(photon) : await nominatim(query, Math.min(limit, 8));
  if (places == null) return null;
  if (cache.size > 2000) cache.clear();
  cache.set(key, { at: Date.now(), places });
  return places;
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
  const want = plain(q);
  return found.find((p) => plain(p.name) === want) ?? null;
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
  const key = `rev:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.places[0] ?? null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=1&lang=fr`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const places = parsePhoton(await res.json());
    cache.set(key, { at: Date.now(), places });
    return places[0] ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
