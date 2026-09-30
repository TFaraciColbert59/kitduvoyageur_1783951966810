/**
 * A11 #15/#40 — Adaptateur météo réelle (Open-Meteo via le service existant).
 *
 * Quand des coordonnées valides sont fournies, la prévision officielle est
 * récupérée par `getWeather` (client existant, aucun nouvel appelant API) et
 * publiée avec provenance `official` (source = fournisseur). Sans coordonnées
 * ou en cas d'échec fournisseur, l'adaptateur skippe explicitement : aucune
 * prévision n'est jamais inventée.
 */
import 'server-only';
import {
  getWeather,
  type WeatherDay,
  type WeatherForecast,
} from '@/features/materiel/services/getWeather';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';
import {
  makeEngineResult,
  type AdventureEngine,
  type EngineWarning,
} from '@/features/adventure-intelligence/domain/engine';
import { EngineSkipSignal } from '@/features/adventure-intelligence/domain/engineRegistry';
import { ADAPTER_VERSION } from './adapterSupport';

/** Fournisseur officiel des prévisions (Open-Meteo, sans clé). */
export const WEATHER_PROVIDER = 'open-meteo';
export const DEFAULT_WEATHER_DAYS = 3;
export const MIN_WEATHER_DAYS = 1;
export const MAX_WEATHER_DAYS = 7;

export const WEATHER_NO_COORDINATES_WARNING: EngineWarning = {
  code: 'weather_no_deterministic_source',
  message:
    'Aucune coordonnée fournie — météo non récupérée, section liveConditions laissée vide (aucune donnée inventée).',
  severity: 'warning',
};

export const WEATHER_PROVIDER_UNAVAILABLE_WARNING: EngineWarning = {
  code: 'weather_provider_unavailable',
  message:
    'Prévisions indisponibles auprès du fournisseur météo — section liveConditions laissée vide (aucune donnée inventée).',
  severity: 'warning',
};

/** Horizon maximal de prévision du fournisseur (Open-Meteo : 16 jours). */
export const PROVIDER_FORECAST_HORIZON_DAYS = 16;

export const WEATHER_BEYOND_HORIZON_WARNING: EngineWarning = {
  code: 'weather_beyond_forecast_horizon',
  message:
    'Départ au-delà de l’horizon de prévision — aucune prévision possible à cette date : se fier à la tendance saisonnière et revérifier à l’approche (aucune donnée inventée).',
  severity: 'info',
};

export interface WeatherCoordinates {
  lat: number;
  lng: number;
}

export interface WeatherAdapterInput {
  route?: unknown;
  coordinates?: WeatherCoordinates | null;
  weatherDays?: number;
  label?: string | null;
  /**
   * Chantier configurateur (L0.8) — date de départ réelle (ISO). Absente : la
   * prévision part d'aujourd'hui (comportement historique). Présente : seules
   * les journées DU VOYAGE sont retenues, jamais la météo d'une autre date.
   */
  departureDay?: string | null;
  /** Durée réelle du voyage (jours), pour compter les jours hors prévision. */
  tripDays?: number | null;
}

export interface WeatherHorizon {
  departureDay: string;
  /** Jours du voyage couverts par une prévision réelle. */
  coveredDays: number;
  /** Jours du voyage sans prévision possible (tendance saisonnière). */
  beyondHorizonDays: number;
}

