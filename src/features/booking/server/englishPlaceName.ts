import 'server-only';
import { appUserAgent } from '@/lib/userAgent';

/**
 * Le nom anglais d'une ville, d'après OpenStreetMap (Photon, `lang=en`) :
 * « Lisbonne » → « Lisbon », « Genève » → « Geneva ». La recherche de lieux de
 * RouteStack ne connaît que les noms anglais (8 octobre : « Lisbonne » refusé
 * pour une voiture, « Paris → Lisbonne » sans vol). Rien d'inventé : un nom que
 * la carte ne connaît pas comme lieu habité ou région renvoie null, et null
 * aussi quand le nom est déjà le bon (« Paris », « Cambridge, Massachusetts ») :
 * l'appelant garde alors la saisie telle quelle, précision comprise.
 */

const PHOTON = 'https://photon.komoot.io/api/';
const UA = appUserAgent('reservation, nom de lieu');
const TIMEOUT_MS = 4000;
/** Lieux habités et régions ; jamais un lieu-dit homonyme (« Lisbonne », hameau du Gers). Villes : nom français. */
const CITY_TYPES = new Set(['city', 'town']);
const PLACE_TYPES = new Set(['city', 'town', 'village', 'district', 'county', 'state', 'country']);

interface PhotonProps {
  type?: string;
  name?: string;
  extent?: [number, number, number, number];
}

const extentArea = (p: PhotonProps) =>
  p.extent ? Math.abs((p.extent[2] - p.extent[0]) * (p.extent[1] - p.extent[3])) : 0;
const fold = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
/** Une ville d'un autre nom, bien plus étendue, que la saisie désigne en français. */
const EXONYM_AREA_RATIO = 5;

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
    // Le lieu le plus pertinent pour Photon (village compris : « Allas-les-Mines »
    // ne doit pas devenir une autre ville de la liste).
    const first = props.find((p) => PLACE_TYPES.has(p.type ?? ''));
    const firstName = first?.name?.trim();
    if (!first || !firstName) return null;
    // « Cambridge, Massachusetts » : le nom avant la précision, qui est gardée.
    const comma = q.indexOf(',');
    const head = comma > 0 ? q.slice(0, comma) : q;
    const rest = comma > 0 ? q.slice(comma) : '';
    // Autre nom (« Lisbon »), ou même nom écrit sans accent (« Seville »).
    if (firstName !== head.trim()) return `${firstName}${rest}`;
    // Le premier lieu porte déjà ce nom. Seule exception : une ville d'un autre
    // nom, bien plus étendue, que la saisie nomme en français (« Londres » :
    // Londres en Argentine passe devant London ; « Venise » : un hameau de France).
    // Comparaison possible seulement entre villes d'emprise connue.
    const firstArea = CITY_TYPES.has(first.type ?? '') ? extentArea(first) : 0;
    const exonym =
      firstArea > 0
        ? cities.find(
            (c) =>
              c.name &&
              fold(c.name) !== fold(head) &&
              extentArea(c) >= EXONYM_AREA_RATIO * firstArea
          )
        : undefined;
    return exonym?.name ? `${exonym.name.trim()}${rest}` : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
