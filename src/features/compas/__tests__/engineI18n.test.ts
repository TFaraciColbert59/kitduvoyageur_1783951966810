/**
 * PLAN-100 6.1 — textes calculés par le moteur du Compas et montrés à l'écran :
 * période conseillée, provenance et adaptations du contexte projet, formats
 * (durées, dates, météo, échelle), règles de la veille, conseils essentiels et
 * conseils de kit. Sans locale, la sortie est le français d'avant (même objet) ;
 * en anglais, plus aucun mot français.
 */
import { describe, expect, it } from 'vitest';
import { bestPeriod, monthName, NORMALS_WHY, type PeriodInput } from '../engine/period';
import {
  adaptationText,
  adaptationTextFor,
  resolveProjectContext,
  sourceLabel,
  SOURCE_LABEL,
  type ContextInput,
} from '../engine/projectContext';
import {
  activityLabel,
  durationZone,
  formatDayMonth,
  formatDuration,
  formatHours,
  formatWeekday,
  RULER_TICKS,
  rulerTicks,
  weatherLabel,
} from '../engine/format';
import { classifyScale } from '../engine/scale';
import { watchRules } from '../engine/watch';
import { essentialAdvice, type AdviceInput } from '../engine/advice';
import { adviseKit } from '../engine/kitRules';
import type { CompasDayPlan } from '../engine/compasModel';
import type { DayForecast } from '../engine/weather';
import { powerClimateNormals } from '../engine/metno';
import { climateWindow } from '@/features/trips/engine/climate';
import fixtures from './fixtures/power-climatology.json';

/** Un texte anglais ne garde ni accent ni mot-outil français (noms propres cités à part). */
const FRENCH =
  /[àâçéèêëîïôöùûüœ«»]|\b(le|la|les|des|du|au|et|ou|jour|jours|nuit|nuits|pour|dans|avec|sans|sur)\b/i;
const english = (text: string) =>
  expect(text.replace(/Météo-France/g, ''), text).not.toMatch(FRENCH);

const period = (over: Partial<PeriodInput> = {}): PeriodInput => ({
  activity: 'hiking',
  lat: 45,
  today: '2026-10-18',
  days: 5,
  ...over,
});

describe('période conseillée', () => {
  it('sans locale : le français d’avant, identique à la locale fr', () => {
    expect(bestPeriod(period({ activity: 'ski' }))?.why).toBe(
      'enneigement le plus sûr, jours qui rallongent'
    );
    expect(bestPeriod(period({ lat: -12, countryCode: 'PE' }))?.why).toBe(
      'saison sèche dans les Andes (mai à septembre)'
    );
    expect(bestPeriod(period({ activity: 'beach' }), 'fr')).toEqual(
      bestPeriod(period({ activity: 'beach' }))
    );
    expect(monthName(8)).toBe('août');
  });

  it('en anglais : la raison et le mois', () => {
    expect(bestPeriod(period({ activity: 'ski' }), 'en')?.why).toBe(
      'most reliable snow, days getting longer'
    );
    expect(bestPeriod(period({ lat: -12, countryCode: 'PE' }), 'en')?.why).toBe(
      'dry season in the Andes (May to September)'
    );
    const normals = { precip: [5, 5, 4, 3, 1, 0.5, 0.4, 0.6, 2, 4, 5, 6] };
    expect(bestPeriod(period({ lat: -10, countryCode: 'BR', normals }))?.why).toBe(NORMALS_WHY);
    expect(bestPeriod(period({ lat: -10, countryCode: 'BR', normals }), 'en')?.why).toBe(
      'driest month in the 2001–2020 normals (NASA POWER)'
    );
    expect(monthName(8, 'en')).toBe('August');
    // Mêmes dates dans les deux langues : seule la raison change.
    const fr = bestPeriod(period({ lat: 64 }))!;
    const en = bestPeriod(period({ lat: 64 }), 'en')!;
    expect({ ...en, why: fr.why }).toEqual(fr);
  });

  it('aucune raison anglaise ne garde un mot français', () => {
    const ccs = [
      'PE',
      'EC',
      'CO',
      'VN',
      'TH',
      'IN',
      'LK',
      'PH',
      'ID',
      'KE',
      'UG',
      'RW',
      'MG',
      'MX',
      'CR',
      'PA',
      'CU',
      'SN',
      'ET',
      'RE',
      'MU',
      'PF',
      'OM',
    ];
    for (const countryCode of ccs) english(bestPeriod(period({ lat: 10, countryCode }), 'en')!.why);
    for (const activity of ['ski', 'beach', 'citytrip', 'water', 'mountaineering', 'hiking'])
      for (const lat of [60, 52, 45, 35]) english(bestPeriod(period({ activity, lat }), 'en')!.why);
  });
});

