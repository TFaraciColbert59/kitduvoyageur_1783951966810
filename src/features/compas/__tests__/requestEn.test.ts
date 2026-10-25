import { describe, expect, it } from 'vitest';
import { looksEnglish, parseIntentRules, type CompasIntentAction } from '../engine/intent';
import { understandRequest } from '../engine/request';
import { daysBetweenIso } from '../engine/format';
import corpus from './fixtures/request-en.json';

/**
 * PLAN-100 6.2 — la phrase anglaise comprise par les règles (sans IA).
 * Le corpus est rejoué champ par champ ; le score par champ est affiché.
 */

type Field = 'days' | 'party' | 'activity' | 'destination' | 'origin' | 'start' | 'end' | 'budget';
const FIELDS: Field[] = [
  'days',
  'party',
  'activity',
  'destination',
  'origin',
  'start',
  'end',
  'budget',
];
type Expect = Partial<Record<Field, unknown>>;

const TODAY = corpus.today;

function read(actions: CompasIntentAction[]): Record<Field, unknown> {
  const find = <T extends CompasIntentAction['type']>(type: T) =>
    actions.find((a) => a.type === type) as Extract<CompasIntentAction, { type: T }> | undefined;
  const dates = find('set_dates');
  const duration = find('set_duration');
  const budget = find('set_budget');
  return {
    days: duration?.days ?? (dates?.end ? daysBetweenIso(dates.start, dates.end) + 1 : null),
    party: find('set_party_size')?.count ?? null,
    activity: find('set_activity')?.activity ?? null,
    destination: find('set_destination')?.place ?? null,
    origin: find('set_origin')?.place ?? null,
    start: dates?.start ?? null,
    end: dates?.end ?? null,
    budget: budget ? { amount: budget.amount, currency: budget.currency ?? null } : null,
  };
}

type Case = { text: string; expect: Expect };

function score(
  parse: (text: string) => CompasIntentAction[],
  cases: Case[] = corpus.cases as Case[]
) {
  const per = Object.fromEntries(FIELDS.map((f) => [f, { ok: 0, total: 0 }])) as Record<
    Field,
    { ok: number; total: number }
  >;
  const failures: string[] = [];
  let nullsOk = true;
  for (const c of cases) {
    const got = read(parse(c.text));
    for (const f of FIELDS) {
      if (!(f in c.expect)) continue;
      per[f].total += 1;
      const want = c.expect[f];
      if (JSON.stringify(got[f]) === JSON.stringify(want)) per[f].ok += 1;
      else {
        if (want === null) nullsOk = false;
        failures.push(
          `${f} « ${c.text} » : attendu ${JSON.stringify(want)}, lu ${JSON.stringify(got[f])}`
        );
      }
    }
  }
  const ok = FIELDS.reduce((t, f) => t + per[f].ok, 0);
  const total = FIELDS.reduce((t, f) => t + per[f].total, 0);
  return { per, ok, total, rate: ok / total, failures, nullsOk };
}

describe('corpus anglais (50 phrases) — règles seules', () => {
  it('le corpus a 50 phrases', () => {
    expect(corpus.cases).toHaveLength(50);
  });

  it('locale « en » : au moins 90 % des champs attendus lus, rien d’ambigu deviné', () => {
    const s = score((t) => parseIntentRules(t, TODAY, 'en'));
    const table = FIELDS.map((f) => `${f}: ${s.per[f].ok}/${s.per[f].total}`).join(' · ');
    console.info(
      `[corpus EN, locale en] ${s.ok}/${s.total} (${(s.rate * 100).toFixed(1)} %) — ${table}`
    );
    if (s.failures.length) console.info(s.failures.join('\n'));
    expect(s.nullsOk).toBe(true);
    expect(s.rate).toBeGreaterThanOrEqual(0.9);
  });

  it('phrases témoins écrites après le code (15) : au moins 85 %, rien d’ambigu deviné', () => {
    const s = score((t) => parseIntentRules(t, TODAY, 'en'), corpus.heldOut as Case[]);
    if (s.failures.length) console.info(s.failures.join('\n'));
    expect(s.nullsOk).toBe(true);
    expect(s.rate).toBeGreaterThanOrEqual(0.85);
  });

  it('sans locale (phrase sans équivoque anglaise) : même seuil', () => {
    const s = score((t) => parseIntentRules(t, TODAY));
    console.info(`[corpus EN, sans locale] ${s.ok}/${s.total} (${(s.rate * 100).toFixed(1)} %)`);
    expect(s.nullsOk).toBe(true);
    expect(s.rate).toBeGreaterThanOrEqual(0.9);
  });
});

