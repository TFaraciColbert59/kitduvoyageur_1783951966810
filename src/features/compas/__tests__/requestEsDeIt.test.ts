import { describe, expect, it } from 'vitest';
import { parseIntentRules, phraseLanguage, type CompasIntentAction } from '../engine/intent';
import { understandRequest } from '../engine/request';
import { daysBetweenIso } from '../engine/format';
import es from './fixtures/request-es.json';
import de from './fixtures/request-de.json';
import it_ from './fixtures/request-it.json';
import en from './fixtures/request-en.json';

/**
 * PLAN-100 6.2 — la phrase espagnole, allemande et italienne comprise par les règles (sans IA).
 * Chaque corpus (50 phrases, écrites avant le code) est rejoué champ par champ ; les 15 phrases
 * témoins ont été écrites après le code.
 */

type Field = 'days' | 'party' | 'activity' | 'destination' | 'origin' | 'start' | 'end' | 'budget';
const FIELDS: Field[] = ['days', 'party', 'activity', 'destination', 'origin', 'start', 'end', 'budget'];
type Case = { text: string; expect: Partial<Record<Field, unknown>> };
const TODAY = '2026-10-07';

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

function score(parse: (text: string) => CompasIntentAction[], cases: Case[]) {
  let ok = 0;
  let total = 0;
  let nullsOk = true;
  const failures: string[] = [];
  for (const c of cases) {
    const got = read(parse(c.text));
    for (const f of FIELDS) {
      if (!(f in c.expect)) continue;
      total += 1;
      const want = c.expect[f];
      if (JSON.stringify(got[f]) === JSON.stringify(want)) ok += 1;
      else {
        if (want === null) nullsOk = false;
        failures.push(`${f} « ${c.text} » : attendu ${JSON.stringify(want)}, lu ${JSON.stringify(got[f])}`);
      }
    }
  }
  return { ok, total, rate: total ? ok / total : 0, nullsOk, failures };
}

const CORPORA = [
  ['es', es],
  ['de', de],
  ['it', it_],
] as const;

for (const [lang, corpus] of CORPORA) {
  describe(`corpus ${lang} (50 phrases) — règles seules`, () => {
    it('le corpus a 50 phrases et 15 phrases témoins', () => {
      expect(corpus.cases).toHaveLength(50);
      expect(corpus.heldOut).toHaveLength(15);
    });

    it(`locale « ${lang} » : au moins 90 % des champs, rien d’ambigu deviné`, () => {
      const s = score((t) => parseIntentRules(t, TODAY, lang), corpus.cases as Case[]);
      console.info(`[corpus ${lang.toUpperCase()}, locale ${lang}] ${s.ok}/${s.total} (${(s.rate * 100).toFixed(1)} %)`);
      if (s.failures.length) console.info(s.failures.join('\n'));
      expect(s.nullsOk).toBe(true);
      expect(s.rate).toBeGreaterThanOrEqual(0.9);
    });

    it('phrases témoins écrites après le code (15) : au moins 85 %, rien d’ambigu deviné', () => {
      const s = score((t) => parseIntentRules(t, TODAY, lang), corpus.heldOut as Case[]);
      console.info(`[témoins ${lang.toUpperCase()}] ${s.ok}/${s.total} (${(s.rate * 100).toFixed(1)} %)`);
      if (s.failures.length) console.info(s.failures.join('\n'));
      expect(s.nullsOk).toBe(true);
      expect(s.rate).toBeGreaterThanOrEqual(0.85);
    });

    it('interface en français (langue reconnue dans la phrase) : même seuil', () => {
      const s = score((t) => parseIntentRules(t, TODAY), corpus.cases as Case[]);
      console.info(`[corpus ${lang.toUpperCase()}, sans locale] ${s.ok}/${s.total} (${(s.rate * 100).toFixed(1)} %)`);
      expect(s.nullsOk).toBe(true);
      expect(s.rate).toBeGreaterThanOrEqual(0.9);
    });
  });
}

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
    'via ferrata en Italie, 2 jours',
    'trekking dans les Dolomites avec ma sœur',
    'une semaine en Sardaigne',
  ];

  it('une phrase française n’est jamais prise pour de l’espagnol, de l’allemand ou de l’italien', () => {
    for (const t of FRENCH) expect(['es', 'de', 'it'], t).not.toContain(phraseLanguage(t));
  });

  it('une phrase anglaise du corpus anglais reste anglaise', () => {
    for (const c of [...en.cases, ...en.heldOut]) expect(['es', 'de', 'it'], c.text).not.toContain(phraseLanguage(c.text));
  });

  it('les corpus sont reconnus dans leur langue', () => {
    for (const [lang, corpus] of CORPORA)
      for (const c of corpus.cases) expect(phraseLanguage(c.text), c.text).toBe(lang);
  });

  it('les noms de lieu seuls ne décident pas', () => {
    expect(phraseLanguage('Sierra Nevada')).toBeNull();
    expect(phraseLanguage('Cinque Terre')).toBeNull();
    expect(phraseLanguage('ski Zermatt')).toBeNull();
  });

  it('interface espagnole, phrase française : les expressions françaises restent lues', () => {
    const r = read(parseIntentRules('5 jours de trek dans le Vercors à 3', TODAY, 'es'));
    expect(r).toMatchObject({ days: 5, party: 3, activity: 'trekking', destination: 'Vercors' });
  });
});