const ctxInput = (over: Partial<ContextInput> = {}): ContextInput => ({
  activity: 'hiking',
  days: 7,
  hours: null,
  partySize: 1,
  month: 1,
  maxAltitudeM: 2000,
  project: null,
  profile: {
    terrain: 'sentier',
    autonomy: 'itinerance_longue',
    priority: 'budget',
    experience: 'debut',
  },
  ...over,
});

describe('contexte projet', () => {
  it('sans locale : le français d’avant, identique à la locale fr', () => {
    expect(resolveProjectContext(ctxInput(), 'fr')).toEqual(resolveProjectContext(ctxInput()));
    expect(SOURCE_LABEL.profil).toBe('ton profil');
    expect(sourceLabel('profil')).toBe('ton profil');
    const [a] = resolveProjectContext(ctxInput()).adaptations;
    expect(adaptationText(a)).toBe(
      'Habituellement tu préfères le bivouac, mais pour ce projet : le refuge (nuits d’hiver en altitude).'
    );
  });

  it('en anglais : provenance, raisons et adaptation', () => {
    expect(sourceLabel('profil', 'en')).toBe('your profile');
    expect(sourceLabel('defaut', 'en')).toBe('suggested');
    const ctx = resolveProjectContext(ctxInput(), 'en');
    expect(ctx.nights).toEqual({
      value: 'refuge',
      source: 'defaut',
      why: 'winter: a roof is safer',
    });
    expect(ctx.pace.why).toBe('beginner level: shorter stages');
    expect(adaptationTextFor(ctx.adaptations[0], 'en')).toBe(
      'You usually prefer wild camping, but for this project: mountain huts (winter nights at altitude).'
    );
    const outing = resolveProjectContext(
      ctxInput({ hours: 4, days: 1, activity: 'citytrip' }),
      'en'
    );
    expect(outing.terrain.why).toBe('not relevant for this activity');
    expect(adaptationTextFor(outing.adaptations[0], 'en')).toBe(
      'You usually prefer self-supported long-distance trips, but for this project: day outings (this outing only takes a few hours).'
    );
    const nights = (n: number) =>
      resolveProjectContext(ctxInput({ profile: null, project: { outdoorNights: n } }), 'en').nights
        .why;
    expect(nights(1)).toBe('1 night outdoors requested');
    expect(nights(3)).toBe('3 nights outdoors requested');
    expect(
      resolveProjectContext(ctxInput({ profile: null, project: { outdoorNights: 3 } })).nights.why
    ).toBe('3 nuits dehors demandées');
  });

  it('aucune raison anglaise ne garde un mot français', () => {
    const profiles = [
      ctxInput().profile,
      { terrain: 'sentier', autonomy: 'bivouac_1_2', priority: 'confort', experience: 'aguerri' },
      { terrain: null, autonomy: null, priority: 'budget', experience: 'regulier' },
    ] as const;
    for (const profile of profiles)
      for (const activity of ['hiking', 'citytrip', 'trail'])
        for (const days of [1, 2, 7])
          for (const month of [1, 7])
            for (const maxAltitudeM of [null, 2000]) {
              const ctx = resolveProjectContext(
                ctxInput({ profile, activity, days, month, maxAltitudeM }),
                'en'
              );
              for (const f of [ctx.nights, ctx.pace, ctx.autonomy, ctx.terrain])
                if (f.why) english(f.why);
              for (const a of ctx.adaptations) english(adaptationTextFor(a, 'en'));
            }
  });
});

