/**
 * Essais aléatoires (graine fixe, reproductibles) : des phrases composées de
 * morceaux dont on connaît la réponse attendue — activité, lieu, durée,
 * personnes, contraintes — sur toutes les activités et des destinations du
 * monde entier. Chaque phrase traverse la chaîne complète (lecture, ancrage,
 * plan d'application, contexte projet, période, distance, modèle) et doit
 * rester cohérente. Un échec affiche la phrase qui l'a provoqué.
 */
import { describe, expect, it } from 'vitest';
import {
  groundingIssue,
  parseIntentRules,
  planApplication,
  validateActions,
  type CompasIntentAction,
} from '../engine/intent';
import { expectedKm, resolveProjectContext } from '../engine/projectContext';
import { bestPeriod } from '../engine/period';
import { buildCompasModel } from '../engine/compasModel';
import { projectBasis, staleParts } from '../engine/dependencies';

const TODAY = '2026-10-06';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Activité attendue → façons de la dire (français et anglais). */
const ACTIVITY_WORDS: Array<[string, string[]]> = [
  ['hiking', ['randonnée', 'rando', 'randonnées']],
  ['trekking', ['trek', 'trekking']],
  ['cycling', ['vélo', 'bikepacking', 'cyclotourisme', 'VTT']],
  ['ski', ['ski', 'ski de rando', 'raquettes']],
  ['mountaineering', ['alpinisme', 'course en glacier']],
  ['climbing', ['escalade', 'via ferrata']],
  ['water', ['kayak', 'canoë', 'paddle', 'voile']],
  ['vanlife', ['van', 'camping-car']],
  ['citytrip', ['city trip', 'citytrip']],
  ['beach', ['plage', 'farniente']],
  ['roadtrip', ['road trip', 'roadtrip']],
  ['bushcraft', ['bushcraft']],
  ['trail', ['trail', 'ultra-trail']],
  ['running', ['course à pied', 'footing', 'jogging']],
];

/** Lieux avec leur préposition (accents, tirets, articles, noms composés). */
const PLACES: Array<[string, string]> = [
  ['en', 'Allemagne'],
  ['en', 'Norvège'],
  ['en', 'Islande'],
  ['au', 'Japon'],
  ['au', 'Pérou'],
  ['au', 'Maroc'],
  ['au', 'Népal'],
  ['aux', 'Açores'],
  ['en', 'Écosse'],
  ['en', 'Patagonie'],
  ['en', 'Corse'],
  ['en', 'Nouvelle-Zélande'],
  ['au', 'Costa Rica'],
  ['à', 'Chamonix'],
  ['à', 'Lisbonne'],
  ['à', 'New York'],
  ['dans le', 'Vercors'],
  ['dans les', 'Dolomites'],
  ['dans les', 'Pyrénées'],
  ['en', 'Laponie'],
];

type Duration = { text: string; days: number | null; hours: number | null };
const DURATIONS: Duration[] = [
  { text: '3 jours', days: 3, hours: null },
  { text: '7 jours', days: 7, hours: null },
  { text: '10 jours', days: 10, hours: null },
  { text: 'deux jours', days: 2, hours: null },
  { text: 'une semaine', days: 7, hours: null },
  { text: 'deux semaines', days: 14, hours: null },
  { text: '5 jours', days: 5, hours: null },
  { text: '2 nuits', days: 3, hours: null },
];

const PARTY: Array<{ text: string; count: number | null }> = [
  { text: '', count: null },
  { text: 'à 4', count: 4 },
  { text: 'en couple', count: 2 },
  { text: 'seul', count: 1 },
  { text: 'pour 6 personnes', count: 6 },
];

const EXTRAS: Array<{ text: string; check: (a: CompasIntentAction[]) => boolean }> = [
  { text: '', check: () => true },
  { text: 'dormir dehors 2 nuits', check: (a) => a.some((x) => x.type === 'set_outdoor_nights' && x.nights === 2) },
  { text: 'rester sous 11 kg', check: (a) => a.some((x) => x.type === 'set_max_pack' && x.kg === 11) },
  { text: 'surtout de la montagne', check: (a) => a.some((x) => x.type === 'set_terrain' && x.terrain === 'montagne') },
  { text: 'je débute', check: (a) => a.some((x) => x.type === 'set_level' && x.level === 'debut') },
  { text: 'en refuge', check: (a) => a.some((x) => x.type === 'set_nights' && x.nights === 'refuge') },
];