describe('détails anglais', () => {
  const en = (t: string) => read(parseIntentRules(t, TODAY, 'en'));

  it('nombres en lettres', () => {
    expect(en('three days in Wales').days).toBe(3);
    expect(en('twelve nights in Peru').days).toBe(13);
  });

  it('« 10/12 » est ambigu (jour/mois US ou UK) : non compris', () => {
    expect(en('Leaving 10/12 to Madeira').start).toBeNull();
    expect(en('10/12 to 15/12 in Madeira').start).toBeNull();
    // 12/25 ne peut être que mois/jour, 25/12 que jour/mois.
    expect(en('Leaving 12/25 to Madeira').start).toBe('2026-12-25');
  });

  it('compagnie : avec qui, sans nombre inventé', () => {
    expect(en('hiking with my wife').party).toBe(2);
    expect(en('hiking with my wife and kids').party).toBeNull();
    expect(en('hiking with friends').party).toBeNull();
    expect(en('a 3 day hike in Wales').party).toBeNull();
    expect(en('for 5 days in Wales').party).toBeNull();
  });

  it('un mois, une saison ou un jour n’est jamais une destination', () => {
    expect(en('Hiking on Saturday').destination).toBeNull();
    expect(en('A trek in the Summer').destination).toBeNull();
  });
});

describe('détection de langue', () => {
  const FRENCH = [
    '5 jours de trek dans le Vercors à 3, en refuge',
    'rando dans les Vosges ce week-end',
    'escalade à Kalymnos',
    'ski à Chamonix en février avec ma femme',
    'kayak en Ardèche depuis Lyon, 3 jours',
    'road trip en Islande du 3 au 12 juillet, budget 2000 €',
    'Paris',
    'trek au Népal pour 3 semaines en avril, on est 4',
    'week-end à Annecy le 10/12',
  ];

  it('une phrase française n’est jamais prise pour de l’anglais', () => {
    for (const t of FRENCH) expect(looksEnglish(t), t).toBe(false);
  });

  it('sans locale, une phrase française est lue exactement comme avant (locale « fr »)', () => {
    for (const t of FRENCH)
      expect(parseIntentRules(t, TODAY), t).toEqual(parseIntentRules(t, TODAY, 'fr'));
  });

  it('les mots communs aux deux langues ne décident pas', () => {
    expect(looksEnglish('ski Paris kayak')).toBe(false);
    expect(looksEnglish('trek solo Patagonie')).toBe(false);
    expect(looksEnglish('3 days in the Vercors, 4 of us')).toBe(true);
  });

  it('interface en anglais, phrase française : les expressions françaises restent lues', () => {
    const r = read(parseIntentRules('5 jours de trek dans le Vercors à 3', TODAY, 'en'));
    expect(r).toMatchObject({ days: 5, party: 3, activity: 'trekking', destination: 'Vercors' });
  });
});

describe('understandRequest en anglais', () => {
  it('la phrase anglaise est comprise, lignes en anglais', () => {
    const r = understandRequest(
      '3 days in the Vercors, 4 of us, leaving Saturday',
      TODAY,
      {},
      'en'
    );
    const line = (k: string) => r.lines.find((l) => l.key === k);
    expect(line('lieu')).toMatchObject({ value: 'Vercors', state: 'compris' });
    expect(line('groupe')).toMatchObject({ state: 'compris' });
    expect(line('quand')?.state).toBe('compris');
  });
});
