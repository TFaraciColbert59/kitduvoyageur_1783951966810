import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import DATA from '../data/icpPriceLevels.json';
import META from '../data/icpPriceLevels.meta.json';
import { icpFoodLevel } from '../engine/icp';
import { mealsPerDay, mealsTotal, priceLevel } from '../engine/costs';

/**
 * Repas en autonomie au niveau de prix de l'alimentation de l'ICP 2021 (Banque mondiale, CC BY 4.0,
 * PLAN-100 4.6). Les repas au restaurant et au refuge restent au barème du Compas : la série « Restaurants
 * et hôtels » donne les prix des résidents, bien sous le coût d'un voyageur. Un pays absent de l'ICP garde
 * son barème, aucun niveau n'est inventé.
 */

const script = path.resolve(__dirname, '..', '..', '..', '..', 'scripts', 'compas', 'build-icp-price-levels.mjs');
const FOOD = DATA.food as Record<string, number>;
const flat = (s: string) => s.replace(/[  ]/g, ' ');

describe('icpFoodLevel — le niveau de prix de l’alimentation, France = 1', () => {
  it('la France est la référence', () => {
    expect(icpFoodLevel('FR', 'France')).toMatchObject({ level: 1 });
    expect(icpFoodLevel(' fr ')?.level).toBe(1);
  });

  it('un pays de l’ICP : l’indice du pays rapporté à celui de la France, arrondi au centième, base datée', () => {
    const pe = icpFoodLevel('pe', 'Pérou')!;
    expect(pe.level).toBe(Math.round((FOOD.PE / FOOD.FR) * 100) / 100);
    expect(pe.level).toBeCloseTo(0.69, 2);
    expect(flat(pe.basis)).toBe('alimentation : Pérou 69 (France = 100) · ICP 2021, Banque mondiale, lu le 12 octobre 2026');
    expect(icpFoodLevel('CH')!.level).toBeGreaterThan(1);
  });

  it('un pays absent de l’ICP n’a pas de niveau (territoires, Cuba, Russie…) : l’appelant garde son barème', () => {
    for (const cc of ['CU', 'RU', 'PF', 'NC', 'XX', '', null, undefined]) expect(icpFoodLevel(cc), String(cc)).toBeNull();
    // Le barème du Compas, lui, connaît ces pays : rien ne devient « inconnu ».
    expect(priceLevel('CU').known).toBe(true);
  });

  it('toutes les valeurs sont des indices plausibles (Monde = 100, entre 5 et 600) et la France est présente', () => {
    expect(Object.keys(FOOD).length).toBeGreaterThanOrEqual(150);
    expect(FOOD.FR).toBeGreaterThan(0);
    for (const [cc, v] of Object.entries(FOOD)) {
      expect(cc).toMatch(/^[A-Z]{2}$/);
      expect(v, cc).toBeGreaterThan(5);
      expect(v, cc).toBeLessThan(600);
    }
  });
});

describe('repas : le niveau de l’alimentation ne touche que les repas en autonomie', () => {
  it('bivouac et journée sans nuit suivent l’alimentation ; refuge et hébergement suivent le barème du pays', () => {
    expect(mealsPerDay('bivouac', 0.45, 0.69)).toBe(Math.round(16 * 0.69));
    expect(mealsPerDay(null, 0.45, 0.69)).toBe(Math.round(14 * 0.69));
    expect(mealsPerDay('refuge', 0.45, 0.69)).toBe(Math.round(22 * 0.45));
    expect(mealsPerDay('hebergement', 0.45, 0.69)).toBe(Math.round(32 * 0.45));
  });

  it('sans niveau d’alimentation : exactement le barème d’avant', () => {
    expect(mealsPerDay('bivouac', 0.45)).toBe(Math.round(16 * 0.45));
    const nights = ['bivouac', 'refuge', 'hebergement'] as const;
    const before = mealsTotal({ days: 4, party: 2, nights: [...nights], level: 0.45 });
    expect(mealsTotal({ days: 4, party: 2, nights: [...nights], level: 0.45, foodLevel: null })).toBe(before);
    expect(mealsTotal({ days: 4, party: 2, nights: [...nights], level: 0.45, foodLevel: undefined })).toBe(before);
    expect(mealsTotal({ days: 3, party: 2, nights: ['hebergement', 'refuge'], level: 1 })).toBe((32 + 22 + 14) * 2);
  });

  it('avec l’alimentation du Pérou (0,69) : bivouac et dernier jour renchéris, restaurant inchangé', () => {
    const pe = icpFoodLevel('PE')!.level;
    const nights = ['bivouac', 'bivouac', 'hebergement'] as const;
    const level = priceLevel('PE').level;
    const total = mealsTotal({ days: 4, party: 1, nights: [...nights], level, foodLevel: pe });
    expect(total).toBe(mealsPerDay('bivouac', level, pe) * 2 + mealsPerDay('hebergement', level, pe) + mealsPerDay(null, level, pe));
    expect(total).toBeGreaterThan(mealsTotal({ days: 4, party: 1, nights: [...nights], level }));
  });
});