function pick<T>(r: () => number, list: T[]): T {
  return list[Math.floor(r() * list.length)];
}

function sentence(r: () => number) {
  const [activity, words] = pick(r, ACTIVITY_WORDS);
  const word = pick(r, words);
  const [prep, place] = pick(r, PLACES);
  const dur = pick(r, DURATIONS);
  const party = pick(r, PARTY);
  const extra = pick(r, EXTRAS);
  const order = Math.floor(r() * 3);
  const parts =
    order === 0
      ? [`${dur.text} de ${word} ${prep} ${place}`, party.text, extra.text]
      : order === 1
        ? [`${word} ${prep} ${place}`, dur.text, party.text, extra.text]
        : [`${dur.text} ${prep} ${place}`, `en ${word}`, party.text, extra.text];
  const text = parts.filter(Boolean).join(', ');
  return { text, activity, place, dur, party, extra };
}

describe('Essais aléatoires : phrases courtes, toute activité, toute destination', () => {
  const r = rng(20261006);
  const cases = Array.from({ length: 400 }, () => sentence(r));

  it.each(cases.map((c) => [c.text, c] as const))('%s', (_text, c) => {
    const actions = parseIntentRules(c.text, TODAY);
    const get = <T extends CompasIntentAction['type']>(t: T) =>
      actions.find((a) => a.type === t) as Extract<CompasIntentAction, { type: T }> | undefined;

    // Activité
    expect(get('set_activity')?.activity, 'activité').toBe(c.activity);
    // Lieu : le nom tel qu'écrit, sans morceau de durée ni de mois
    const dest = get('set_destination');
    expect(dest?.place, 'destination').toBe(c.place);
    // Durée
    const dur = get('set_duration');
    expect(dur?.days ?? null, 'durée en jours').toBe(c.dur.days);
    // Personnes
    expect(get('set_party_size')?.count ?? null, 'personnes').toBe(c.party.count);
    // Contrainte
    expect(c.extra.check(actions), `contrainte « ${c.extra.text} »`).toBe(true);

    // Chaque action des règles est ancrée dans la phrase
    for (const a of actions) expect(groundingIssue(a, c.text), `ancrage ${a.type}`).toBeNull();

    // Validation et plan d'application ne tombent jamais
    const proposals = validateActions(
      actions.map((action) => ({ action, source: 'regles' as const })),
      { today: TODAY, startDate: null, endDate: null, engaged: 0, currency: 'EUR', avoid: [], wishes: [] }
    );
    expect(proposals.filter((p) => !p.ok).map((p) => `${p.label} : ${p.reason}`), 'propositions refusées').toEqual([]);
    const ops = planApplication(
      proposals.filter((p) => p.ok).map((p) => p.action),
      { startDate: null, endDate: null, days: null, shortHours: null, preferences: { pace: 'normal', nights: null, avoid: [], wishes: [] }, hasRoute: false }
    );
    expect(ops.length).toBeGreaterThan(0);

    // Contexte projet, période, distance : cohérents pour CE projet
    const days = c.dur.days ?? 1;
    const ctx = resolveProjectContext({
      activity: c.activity,
      days,
      hours: c.dur.hours,
      partySize: c.party.count,
      month: null,
      project: null,
      profile: { terrain: 'sentier', autonomy: 'itinerance_longue', priority: 'budget', experience: 'regulier' },
    });
    if (days > 1 && !['running', 'trail'].includes(c.activity)) expect(ctx.modules.nights).toBe(true);
    if (days <= 1) expect(ctx.nights.value).toBeNull();
    const period = bestPeriod({ activity: c.activity, lat: 45, today: TODAY, days });
    if (period) {
      expect(period.start >= '2026-10-27').toBe(true);
      expect(new Date(`${period.start}T12:00:00Z`).getUTCDay()).toBe(6);
    }
    const km = expectedKm(ctx, { hours: c.dur.hours, days, targetKm: null });
    if (km != null) expect(Number.isFinite(km) && km > 0).toBe(true);

    // Le modèle se construit, même sans étape ni objet
    const model = buildCompasModel({
      trip: {
        id: 't',
        slug: 's',
        title: c.text,
        destinationName: c.place,
        startDate: period?.start ?? null,
        endDate: period?.end ?? null,
        primaryActivity: c.activity,
        estimatedBudget: null,
        budgetCurrency: 'EUR',
        partySize: c.party.count,
        ownerId: 'u',
        durationHours: c.dur.hours,
        preferences: null,
      },
      steps: [],
      items: [],
      members: [],
      expenses: [],
      inventory: [],
      bookings: [],
      weather: [],
      routeHasGeometry: false,
      now: new Date(`${TODAY}T10:00:00Z`),
      timeZone: 'Europe/Paris',
    } as never);
    expect(model.verdict.level).toBeTruthy();

    // Dépendances : rien ne change → rien à refaire ; la durée change → itinéraire refait
    const b = projectBasis({ anchor: null, destinationName: c.place, days, hours: null, startDate: period?.start ?? null, activity: c.activity, partySize: c.party.count, prefs: null });
    expect(staleParts(b, b)).toEqual([]);
    expect(staleParts(b, { ...b, days: days + 3 })).toContain('steps');
  });
});

