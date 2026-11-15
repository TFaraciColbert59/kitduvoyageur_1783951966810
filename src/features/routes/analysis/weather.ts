/**
 * K2.24 · Prévisions météo le long du parcours.
 *
 * La série horaire est fournie par l'appelant (MET Norway côté serveur) ; ce
 * module ne fait aucun appel. Il échantillonne l'heure la plus proche pour
 * chaque point, à l'heure de passage estimée, et conserve source, fraîcheur,
 * fuseau et couverture. Une heure hors série reste `missing`, jamais comblée.
 *
 * Une prévision n'est pas une alerte officielle : `officialAlerts` reste
 * explicitement indisponible tant qu'aucune API d'alerte n'est branchée.
 */
import {
  isFiniteNumber,
  type AnalysisGap,
  type AnalysisStatus,
  type AnalysisWarning,
} from './types';
import {
  parseInstant,
  round,
  routeSamples,
  toIso,
  type GeoPointInput,
} from './geo';

export interface WeatherHourInput {
  /** ISO 8601, avec fuseau (`Z`, `+02:00`) ou heure locale du champ `timezone`. */
  readonly time: string;
  readonly temperatureC?: number | null;
  readonly windKmH?: number | null;
  readonly windGustKmH?: number | null;
  readonly precipitationMm?: number | null;
  readonly precipitationProbability?: number | null;
  readonly weatherCode?: number | null;
}

export interface WeatherSeries {
  readonly source: string;
  readonly attribution: string;
  readonly fetchedAt: string | null;
  /** Fin de validité annoncée par la source, si elle en publie une. */
  readonly validUntil?: string | null;
  /** Fuseau IANA utilisé pour les heures sans offset. */
  readonly timezone: string;
  readonly hours: readonly WeatherHourInput[];
}

export interface RouteWeatherInput {
  readonly points?: readonly GeoPointInput[] | null;
  readonly series: WeatherSeries | null;
  readonly startAt: string;
  /** Durée totale estimée ; prioritaire sur `speedKmH`. */
  readonly durationS?: number | null;
  readonly speedKmH?: number | null;
  /** Écart maximal accepté entre l'heure de passage et l'heure de prévision. */
  readonly maxOffsetMinutes?: number | null;
}

export interface WeatherMatch {
  readonly status: 'forecast' | 'missing';
  readonly hour: WeatherHourInput | null;
  readonly forecastTime: string | null;
  readonly offsetMinutes: number | null;
  readonly missingFields: string[];
}

export interface RouteWeatherSample {
  readonly lat: number;
  readonly lon: number;
  readonly distanceM: number;
  readonly etaIso: string | null;
  readonly status: 'forecast' | 'missing';
  readonly forecastTime: string | null;
  readonly offsetMinutes: number | null;
  readonly temperatureC: number | null;
  readonly windKmH: number | null;
  readonly windGustKmH: number | null;
  readonly precipitationMm: number | null;
  readonly precipitationProbability: number | null;
  readonly weatherCode: number | null;
  readonly condition: string | null;
  readonly missingFields: string[];
}

export interface RouteWeatherAnalysis {
  readonly status: AnalysisStatus;
  readonly source: string | null;
  readonly attribution: string | null;
  readonly fetchedAt: string | null;
  readonly validUntil: string | null;
  readonly timezone: string | null;
  readonly coverage: {
    readonly samples: number;
    readonly withForecast: number;
    readonly ratio: number;
  };
  readonly samples: RouteWeatherSample[];
  readonly summary: {
    readonly minTemperatureC: number | null;
    readonly maxTemperatureC: number | null;
    readonly maxWindKmH: number | null;
    readonly maxGustKmH: number | null;
    readonly maxPrecipitationMm: number | null;
    readonly maxPrecipitationProbability: number | null;
    readonly rainRisk: 'none' | 'possible' | 'likely' | 'unknown';
    readonly windRisk: 'none' | 'caution' | 'strong' | 'unknown';
    readonly stormRisk: 'none' | 'possible' | 'unknown';
  };
  readonly officialAlerts: {
    readonly status: 'unavailable';
    readonly reason: 'official_alert_source_unavailable';
    readonly message: string;
  };
  readonly missing: AnalysisGap[];
  readonly warnings: AnalysisWarning[];
  readonly method: {
    readonly id: string;
    readonly sampling: 'nearest_hour';
    readonly maxOffsetMinutes: number;
    readonly etaBasis: 'duration' | 'speed' | null;
  };
}

