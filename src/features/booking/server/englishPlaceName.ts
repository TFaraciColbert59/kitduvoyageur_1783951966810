import 'server-only';

/**
 * Le nom anglais d'une ville, d'après OpenStreetMap (Photon, `lang=en`) :
 * « Lisbonne » → « Lisbon », « Genève » → « Geneva ». La recherche de lieux de
 * RouteStack ne connaît que les noms anglais (8 octobre : « Lisbonne » refusé
 * pour une voiture, « Paris → Lisbonne » sans vol). Rien d'inventé : un nom que
 * la carte ne connaît pas comme lieu habité ou région renvoie null.
 */

const PHOTON = 'https://photon.komoot.io/api/';
const UA = 'kitduvoyageur/1.0 (reservation, nom de lieu)';
const TIMEOUT_MS = 4000;
/** Villes d'abord ; régions en repli ; jamais un lieu-dit homonyme (« Lisbonne », hameau du Gers). */
const CITY_TYPES = new Set(['city', 'town']);
const PLACE_TYPES = new Set(['city', 'town', 'village', 'district', 'county', 'state', 'country']);

interface PhotonProps {
  type?: string;
  name?: string;
  extent?: [number, number, number, number];
}

const extentArea = (p: PhotonProps) =>
  p.extent ? Math.abs((p.extent[2] - p.extent[0]) * (p.extent[1] - p.extent[3])) : 0;

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export async function englishPlaceName(
  name: string,
  fetchImpl: FetchLike = fetch
): Promise<string | null> {
  const q = name.trim().slice(0, 80);
  if (q.length < 2) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${PHOTON}?q=${encodeURIComponent(q)}&limit=5&lang=en`, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { features?: Array<{ properties?: PhotonProps }> };
    const props = (payload.features ?? []).map((f) => f.properties ?? {});
    const cities = props.filter((p) => CITY_TYPES.has(p.type ?? '')).slice(0, 3);
    const pool = cities.length
      ? cities
      : props.filter((p) => PLACE_TYPES.has(p.type ?? '')).slice(0, 1);
    // Homonymes (« Londres » : la ville d'Argentine passe devant London) : la
    // plus étendue des premières villes ; sans emprise connue, la première.
    const hit = pool.reduce<PhotonProps | null>(
      (best, p) => (best == null || extentArea(p) > extentArea(best) ? p : best),
      null
    );
    const en = hit?.name?.trim();
    return en ? en : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
