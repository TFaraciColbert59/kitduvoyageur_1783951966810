/**
 * Plan 4.8 : sous les tropiques, moustiques, soleil et eau (filtre ou pastilles) ;
 * le filtre à eau suit la ressource (altitude, activité qui vit des sources
 * naturelles, tropiques), pas seulement l'altitude.
 *
 * La zone tropicale vient de la latitude (|lat| < 23,5°, soleil au zénith),
 * jamais d'un nom de pays. Normales : vraies réponses de NASA POWER.
 */
import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/power-climatology.json';
import { adviseKit, type KitContext } from '../engine/kitRules';
import { essentialAdvice, repeatsRule, type AdviceInput } from '../engine/advice';
import { keepRuleForActivity } from '../engine/autofill';
import { powerClimateNormals } from '../engine/metno';
import type { CompasDayPlan, CompasKitLine } from '../engine/compasModel';
import type { DayForecast } from '../engine/weather';
import { climateWindow } from '@/features/trips/engine/climate';
import { generateTripContextualKit, type ContextualKitInput } from '@/features/trips/engine/contextualKitEngine';

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
  date: '2027-08-12',
  title: 'J1',
  distanceKm: 12,
  gainM: 600,
  lossM: 400,
  lat: 45,
  lon: 6,
  stay: null,
  walkMin: null,
  ...over,
});

const climateAt = (place: Place, month: number) =>
  climateWindow(powerClimateNormals(fixtures[place].payload), [`2027-${String(month).padStart(2, '0')}-10`]);

const ctx = (over: Partial<KitContext> = {}): KitContext => ({
  lat: 45,
  maxAltitudeM: null,
  climate: null,
  activity: 'hiking',
  ...over,
});

const run = (
  context: KitContext,
  opts: { lines?: CompasKitLine[]; forecast?: DayForecast | null; water?: number | null } = {}
) =>
  adviseKit({
    lines: opts.lines ?? [],
    forecasts: [{ day: 1, date: '2027-08-12', forecast: opts.forecast ?? null }],
    dayPlans: [plan()],
    waterPointsCount: opts.water ?? null,
    context,
  });

const needs = (a: ReturnType<typeof run>) => a.map((x) => x.need);
const by = (a: ReturnType<typeof run>, need: string) => a.find((x) => x.need === need);

