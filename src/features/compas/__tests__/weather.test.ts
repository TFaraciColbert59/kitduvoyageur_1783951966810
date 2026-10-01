import { describe, expect, it } from 'vitest';
import {
  averageTrend,
  buildCalendar,
  dayQuality,
  departureAdvice,
  hourQuality,
  morningFreezingLevel,
  parseForecast,
  walkingMinutes,
  type HourCondition,
} from '../engine/weather';

const hoursOf = (
  date: string,
  overrides: Record<number, Partial<HourCondition>> = {}
): HourCondition[] =>
  Array.from({ length: 24 }, (_, h) => ({
    time: `${date}T${String(h).padStart(2, '0')}:00`,
    tempC: 8,
    precipPct: 10,
    precipMm: 0,
    windKmh: 10,
    gustKmh: 20,
    code: 2,
    freezingM: 1800,
    isDay: h >= 8 && h < 19,
    ...overrides[h],
  }));

describe('lecture Open-Meteo', () => {
  it('range les heures sous leur jour et garde null quand une valeur manque', () => {
    const payload = {
      daily: {
        time: ['2026-10-10'],
        weather_code: [3],
        temperature_2m_max: [14.2],
        temperature_2m_min: [4.1],
        precipitation_probability_max: [35],
        precipitation_sum: [0.4],
        wind_gusts_10m_max: [38],
        sunrise: ['2026-10-10T07:58'],
        sunset: ['2026-10-10T19:12'],
      },
      hourly: {
        time: ['2026-10-10T08:00', '2026-10-10T09:00'],
        temperature_2m: [6, null],
        precipitation_probability: [10, 20],
        weather_code: [2, 3],
        is_day: [1, 1],
      },
    };
    const [d] = parseForecast(payload);
    expect(d.date).toBe('2026-10-10');
    expect(d.sunrise).toBe('07:58');
    expect(d.hours).toHaveLength(2);
    expect(d.hours[1].tempC).toBeNull();
    expect(d.hours[0].isDay).toBe(true);
    expect(parseForecast(null)).toEqual([]);
  });
});

describe('qualité', () => {
  it('orage et rafales rendent une heure mauvaise, avec les raisons', () => {
    const q = hourQuality({ ...hoursOf('2026-10-10')[14], code: 95, gustKmh: 65 });
    expect(q.quality).toBe('mauvais');
    expect(q.reasons).toContain('orage');
  });

  it('un jour de pluie probable est mauvais, une averse possible est moyenne', () => {
    const base = {
      date: '2026-10-10',
      tMin: 5,
      tMax: 14,
      precipMm: 2,
      gustMax: 30,
      code: 61,
      sunrise: '07:58',
      sunset: '19:12',
      hours: [],
    };
    expect(dayQuality({ ...base, precipPct: 80 }).quality).toBe('mauvais');
    expect(dayQuality({ ...base, precipPct: 45 }).quality).toBe('moyen');
    expect(dayQuality({ ...base, precipPct: 10, code: 2 }).quality).toBe('bon');
  });

  it('calendrier : prévision, puis tendance étiquetée, puis inconnu', () => {
    const forecast = [
      {
        date: '2026-10-01',
        tMin: 5,
        tMax: 15,
        precipPct: 10,
        precipMm: 0,
        gustMax: 20,
        code: 1,
        sunrise: null,
        sunset: null,
        hours: [],
      },
    ];
    const trend = averageTrend(
      [
        {
          daily: {
            time: ['2025-10-20'],
            precipitation_sum: [6],
            temperature_2m_max: [12],
            temperature_2m_min: [4],
            wind_gusts_10m_max: [30],
          },
        },
        {
          daily: {
            time: ['2024-10-20'],
            precipitation_sum: [4],
            temperature_2m_max: [14],
            temperature_2m_min: [6],
            wind_gusts_10m_max: [40],
          },
        },
      ],
      ['2026-10-20']
    );
    expect(trend[0]).toMatchObject({ precipMm: 5, years: 2, tMax: 13 });
    const cal = buildCalendar(['2026-10-01', '2026-10-20', '2026-11-30'], forecast, trend);
    expect(cal.map((c) => c.kind)).toEqual(['prevision', 'tendance', 'inconnu']);
    expect(cal[1].quality).toBe('mauvais');
    expect(cal[2].quality).toBeNull();
  });
});

describe('temps de marche et départ', () => {
  it('DIN 33466 au rythme du plus lent', () => {
    // 20 km à 4 km/h = 5 h ; 118 m de D+ et de D- ≈ 0,63 h → 5 h + 0,31 h
    expect(
      walkingMinutes({ distanceKm: 20, gainM: 118, lossM: 118, flatSpeedKmh: 4, pace: 'normal' })
    ).toBe(319);
    expect(
      walkingMinutes({ distanceKm: null, gainM: 0, lossM: 0, flatSpeedKmh: 4, pace: 'normal' })
    ).toBeNull();
    const slow =
      walkingMinutes({ distanceKm: 20, gainM: 0, lossM: 0, flatSpeedKmh: 4, pace: 'tranquille' }) ??
      0;
    expect(slow).toBeGreaterThan(300);
  });

  it('départ dès le jour, arrivée avant la nuit', () => {
    const a = departureAdvice({
      walkMin: 320,
      sunrise: '07:58',
      sunset: '19:12',
      hours: hoursOf('2026-10-10'),
    });
    expect(a.start).toBe('08:00');
    expect(a.arrival).toBe('14:08');
    expect(a.warning).toBeNull();
    expect(a.latestStart).toBe('12:30');
  });

  it('prévient quand les orages arrivent avant la fin de l’étape', () => {
    const a = departureAdvice({
      walkMin: 320,
      sunrise: '07:58',
      sunset: '19:12',
      hours: hoursOf('2026-10-10', { 13: { code: 95 } }),
    });
    expect(a.stormFrom).toBe('13:00');
    expect(a.warning).toMatch(/orages/);
  });

  it('prévient quand l’étape dépasse la lumière du jour', () => {
    const a = departureAdvice({
      walkMin: 700,
      sunrise: '07:58',
      sunset: '19:12',
      hours: hoursOf('2026-10-10'),
    });
    expect(a.warning).toMatch(/lumière du jour/);
  });

  it('isotherme 0 °C du matin', () => {
    expect(morningFreezingLevel(hoursOf('2026-10-10', { 7: { freezingM: 1240 } }))).toBe(1240);
    expect(morningFreezingLevel([])).toBeNull();
  });
});
