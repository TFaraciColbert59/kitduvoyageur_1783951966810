import { describe, expect, it } from 'vitest';
import { analyzeRouteWeather, type WeatherSeries } from '../weather';

const series: WeatherSeries = {
  source: 'MET Norway',
  attribution: 'MET Norway (CC BY 4.0)',
  fetchedAt: '2026-07-01T09:45:00Z',
  timezone: 'UTC',
  hours: [
    {
      time: '2026-07-01T10:00:00Z',
      temperatureC: 12,
      windKmH: 15,
      windGustKmH: 25,
      precipitationMm: 0,
      precipitationProbability: 10,
      weatherCode: 1,
    },
    {
      time: '2026-07-01T11:00:00Z',
      temperatureC: 13,
      windKmH: 35,
      windGustKmH: 50,
      precipitationMm: 0.6,
      precipitationProbability: 70,
      weatherCode: 61,
    },
    {
      time: '2026-07-01T12:00:00Z',
      temperatureC: 14,
      windKmH: 20,
      windGustKmH: 30,
      precipitationMm: 0,
      precipitationProbability: 20,
      weatherCode: 2,
    },
  ],
};

function route() {
  return [
    { lat: 45, lon: 5 },
    { lat: 45, lon: 5.05 },
    { lat: 45, lon: 5.1 },
  ];
}

describe('K2.24 — météo le long du parcours', () => {
  it('échantillonne chaque point à son heure de passage avec vent et pluie', () => {
    const result = analyzeRouteWeather({
      points: route(),
      series,
      startAt: '2026-07-01T10:00:00Z',
      durationS: 7200,
    });

    expect(result.status).toBe('available');
    expect(result.coverage).toEqual({ samples: 3, withForecast: 3, ratio: 1 });
    expect(result.samples[0].temperatureC).toBe(12);
    expect(result.samples[1].windKmH).toBe(35);
    expect(result.samples[1].precipitationProbability).toBe(70);
    expect(result.summary.maxWindKmH).toBe(35);
    expect(result.summary.maxGustKmH).toBe(50);
    expect(result.summary.rainRisk).toBe('likely');
    expect(result.officialAlerts.status).toBe('unavailable');
  });

  it('laisse missing un point hors de la fenêtre de prévision', () => {
    const result = analyzeRouteWeather({
      points: route(),
      series,
      startAt: '2026-07-01T10:00:00Z',
      durationS: 4 * 3600,
      maxOffsetMinutes: 30,
    });

    expect(result.status).toBe('partial');
    expect(result.coverage.withForecast).toBe(2);
    expect(result.samples[2].status).toBe('missing');
    expect(result.missing.map((gap) => gap.code)).toContain('weather_horizon_incomplete');
  });

  it('rend unavailable sans série ou sans heure de passage estimable', () => {
    const noSeries = analyzeRouteWeather({
      points: route(),
      series: null,
      startAt: '2026-07-01T10:00:00Z',
      durationS: 7200,
    });
    expect(noSeries.status).toBe('unavailable');
    expect(noSeries.missing[0].code).toBe('weather_source_unavailable');

    const noEta = analyzeRouteWeather({
      points: route(),
      series,
      startAt: '2026-07-01T10:00:00Z',
    });
    expect(noEta.status).toBe('unavailable');
    expect(noEta.missing[0].code).toBe('eta_unavailable');
  });

  it('interprète une heure locale MET Norway dans le fuseau de la série', () => {
    const localSeries: WeatherSeries = {
      ...series,
      timezone: 'Europe/Paris',
      hours: [
        { ...series.hours[0], time: '2026-07-01T12:00' },
        { ...series.hours[1], time: '2026-07-01T13:00' },
      ],
    };

    const result = analyzeRouteWeather({
      points: route().slice(0, 2),
      series: localSeries,
      startAt: '2026-07-01T10:00:00Z',
      durationS: 3600,
    });

    expect(result.status).toBe('available');
    expect(result.samples[0].offsetMinutes).toBe(0);
    expect(result.samples[1].offsetMinutes).toBe(0);
  });

  it('signale un vent fort comme risque dérivé, jamais comme alerte officielle', () => {
    const windy: WeatherSeries = {
      ...series,
      hours: [{ ...series.hours[0], windKmH: 65, windGustKmH: 80 }],
    };

    const result = analyzeRouteWeather({
      points: route().slice(0, 2),
      series: windy,
      startAt: '2026-07-01T10:00:00Z',
      durationS: 600,
    });

    expect(result.summary.windRisk).toBe('strong');
    expect(result.officialAlerts.reason).toBe('official_alert_source_unavailable');
  });
});
