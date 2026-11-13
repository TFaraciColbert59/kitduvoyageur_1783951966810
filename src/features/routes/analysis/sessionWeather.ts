/**
 * S2.03 · Météo enregistrée avec la séance.
 *
 * Une séance passée ne peut pas être reconstituée avec la prévision du jour :
 * si aucun snapshot n'a été enregistré, l'état est `unavailable` et le motif
 * le dit. Un snapshot enregistré provient d'une prévision au départ, pas d'une
 * observation : `basis` le distingue explicitement.
 */
import {
  isFiniteNumber,
  type AnalysisGap,
  type AnalysisStatus,
  type AnalysisWarning,
} from './types';
import { isValidLatLon, parseInstant, round, toIso } from './geo';
import {
  conditionFromCode,
  matchWeatherAt,
  type WeatherHourInput,
  type WeatherSeries,
} from './weather';

export interface SessionWeatherSnapshot {
  readonly tempC?: number | null;
  readonly condition?: string | null;
  readonly windKmH?: number | null;
  readonly precipitationProbability?: number | null;
  readonly fetchedAt?: string | null;
  readonly source?: string | null;
  readonly isAlert?: boolean | null;
  readonly alertMessage?: string | null;
}

export interface SessionWeatherInput {
  readonly session: {
    readonly id?: string;
    readonly startedAt: string;
    readonly endedAt?: string | null;
    readonly lat?: number | null;
    readonly lon?: number | null;
    readonly weather?: SessionWeatherSnapshot | null;
  };
  readonly forecast?: WeatherSeries | null;
  readonly now?: string | null;
  readonly maxOffsetMinutes?: number | null;
}

export interface SessionWeatherValue {
  readonly tempC: number | null;
  readonly condition: string | null;
  readonly windKmH: number | null;
  readonly precipitationProbability: number | null;
  readonly fetchedAt: string | null;
  readonly source: string | null;
  readonly isAlert: boolean | null;
  readonly alertMessage: string | null;
}

export interface SessionWeatherAnalysis {
  readonly status: AnalysisStatus;
  readonly kind: 'recorded_session' | 'forecast_at_start' | 'none';
  readonly basis: 'recorded_forecast_at_session' | 'forecast' | null;
  readonly label: string;
  readonly value: SessionWeatherValue | null;
  readonly provenance: {
    readonly source: string | null;
    readonly recordedAt: string | null;
    readonly kind: 'recorded' | 'forecast';
  } | null;
  readonly missing: AnalysisGap[];
  readonly warnings: AnalysisWarning[];
}

function snapshotValue(
  snapshot: SessionWeatherSnapshot,
  source: string | null
): SessionWeatherValue {
  return {
    tempC: isFiniteNumber(snapshot.tempC) ? snapshot.tempC : null,
    condition: snapshot.condition?.trim() || null,
    windKmH: isFiniteNumber(snapshot.windKmH) ? snapshot.windKmH : null,
    precipitationProbability: isFiniteNumber(snapshot.precipitationProbability)
      ? snapshot.precipitationProbability
      : null,
    fetchedAt: snapshot.fetchedAt ?? null,
    source: snapshot.source?.trim() || source,
    isAlert: typeof snapshot.isAlert === 'boolean' ? snapshot.isAlert : null,
    alertMessage: snapshot.alertMessage?.trim() || null,
  };
}

function hasSnapshotValue(value: SessionWeatherValue): boolean {
  return value.tempC !== null || value.condition !== null || value.windKmH !== null;
}

function valueFromHour(hour: WeatherHourInput, source: string, fetchedAt: string | null): SessionWeatherValue {
  return {
    tempC: isFiniteNumber(hour.temperatureC) ? hour.temperatureC : null,
    condition: conditionFromCode(hour.weatherCode),
    windKmH: isFiniteNumber(hour.windKmH) ? hour.windKmH : null,
    precipitationProbability: isFiniteNumber(hour.precipitationProbability)
      ? hour.precipitationProbability
      : null,
    fetchedAt,
    source,
    isAlert: null,
    alertMessage: null,
  };
}