describe('tropiques : moustiques, soleil, eau', () => {
  const bali = ctx({ lat: fixtures.ubud.lat, climate: climateAt('ubud', 8) });

  it('Bali, sans prévision ni altitude : moustiques, soleil, filtre ou pastilles', () => {
    const a = run(bali);
    expect(needs(a)).toEqual(expect.arrayContaining(['moustiques', 'soleil', 'filtre']));
    const m = by(a, 'moustiques');
    expect(m?.reason).toMatch(/tropical/);
    expect(m?.reason).toContain('8,5° S');
    expect(m?.reason).toMatch(/dengue/);
    expect(m?.reason).toMatch(/paludisme/);
    expect(m?.source).toBe('latitude du lieu');
    expect(by(a, 'soleil')?.reason).toMatch(/tropicale.*toute l’année/);
    const f = by(a, 'filtre');
    expect(f?.label).toMatch(/pastilles/);
    expect(f?.reason).toMatch(/robinet/);
    expect(f?.reason).toMatch(/virus/);
    expect(f?.source).toMatch(/latitude/);
  });

  it('le conseil ne lit que la latitude : 23,4° oui, 24° non', () => {
    expect(needs(run(ctx({ lat: 23.4 })))).toEqual(expect.arrayContaining(['moustiques', 'soleil', 'filtre']));
    expect(needs(run(ctx({ lat: -23.4 })))).toContain('moustiques');
    for (const lat of [23.5, 24, 45, -33.9])
      for (const need of ['moustiques', 'filtre']) expect(needs(run(ctx({ lat })))).not.toContain(need);
  });

  it('Paris ou latitude inconnue : rien de tropical', () => {
    const paris = needs(run(ctx({ lat: 48.85, climate: climateAt('paris', 8) })));
    for (const need of ['moustiques', 'filtre']) expect(paris).not.toContain(need);
    expect(needs(run(ctx({ lat: null })))).toEqual([]);
  });

  it('les hautes terres tropicales n’ont pas de moustiques : Cusco (3 400 m, 7 °C de moyenne), mais le soleil et l’eau restent', () => {
    const a = run(ctx({ lat: fixtures.cusco.lat, maxAltitudeM: 3400, climate: climateAt('cusco', 7) }));
    expect(needs(a)).not.toContain('moustiques');
    expect(needs(a)).toEqual(expect.arrayContaining(['soleil', 'filtre']));
    // Altitude inconnue mais climat frais : le climat suffit.
    expect(needs(run(ctx({ lat: fixtures.cusco.lat, climate: climateAt('cusco', 7) })))).not.toContain('moustiques');
    // Altitude seule, sans climat lisible : au-dessus de 2 500 m.
    expect(needs(run(ctx({ lat: -13.5, maxAltitudeM: 2600 })))).not.toContain('moustiques');
    expect(needs(run(ctx({ lat: -13.5, maxAltitudeM: 2400 })))).toContain('moustiques');
  });

  it('altitude et climat inconnus : les moustiques restent dits, par précaution', () => {
    expect(needs(run(ctx({ lat: 5, maxAltitudeM: null, climate: null })))).toContain('moustiques');
  });

  it('un objet du kit couvre le besoin (répulsif, moustiquaire, filtre, pastilles)', () => {
    const a = run(bali, { lines: [line('Répulsif anti-moustiques 50 %'), line('Filtre à eau Sawyer Mini')] });
    expect(by(a, 'moustiques')).toMatchObject({ covered: true, coveredBy: 'Répulsif anti-moustiques 50 %' });
    expect(by(a, 'filtre')).toMatchObject({ covered: true, coveredBy: 'Filtre à eau Sawyer Mini' });
    expect(by(run(bali, { lines: [line('Pastilles Micropur Forte')] }), 'filtre')?.covered).toBe(true);
    expect(by(run(bali, { lines: [line('Moustiquaire de voyage')] }), 'moustiques')?.covered).toBe(true);
  });

  it('la prévision garde la priorité sur le soleil des tropiques', () => {
    const forecast: DayForecast = {
      date: '2027-08-12',
      tMin: 22,
      tMax: 31,
      precipPct: 10,
      precipMm: 0,
      gustMax: 20,
      code: 1,
      sunrise: '06:00',
      sunset: '18:00',
      hours: [],
    };
    const soleil = run(bali, { forecast }).filter((x) => x.need === 'soleil');
    expect(soleil).toHaveLength(1);
    expect(soleil[0].source).toBe('MET Norway');
  });
});