describe('formats', () => {
  it('sans locale : le français d’avant', () => {
    expect(formatHours(96)).toBe('4 j');
    expect(formatHours(5.5)).toBe('5 h 30');
    expect(formatDuration(330)).toBe('5 h 30');
    expect(formatDayMonth('2026-10-10')).toBe('sam. 10 oct.');
    expect(formatWeekday('2026-10-12')).toBe('lun. 12');
    expect(weatherLabel(0)).toEqual({ label: 'Dégagé', icon: 'sun' });
    expect(rulerTicks()).toEqual(RULER_TICKS);
    expect(activityLabel('hiking')).toBe('Randonnée');
    expect(durationZone(48)).toBe('Expédition');
  });

  it('en anglais : durées, dates, météo, règle, activité, échelle', () => {
    expect(formatHours(96, 'en')).toBe('4 d');
    expect(formatHours(100, 'en')).toBe('4 d 4 h');
    expect(formatHours(5.5, 'en')).toBe('5 h 30 min');
    expect(formatHours(0.5, 'en')).toBe('30 min');
    expect(formatDuration(330, 'en')).toBe('5 h 30 min');
    expect(formatDayMonth('2026-10-10', 'en')).toBe('Sat, Oct 10');
    expect(formatWeekday('2026-10-12', 'en')).toBe('Mon 12');
    expect(weatherLabel(0, 'en')).toEqual({ label: 'Clear', icon: 'sun' });
    expect(weatherLabel(95, 'en').label).toBe('Thunderstorm');
    expect(rulerTicks('en').map(([, l]) => l)).toEqual(['15 min', '1 h', '1 d', '1 wk', '1 mo']);
    expect(activityLabel('randonnee', 'en')).toBe('Hiking');
    expect(activityLabel('kite-surf', 'en')).toBe('Kite surf');
    expect(durationZone(48, 'en')).toBe('Expedition');
    expect(classifyScale(48, 'en')).toEqual({
      id: 'expedition',
      label: 'Expedition',
      rule: '2 to 10 days',
    });
    expect(classifyScale(48)).toEqual({
      id: 'expedition',
      label: 'Expédition',
      rule: '2 à 10 jours',
    });
    for (const code of [0, 1, 3, 45, 51, 61, 71, 80, 85, 95, 4])
      english(weatherLabel(code, 'en').label);
    for (const h of [1, 5, 20, 30, 300])
      english(`${classifyScale(h, 'en')!.label} ${classifyScale(h, 'en')!.rule}`);
  });
});

describe('veille : les règles', () => {
  it('sans locale : le français d’avant, identique à la locale fr', () => {
    expect(watchRules([], 'fr')).toEqual(watchRules([]));
    expect(watchRules([])[0].label).toBe('Orages annoncés');
  });

  it('en anglais, avec les seuils du moteur', () => {
    const labels = watchRules([], 'en').map((r) => r.label);
    expect(labels[0]).toBe('Thunderstorms forecast');
    expect(labels.join(' | ')).toContain('60 km/h');
    expect(labels.join(' | ')).toContain('1200 m');
    for (const l of labels) english(l);
  });
});

const adviceInput = (over: Partial<AdviceInput> = {}): AdviceInput => ({
  activity: 'hiking',
  nights: [],
  maxAltitudeM: 1000,
  party: 1,
  startDate: null,
  lat: 45,
  countryCode: 'FR',
  ...over,
});

describe('conseils essentiels', () => {
  it('sans locale : le français d’avant, identique à la locale fr', () => {
    expect(essentialAdvice(adviceInput())).toEqual([
      'Seul·e : laisse ton itinéraire et ton heure de retour à un proche. Urgence : 112.',
    ]);
    expect(essentialAdvice(adviceInput({ maxAltitudeM: 3000 }), 3, 'fr')).toEqual(
      essentialAdvice(adviceInput({ maxAltitudeM: 3000 }))
    );
  });

  it('en anglais', () => {
    expect(essentialAdvice(adviceInput(), 3, 'en')).toEqual([
      'On your own: leave your route and return time with someone close. Emergency: 112.',
    ]);
    for (const activity of ['hiking', 'water', 'ski', 'trekking'])
      for (const maxAltitudeM of [null, 2450, 3000])
        for (const startDate of [null, '2027-01-10', '2027-07-10'])
          for (const lat of [45, 10])
            for (const countryCode of ['FR', 'PE'])
              for (const n of essentialAdvice(
                adviceInput({
                  activity,
                  maxAltitudeM,
                  startDate,
                  lat,
                  countryCode,
                  party: 1,
                  nights: ['refuge', 'bivouac'],
                }),
                9,
                'en'
              ))
                english(n);
  });

  it('même nombre de conseils, dans le même ordre, dans les deux langues', () => {
    const input = adviceInput({
      activity: 'trekking',
      maxAltitudeM: null,
      lat: 10,
      nights: ['refuge'],
      startDate: '2027-07-10',
    });
    expect(essentialAdvice(input, 3, 'en')).toHaveLength(essentialAdvice(input).length);
  });
});

