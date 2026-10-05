import { parseMetNo, symbolToWmo, localStamp } from '@/features/compas/engine/metno';

/**
 * Pont MET Norway → forme de réponse Open-Meteo.
 *
 * Plusieurs modules de l'app (page Pays, Matériel, cockpit Randonnée, Partir
 * librement) lisent des réponses au format Open-Meteo. Open-Meteo n'est gratuit
 * qu'en usage non commercial ; MET Norway (CC BY 4.0) l'est aussi en usage
 * commercial. Ce module rend la prévision MET Norway dans la forme attendue,
 * pour que chaque appelant ne change que sa requête.
 *
 * Ce que MET Norway ne publie pas reste `null` (probabilité de pluie hors
 * Nordiques, rafales) : jamais comblé. L'indice UV est celui « par ciel
 * clair » publié par MET.
 */

export const METNO_ATTRIBUTION = 'MET Norway (CC BY 4.0)';

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

interface Step {
  time?: unknown;
  data?: {
    instant?: { details?: Record<string, unknown> };
    next_1_hours?: { summary?: { symbol_code?: unknown }; details?: Record<string, unknown> };
    next_6_hours?: { summary?: { symbol_code?: unknown }; details?: Record<string, unknown> };
  };
}

export interface OpenMeteoLike {
  timezone: string;
  current: {
    time: string;
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number | null;
    relative_humidity_2m: number | null;
  } | null;
  current_weather: { temperature: number; weathercode: number; windspeed: number | null } | null;
  hourly: {
    time: string[];
    temperature_2m: (number | null)[];
    precipitation_probability: (number | null)[];
    precipitation: (number | null)[];
    weather_code: (number | null)[];
    weathercode: (number | null)[];
    wind_speed_10m: (number | null)[];
    relative_humidity_2m: (number | null)[];
    uv_index: (number | null)[];
  };
  daily: {
    time: string[];
    weather_code: (number | null)[];
    weathercode: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
    precipitation_probability_max: (number | null)[];
    wind_gusts_10m_max: (number | null)[];
    sunrise: (string | null)[];
    sunset: (string | null)[];
  };
}

/** Réponse `locationforecast/2.0/complete` → forme Open-Meteo (heure locale du lieu). */
export function metnoToOpenMeteo(payload: unknown, timeZone: string): OpenMeteoLike | null {
  const series = (payload as { properties?: { timeseries?: unknown } } | null)?.properties?.timeseries;
  if (!Array.isArray(series) || series.length === 0) return null;
  const steps = series as Step[];

  const hourly: OpenMeteoLike['hourly'] = {
    time: [],
    temperature_2m: [],
    precipitation_probability: [],
    precipitation: [],
    weather_code: [],
    weathercode: [],
    wind_speed_10m: [],
    relative_humidity_2m: [],
    uv_index: [],
  };
  // Seuls les pas horaires (les ~60 premières heures) alimentent la série horaire.
  for (const st of steps) {
    if (typeof st.time !== 'string' || !st.data?.next_1_hours) continue;
    const at = new Date(st.time);
    if (Number.isNaN(at.getTime())) continue;
    const inst = st.data.instant?.details ?? {};
    const p1 = st.data.next_1_hours;
    const code = symbolToWmo(p1.summary?.symbol_code);
    const wind = num(inst.wind_speed);
    hourly.time.push(localStamp(at, timeZone));
    hourly.temperature_2m.push(num(inst.air_temperature));
    hourly.precipitation_probability.push(num(p1.details?.probability_of_precipitation));
    hourly.precipitation.push(num(p1.details?.precipitation_amount));
    hourly.weather_code.push(code);
    hourly.weathercode.push(code);
    hourly.wind_speed_10m.push(wind == null ? null : Math.round(wind * 3.6 * 10) / 10);
    hourly.relative_humidity_2m.push(num(inst.relative_humidity));
    hourly.uv_index.push(num(inst.ultraviolet_index_clear_sky));
  }

  const first = steps[0];
  const firstInst = first?.data?.instant?.details ?? {};
  const firstCode = symbolToWmo((first?.data?.next_1_hours ?? first?.data?.next_6_hours)?.summary?.symbol_code);
  const firstTemp = num(firstInst.air_temperature);
  const firstWind = num(firstInst.wind_speed);
  const current =
    firstTemp != null && firstCode != null && typeof first?.time === 'string'
      ? {
          time: localStamp(new Date(first.time), timeZone),
          temperature_2m: firstTemp,
          weather_code: firstCode,
          wind_speed_10m: firstWind == null ? null : Math.round(firstWind * 3.6 * 10) / 10,
          relative_humidity_2m: num(firstInst.relative_humidity),
        }
      : null;

  const days = parseMetNo(payload, timeZone);
  const daily: OpenMeteoLike['daily'] = {
    time: days.map((d) => d.date),
    weather_code: days.map((d) => d.code),
    weathercode: days.map((d) => d.code),
    temperature_2m_max: days.map((d) => d.tMax),
    temperature_2m_min: days.map((d) => d.tMin),
    precipitation_sum: days.map((d) => d.precipMm),
    precipitation_probability_max: days.map((d) => d.precipPct),
    wind_gusts_10m_max: days.map((d) => d.gustMax),
    sunrise: days.map((d) => (d.sunrise ? `${d.date}T${d.sunrise}` : null)),
    sunset: days.map((d) => (d.sunset ? `${d.date}T${d.sunset}` : null)),
  };

  return {
    timezone: timeZone,
    current,
    current_weather: current
      ? { temperature: current.temperature_2m, weathercode: current.weather_code, windspeed: current.wind_speed_10m }
      : null,
    hourly,
    daily,
  };
}