describe('filtre à eau : selon la ressource, pas seulement l’altitude', () => {
  it('altitude mesurée au-dessus de 2 400 m : névés, torrents, sources non contrôlées', () => {
    const f = by(run(ctx({ maxAltitudeM: 2600 })), 'filtre');
    expect(f?.reason).toContain('2 600 m');
    expect(f?.reason).toMatch(/névés/);
    expect(f?.source).toMatch(/altitude/);
    expect(needs(run(ctx({ maxAltitudeM: 2400 })))).not.toContain('filtre');
    expect(needs(run(ctx({ maxAltitudeM: 1800 })))).not.toContain('filtre');
  });

  it('une activité qui vit de l’eau des ruisseaux et des sources (trek, bivouac, bushcraft, alpinisme) en emporte un à basse altitude', () => {
    for (const activity of ['trekking', 'bivouac', 'bushcraft', 'mountaineering']) {
      const f = by(run(ctx({ activity, maxAltitudeM: 1200 })), 'filtre');
      expect(f?.reason, activity).toMatch(/ruisseaux/);
      expect(f?.source, activity).toMatch(/activité/);
    }
    for (const activity of ['hiking', 'citytrip', 'cycling', 'beach', 'water'])
      expect(needs(run(ctx({ activity, maxAltitudeM: 1200 }))), activity).not.toContain('filtre');
  });

  it('les points d’eau connus du tracé sont comptés, sans être garantis potables', () => {
    const f = by(run(ctx({ activity: 'trekking' }), { water: 3 }), 'filtre');
    expect(f?.reason).toMatch(/3 points d’eau connus/);
    expect(f?.reason).toMatch(/pas tous contrôlés/);
    expect(by(run(ctx({ activity: 'trekking' }), { water: 1 }), 'filtre')?.reason).toMatch(/1 point d’eau connu /);
  });

  it('plusieurs raisons : toutes dites, toutes sourcées', () => {
    const f = by(run(ctx({ lat: -13.5, activity: 'trekking', maxAltitudeM: 3400 })), 'filtre');
    expect(f?.reason).toMatch(/robinet/);
    expect(f?.reason).toMatch(/névés/);
    expect(f?.reason).toMatch(/ruisseaux/);
    expect(f?.source).toMatch(/latitude.*altitude.*activité/);
  });
});

describe('règles d’équipement : répulsif, pastilles, filtre', () => {
  const kit = (place: Place, month: number, over: Partial<ContextualKitInput> = {}) =>
    generateTripContextualKit({
      activity: 'hiking',
      durationDays: 4,
      seasonMonth: month,
      latitude: fixtures[place].lat,
      climate: climateAt(place, month),
      ...over,
    });
  const keys = (a: ReturnType<typeof kit>) => [...a.vitalGaps, ...a.recommendedGaps].map((g) => g.key);
  const gap = (a: ReturnType<typeof kit>, key: string) => [...a.vitalGaps, ...a.recommendedGaps].find((g) => g.key === key);

  it('Bali : répulsif, pastilles de purification, filtre, crème vitale', () => {
    const a = kit('ubud', 8);
    expect(keys(a)).toEqual(expect.arrayContaining(['mosquito-repellent', 'water-purification', 'water-filter']));
    expect(gap(a, 'mosquito-repellent')?.reason).toMatch(/tropical/);
    expect(gap(a, 'water-purification')?.reason).toMatch(/virus/);
    expect(gap(a, 'water-filter')?.reason).toMatch(/robinet/);
    expect(gap(a, 'mosquito-repellent')?.shopProduct).toBeNull();
  });

  it('Cusco à 3 400 m : filtre (tropiques et altitude), mais pas de répulsif', () => {
    const a = kit('cusco', 7, { elevationProfile: { maxM: 3400 } as never });
    expect(keys(a)).toContain('water-filter');
    expect(keys(a)).not.toContain('mosquito-repellent');
  });

  it('le Mont-Blanc à 2 600 m garde sa raison d’altitude ; un trek à basse altitude en Europe a son filtre, une rando non', () => {
    const alt = kit('chamonix', 8, { elevationProfile: { maxM: 2600 } as never });
    expect(gap(alt, 'water-filter')?.reason).toContain('2600m');
    const trek = kit('paris', 8, { activity: 'trekking' });
    expect(gap(trek, 'water-filter')?.reason).toMatch(/ruisseaux/);
    expect(keys(kit('paris', 8))).not.toContain('water-filter');
    expect(keys(kit('paris', 8))).not.toContain('mosquito-repellent');
  });

  describe('répulsif : le point le plus bas du parcours décide, pas le plus haut', () => {
    // Kilimandjaro + Moshi (3,3° S) : le sommet à 4 700 m, la ville de départ à 850 m.
    const moshi = (profile: { maxM: number; minM?: number }, over: Partial<ContextualKitInput> = {}) =>
      generateTripContextualKit({
        activity: 'trekking',
        durationDays: 8,
        seasonMonth: 1,
        latitude: -3.3,
        elevationProfile: profile as never,
        ...over,
      });
    const repellent = (a: ReturnType<typeof moshi>) =>
      [...a.vitalGaps, ...a.recommendedGaps].some((g) => g.key === 'mosquito-repellent');

    it('un seul point à 2 500 m ou plus ne retire pas le répulsif : le départ est à 850 m', () => {
      expect(repellent(moshi({ maxM: 4700, minM: 850 }))).toBe(true);
    });

    it('avec seulement un maximum connu, le répulsif n’est jamais retiré', () => {
      expect(repellent(moshi({ maxM: 4700 }))).toBe(true);
      expect(repellent(moshi({ maxM: 4700, minM: 0 }))).toBe(true);
    });

    it('tout le parcours au-dessus de 2 500 m : pas de répulsif', () => {
      expect(repellent(moshi({ maxM: 4200, minM: 2900 }))).toBe(false);
      expect(repellent(moshi({ maxM: 2500, minM: 2500 }))).toBe(false);
    });

    it('un parcours bas garde son répulsif', () => {
      expect(repellent(moshi({ maxM: 900, minM: 120 }))).toBe(true);
    });

    it('le mois frais du premier lieu ne retire pas le répulsif d’un parcours qui descend (Cusco, puis la forêt)', () => {
      const cool = climateAt('cusco', 11);
      expect(cool?.months[0].tMeanC).toBeLessThan(15);
      expect(repellent(moshi({ maxM: 3750, minM: 190 }, { latitude: -13.53, climate: cool }))).toBe(true);
      // Sans point bas connu, le mois frais du lieu décide, faute de mieux (comportement d'origine).
      expect(repellent(moshi({ maxM: 3750 }, { latitude: -13.53, climate: cool }))).toBe(false);
    });
  });

  it('villes et plages des tropiques : répulsif gardé ; sortie de quelques heures : ni pastilles ni filtre', () => {
    expect(keepRuleForActivity('mosquito-repellent', 'citytrip')).toBe(true);
    expect(keepRuleForActivity('mosquito-repellent', 'beach')).toBe(true);
    expect(keepRuleForActivity('water-purification', 'hiking', true)).toBe(false);
    expect(keepRuleForActivity('water-purification', 'hiking')).toBe(true);
  });
});