describe('détails', () => {
  const p = (t: string, l: 'es' | 'de' | 'it') => read(parseIntentRules(t, TODAY, l));

  it('nombres en lettres', () => {
    expect(p('veintiún días en Perú', 'es').days).toBe(21);
    expect(p('Dreiundzwanzig Tage in Peru', 'de').days).toBe(23);
    expect(p('ventidue giorni in Perù', 'it').days).toBe(22);
    expect(p('somos doce, 3 días en Gredos', 'es').party).toBe(12);
  });

  it('« 10/12 » se lit jour/mois (ordre européen)', () => {
    expect(p('Salida el 10/12 a Madeira', 'es').start).toBe('2026-12-10');
    expect(p('Partenza il 10/12 per Madeira', 'it').start).toBe('2026-12-10');
    expect(p('Abflug am 10.12. nach Madeira', 'de').start).toBe('2026-12-10');
  });

  it('fêtes locales', () => {
    expect(p('Reyes en Granada', 'es').start).toBe('2027-01-06');
    expect(p('Ostern im Tessin', 'de').start).toBe('2027-03-28');
    expect(p('Silvester in Berlin', 'de').start).toBe('2026-12-31');
    expect(p('Pasquetta in Umbria', 'it').start).toBe('2027-03-29');
    expect(p('Capodanno a Vienna', 'it').start).toBe('2026-12-31');
  });

  it('saisons : jamais une date ni une destination', () => {
    expect(p('Trekking en invierno', 'es')).toMatchObject({ start: null, destination: null });
    expect(p('Wandern im Herbst', 'de')).toMatchObject({ start: null, destination: null });
    expect(p('Escursioni in primavera', 'it')).toMatchObject({ start: null, destination: null });
  });

  it('compagnie sans nombre : non comprise', () => {
    expect(p('Senderismo con amigos en Gredos', 'es').party).toBeNull();
    expect(p('Wandern mit Freunden im Harz', 'de').party).toBeNull();
    expect(p('Escursioni con gli amici in Sila', 'it').party).toBeNull();
    expect(p('Familie mit 2 Kindern im Harz', 'de').party).toBeNull();
  });

  it('« solo » suivi d’un nombre veut dire « seulement »', () => {
    expect(p('Solo 3 días en Mallorca', 'es').party).toBeNull();
    expect(p('Solo 3 giorni a Capri', 'it').party).toBeNull();
  });

  it('les noms communs allemands ne sont pas des lieux', () => {
    expect(p('Wandern in der Natur am Wochenende', 'de').destination).toBeNull();
  });
});

describe('understandRequest en espagnol', () => {
  it('la phrase espagnole est comprise', () => {
    const r = understandRequest('3 días en los Pirineos, somos 4, salimos el sábado', TODAY, {}, 'es');
    const line = (k: string) => r.lines.find((l) => l.key === k);
    expect(line('lieu')).toMatchObject({ value: 'Pirineos', state: 'compris' });
    expect(line('groupe')).toMatchObject({ state: 'compris' });
    expect(line('quand')?.state).toBe('compris');
  });
});