export function analyzeSessionWeather(input: SessionWeatherInput): SessionWeatherAnalysis {
  const warnings: AnalysisWarning[] = [];
  const startedAtMs = parseInstant(input.session.startedAt, input.forecast?.timezone ?? null);
  if (startedAtMs === null) {
    return {
      status: 'unavailable',
      kind: 'none',
      basis: null,
      label: 'Météo indisponible',
      value: null,
      provenance: null,
      missing: [
        {
          code: 'session_time_invalid',
          message: 'L’heure de la séance est absente ou invalide : la météo ne peut pas être datée.',
        },
      ],
      warnings,
    };
  }

  const snapshot = input.session.weather ?? null;
  if (snapshot) {
    const value = snapshotValue(snapshot, null);
    if (!hasSnapshotValue(value)) {
      warnings.push({
        code: 'session_weather_invalid',
        message: 'Le snapshot météo enregistré ne porte aucune valeur exploitable.',
        severity: 'warning',
      });
    } else {
      const missing: AnalysisGap[] = [];
      if (value.tempC === null || value.condition === null) {
        missing.push({
          code: 'session_weather_partial',
          message: 'Température ou condition absente du snapshot enregistré.',
        });
      }
      if (value.fetchedAt === null) {
        warnings.push({
          code: 'session_weather_time_missing',
          message: 'L’heure de récupération du snapshot est absente : fraîcheur inconnue.',
          severity: 'info',
        });
      }
      return {
        status: missing.length > 0 ? 'partial' : 'available',
        kind: 'recorded_session',
        basis: 'recorded_forecast_at_session',
        label: 'Météo enregistrée au départ (prévision)',
        value,
        provenance: {
          source: value.source,
          recordedAt: value.fetchedAt,
          kind: 'recorded',
        },
        missing,
        warnings,
      };
    }
  }

  const nowMs = parseInstant(input.now ?? null, 'UTC') ?? Date.now();
  const endedAtMs = parseInstant(input.session.endedAt ?? null, input.forecast?.timezone ?? null);
  const referenceEndMs = endedAtMs ?? startedAtMs;
  const isPast = referenceEndMs < nowMs;

  if (isPast) {
    return {
      status: 'unavailable',
      kind: 'none',
      basis: null,
      label: 'Météo non enregistrée',
      value: null,
      provenance: null,
      missing: [
        {
          code: 'no_recorded_weather',
          message:
            'Cette séance passée n’a pas de météo enregistrée ; une prévision actuelle ne peut pas la reconstituer.',
        },
      ],
      warnings,
    };
  }

  const { lat, lon } = input.session;
  if (!isValidLatLon(lat, lon)) {
    return {
      status: 'unavailable',
      kind: 'none',
      basis: null,
      label: 'Météo indisponible',
      value: null,
      provenance: null,
      missing: [
        {
          code: 'session_location_missing',
          message: 'La position de la séance est absente : aucune prévision localisée.',
        },
      ],
      warnings,
    };
  }

  const forecast = input.forecast ?? null;
  if (!forecast || forecast.hours.length === 0) {
    return {
      status: 'unavailable',
      kind: 'none',
      basis: null,
      label: 'Météo indisponible',
      value: null,
      provenance: null,
      missing: [
        {
          code: 'forecast_unavailable',
          message: 'Aucune série météo n’est disponible pour cette séance à venir.',
        },
      ],
      warnings,
    };
  }

  const maxOffsetMinutes = isFiniteNumber(input.maxOffsetMinutes)
    ? Math.max(0, input.maxOffsetMinutes)
    : 90;
  const match = matchWeatherAt(forecast, startedAtMs, maxOffsetMinutes);
  if (match.status === 'missing' || !match.hour) {
    return {
      status: 'unavailable',
      kind: 'none',
      basis: null,
      label: 'Météo indisponible',
      value: null,
      provenance: null,
      missing: [
        {
          code: 'forecast_hour_missing',
          message: `Aucune prévision à moins de ${maxOffsetMinutes} min du départ de la séance.`,
        },
      ],
      warnings,
    };
  }

  const value = valueFromHour(match.hour, forecast.source, forecast.fetchedAt);
  const missing: AnalysisGap[] = [];
  if (value.tempC === null || value.condition === null) {
    missing.push({
      code: 'forecast_fields_missing',
      message: 'Température ou condition absente de la prévision au départ.',
    });
  }

  return {
    status: missing.length > 0 ? 'partial' : 'available',
    kind: 'forecast_at_start',
    basis: 'forecast',
    label: `Prévision au départ${match.offsetMinutes === null ? '' : ` (${round(match.offsetMinutes, 0)} min d’écart)`}`,
    value,
    provenance: {
      source: forecast.source,
      recordedAt: toIso(startedAtMs),
      kind: 'forecast',
    },
    missing,
    warnings,
  };
}