/* ---------- Cas plus durs : dates, noms composés, anglais, ordre libre ---------- */

const HARD_PLACES: Array<[string, string]> = [
  ['à l’', 'Île de Ré'],
  ['dans le', "Val d'Aran"],
  ['aux', 'États-Unis'],
  ['à la', 'Réunion'],
  ['en', 'Afrique du Sud'],
  ['au', 'Mont Blanc'],
  ['en', 'Côte d’Ivoire'],
  ['dans le', 'Jura'],
  ['à', 'Saint-Jean-Pied-de-Port'],
  ['en', 'Bosnie-Herzégovine'],
  ['au', 'Kirghizistan'],
  ['en', 'Sardaigne'],
];

const DATES: Array<{ text: string; start: string; end: string | null }> = [
  { text: 'en mai', start: '2027-05-01', end: null },
  { text: 'en septembre', start: '2027-09-01', end: null },
  { text: 'début juillet', start: '2027-07-01', end: null },
  { text: 'mi-août', start: '2027-08-15', end: null },
  { text: 'en décembre', start: '2026-12-01', end: null },
  { text: 'demain', start: '2026-10-07', end: null },
  { text: 'le 14 juillet', start: '2027-07-14', end: null },
];

describe('Essais aléatoires : dates, noms composés, ordre libre', () => {
  const r = rng(7);
  const cases = Array.from({ length: 300 }, () => {
    const [activity, words] = pick(r, ACTIVITY_WORDS);
    const word = pick(r, words);
    const [prep, place] = pick(r, [...PLACES, ...HARD_PLACES]);
    const dur = pick(r, DURATIONS);
    const date = pick(r, DATES);
    const order = Math.floor(r() * 3);
    const text =
      order === 0
        ? `${word} ${prep} ${place} ${dur.text} ${date.text}`
        : order === 1
          ? `${dur.text} ${prep} ${place} ${date.text}, ${word}`
          : `${date.text}, ${dur.text} de ${word} ${prep} ${place}`;
    return { text, activity, place, dur, date };
  });

  it.each(cases.map((c) => [c.text, c] as const))('%s', (_t, c) => {
    const actions = parseIntentRules(c.text, TODAY);
    const get = <T extends CompasIntentAction['type']>(t: T) =>
      actions.find((a) => a.type === t) as Extract<CompasIntentAction, { type: T }> | undefined;
    expect(get('set_activity')?.activity, 'activité').toBe(c.activity);
    expect(get('set_destination')?.place, 'destination').toBe(c.place);
    expect(get('set_duration')?.days ?? null, 'durée').toBe(c.dur.days);
    expect(get('set_dates')?.start, 'départ').toBe(c.date.start);
    for (const a of actions) expect(groundingIssue(a, c.text), `ancrage ${a.type}`).toBeNull();
  });
});

