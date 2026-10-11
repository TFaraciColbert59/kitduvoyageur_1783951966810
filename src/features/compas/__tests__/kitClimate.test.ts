/**
 * Plan 4.8 : conseils de kit fondés sur les normales climatiques (NASA POWER)
 * quand aucune prévision ne couvre les jours du voyage (au-delà de dix jours).
 *
 * Les normales viennent de `fixtures/power-climatology.json` : de vraies
 * réponses de NASA POWER (voir `climateNormals.test.ts`). Aucune règle ne lit
 * un pays : seulement le mois, la latitude et l'altitude.
 */
import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/power-climatology.json';
import { adviseKit, type KitContext } from '../engine/kitRules';
import { powerClimateNormals } from '../engine/metno';
import type { CompasDayPlan, CompasKitLine } from '../engine/compasModel';
import type { DayForecast } from '../engine/weather';
import { climateWindow } from '@/features/trips/engine/climate';

type Place = keyof typeof fixtures;

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

const plan = (over: Partial<CompasDayPlan> = {}): CompasDayPlan => ({
  day: 1,
  date: '2027-07-12',
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

/** Contexte d'un voyage dans un lieu des fixtures, au mois donné. */
const at = (place: Place, month: number, over: Partial<KitContext> = {}): KitContext => {
  const normals = powerClimateNormals(fixtures[place].payload);
  return {
    lat: fixtures[place].lat,
    maxAltitudeM: null,
    activity: 'hiking',
    climate: climateWindow(normals, [`2027-${String(month).padStart(2, '0')}-10`]),
    ...over,
  };
};

const run = (
  context: KitContext | undefined,
  opts: { lines?: CompasKitLine[]; forecast?: DayForecast | null; plan?: CompasDayPlan; water?: number | null } = {}
) =>
  adviseKit({
    lines: opts.lines ?? [],
    forecasts: [{ day: 1, date: '2027-07-12', forecast: opts.forecast ?? null }],
    dayPlans: [opts.plan ?? plan({ walkMin: null })],
    waterPointsCount: opts.water ?? null,
    context,
  });

const needs = (advice: ReturnType<typeof run>) => advice.map((a) => a.need);
const byNeed = (advice: ReturnType<typeof run>, need: string) => advice.find((a) => a.need === need);

describe('kit : froid sans altitude, d’après les normales du mois', () => {
  it('Reykjavik en février, aucune altitude connue : couche chaude, gants et bonnet, avec la donnée', () => {
    const a = run(at('reykjavik', 2));
    expect(needs(a)).toEqual(expect.arrayContaining(['froid', 'extremites']));
    const froid = byNeed(a, 'froid');
    expect(froid?.reason).toContain('février');
    expect(froid?.reason).toContain('0 °C');
    expect(froid?.source).toMatch(/NASA POWER/);
    expect(froid?.covered).toBe(false);
    const gel = byNeed(a, 'extremites');
    expect(gel?.reason).toContain('février');
    expect(gel?.reason).toContain('-14 °C');
  });

  it('Torres del Paine en juillet : l’hiver austral, sans lire un seul nom de pays', () => {
    const a = run(at('torres', 7));
    expect(byNeed(a, 'froid')?.reason).toContain('juillet');
    expect(byNeed(a, 'extremites')?.reason).toContain('-19 °C');
  });

  it('Paris en juin : rien à signaler, malgré un minimum relevé à 3 °C', () => {
    expect(needs(run(at('paris', 6)))).toEqual([]);
  });

  it('un objet du kit couvre le besoin', () => {
    const a = run(at('reykjavik', 2), { lines: [line('Polaire 200')] });
    expect(byNeed(a, 'froid')).toMatchObject({ covered: true, coveredBy: 'Polaire 200' });
  });

  it('le mois le plus froid du voyage est nommé', () => {
    const normals = powerClimateNormals(fixtures.paris.payload);
    const context: KitContext = {
      lat: 48.85,
      maxAltitudeM: null,
      climate: climateWindow(normals, ['2027-06-28', '2027-07-02', '2027-12-30']),
    };
    const a = run(context);
    // Décembre : 3,55 °C de moyenne, -7 °C déjà relevé. Juin et juillet ne parlent pas.
    expect(byNeed(a, 'froid')?.reason).toContain('décembre');
    expect(byNeed(a, 'extremites')?.reason).toContain('décembre');
    expect(byNeed(a, 'soleil')?.reason).toContain('juillet');
  });
});

describe('kit : pluie et saison des pluies, d’après les normales', () => {
  it('Reykjavik en septembre : veste imperméable (6 mm par jour), housse étanche', () => {
    const a = run(at('reykjavik', 9));
    expect(byNeed(a, 'pluie')?.reason).toContain('septembre');
    expect(byNeed(a, 'pluie')?.reason).toContain('6 mm par jour');
    expect(byNeed(a, 'pluie')?.source).toMatch(/NASA POWER/);
    expect(needs(a)).toContain('etanche');
  });

  it('Bali en janvier : pluies abondantes (saison des pluies), veste ET protection du matériel', () => {
    const a = run(at('ubud', 1));
    const pluie = byNeed(a, 'pluie');
    expect(pluie?.reason).toContain('10,2 mm par jour');
    expect(pluie?.reason).toMatch(/mousson|saison des pluies/);
    expect(byNeed(a, 'etanche')?.label).toMatch(/étanche/i);
    expect(byNeed(a, 'etanche')?.reason).toContain('janvier');
  });

  it('le Mont-Blanc en mai : veste, mais pas de saison des pluies', () => {
    const a = run(at('chamonix', 5));
    expect(needs(a)).toContain('pluie');
    expect(needs(a)).not.toContain('etanche');
  });

  it('Paris en octobre, Marrakech en juin : pas de pluie annoncée', () => {
    expect(needs(run(at('paris', 10)))).not.toContain('pluie');
    expect(needs(run(at('marrakech', 6)))).not.toContain('pluie');
  });

  it('une housse déjà dans le kit couvre le besoin', () => {
    const a = run(at('ubud', 1), { lines: [line('Housse de pluie sac 40 L'), line('Poncho')] });
    expect(byNeed(a, 'etanche')).toMatchObject({ covered: true });
    expect(byNeed(a, 'pluie')).toMatchObject({ covered: true, coveredBy: 'Poncho' });
  });
});

describe('kit : chaleur et soleil, d’après les normales', () => {
  it('Marrakech en juillet : protection solaire, et un repère d’eau qui parle de la chaleur', () => {
    const a = run(at('marrakech', 7), { plan: plan({ walkMin: 360 }) });
    const soleil = byNeed(a, 'soleil');
    expect(soleil?.reason).toContain('juillet');
    expect(soleil?.reason).toContain('29 °C');
    expect(byNeed(a, 'eau')?.reason).toMatch(/mois chaud/);
  });

  it('Paris en juillet : soleil, mais pas de mise en garde de chaleur sur l’eau', () => {
    const a = run(at('paris', 7), { plan: plan({ walkMin: 360 }) });
    expect(needs(a)).toContain('soleil');
    expect(byNeed(a, 'eau')?.reason).not.toMatch(/mois chaud/);
  });

  it('Paris en janvier : ni soleil ni chaleur', () => {
    expect(needs(run(at('paris', 1)))).not.toContain('soleil');
  });
});

describe('kit : la prévision garde la priorité sur les normales', () => {
  const fc = (over: Partial<DayForecast> = {}): DayForecast => ({
    date: '2027-07-12',
    tMin: 8,
    tMax: 18,
    precipPct: 10,
    precipMm: 0,
    gustMax: 20,
    code: 1,
    sunrise: '07:40',
    sunset: '19:00',
    hours: [],
    ...over,
  });

  it('un besoin n’apparaît qu’une fois : la prévision d’abord, citée MET Norway', () => {
    const a = run(at('reykjavik', 9), { forecast: fc({ precipPct: 90, precipMm: 14 }) });
    expect(a.filter((x) => x.need === 'pluie')).toHaveLength(1);
    expect(byNeed(a, 'pluie')?.source).toBe('MET Norway');
  });

  it('sans normales ni contexte : le comportement d’avant, inchangé', () => {
    expect(needs(run(undefined))).toEqual([]);
    expect(needs(run({ lat: null, maxAltitudeM: null, climate: null }))).toEqual([]);
  });
});
