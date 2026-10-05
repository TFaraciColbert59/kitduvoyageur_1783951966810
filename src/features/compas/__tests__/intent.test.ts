import { describe, expect, it } from 'vitest';
import {
  groundingIssue,
  mergeActions,
  numberInText,
  parseIntentRules,
  planApplication,
  validateActions,
  type CompasIntentAction,
  type IntentContext,
} from '../engine/intent';

// Jeudi 1er octobre 2026.
const TODAY = '2026-10-01';
const ctx: IntentContext = {
  today: TODAY,
  startDate: null,
  endDate: null,
  engaged: 240,
  currency: 'EUR',
  avoid: [],
  wishes: [],
};
const types = (a: CompasIntentAction[]) => a.map((x) => x.type);

describe('lecteur de règles (sans IA)', () => {
  it('comprend une phrase complète', () => {
    const a = parseIntentRules(
      '3 jours dans le Vercors à 4, départ samedi, bivouac, tranquille, budget 300 €',
      TODAY
    );
    expect(a).toEqual(
      expect.arrayContaining([
        { type: 'set_dates', start: '2026-10-03', end: null },
        { type: 'set_duration', days: 3, hours: null },
        { type: 'set_party_size', count: 4 },
        { type: 'set_budget', amount: 300 },
        { type: 'set_pace', pace: 'tranquille' },
        { type: 'set_nights', nights: 'bivouac' },
        { type: 'search_route', query: 'Vercors' },
      ])
    );
  });

  it('dates en toutes lettres, intervalle et année suivante', () => {
    expect(parseIntentRules('du 12 au 14 octobre', TODAY)[0]).toEqual({
      type: 'set_dates',
      start: '2026-10-12',
      end: '2026-10-14',
    });
    expect(parseIntentRules('le 3 mars', TODAY)[0]).toEqual({
      type: 'set_dates',
      start: '2027-03-03',
      end: null,
    });
    expect(parseIntentRules('demain', TODAY)[0]).toEqual({
      type: 'set_dates',
      start: '2026-10-02',
      end: null,
    });
  });

  it('nuits, semaines, heures et week-end', () => {
    expect(parseIntentRules('2 nuits en refuge', TODAY)).toEqual(
      expect.arrayContaining([
        { type: 'set_duration', days: 3, hours: null },
        { type: 'set_nights', nights: 'refuge' },
      ])
    );
    expect(parseIntentRules('une semaine', TODAY)).toContainEqual({
      type: 'set_duration',
      days: 7,
      hours: null,
    });
    expect(parseIntentRules('sortie de 2h30', TODAY)).toContainEqual({
      type: 'set_duration',
      days: null,
      hours: 2.5,
    });
    expect(parseIntentRules('ce week-end', TODAY)).toEqual(
      expect.arrayContaining([
        { type: 'set_dates', start: '2026-10-03', end: null },
        { type: 'set_duration', days: 2, hours: null },
      ])
    );
  });

  it("une heure de départ n'est pas une durée, une altitude n'est pas un groupe", () => {
    expect(types(parseIntentRules('départ à 8h', TODAY))).not.toContain('set_duration');
    expect(types(parseIntentRules('un sommet à 3000 m', TODAY))).not.toContain('set_party_size');
    expect(types(parseIntentRules('il y a une rivière', TODAY))).not.toContain('set_party_size');
  });

  it('éviter, envies et objets', () => {
    const a = parseIntentRules('sans voiture, envie de voir un lac, ajoute 2 frontales', TODAY);
    expect(a).toContainEqual({ type: 'avoid', label: 'voiture' });
    expect(a).toContainEqual({ type: 'wish', label: 'voir un lac' });
    expect(a).toContainEqual({ type: 'add_item', name: 'frontales', quantity: 2 });
  });
});

describe('ancrage : rien qui ne soit dans la phrase', () => {
  it('refuse un nombre inventé', () => {
    expect(numberInText('budget 1 200 €', 1200)).toBe(true);
    expect(numberInText('on part à quatre', 4)).toBe(true);
    expect(groundingIssue({ type: 'set_party_size', count: 6 }, 'on part à quatre')).toMatch(
      /absent/
    );
    expect(groundingIssue({ type: 'set_budget', amount: 500 }, 'pas trop cher')).toMatch(/absent/);
    expect(groundingIssue({ type: 'set_duration', days: 3, hours: null }, 'deux nuits')).toBeNull();
    expect(
      groundingIssue({ type: 'set_dates', start: '2026-10-03', end: null }, 'samedi')
    ).toBeNull();
    expect(
      groundingIssue({ type: 'set_dates', start: '2026-10-17', end: null }, 'bientôt')
    ).toMatch(/absente/);
  });
});

describe('limites réelles', () => {
  it('date passée, enveloppe sous l’engagé, durée sans départ', () => {
    const p = validateActions(
      [
        { action: { type: 'set_budget', amount: 100 }, source: 'regles' },
        { action: { type: 'set_duration', days: 3, hours: null }, source: 'regles' },
        { action: { type: 'set_party_size', count: 4 }, source: 'ia' },
      ],
      ctx
    );
    expect(p[0]).toMatchObject({ ok: false, reason: expect.stringMatching(/240/) });
    // Une durée en jours se garde sans date de départ : le préremplissage s'en sert.
    expect(p[1]).toMatchObject({ ok: true, reason: null });
    expect(p[2]).toMatchObject({ ok: true, label: '4 personnes', source: 'ia' });
    const past = validateActions(
      [{ action: { type: 'set_dates', start: '2026-09-01', end: null }, source: 'ia' }],
      ctx
    );
    expect(past[0].reason).toBe('Date passée');
  });

  it("l'IA passe d'abord, les règles complètent sans doublon", () => {
    const merged = mergeActions(
      [{ type: 'set_party_size', count: 4 }],
      [
        { type: 'set_party_size', count: 3 },
        { type: 'set_pace', pace: 'tranquille' },
      ]
    );
    expect(merged).toEqual([
      { action: { type: 'set_party_size', count: 4 }, source: 'ia' },
      { action: { type: 'set_pace', pace: 'tranquille' }, source: 'regles' },
    ]);
  });
});