const DEFAULT_MAX_OFFSET_MINUTES = 90;

/** Libellé français d'un code WMO ; `null` si le code est absent ou inconnu. */
export function conditionFromCode(code: number | null | undefined): string | null {
  if (!isFiniteNumber(code)) return null;
  if (code === 0) return 'Ciel dégagé';
  if (code >= 1 && code <= 3) return 'Partiellement nuageux';
  if (code === 45 || code === 48) return 'Brouillard';
  if (code >= 51 && code <= 57) return 'Bruine';
  if (code >= 61 && code <= 67) return 'Pluie';
  if (code >= 71 && code <= 77) return 'Neige';
  if (code >= 80 && code <= 82) return 'Averses';
  if (code >= 85 && code <= 86) return 'Averses de neige';
  if (code >= 95 && code <= 99) return 'Orage';
  return null;
}

function missingFields(hour: WeatherHourInput): string[] {
  const fields: string[] = [];
  if (!isFiniteNumber(hour.temperatureC)) fields.push('temperature');
  if (!isFiniteNumber(hour.windKmH)) fields.push('wind');
  if (!isFiniteNumber(hour.precipitationMm) && !isFiniteNumber(hour.precipitationProbability)) {
    fields.push('precipitation');
  }
  return fields;
}

function nearestHour(
  series: WeatherSeries,
  atMs: number,
  maxOffsetMinutes: number
): WeatherMatch {
  let best: { hour: WeatherHourInput; timeMs: number; offsetMinutes: number } | null = null;
  for (const hour of series.hours) {
    const timeMs = parseInstant(hour.time, series.timezone);
    if (timeMs === null) continue;
    const offsetMinutes = (atMs - timeMs) / 60_000;
    if (
      best === null ||
      Math.abs(offsetMinutes) < Math.abs(best.offsetMinutes)
    ) {
      best = { hour, timeMs, offsetMinutes };
    }
  }
  if (!best || Math.abs(best.offsetMinutes) > maxOffsetMinutes) {
    return {
      status: 'missing',
      hour: null,
      forecastTime: null,
      offsetMinutes: best ? round(best.offsetMinutes, 0) : null,
      missingFields: ['forecast_hour'],
    };
  }
  return {
    status: 'forecast',
    hour: best.hour,
    forecastTime: best.hour.time,
    offsetMinutes: round(best.offsetMinutes, 0),
    missingFields: missingFields(best.hour),
  };
}

/** Échantillonne la série à un instant donné ; exporté pour S2.03. */
export function matchWeatherAt(
  series: WeatherSeries | null,
  atMs: number | null,
  maxOffsetMinutes = DEFAULT_MAX_OFFSET_MINUTES
): WeatherMatch {
  if (!series || series.hours.length === 0 || atMs === null || !Number.isFinite(atMs)) {
    return {
      status: 'missing',
      hour: null,
      forecastTime: null,
      offsetMinutes: null,
      missingFields: ['forecast_hour'],
    };
  }
  return nearestHour(series, atMs, maxOffsetMinutes);
}

function maxOf(
  samples: readonly RouteWeatherSample[],
  pick: (sample: RouteWeatherSample) => number | null
): number | null {
  let max: number | null = null;
  for (const sample of samples) {
    const value = pick(sample);
    if (value === null || !Number.isFinite(value)) continue;
    max = max === null ? value : Math.max(max, value);
  }
  return max;
}

function minOf(
  samples: readonly RouteWeatherSample[],
  pick: (sample: RouteWeatherSample) => number | null
): number | null {
  let min: number | null = null;
  for (const sample of samples) {
    const value = pick(sample);
    if (value === null || !Number.isFinite(value)) continue;
    min = min === null ? value : Math.min(min, value);
  }
  return min;
}