describe('la source : méta, licence et script', () => {
  it('la méta cite la Banque mondiale, la série, la licence CC BY 4.0, les dates et les empreintes', () => {
    expect(META.source).toMatch(/^The World Bank: ICP 2021/);
    expect(META.page).toBe('https://api.worldbank.org/v2/sources/90');
    expect(META.licence).toBe('CC BY 4.0');
    expect(META.licenceUrl).toBe('https://datacatalog.worldbank.org/public-licenses');
    expect(META.series).toMatch(/^1101000 : /);
    expect(META.classification).toMatch(/^PX\.WL : Price level index \(World = 100\)/);
    expect(META.readOn).toBe('2026-10-12');
    expect(META.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(META.sha256.food).toMatch(/^[0-9a-f]{64}$/);
    expect(META.sha256.countries).toMatch(/^[0-9a-f]{64}$/);
    expect(META.countries).toBe(Object.keys(FOOD).length);
    expect(META.credit).toMatch(/The World Bank: ICP 2021/);
    expect(META.credit).toMatch(/CC BY 4\.0/);
  });

  it('le fichier JSON est tel que le script l’écrit (jamais édité à la main)', () => {
    const text = readFileSync(path.resolve(__dirname, '..', 'data', 'icpPriceLevels.json'), 'utf8');
    expect(JSON.parse(text)).toEqual(DATA);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('le script écarte les agrégats et les pays sans valeur, refuse le reste', async () => {
    const { parseSeries, countryTable } = (await import(script)) as {
      parseSeries: (payload: unknown, series: string, table: Record<string, string>) => Record<string, number>;
      countryTable: (payload: unknown) => Record<string, string>;
    };
    const table = countryTable([
      { page: 1 },
      [
        { id: 'FRA', iso2Code: 'FR', region: { id: 'ECS' } },
        { id: 'PER', iso2Code: 'PE', region: { id: 'LCN' } },
        { id: 'CUB', iso2Code: 'CU', region: { id: 'LCN' } },
        { id: 'WLD', iso2Code: '1W', region: { id: 'NA' } },
      ],
    ]);
    expect(table).toEqual({ FRA: 'FR', PER: 'PE', CUB: 'CU' });
    const row = (country: string, value: number | null, over: Record<string, string> = {}) => ({
      variable: [
        { concept: 'Country', id: country },
        { concept: 'Classification', id: over.classification ?? 'PX.WL' },
        { concept: 'Series', id: over.series ?? '1101000' },
        { concept: 'Time', id: over.time ?? 'YR2021' },
      ],
      value,
    });
    const payload = (rows: unknown[]) => ({ source: { id: '90', data: rows } });
    expect(parseSeries(payload([row('FRA', 128.783), row('PER', 89.45), row('CUB', null), row('WLD', 100)]), '1101000', table)).toEqual({ FR: 128.8, PE: 89.5 });
    expect(() => parseSeries(payload([row('FRA', 9999)]), '1101000', table)).toThrow(/hors bornes/);
    expect(() => parseSeries(payload([row('FRA', 2)]), '1101000', table)).toThrow(/hors bornes/);
    expect(() => parseSeries(payload([row('FRA', 100, { series: '1111000' })]), '1101000', table)).toThrow(/série inattendue/);
    expect(() => parseSeries(payload([row('FRA', 100, { classification: 'PP' })]), '1101000', table)).toThrow(/classement inattendu/);
    expect(() => parseSeries(payload([row('FRA', 100, { time: 'YR2017' })]), '1101000', table)).toThrow(/année inattendue/);
    expect(() => parseSeries({ source: {} }, '1101000', table)).toThrow(/illisible/);
  });
});
