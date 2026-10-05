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
