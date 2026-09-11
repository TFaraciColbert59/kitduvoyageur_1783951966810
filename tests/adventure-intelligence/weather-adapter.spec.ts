/**
 * A11 #15/#40 — Météo réelle quand les coordonnées existent (TEST-A11-WX-01..04).
 *
 * Le service météo existant (`getWeather`, Open-Meteo) est mocké : présent,
 * absent, erreur fournisseur et aucune fabrication. La météo officielle est
 * injectée dans `sections.liveConditions` du plan (la liste normative de 19
 * sections ne comporte pas de clé `weather`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WeatherForecast } from '@/features/materiel/services/getWeather';

const weatherMock = vi.hoisted(() => ({
  getWeather: vi.fn(),
}));

vi.mock('@/features/materiel/services/getWeather', () => ({
  getWeather: weatherMock.getWeather,
}));

import {
  DEFAULT_WEATHER_DAYS,
  WEATHER_NO_COORDINATES_WARNING,
  WEATHER_PROVIDER,
  WEATHER_PROVIDER_UNAVAILABLE_WARNING,
  weatherAdapter,
} from '@/features/adventure-intelligence/server/adapters/weatherAdapter';
import { EngineSkipSignal } from '@/features/adventure-intelligence/domain/engineRegistry';
import type { AdventureExecutionContext } from '@/features/adventure-intelligence/domain/engine';
import {
  generateAdventure,
  type AdventureEnginePersistence,
} from '@/features/adventure-intelligence/server/generateAdventure';
import { createDefaultRegistry } from '@/features/adventure-intelligence/server/adapters';

const OWNER_ID = 'a1100000-0000-4000-8000-0000000000w1';
const PLAN_ID = 'a1100000-0000-4000-8000-0000000000w2';
const NOW = '2026-09-11T12:00:00.000Z';
const TEXT = 'Trek de six jours au Massif du Sancy en juillet en refuge';

const CONTEXT: AdventureExecutionContext = { userId: OWNER_ID, nowIso: NOW };

function forecast(days = 5): WeatherForecast {
  return {
    cells: [
      { hour: '08:00', tempC: 12, precipPct: 10, weathercode: 3 },
      { hour: '09:00', tempC: 14, precipPct: 20, weathercode: 61 },
    ],
    days: Array.from({ length: days }, (_, index) => ({
      date: `2026-09-${String(20 + index).padStart(2, '0')}`,
      day: index === 0 ? 'Auj.' : 'Lun',
      tempMinC: 8 + index,
      tempMaxC: 18 + index,
      precipPct: 15 + index,
      weathercode: index % 2 === 0 ? 3 : 61,
    })),
    current: { tempC: 14, weathercode: 3, precipPct: 20 },
    location: { latitude: 45.53, longitude: 2.81, label: 'Massif du Sancy' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('A11 — météo réelle (TEST-A11-WX)', () => {
  it('TEST-A11-WX-01: coordonnées présentes ⇒ prévisions officielles avec provenance du fournisseur', async () => {
    weatherMock.getWeather.mockResolvedValue(forecast(5));

    const result = await weatherAdapter.run(
      { coordinates: { lat: 45.53, lng: 2.81 }, weatherDays: 3, label: 'Massif du Sancy' },
      CONTEXT
    );

    expect(weatherMock.getWeather).toHaveBeenCalledTimes(1);
    expect(weatherMock.getWeather).toHaveBeenCalledWith(45.53, 2.81, 'Massif du Sancy', 3);
    expect(result.value.provider).toBe(WEATHER_PROVIDER);
    expect(result.value.days).toHaveLength(3);
    expect(result.provenance[0]).toMatchObject({
      source: 'official',
      sourceRef: WEATHER_PROVIDER,
      observedAt: NOW,
    });
    expect(result.confidence.score).toBeGreaterThan(0);
    expect(result.computedAt).toBe(NOW);
    expect(result.warnings).toEqual([]);
  });

  it('TEST-A11-WX-02: coordonnées absentes ⇒ skip explicite, jamais d’appel fournisseur', async () => {
    await expect(weatherAdapter.run({}, CONTEXT)).rejects.toMatchObject({
      warning: WEATHER_NO_COORDINATES_WARNING,
    });
    await expect(weatherAdapter.run({}, CONTEXT)).rejects.toBeInstanceOf(EngineSkipSignal);

    const missing = await weatherAdapter
      .run({ coordinates: { lat: Number.NaN, lng: 2.81 } }, CONTEXT)
      .catch((error: unknown) => error);
    expect(missing).toBeInstanceOf(EngineSkipSignal);
    expect((missing as EngineSkipSignal).warning.code).toBe('weather_no_deterministic_source');

    expect(weatherMock.getWeather).not.toHaveBeenCalled();
  });

  it('TEST-A11-WX-03: erreur fournisseur ⇒ repli explicite, aucune donnée fabriquée', async () => {
    weatherMock.getWeather.mockRejectedValue(new Error('Open-Meteo indisponible'));

    const rejection = await weatherAdapter
      .run({ coordinates: { lat: 45.53, lng: 2.81 } }, CONTEXT)
      .catch((error: unknown) => error);

    expect(rejection).toBeInstanceOf(EngineSkipSignal);
    expect((rejection as EngineSkipSignal).warning).toEqual(WEATHER_PROVIDER_UNAVAILABLE_WARNING);

    weatherMock.getWeather.mockResolvedValue(null);
    const empty = await weatherAdapter
      .run({ coordinates: { lat: 45.53, lng: 2.81 } }, CONTEXT)
      .catch((error: unknown) => error);
    expect(empty).toBeInstanceOf(EngineSkipSignal);
    expect((empty as EngineSkipSignal).warning.code).toBe('weather_provider_unavailable');
  });

  it('TEST-A11-WX-04: jamais de journée inventée et injection dans liveConditions sans coordonnées', async () => {
    weatherMock.getWeather.mockResolvedValue(forecast(2));

    const partial = await weatherAdapter.run(
      { coordinates: { lat: 45.53, lng: 2.81 }, weatherDays: DEFAULT_WEATHER_DAYS },
      CONTEXT
    );
    expect(partial.value.days).toHaveLength(2);
    expect(partial.warnings.map((warning) => warning.code)).toContain('weather_forecast_partial');

    const versions: Record<string, unknown>[] = [];
    const persistence: AdventureEnginePersistence = {
      persistPlanBundle: async (bundle) => {
        versions.push(bundle.version);
        return { id: PLAN_ID };
      },
      insertEngineRun: async () => {},
    };
    const deps = {
      registry: createDefaultRegistry(),
      persistence,
      hasActiveConsent: async () => false,
      getCurrentProfile: async () => null,
      persistAdventurePredictions: async () => {},
    };

    const withWeather = await generateAdventure(
      { ownerId: OWNER_ID, text: TEXT, now: NOW, coordinates: { lat: 45.53, lng: 2.81 } },
      deps
    );
    expect(withWeather.plan.sections.liveConditions).not.toBeNull();
    expect(withWeather.plan.sections.liveConditions?.provenance[0].source).toBe('official');
    expect(
      (withWeather.plan.sections.liveConditions?.value as { days: unknown[] }).days
    ).toHaveLength(2);
    expect(withWeather.runs.some((run) => run.engineId === 'weather' && run.status === 'succeeded')).toBe(
      true
    );

    vi.clearAllMocks();
    const withoutWeather = await generateAdventure(
      { ownerId: OWNER_ID, text: TEXT, now: NOW },
      deps
    );
    expect(withoutWeather.plan.sections.liveConditions).toBeNull();
    expect(weatherMock.getWeather).not.toHaveBeenCalled();
    expect(
      withoutWeather.runs.some((run) => run.engineId === 'weather' && run.status === 'skipped')
    ).toBe(true);
    expect(versions).toHaveLength(2);
  });
});