describe('conseil essentiel : l’eau', () => {
  const base: AdviceInput = {
    activity: 'hiking',
    nights: [],
    maxAltitudeM: 800,
    party: 3,
    startDate: '2027-10-17',
    lat: 45.6,
    countryCode: 'FR',
  };

  it('sous les tropiques : l’eau n’est pas toujours potable, traite-la', () => {
    const notes = essentialAdvice({ ...base, lat: -8.5, countryCode: null });
    const water = notes.find((n) => /potable/.test(n)) ?? '';
    expect(water).toMatch(/robinet/);
    expect(water).toMatch(/filtre, pastilles/);
    expect(water).toMatch(/bouteille scellée/);
  });

  it('en altitude (au-dessus de 2 400 m) : l’eau des névés et des torrents se traite aussi', () => {
    const notes = essentialAdvice({ ...base, maxAltitudeM: 3000 });
    expect(notes.join(' ')).toMatch(/névés/);
  });

  it('une visite de ville dans les tropiques garde le conseil d’eau (eau du robinet), pas celui des sources', () => {
    const notes = essentialAdvice({ ...base, activity: 'citytrip', lat: 13.7 });
    expect(notes.join(' ')).toMatch(/robinet/);
    expect(notes.join(' ')).not.toMatch(/névés/);
  });

  it('ailleurs, à basse altitude : rien sur l’eau', () => {
    expect(essentialAdvice(base)).toEqual([]);
  });

  it('l’IA ne redit pas le conseil d’eau', () => {
    const rules = essentialAdvice({ ...base, lat: -8.5 });
    expect(repeatsRule('Pense à emporter des pastilles de purification pour l’eau.', rules)).toBe(true);
    expect(repeatsRule('Un bon livre pour les soirées.', rules)).toBe(false);
  });
});
