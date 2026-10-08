import 'server-only';
import { GEOAPIFY_DAILY_CREDITS, takeApiCredits } from '@/lib/apiCredits';
import { parseGeoapify, type CompasPlace } from '../engine/places';
import { areaKinds, geoapifyCategories, parseGeoapifyArea, type AreaPlace, type AreaQuery } from '../engine/itinerary';

/**
 * Geoapify (offre gratuite, usage commercial permis, 3 000 requêtes par jour) :
 * dernier secours de la carte quand Photon, Nominatim et Overpass ne répondent
 * pas. Clé serveur `GEOAPIFY_API_KEY` ; absente → rien n'est appelé (null).
 * Les résultats passent par le même cache partagé que les autres sources.
 */
const BASE = 'https://api.geoapify.com';

function apiKey(): string | null {
  const k = process.env.GEOAPIFY_API_KEY?.trim();
  return k ? k : null;
}

export function geoapifyAvailable(): boolean {
  return apiKey() != null;
}

/** Lieux d'une zone : au plus 200 (10 crédits) ; le référentiel a déjà les lieux habités. */
const AREA_LIMIT = 200;

/**
 * Crédits Geoapify d'un appel (offre gratuite) : un pour le géocodage, un par
 * tranche de 20 lieux demandés pour Places. Compté d'avance, sur le compteur
 * commun du site (routage compris), arrêt à 2 700 par jour.
 */
export function geoapifyCallCredits(path: string, params: Record<string, string>): number {
  if (path.startsWith('/v2/places')) return Math.max(1, Math.ceil(Number(params.limit ?? 20) / 20));
  return 1;
}

async function call(path: string, params: Record<string, string>, timeoutMs: number): Promise<unknown | null> {
  const key = apiKey();
  if (!key) return null;
  if (!(await takeApiCredits('geoapify', geoapifyCallCredits(path, params), GEOAPIFY_DAILY_CREDITS))) {
    console.warn('[compas] Geoapify : crédits du jour épuisés', path);
    return null;
  }
  const url = `${BASE}${path}?${new URLSearchParams({ ...params, apiKey: key }).toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!res.ok) {
      // Jamais l'URL complète dans les journaux : elle porte la clé.
      console.warn('[compas] Geoapify', path, res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[compas] Geoapify injoignable', path, err instanceof Error ? err.message : 'erreur');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function geoapifySearch(query: string, limit: number): Promise<CompasPlace[] | null> {
  const payload = await call('/v1/geocode/search', { text: query, lang: 'fr', limit: String(Math.min(limit, 10)), format: 'json' }, 8000);
  return payload == null ? null : parseGeoapify(payload);
}

export async function geoapifyReverse(lat: number, lon: number): Promise<CompasPlace[] | null> {
  const payload = await call(
    '/v1/geocode/reverse',
    { lat: String(lat), lon: String(lon), lang: 'fr', type: 'city', format: 'json' },
    8000
  );
  return payload == null ? null : parseGeoapify(payload);
}

/** Lieux d'une zone (villes, villages, refuges) : une seule requête, 200 lieux au plus. */
export async function geoapifyArea(q: AreaQuery, timeoutMs: number): Promise<AreaPlace[] | null> {
  const radiusM = Math.round(Math.min(q.radiusKm, 400) * 1000);
  const payload = await call(
    '/v2/places',
    {
      categories: geoapifyCategories(areaKinds(q)),
      filter: `circle:${q.center.lon.toFixed(5)},${q.center.lat.toFixed(5)},${radiusM}`,
      limit: String(AREA_LIMIT),
      lang: 'fr',
    },
    timeoutMs
  );
  if (payload == null) return null;
  const places = parseGeoapifyArea(payload);
  return places.length ? places : null;
}
