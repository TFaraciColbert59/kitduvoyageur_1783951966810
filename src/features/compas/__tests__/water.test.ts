import { describe, expect, it } from 'vitest';
import { planWater, volumeFromName } from '../engine/water';
import type { CompasDayPlan } from '../engine/compasModel';
import type { DayForecast } from '../engine/weather';

const plan = (day: number, walkMin: number | null): CompasDayPlan => ({
  day,
  date: `2026-10-0${day}`,
  title: `Jour ${day}`,
  distanceKm: null,
  gainM: null,
  lossM: null,
  lat: null,
  lon: null,
  stay: null,
  walkMin,
});

const fc = (tMax: number) => ({ tMax }) as unknown as DayForecast;

describe('volumeFromName — seul un volume écrit est compté', () => {
  it.each([
    ['Gourde 1 L', 1],
    ['Poche à eau 1,5l', 1.5],
    ['Flasque 500 ml', 0.5],
    ['Bidon 2 litres', 2],
  ])('%s → %s L', (name, v) => expect(volumeFromName(name)).toBe(v));

  it('CONTRE-EXEMPLE — pas de volume supposé', () => {
    expect(volumeFromName('Gourde inox')).toBeNull();
    expect(volumeFromName('Bidon 500 L')).toBeNull();
  });
});

describe('planWater — repère par heure de marche, jour par jour', () => {
  const p = planWater({
    dayPlans: [plan(1, 240), plan(2, 360), plan(3, null)],
    forecasts: [
      { day: 1, forecast: fc(18) },
      { day: 2, forecast: fc(29) },
    ],
    lines: [
      { id: 'a', name: 'Gourde 1 L', quantity: 2 },
      { id: 'b', name: 'Poche à eau', quantity: 1 },
      { id: 'c', name: 'Veste', quantity: 1 },
    ],
  });

  it('applique 0,5 L/h, 0,75 L/h par temps chaud, et laisse un jour inconnu vide', () => {
    expect(p.days.map((d) => d.liters)).toEqual([2, 4.5, null]);
    expect(p.days[1].hot).toBe(true);
    expect(p.peak?.day).toBe(2);
  });

  it('compte les contenants, sans volume inventé', () => {
    expect(p.containers.map((c) => c.id)).toEqual(['a', 'b']);
    expect(p.knownLiters).toBe(2);
    expect(p.unknownCount).toBe(1);
  });

  it('sans contenant ni marche : rien d’affirmé', () => {
    const empty = planWater({ dayPlans: [plan(1, null)], forecasts: [], lines: [] });
    expect(empty.peak).toBeNull();
    expect(empty.knownLiters).toBeNull();
  });
});
