import { describe, expect, it } from 'vitest';
import { kitCompatibility, normalizeName, planKitApply, type MyKit } from '../engine/kitApply';
import type { DayForecast } from '../engine/weather';

const item = (name: string, id = name) => ({
  id,
  name,
  category: null,
  weightG: 300,
  quantity: 1,
  isVital: false,
  productOwnershipId: null,
});

const kit: MyKit = {
  id: 'k1',
  name: 'Automne alpin',
  season: 'automne',
  items: [item('Veste Gore-Tex'), item('Polaire'), item('Gourde 1 L'), item('  polaire ')],
};

describe('planKitApply', () => {
  it('ignore casse, accents et doublons ; compte ce qui est déjà là', () => {
    const plan = planKitApply(kit, ['veste gore-tex', 'Tente']);
    expect(plan.alreadyThere).toBe(1);
    expect(plan.toAdd.map((i) => i.name)).toEqual(['Polaire', 'Gourde 1 L']);
  });
  it('normalizeName', () => {
    expect(normalizeName('  Gourde  ÉTANCHE ')).toBe('gourde etanche');
  });
});

const fc: DayForecast = {
  date: '2026-10-12',
  tMin: -1,
  tMax: 14,
  precipPct: 80,
  precipMm: 10,
  gustMax: 20,
  code: 61,
  sunrise: '2026-10-12T07:40',
  sunset: '2026-10-12T19:00',
  hours: [],
};

describe('kitCompatibility', () => {
  it('compte ce que le kit couvre et ce qu’il apporte de nouveau', () => {
    const c = kitCompatibility({
      kit,
      tripNames: ['Veste imperméable'],
      forecasts: [{ day: 1, date: '2026-10-12', forecast: fc }],
      dayPlans: [],
      waterPointsCount: null,
    });
    // pluie, froid, extrémités : 3 conseils ; le kit couvre pluie + froid, le voyage couvrait déjà la pluie
    expect(c.total).toBe(3);
    expect(c.covered).toBe(2);
    expect(c.bringsNew).toBe(1);
  });
});
