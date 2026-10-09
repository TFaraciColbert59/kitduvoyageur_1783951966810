import { describe, expect, it } from 'vitest';
import { adviseKit } from '../engine/kitRules';
import type { CompasDayPlan, CompasKitLine } from '../engine/compasModel';
import type { DayForecast } from '../engine/weather';

const line = (name: string): CompasKitLine => ({
  id: name,
  name,
  category: null,
  weightGrams: null,
  quantity: 1,
  packed: false,
  vital: false,
  kind: 'base',
  shared: false,
  ownerId: null,
  inventoryItemId: null,
  lent: false,
  status: 'owned',
  reason: null,
  shopProductId: null,
  purchaseState: null,
  condition: null,
});

const fc = (over: Partial<DayForecast> = {}): DayForecast => ({
  date: '2026-10-12',
  tMin: 8,
  tMax: 18,
  precipPct: 10,
  precipMm: 0,
  gustMax: 20,
  code: 1,
  sunrise: '2026-10-12T07:40',
  sunset: '2026-10-12T19:00',
  hours: [],
  ...over,
});

const plan = (over: Partial<CompasDayPlan> = {}): CompasDayPlan => ({
  day: 1,
  date: '2026-10-12',
  title: 'J1',
  distanceKm: 12,
  gainM: 600,
  lossM: 400,
  lat: 45,
  lon: 6,
  stay: null,
  walkMin: 300,
  ...over,
});

const run = (
  lines: CompasKitLine[],
  f: DayForecast | null,
  p = plan(),
  water: number | null = null
) =>
  adviseKit({
    lines,
    forecasts: [{ day: 1, date: '2026-10-12', forecast: f }],
    dayPlans: [p],
    waterPointsCount: water,
  });

describe('adviseKit', () => {
  it('beau temps : seul le repère d’eau reste, pas de conseil inventé', () => {
    const a = run([], fc());
    expect(a.map((x) => x.need)).toEqual(['eau']);
  });

  it('pluie : demande une veste et cite jour, valeur et source', () => {
    const a = run([], fc({ precipPct: 80, precipMm: 12 }));
    const r = a.find((x) => x.need === 'pluie');
    expect(r?.covered).toBe(false);
    expect(r?.reason).toContain('12 mm');
    expect(r?.reason).toContain('12/10');
    expect(r?.source).toBe('MET Norway');
  });

  it('un objet du kit couvre le besoin', () => {
    const a = run([line('Veste Gore-Tex')], fc({ precipPct: 80 }));
    const r = a.find((x) => x.need === 'pluie');
    expect(r?.covered).toBe(true);
    expect(r?.coveredBy).toBe('Veste Gore-Tex');
  });

  it('gel : couche chaude ET gants/bonnet', () => {
    const a = run([], fc({ tMin: -2 }));
    expect(a.map((x) => x.need)).toEqual(expect.arrayContaining(['froid', 'extremites']));
  });

  it('froid sans gel : pas de gants', () => {
    const a = run([], fc({ tMin: 2 }));
    expect(a.some((x) => x.need === 'extremites')).toBe(false);
  });

  it('marche plus longue que le jour : frontale', () => {
    expect(run([], fc(), plan({ walkMin: 700 })).some((x) => x.need === 'frontale')).toBe(true);
  });

  it('lever et coucher en « HH:MM » (format réel des prévisions) : la frontale part aussi', () => {
    const hhmm = fc({ sunrise: '07:40', sunset: '19:00' });
    expect(run([], hhmm, plan({ walkMin: 700 })).some((x) => x.need === 'frontale')).toBe(true);
    expect(run([], hhmm, plan({ walkMin: 300 })).some((x) => x.need === 'frontale')).toBe(false);
  });

  it('eau : repère par heure et points d’eau dits tels quels', () => {
    const a = run([], fc(), plan({ walkMin: 360 }), 0).find((x) => x.need === 'eau');
    expect(a?.reason).toContain('3 L');
    expect(a?.reason).toContain('aucun point d’eau connu');
    const b = run([], fc(), plan({ walkMin: 360 }), null).find((x) => x.need === 'eau');
    expect(b?.reason).toContain('non renseignés');
  });

  it('sans prévision : aucun conseil météo', () => {
    const a = run([], null, plan({ walkMin: null }));
    expect(a).toEqual([]);
  });
});