describe("plan d'application", () => {
  const current = {
    startDate: '2026-10-12',
    endDate: '2026-10-15',
    days: 4,
    shortHours: null,
    preferences: { pace: 'normal' as const, nights: null, avoid: [], wishes: [] },
    hasRoute: true,
  };

  it('durée seule : garde le départ, recalcule la fin et redécoupe', () => {
    expect(planApplication([{ type: 'set_duration', days: 3, hours: null }], current)).toEqual([
      {
        op: 'dates',
        startDate: '2026-10-12',
        endDate: '2026-10-14',
        durationHours: null,
        resplit: true,
      },
    ]);
  });

  it('départ seul : garde la durée, sans redécouper', () => {
    expect(
      planApplication([{ type: 'set_dates', start: '2026-10-20', end: null }], current)[0]
    ).toEqual({
      op: 'dates',
      startDate: '2026-10-20',
      endDate: '2026-10-23',
      durationHours: null,
      resplit: false,
    });
  });

  it('regroupe les préférences en une seule écriture', () => {
    const ops = planApplication(
      [
        { type: 'set_pace', pace: 'tranquille' },
        { type: 'avoid', label: 'voiture' },
        { type: 'set_party_size', count: 4 },
      ],
      current
    );
    expect(ops).toEqual([
      { op: 'party', partySize: 4 },
      {
        op: 'prefs',
        preferences: { pace: 'tranquille', nights: null, avoid: ['voiture'], wishes: [] },
      },
    ]);
  });
});

describe('Mois seul (« en janvier », « début mai », « week-end en mai »)', () => {
  const today = '2026-10-05';
  const dates = (t: string) => parseIntentRules(t, today).find((a) => a.type === 'set_dates');
  const place = (t: string) =>
    (parseIntentRules(t, today).find((a) => a.type === 'set_destination') as { place: string } | undefined)?.place;

  it('pose le départ au début du mois, l’année suivante si le mois est passé', () => {
    expect(dates('Trek en Patagonie, 8 jours en janvier')).toMatchObject({ start: '2027-01-01' });
    expect(dates('Van en Écosse 10 jours en juin')).toMatchObject({ start: '2027-06-01' });
    expect(dates('Ski début février 2027 à Val Thorens')).toMatchObject({ start: '2027-02-01' });
    expect(dates('Rando mi-novembre')).toMatchObject({ start: '2026-11-15' });
  });
  it('ce mois-ci : à partir d’aujourd’hui', () => {
    expect(dates('Rando en octobre dans les Vosges')).toMatchObject({ start: today });
  });
  it('un week-end dans un mois tombe sur son premier samedi, pas ce week-end', () => {
    expect(dates('Escalade, week-end de 3 jours en mai')).toMatchObject({ start: '2027-05-01' });
    expect(dates('week-end à Annecy fin mai')).toMatchObject({ start: '2027-05-22' });
  });
  it('un jour précis prime sur le mois seul', () => {
    expect(dates('le 12 mai en Corse')).toMatchObject({ start: '2027-05-12' });
  });
  it('la destination s’arrête avant la durée ou le mois', () => {
    expect(place('Plage en Crète une semaine en juillet')).toBe('Crète');
    expect(place('week-end à Annecy fin mai')).toBe('Annecy');
  });
  it('une date de l’IA dans le mois dit est ancrée', () => {
    expect(groundingIssue({ type: 'set_dates', start: '2027-01-10', end: null }, '8 jours en janvier')).toBeNull();
    expect(groundingIssue({ type: 'set_dates', start: '2027-03-10', end: null }, '8 jours en janvier')).not.toBeNull();
  });
});

describe('Ce que l’IA ajoute sans que la phrase le dise', () => {
  it('rythme et nuits refusés s’ils ne sont pas dits', () => {
    const t = 'Hiking in Iceland 5 days in July';
    expect(groundingIssue({ type: 'set_pace', pace: 'normal' }, t)).toMatch(/absent/);
    expect(groundingIssue({ type: 'set_nights', nights: 'bivouac' }, t)).toMatch(/absentes/);
    expect(groundingIssue({ type: 'set_pace', pace: 'tranquille' }, 'à un rythme tranquille')).toBeNull();
    expect(groundingIssue({ type: 'set_nights', nights: 'refuge' }, 'nuits en gîte ou en refuge')).toBeNull();
  });
  it('anglais : durée et mois lus', () => {
    const r = parseIntentRules('Hiking in Iceland 5 days in July', '2026-10-05');
    expect(r).toContainEqual({ type: 'set_duration', days: 5, hours: null });
    expect(r.find((a) => a.type === 'set_dates')).toMatchObject({ start: '2027-07-01' });
    expect(parseIntentRules('2 weeks in Peru', '2026-10-05')).toContainEqual({ type: 'set_duration', days: 14, hours: null });
  });
});