const fc = (over: Partial<DayForecast> = {}): DayForecast => ({
  date: '2026-10-12',
  tMin: -2,
  tMax: 28,
  precipPct: 80,
  precipMm: 12,
  gustMax: 20,
  code: 61,
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
  walkMin: 900,
  ...over,
});

describe('conseils de kit', () => {
  const input = (lat = 10, maxAltitudeM: number | null = 3000) => ({
    lines: [{ name: 'Veste Gore-Tex' }],
    forecasts: [{ day: 1, date: '2026-10-12', forecast: fc() }],
    dayPlans: [plan()],
    waterPointsCount: 3,
    context: { lat, maxAltitudeM, climate: null, activity: 'bushcraft' },
  });

  it('sans locale : le français d’avant, identique à la locale fr', () => {
    expect(adviseKit(input(), 'fr')).toEqual(adviseKit(input()));
    expect(adviseKit(input())[0]).toMatchObject({
      label: 'Veste imperméable',
      reason: 'Jour 1 (12/10) : pluie à 80 %, 12 mm.',
    });
  });

  it('en anglais : mêmes besoins, textes anglais', () => {
    const fr = adviseKit(input());
    const en = adviseKit(input(), 'en');
    expect(en.map((a) => [a.id, a.covered, a.coveredBy])).toEqual(
      fr.map((a) => [a.id, a.covered, a.coveredBy])
    );
    expect(en[0]).toMatchObject({
      label: 'Waterproof jacket',
      reason: 'Day 1 (10/12): 80% chance of rain, 12 mm.',
      source: 'MET Norway',
    });
    for (const a of en) {
      english(a.label);
      english(a.reason);
      english(a.source);
    }
  });
});

describe('conseils de kit tirés des normales (NASA POWER)', () => {
  it('en anglais, pour chaque lieu des fixtures et chaque saison : aucun mot français', () => {
    for (const place of Object.keys(fixtures) as Array<keyof typeof fixtures>)
      for (const month of [1, 4, 7, 10])
        for (const maxAltitudeM of [null, 3000])
          for (const water of [null, 0, 1, 4]) {
            const input = {
              lines: [],
              forecasts: [{ day: 1, date: '2027-01-10', forecast: null }],
              dayPlans: [plan({ date: null, walkMin: 400 })],
              waterPointsCount: water,
              context: {
                lat: fixtures[place].lat,
                maxAltitudeM,
                altitudeFrom: 'lieux' as const,
                activity: 'bushcraft',
                climate: climateWindow(powerClimateNormals(fixtures[place].payload), [
                  `2027-${String(month).padStart(2, '0')}-10`,
                ]),
              },
            };
            const en = adviseKit(input, 'en');
            expect(en.map((a) => a.id)).toEqual(adviseKit(input).map((a) => a.id));
            for (const a of en) {
              english(a.label);
              english(a.reason);
              english(a.source);
            }
          }
  });

  it('le mois et les nombres suivent la langue', () => {
    const input = {
      lines: [],
      forecasts: [],
      dayPlans: [],
      waterPointsCount: null,
      context: {
        lat: fixtures.ubud.lat,
        maxAltitudeM: 2600,
        climate: climateWindow(powerClimateNormals(fixtures.ubud.payload), ['2027-01-10']),
      },
    };
    const reasons = adviseKit(input, 'en')
      .map((a) => a.reason)
      .join(' ');
    expect(reasons).toMatch(/In January: \d+(\.\d)? mm per day/);
    expect(reasons).toContain('Route up to 2,600 m');
    expect(
      adviseKit(input)
        .map((a) => a.reason)
        .join(' ')
    ).toContain('Parcours jusqu’à 2 600 m');
  });
});
