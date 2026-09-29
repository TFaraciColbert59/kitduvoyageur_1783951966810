/**
 * Meteo cote navigateur — on passe par /api/weather, jamais en direct.
 *
 * L ecran de preparation appelait Open-Meteo depuis le navigateur, ce qui
 * contournait le rate limit, le cache central et la validation de plage de la
 * route. Ici on interroge la route, et on ne fait PAS confiance a sa reponse :
 * une serie de dates decalee est refusee entiere, parce que le jour 1
 * afficherait alors la meteo d un autre jour.
 *
 * Toute panne — reseau, 4xx, 5xx, corps illisible — donne `null`. L ecran affiche
 * alors « meteo indisponible », ce qui est vrai, au lieu d un ciel invente.
 */

import { readMeasureProvider, type MeasureProviderId } from './engine/provenance';
import { weatherLabel, type DayWeather } from './engine/weather';

const ENDPOINT = '/api/weather';

export interface WeatherAnchorLike {
  readonly lat: number;
  readonly lon: number;
}

/** L injection de reseau, avec la meme forme que le reste du module. */
export type WeatherFetcher = typeof fetch;

/**
 * Le fournisseur des journees, tel que la route l a NOMME — jamais devine.
 *
 * Un deuxieme canal, distinct de celui du routage : le routage nomme un moteur
 * par `provider` nu ("valhalla"), la meteo et l altitude nomment un objet
 * `{ id, name, url }`. Les deux appartiennent au meme vocabulaire
 * (`engine/provenance.ts`) mais pas au meme type, donc les melanger
 * reviendrait a afficher « Open-Meteo (previsions) » sous un denivele, ou a
 * laisser croire qu un routeur est un service de mesure.
 */
export type WeatherProviderListener = (provider: MeasureProviderId) => void;

/**
 * Le fournisseur nomme par le CORPS de la reponse de `/api/weather`, ou
 * `null`.
 *
 * Fonction jumelle de `readRouteProvider` : la regle est la meme, et le
 * vocabulaire vient de `engine/provenance.ts`. Elle lit `provider.id` et rien
 * d autre — un `provider` en chaine ne nomme personne, parce que la route
 * rend l objet `{ id, name, url }` de `dataProviders.ts`.
 */
export function readWeatherProvider(payload: unknown): MeasureProviderId | null {
  return readMeasureProvider(payload);
}

/** Un nombre exploitable, ou `null`. Jamais `0` a la place d une absence. */
function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** La requete a envoyer, ou `null` si elle n a pas de sens. */
export function weatherQuery(
  anchor: WeatherAnchorLike,
  dates: readonly string[],
): string | null {
  const { lat, lon } = anchor;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0 || lon === 0) return null;
  if (dates.length === 0) return null;
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return null;
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    from: first,
    to: last,
  });
  return `${ENDPOINT}?${params.toString()}`;
}

/**
 * La reponse de la route, lue sans invention.
 *
 * Exigee : exactement une journee par date demandee, dans le meme ordre. Sinon
 * on refuse tout : aligner une serie decalee ferait dire au jour 1 la meteo
 * d une autre date, ce qui est exactement le mensonge a eviter.
 */
export function readWeatherResponse(
  payload: unknown,
  dates: readonly string[],
): DayWeather[] | null {
  const body = payload as { status?: unknown; days?: unknown } | null;
  if (!body || body.status !== 'ok' || !Array.isArray(body.days)) return null;
  if (body.days.length !== dates.length) return null;

  const days: DayWeather[] = [];
  for (let index = 0; index < dates.length; index += 1) {
    const raw = body.days[index] as Record<string, unknown> | null;
    if (!raw || raw.date !== dates[index]) return null;
    const code = numberOrNull(raw.code);
    days.push({
      date: dates[index],
      tMaxC: numberOrNull(raw.tMaxC),
      tMinC: numberOrNull(raw.tMinC),
      precipMm: numberOrNull(raw.precipMm),
      precipProbPct: numberOrNull(raw.precipProbPct),
      windMaxKmh: numberOrNull(raw.windMaxKmh),
      code,
      // Le libelle est RECALCULE depuis le code WMO : un libelle venu du reseau
      // n a pas sa place dans un ecran qui promet des donnees verifiees.
      label: code === null ? '' : weatherLabel(code),
    });
  }
  return days;
}

/**
 * La prevision des journees demandees, ou `null` si elle n est pas fiable.
 *
 * `onProvider` est appele UNIQUEMENT quand la serie a ete ACCEPTEE : une
 * reponse decalee, un 503 ou un corps illisible ne nomment personne. C est la
 * regle du routage (`browserMeasurements.ts`), et c est elle qui distingue un
 * credit d une intention. Sans elle, un 503 de la route se retrouverait
 * attribue a Open-Meteo alors que personne n avait repondu.
 *
 * `fetcher` rend la meteoInjectable comme le routage. Sans ce parametre, ce
 * module ignorait le `fetch` que `browserMeasurementRunners` recoit et
 * allait chercher le global : le credit de la meteo n etait donc ni testable,
 * ni provenable, et le seul chemin serie de mesure a contourner le point
 * d injection unique du fichier. Il vaut le `fetch` global par defaut, donc
 * l appel navigateur ne change rien.
 */
export async function fetchWeatherThroughApi(
  anchor: WeatherAnchorLike,
  dates: readonly string[],
  signal?: AbortSignal,
  onProvider?: WeatherProviderListener,
  fetcher: WeatherFetcher = fetch,
): Promise<DayWeather[] | null> {
  const query = weatherQuery(anchor, dates);
  if (!query) return null;
  try {
    const response = await fetcher(query, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const body = (await response.json()) as unknown;
    const days = readWeatherResponse(body, dates);
    if (!days) return null;
    // La provenance se lit ICI, sur la reponse qui porte la mesure, et nulle
    // part ailleurs : apres coup, une serie de temperatures ne dit plus quelle
    // route l a produite.
    const provider = readWeatherProvider(body);
    if (provider && onProvider) onProvider(provider);
    return days;
  } catch {
    return null;
  }
}
