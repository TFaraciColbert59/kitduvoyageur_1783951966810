import 'server-only';
import { parsePhoton, type CompasPlace } from '../engine/places';

/**
 * Recherche d'un lieu sur la carte (Photon, données OpenStreetMap), en
 * français. Mémoire courte côté serveur : une même étape n'est cherchée
 * qu'une fois. Réseau en panne → null, jamais un lieu deviné.
 */

const cache = new Map<string, { at: number; places: CompasPlace[] }>();
const TTL_MS = 6 * 3600_000;
const TIMEOUT_MS = 6000;

async function search(query: string, limit: number): Promise<CompasPlace[] | null> {
  const key = `${limit}:${query.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.places;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}&lang=fr`,
      { headers: { Accept: 'application/json' }, signal: controller.signal, cache: 'no-store' }
    );
    if (!res.ok) return null;
    const places = parsePhoton(await res.json());
    if (cache.size > 2000) cache.clear();
    cache.set(key, { at: Date.now(), places });
    return places;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** La destination nommée par la personne (pays, région, ville, massif…). */
export async function lookupDestination(query: string): Promise<CompasPlace | null> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return null;
  const found = await search(q, 5);
  return found?.[0] ?? null;
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
