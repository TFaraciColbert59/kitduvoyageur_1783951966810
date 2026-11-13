import { describe, expect, it } from 'vitest';
import { analyzeSessionWeather } from '../sessionWeather';
import type { WeatherSeries } from '../weather';

const forecast: WeatherSeries = {
  source: 'MET Norway',
  attribution: 'MET Norway (CC BY 4.0)',
  fetchedAt: '2026-07-01T07:00:00Z',
  timezone: 'UTC',
  hours: [
    {
      time: '2026-07-02T08:00:00Z',
      temperatureC: 15,
      windKmH: 10,
      precipitationMm: 0,
      precipitationProbability: 5,
      weatherCode: 1,
    },
  ],
};

describe('S2.03 — météo enregistrée avec la séance', () => {
  it('affiche le snapshot enregistré en le distinguant d’une observation', () => {
    const result = analyzeSessionWeather({
      session: {
        startedAt: '2026-07-01T08:00:00Z',
        endedAt: '2026-07-01T12:00:00Z',
        lat: 45,
        lon: 5,
        weather: {
          tempC: 8,
          condition: 'Pluie',
          windKmH: 20,
          precipitationProbability: 60,
          fetchedAt: '2026-07-01T07:55:00Z',
          source: 'MET Norway',
        },
      },
      now: '2026-07-02T00:00:00Z',
    });

    expect(result.status).toBe('available');
    expect(result.kind).toBe('recorded_session');
    expect(result.basis).toBe('recorded_forecast_at_session');
    expect(result.value?.tempC).toBe(8);
    expect(result.provenance?.kind).toBe('recorded');
    expect(result.label).toContain('prévision');
  });

  it('refuse de reconstituer une séance passée sans snapshot', () => {
    const result = analyzeSessionWeather({
      session: {
        startedAt: '2026-07-01T08:00:00Z',
        endedAt: '2026-07-01T12:00:00Z',
        lat: 45,
        lon: 5,
      },
      forecast,
      now: '2026-07-02T00:00:00Z',
    });

    expect(result.status).toBe('unavailable');
    expect(result.kind).toBe('none');
    expect(result.missing[0].code).toBe('no_recorded_weather');
  });

  it('utilise une prévision au départ pour une séance à venir', () => {
    const result = analyzeSessionWeather({
      session: {
        startedAt: '2026-07-02T08:00:00Z',
        endedAt: '2026-07-02T12:00:00Z',
        lat: 45,
        lon: 5,
      },
      forecast,
      now: '2026-07-01T12:00:00Z',
    });

    expect(result.status).toBe('available');
    expect(result.kind).toBe('forecast_at_start');
    expect(result.basis).toBe('forecast');
    expect(result.value?.tempC).toBe(15);
  });

  it('rend le snapshot partiel si la température manque', () => {
    const result = analyzeSessionWeather({
      session: {
        startedAt: '2026-07-01T08:00:00Z',
        weather: { condition: 'Pluie', windKmH: 20 },
      },
    });

    expect(result.status).toBe('partial');
    expect(result.kind).toBe('recorded_session');
    expect(result.missing.map((gap) => gap.code)).toContain('session_weather_partial');
  });

  it('refuse une séance sans heure exploitable', () => {
    const result = analyzeSessionWeather({
      session: { startedAt: 'pas-une-date', lat: 45, lon: 5 },
    });

    expect(result.status).toBe('unavailable');
    expect(result.missing[0].code).toBe('session_time_invalid');
  });
});
