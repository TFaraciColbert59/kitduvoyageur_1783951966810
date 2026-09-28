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

import { weatherLabel, type DayWeather } from './engine/weather';

const ENDPOINT = '/api/weather';

export interface WeatherAnchorLike {
  readonly lat: number;
  readonly lon: number;
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

/** La prevision des journees demandees, ou `null` si elle n est pas fiable. */
export async function fetchWeatherThroughApi(
  anchor: WeatherAnchorLike,
  dates: readonly string[],
  signal?: AbortSignal,
): Promise<DayWeather[] | null> {
  const query = weatherQuery(anchor, dates);
  if (!query) return null;
  try {
    const response = await fetch(query, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return readWeatherResponse((await response.json()) as unknown, dates);
  } catch {
    return null;
  }
}