export function analyzeRouteWeather(input: RouteWeatherInput): RouteWeatherAnalysis {
  const maxOffsetMinutes = isFiniteNumber(input.maxOffsetMinutes)
    ? Math.max(0, input.maxOffsetMinutes)
    : DEFAULT_MAX_OFFSET_MINUTES;
  const officialAlerts = {
    status: 'unavailable' as const,
    reason: 'official_alert_source_unavailable' as const,
    message:
      'Aucune API d’alerte météo officielle n’est branchée : les risques affichés sont dérivés de la prévision, jamais présentés comme une alerte officielle.',
  };
  const empty = (missing: AnalysisGap[], warnings: AnalysisWarning[] = []): RouteWeatherAnalysis => ({
    status: 'unavailable',
    source: input.series?.source ?? null,
    attribution: input.series?.attribution ?? null,
    fetchedAt: input.series?.fetchedAt ?? null,
    validUntil: input.series?.validUntil ?? null,
    timezone: input.series?.timezone ?? null,
    coverage: { samples: 0, withForecast: 0, ratio: 0 },
    samples: [],
    summary: {
      minTemperatureC: null,
      maxTemperatureC: null,
      maxWindKmH: null,
      maxGustKmH: null,
      maxPrecipitationMm: null,
      maxPrecipitationProbability: null,
      rainRisk: 'unknown',
      windRisk: 'unknown',
      stormRisk: 'unknown',
    },
    officialAlerts,
    missing,
    warnings,
    method: {
      id: 'lkdv-route-weather/1',
      sampling: 'nearest_hour',
      maxOffsetMinutes,
      etaBasis: null,
    },
  });

  const series = input.series;
  if (!series || series.hours.length === 0) {
    return empty([
      {
        code: 'weather_source_unavailable',
        message: 'Aucune série météo fournie : les conditions du parcours restent inconnues.',
      },
    ]);
  }

  const points = routeSamples(input.points ?? []);
  if (points.length < 2) {
    return empty([
      {
        code: 'route_geometry_unavailable',
        message: 'La géométrie du parcours est absente : la météo ne peut pas être positionnée.',
      },
    ]);
  }

  const startMs = parseInstant(input.startAt, series.timezone);
  if (startMs === null) {
    return empty([
      {
        code: 'start_time_invalid',
        message: 'L’heure de départ est absente ou invalide : les heures de passage sont inconnues.',
      },
    ]);
  }

  const totalDistanceM = points[points.length - 1].distanceM;
  const durationS = isFiniteNumber(input.durationS) ? Math.max(0, input.durationS) : null;
  const speedKmH = isFiniteNumber(input.speedKmH) ? input.speedKmH : null;
  if ((durationS === null || durationS <= 0) && (speedKmH === null || speedKmH <= 0)) {
    return empty([
      {
        code: 'eta_unavailable',
        message:
          'Ni durée ni vitesse de parcours ne sont fournies : les heures de passage ne peuvent pas être estimées.',
      },
    ]);
  }
  const etaBasis: 'duration' | 'speed' = durationS !== null && durationS > 0 ? 'duration' : 'speed';

  const samples: RouteWeatherSample[] = [];
  for (const point of points) {
    const ratio = totalDistanceM > 0 ? point.distanceM / totalDistanceM : 0;
    const etaMs =
      etaBasis === 'duration'
        ? startMs + ratio * (durationS ?? 0) * 1000
        : startMs + (point.distanceM / ((speedKmH ?? 0) * 1000)) * 3_600_000;
    const match = matchWeatherAt(series, etaMs, maxOffsetMinutes);
    const hour = match.hour;
    samples.push({
      lat: point.lat,
      lon: point.lon,
      distanceM: round(point.distanceM, 1),
      etaIso: toIso(etaMs),
      status: match.status,
      forecastTime: match.forecastTime,
      offsetMinutes: match.offsetMinutes,
      temperatureC: isFiniteNumber(hour?.temperatureC) ? hour.temperatureC : null,
      windKmH: isFiniteNumber(hour?.windKmH) ? hour.windKmH : null,
      windGustKmH: isFiniteNumber(hour?.windGustKmH) ? hour.windGustKmH : null,
      precipitationMm: isFiniteNumber(hour?.precipitationMm) ? hour.precipitationMm : null,
      precipitationProbability: isFiniteNumber(hour?.precipitationProbability)
        ? hour.precipitationProbability
        : null,
      weatherCode: isFiniteNumber(hour?.weatherCode) ? hour.weatherCode : null,
      condition: conditionFromCode(hour?.weatherCode),
      missingFields: match.missingFields,
    });
  }

  const withForecast = samples.filter((sample) => sample.status === 'forecast').length;
  const coverage = {
    samples: samples.length,
    withForecast,
    ratio: samples.length > 0 ? round(withForecast / samples.length, 4) : 0,
  };

  const forecastSamples = samples.filter((sample) => sample.status === 'forecast');
  const maxProbability = maxOf(forecastSamples, (sample) => sample.precipitationProbability);
  const maxPrecipitation = maxOf(forecastSamples, (sample) => sample.precipitationMm);
  const rainRisk =
    maxProbability === null && maxPrecipitation === null
      ? 'unknown'
      : (maxProbability ?? 0) >= 60 || (maxPrecipitation ?? 0) >= 2
        ? 'likely'
        : (maxProbability ?? 0) >= 30 || (maxPrecipitation ?? 0) > 0.2
          ? 'possible'
          : 'none';

  const windValues = forecastSamples.flatMap((sample) =>
    [sample.windKmH, sample.windGustKmH].filter(
      (value): value is number => value !== null && Number.isFinite(value)
    )
  );
  const maxWind = windValues.length > 0 ? Math.max(...windValues) : null;
  const windRisk =
    maxWind === null ? 'unknown' : maxWind >= 60 ? 'strong' : maxWind >= 40 ? 'caution' : 'none';
  const codes = forecastSamples
    .map((sample) => sample.weatherCode)
    .filter((code): code is number => code !== null);
  const stormRisk =
    codes.length === 0 ? 'unknown' : codes.some((code) => code >= 95) ? 'possible' : 'none';

  const missing: AnalysisGap[] = [];
  if (withForecast < samples.length) {
    missing.push({
      code: 'weather_horizon_incomplete',
      message: `${samples.length - withForecast} point(s) hors de la fenêtre de prévision : aucune valeur n’est extrapolée.`,
    });
  }
  const fieldsMissing = samples.some((sample) => sample.missingFields.length > 0);
  if (fieldsMissing) {
    missing.push({
      code: 'weather_fields_missing',
      message: 'Certains champs (vent, pluie) sont absents de la série et restent inconnus.',
    });
  }

  const warnings: AnalysisWarning[] = [];
  if (
    samples.some(
      (sample) =>
        sample.status === 'missing' &&
        sample.offsetMinutes !== null &&
        Math.abs(sample.offsetMinutes) > maxOffsetMinutes
    )
  ) {
    warnings.push({
      code: 'weather_offset_exceeded',
      message: `Aucune prévision à moins de ${maxOffsetMinutes} min de certains passages.`,
      severity: 'warning',
    });
  }

  const status: AnalysisStatus =
    withForecast === 0
      ? 'unavailable'
      : withForecast < samples.length || fieldsMissing
        ? 'partial'
        : 'available';

  return {
    status,
    source: series.source,
    attribution: series.attribution,
    fetchedAt: series.fetchedAt,
    validUntil: series.validUntil ?? null,
    timezone: series.timezone,
    coverage,
    samples,
    summary: {
      minTemperatureC: minOf(forecastSamples, (sample) => sample.temperatureC),
      maxTemperatureC: maxOf(forecastSamples, (sample) => sample.temperatureC),
      maxWindKmH: maxOf(forecastSamples, (sample) => sample.windKmH),
      maxGustKmH: maxOf(forecastSamples, (sample) => sample.windGustKmH),
      maxPrecipitationMm: maxPrecipitation,
      maxPrecipitationProbability: maxProbability,
      rainRisk,
      windRisk,
      stormRisk,
    },
    officialAlerts,
    missing,
    warnings,
    method: {
      id: 'lkdv-route-weather/1',
      sampling: 'nearest_hour',
      maxOffsetMinutes,
      etaBasis,
    },
  };
}
