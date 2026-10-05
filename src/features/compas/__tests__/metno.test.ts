import { describe, expect, it } from 'vitest';
import { localStamp, parseMetNo, powerToDaily, symbolToWmo } from '../engine/metno';
import { averageTrend, buildCalendar } from '../engine/weather';
import chamonix from './fixtures/metno-chamonix.json';

describe('MET Norway : symboles et heure locale', () => {
  it('traduit les symboles Yr en codes WMO, orage en tête', () => {
    expect(symbolToWmo('clearsky_day')).toBe(0);
    expect(symbolToWmo('fair_night')).toBe(1);
    expect(symbolToWmo('heavyrainandthunder')).toBe(95);
    expect(symbolToWmo('lightsnowshowers_polartwilight')).toBe(85);
    expect(symbolToWmo('sleet')).toBe(63);
    expect(symbolToWmo('inconnu')).toBeNull();
    expect(symbolToWmo(undefined)).toBeNull();
  });

  it('écrit l’heure du lieu, pas celle du serveur', () => {
    const at = new Date('2026-10-05T17:00:00Z');
    expect(localStamp(at, 'Europe/Paris')).toBe('2026-10-05T19:00');
    expect(localStamp(at, 'Asia/Kathmandu')).toBe('2026-10-05T22:45');
  });
});

describe('MET Norway : réponse réelle (Chamonix, 5 octobre 2026)', () => {
  const days = parseMetNo(chamonix, 'Europe/Paris');

  it('regroupe par jour local, dans l’ordre', () => {
    expect(days.map((d) => d.date)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']);
    expect(days[0].hours[0].time).toBe('2026-10-05T19:00');
  });

  it('températures, lever et coucher lisibles ; rien d’inventé', () => {
    const d = days[1];
    expect(d.tMin).not.toBeNull();
    expect(d.tMax).not.toBeNull();
    expect(d.tMax!).toBeGreaterThanOrEqual(d.tMin!);
    expect(d.sunrise).toMatch(/^0[6-8]:\d\d$/);
    expect(d.sunset).toMatch(/^1[8-9]:\d\d$/);
    // Ni probabilité de pluie ni rafales publiées sur les Alpes : null, pas zéro.
    expect(d.precipPct).toBeNull();
    expect(d.gustMax).toBeNull();
    expect(d.code).not.toBeNull();
  });

  it('isotherme 0 °C estimée au-dessus du point quand il fait doux', () => {
    const h = days[1].hours.find((x) => x.tempC != null && x.tempC > 5)!;
    expect(h.freezingM).toBeGreaterThan(1239);
  });

  it('nuit et jour d’après le soleil', () => {
    const night = days[1].hours.find((h) => h.time.endsWith('T02:00'));
    const noon = days[1].hours.find((h) => h.time.endsWith('T13:00'));
    expect(night?.isDay).toBe(false);
    expect(noon?.isDay).toBe(true);
  });

  it('la pluie d’un jour ne compte jamais deux fois un pas de 6 h', () => {
    const payload = {
      geometry: { coordinates: [6.87, 45.92, 1000] },
      properties: {
        timeseries: [
          {
            time: '2026-10-10T04:00:00Z',
            data: {
              instant: { details: { air_temperature: 8 } },
              next_1_hours: { summary: { symbol_code: 'rain' }, details: { precipitation_amount: 1 } },
              next_6_hours: { summary: { symbol_code: 'rain' }, details: { precipitation_amount: 9 } },
            },
          },
          {
            time: '2026-10-10T06:00:00Z',
            data: {
              instant: { details: { air_temperature: 9 } },
              next_6_hours: { summary: { symbol_code: 'rain' }, details: { precipitation_amount: 4 } },
            },
          },
        ],
      },
    };
    const [d] = parseMetNo(payload, 'UTC');
    expect(d.precipMm).toBe(5);
    expect(d.code).toBe(63);
  });

  it('un pas de 6 h compte pour le jour local qu’il couvre (Katmandou)', () => {
    const step = (time: string, mm: number, symbol: string, six = false) => ({
      time,
      data: {
        instant: { details: { air_temperature: 10 } },
        ...(six ? {} : { next_1_hours: { summary: { symbol_code: 'cloudy' }, details: { precipitation_amount: 0 } } }),
        next_6_hours: { summary: { symbol_code: symbol }, details: { precipitation_amount: mm } },
      },
    });
    const payload = {
      geometry: { coordinates: [85.32, 27.71, 1300] },
      properties: {
        timeseries: [
          // 18:00 UTC = 23:45 à Katmandou : la pluie de 6 h tombe le lendemain.
          step('2026-10-10T18:00:00Z', 8, 'heavyrainandthunder', true),
          step('2026-10-11T06:00:00Z', 0, 'clearsky_day', true),
        ],
      },
    };
    const days = parseMetNo(payload, 'Asia/Kathmandu');
    const d10 = days.find((d) => d.date === '2026-10-10')!;
    const d11 = days.find((d) => d.date === '2026-10-11')!;
    expect(d10.precipMm).toBeNull();
    expect(d10.code).toBeNull();
    expect(d11.precipMm).toBe(8);
    expect(d11.code).toBe(95);
  });

  it('réponse illisible : aucun jour', () => {
    expect(parseMetNo(null, 'UTC')).toEqual([]);
    expect(parseMetNo({ properties: {} }, 'UTC')).toEqual([]);
  });
});

describe('NASA POWER : tendance des années passées', () => {
  const power = {
    header: { fill_value: -999 },
    properties: {
      parameter: {
        T2M_MAX: { '20241020': 12, '20251020': 14 },
        T2M_MIN: { '20241020': 2, '20251020': -999 },
        PRECTOTCORR: { '20241020': 6, '20251020': 4 },
        WS10M_MAX: { '20241020': 10, '20251020': 20 },
      },
    },
  };

  it('même forme que l’archive, remplissage → null, vent en km/h', () => {
    const daily = powerToDaily(power)!;
    expect(daily.daily.time).toEqual(['2024-10-20', '2025-10-20']);
    expect(daily.daily.temperature_2m_min).toEqual([2, null]);
    expect(daily.daily.wind_gusts_10m_max).toEqual([36, 72]);
  });

  it('nourrit le calendrier en « tendance » au-delà de la prévision', () => {
    const trend = averageTrend([powerToDaily(power)], ['2026-10-20']);
    expect(trend[0]).toMatchObject({ tMax: 13, precipMm: 5, years: 2 });
    const [day] = buildCalendar(['2026-10-20'], [], trend);
    expect(day.kind).toBe('tendance');
    expect(day.quality).toBe('mauvais');
  });

  it('réponse vide : pas de tendance', () => {
    expect(powerToDaily(null)).toBeNull();
    expect(powerToDaily({ properties: { parameter: {} } })).toBeNull();
  });
});