describe('Essais aléatoires : anglais', () => {
  const EN: Array<[string, string]> = [
    ['hiking', 'Hiking'],
    ['trekking', 'Trekking'],
    ['cycling', 'Cycling'],
    ['water', 'Kayaking'],
    ['running', 'Running'],
  ];
  const r = rng(99);
  const cases = Array.from({ length: 60 }, () => {
    const [activity, word] = pick(r, EN);
    const place = pick(r, ['Iceland', 'Norway', 'Scotland', 'Japan', 'Peru', 'Canada']);
    const days = 2 + Math.floor(r() * 12);
    return { text: `${word} in ${place} ${days} days`, activity, place, days };
  });
  it.each(cases.map((c) => [c.text, c] as const))('%s', (_t, c) => {
    const actions = parseIntentRules(c.text, TODAY);
    const get = <T extends CompasIntentAction['type']>(t: T) =>
      actions.find((a) => a.type === t) as Extract<CompasIntentAction, { type: T }> | undefined;
    expect(get('set_activity')?.activity, 'activité').toBe(c.activity);
    expect(get('set_destination')?.place, 'destination').toBe(c.place);
    expect(get('set_duration')?.days, 'durée').toBe(c.days);
  });
});

describe('Essais aléatoires : sorties courtes et budgets', () => {
  const SHORT: Array<[string, string]> = [
    ['running', 'courir'],
    ['running', 'footing'],
    ['trail', 'trail'],
    ['hiking', 'rando'],
    ['cycling', 'vélo'],
  ];
  const WHEN: Array<{ text: string; start: string }> = [
    { text: 'cet après-midi', start: '2026-10-06' },
    { text: 'ce soir', start: '2026-10-06' },
    { text: 'demain', start: '2026-10-07' },
    { text: 'samedi', start: '2026-10-10' },
    { text: '', start: '2026-10-06' },
  ];
  const r = rng(42);
  const cases = Array.from({ length: 200 }, () => {
    const [activity, word] = pick(r, SHORT);
    const hours = pick(r, [1, 2, 3, 4]);
    const when = pick(r, WHEN);
    const km = pick(r, [null, 10, 20, 42]);
    const budget = pick(r, [null, 50, 300]);
    const text = [`${word} ${hours}h`, km ? `${km} km` : '', when.text, budget ? `budget ${budget} €` : '']
      .filter(Boolean)
      .join(' ');
    return { text, activity, hours, when, km, budget };
  });
  it.each(cases.map((c) => [c.text, c] as const))('%s', (_t, c) => {
    const actions = parseIntentRules(c.text, TODAY);
    const get = <T extends CompasIntentAction['type']>(t: T) =>
      actions.find((a) => a.type === t) as Extract<CompasIntentAction, { type: T }> | undefined;
    expect(get('set_activity')?.activity, 'activité').toBe(c.activity);
    expect(get('set_duration')?.hours, 'heures').toBe(c.hours);
    expect(get('set_dates')?.start, 'jour').toBe(c.when.start);
    expect(get('set_distance')?.km ?? null, 'distance').toBe(c.km);
    expect(get('set_budget')?.amount ?? null, 'budget').toBe(c.budget);
    expect(get('set_destination'), 'aucun lieu inventé').toBeUndefined();
    const ctx = resolveProjectContext({ activity: c.activity, days: 1, hours: c.hours, partySize: 1, month: 10, project: null, profile: null });
    expect(ctx.scope).toBe('sortie');
    expect(ctx.modules).toEqual({ nights: false, transport: false, resa: false, fullPack: false });
    const km = expectedKm(ctx, { hours: c.hours, days: 1, targetKm: c.km });
    expect(km).toBeGreaterThan(0);
  });
});