export interface WeatherAdapterOutput {
  provider: string;
  coordinates: WeatherCoordinates;
  days: WeatherDay[];
  current: WeatherForecast['current'];
  fetchedAt: string;
  /** L0.8 — présent uniquement quand la date de départ est connue. */
  horizon?: WeatherHorizon;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function dayIndex(iso: string): number | null {
  if (!ISO_DAY.test(iso)) return null;
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : null;
}

/**
 * Fenêtre à demander au fournisseur pour couvrir le départ. `null` si le départ
 * est au-delà de l'horizon de prévision. Un départ passé (voyage en cours)
 * repart d'aujourd'hui.
 */
export function forecastWindow(
  nowIso: string,
  departureDay: string,
  requestedDays: number
): { offsetDays: number; forecastDays: number } | null {
  const today = dayIndex(nowIso.slice(0, 10));
  const start = dayIndex(departureDay);
  if (today === null || start === null) return null;
  const offsetDays = Math.max(0, start - today);
  if (offsetDays >= PROVIDER_FORECAST_HORIZON_DAYS) return null;
  return {
    offsetDays,
    forecastDays: Math.min(PROVIDER_FORECAST_HORIZON_DAYS, offsetDays + requestedDays),
  };
}

function normalizeCoordinates(value: WeatherCoordinates | null | undefined): WeatherCoordinates | null {
  if (!value) return null;
  const { lat, lng } = value;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Bornage du nombre de jours demandés (1..7, défaut 3). */
export function clampWeatherDays(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_WEATHER_DAYS;
  return Math.min(MAX_WEATHER_DAYS, Math.max(MIN_WEATHER_DAYS, Math.trunc(value)));
}

export const weatherAdapter: AdventureEngine<WeatherAdapterInput, WeatherAdapterOutput> = {
  id: 'weather',
  version: ADAPTER_VERSION,
  dependencies: ['route'],
  canRun: () => true,
  async run(input, context) {
    const coordinates = normalizeCoordinates(input?.coordinates);
    if (!coordinates) {
      throw new EngineSkipSignal(WEATHER_NO_COORDINATES_WARNING);
    }

    const requestedDays = clampWeatherDays(input?.weatherDays);
    const departureDay =
      typeof input?.departureDay === 'string' && dayIndex(input.departureDay) !== null
        ? input.departureDay
        : null;
    const window = departureDay ? forecastWindow(context.nowIso, departureDay, requestedDays) : null;
    if (departureDay && !window) {
      // Aucun appel fournisseur : la météo d'aujourd'hui ne dit rien du départ.
      throw new EngineSkipSignal(WEATHER_BEYOND_HORIZON_WARNING);
    }

    let forecast: WeatherForecast | null = null;
    try {
      forecast = await getWeather(
        coordinates.lat,
        coordinates.lng,
        input?.label ?? null,
        window ? window.forecastDays : requestedDays
      );
    } catch {
      forecast = null;
    }

    if (!forecast || forecast.days.length === 0) {
      throw new EngineSkipSignal(WEATHER_PROVIDER_UNAVAILABLE_WARNING);
    }

    // Seules les journées du voyage sont gardées. Le fournisseur peut rendre
    // moins de jours que demandé : on ne complète jamais artificiellement.
    const departureIndex = departureDay ? dayIndex(departureDay) : null;
    const todayIndex = dayIndex(context.nowIso.slice(0, 10));
    const firstDay =
      departureIndex !== null && todayIndex !== null ? Math.max(departureIndex, todayIndex) : null;
    const tripDays = forecast.days.filter((day) => {
      if (firstDay === null) return true;
      const index = dayIndex(String(day.date).slice(0, 10));
      return index !== null && index >= firstDay;
    });
    if (tripDays.length === 0) {
      throw new EngineSkipSignal(WEATHER_PROVIDER_UNAVAILABLE_WARNING);
    }
    const days = tripDays.slice(0, requestedDays);
    const warnings: EngineWarning[] = [];
    let horizon: WeatherHorizon | undefined;
    if (departureDay) {
      const total =
        typeof input?.tripDays === 'number' && Number.isFinite(input.tripDays) && input.tripDays >= 1
          ? Math.trunc(input.tripDays)
          : requestedDays;
      const offset = window?.offsetDays ?? 0;
      const forecastable = Math.max(0, Math.min(total, PROVIDER_FORECAST_HORIZON_DAYS - offset));
      horizon = {
        departureDay,
        coveredDays: days.length,
        beyondHorizonDays: Math.max(0, total - forecastable),
      };
      if (horizon.beyondHorizonDays > 0) {
        warnings.push({
          code: 'weather_trend_only',
          message: `${horizon.beyondHorizonDays} jour(s) du voyage au-delà de l’horizon de prévision : tendance saisonnière uniquement, à revérifier à l’approche.`,
          severity: 'info',
        });
      }
    }
    if (days.length < requestedDays) {
      warnings.push({
        code: 'weather_forecast_partial',
        message: `Prévisions disponibles sur ${days.length} jour(s) sur ${requestedDays} demandé(s) — aucune journée n'est inventée.`,
        severity: 'info',
      });
    }

    return makeEngineResult({
      value: {
        provider: WEATHER_PROVIDER,
        coordinates,
        days,
        current: forecast.current,
        fetchedAt: context.nowIso,
        ...(horizon ? { horizon } : {}),
      },
      confidence: makeConfidence({
        score: 0.7,
        sampleCount: 0,
        method: 'weather:open-meteo',
        reasons: [
          'Prévisions officielles Open-Meteo (fenêtre courte, non personnalisées).',
        ],
      }),
      provenance: [
        {
          source: 'official',
          sourceRef: WEATHER_PROVIDER,
          observedAt: context.nowIso,
          notes: `Prévisions ${days.length} jour(s) pour ${forecast.location.label || `${coordinates.lat},${coordinates.lng}`}`,
        },
      ],
      assumptions: [
        {
          id: 'weather_open_meteo',
          label: 'Prévisions Open-Meteo',
          detail: `${days.length} jour(s) réellement disponibles, jamais complétés artificiellement.`,
        },
      ],
      warnings,
      computedAt: context.nowIso,
    });
  },
};
