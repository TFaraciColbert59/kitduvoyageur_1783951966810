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

export interface WeatherCoordinates {
  lat: number;
  lng: number;
}

export interface WeatherAdapterInput {
  route?: unknown;
  coordinates?: WeatherCoordinates | null;
  weatherDays?: number;
  label?: string | null;
}

export interface WeatherAdapterOutput {
  provider: string;
  coordinates: WeatherCoordinates;
  days: WeatherDay[];
  current: WeatherForecast['current'];
  fetchedAt: string;
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
    let forecast: WeatherForecast | null = null;
    try {
      forecast = await getWeather(coordinates.lat, coordinates.lng, input?.label ?? null, requestedDays);
    } catch {
      forecast = null;
    }

    if (!forecast || forecast.days.length === 0) {
      throw new EngineSkipSignal(WEATHER_PROVIDER_UNAVAILABLE_WARNING);
    }

    // Le fournisseur peut rendre moins de jours que demandé : on ne complète
    // jamais artificiellement la série.
    const days = forecast.days.slice(0, requestedDays);
    const warnings: EngineWarning[] = [];
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
