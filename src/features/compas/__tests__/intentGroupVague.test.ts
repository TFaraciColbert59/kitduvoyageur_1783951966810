import { describe, expect, it } from 'vitest';
import {
  actionLabel,
  budgetConverted,
  groundingIssue,
  parseIntentRules,
  planApplication,
  validateActions,
  type ApplyCurrent,
  type CompasIntentAction,
  type IntentContext,
} from '../engine/intent';
import { readMoney, saidPerPerson, spellNumbers, vagueSpan } from '../engine/intentWords';
import { understandRequest } from '../engine/request';

/**
 * Compréhension de la demande, restes de PLAN-100 4.10 (lot AC) :
 *  - « 50 € par personne » est multiplié par la taille du groupe (celui de la phrase, sinon celui du voyage) ; sans
 *    groupe connu, une précision est demandée, rien n'est supposé ;
 *  - « quelques jours » n'est pas un nombre : seule la borne sûre du pluriel est posée, dite « au moins », et la
 *    personne est invitée à préciser ; un chiffre de l'IA pour ces mots est refusé.
 */

const TODAY = '2026-10-07';
const flat = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');
const find = <T extends CompasIntentAction['type']>(list: CompasIntentAction[], type: T) =>
  list.find((a) => a.type === type) as Extract<CompasIntentAction, { type: T }> | undefined;
const ctx = (over: Partial<IntentContext> = {}): IntentContext => ({
  today: TODAY,
  startDate: null,
  endDate: null,
  engaged: 0,
  currency: 'EUR',
  avoid: [],
  wishes: [],
  ...over,
});
const budgetOf = (say: string) => find(parseIntentRules(say, TODAY), 'set_budget');

describe('« par personne » : le montant dit est lu comme tel', () => {
  it.each([
    ['week-end à 4, 50 € par personne'],
    ['trek à 3, budget de 800 € par personne'],
    ['50€/pers pour un week-end'],
    ['50 euros / personne'],
    ['on est 4, 50 euros chacun'],
    ['4 amis, chacun 50 €'],
    ['budget par personne : 50 €'],
    ['budget par personne de 50 €'],
    ['50 € pp'],
    ['3k€ par personne'],
    ['1,500 € par personne'],
    ['50 € per person'],
  ])('« %s » : montant par personne', (say) => {
    expect(budgetOf(say)).toMatchObject({ type: 'set_budget', perPerson: true });
  });

  it.each([
    ['week-end à 4, budget 200 €'],
    ['4 personnes, 200 € pour tout le monde'],
    ['budget 800 € pour 4 personnes'],
    ['trek de 5 jours pour 300 €'],
    ['à 4 personnes, 200 € en tout'],
  ])('« %s » : l’enveloppe du groupe, pas un montant par personne', (say) => {
    const b = budgetOf(say);
    expect(b).toBeDefined();
    expect(b).not.toHaveProperty('perPerson');
  });

  it('un taux par jour, nuit, semaine ou mois n’est pas lu comme « par personne » (limite connue : enveloppe inchangée)', () => {
    for (const say of ['50 € par jour', '50 € par personne et par jour', '50 € par personne / nuit', '80 € / semaine par personne'])
      expect(budgetOf(say), say).not.toHaveProperty('perPerson');
  });

  it('saidPerPerson ne regarde que le voisinage du montant', () => {
    const plain = (t: string) => spellNumbers(t.toLowerCase());
    const m = (t: string) => readMoney(plain(t), t)!;
    expect(saidPerPerson(plain('on part à 4, il reste une personne à prévenir. budget 200 €'), m('on part à 4, il reste une personne à prévenir. budget 200 €'))).toBe(false);
    expect(saidPerPerson(plain('200 € par personne'), m('200 € par personne'))).toBe(true);
  });
});

describe('validateActions — le montant par personne est multiplié par le groupe', () => {
  const perPerson: CompasIntentAction = { type: 'set_budget', amount: 50, currency: 'EUR', perPerson: true };
  const proposal = (list: CompasIntentAction[], context = ctx()) =>
    validateActions(
      list.map((action) => ({ action, source: 'regles' as const })),
      context
    ).find((p) => p.action.type === 'set_budget')!;

  it('groupe dit dans la phrase : 50 € × 4 = 200 €, le calcul est dans le libellé', () => {
    const p = proposal([{ type: 'set_party_size', count: 4 }, perPerson]);
    expect(p.ok).toBe(true);
    expect(p.action).toEqual({ type: 'set_budget', amount: 200, currency: 'EUR', groupOf: 4 });
    expect(flat(p.label)).toBe('Enveloppe : 200 € (50 € par personne × 4 personnes)');
  });

  it('sans groupe dans la phrase : celui du voyage', () => {
    const p = proposal([perPerson], ctx({ partySize: 3 }));
    expect(p.ok).toBe(true);
    expect(p.action).toMatchObject({ amount: 150, groupOf: 3 });
    expect(flat(p.label)).toBe('Enveloppe : 150 € (50 € par personne × 3 personnes)');
  });

  it('le groupe de la phrase prime sur celui du voyage', () => {
    const p = proposal([{ type: 'set_party_size', count: 4 }, perPerson], ctx({ partySize: 2 }));
    expect(p.action).toMatchObject({ amount: 200, groupOf: 4 });
  });

  it('un groupe de la phrase refusé (plus de 50 personnes) ne sert pas : celui du voyage, sinon une précision', () => {
    expect(proposal([{ type: 'set_party_size', count: 60 }, perPerson], ctx({ partySize: 2 })).action).toMatchObject({ amount: 100, groupOf: 2 });
    const p = proposal([{ type: 'set_party_size', count: 60 }, perPerson]);
    expect(p.ok).toBe(false);
  });

  it('aucun groupe connu : refusé avec une demande de précision, rien n’est supposé (ni 1, ni 2)', () => {
    for (const context of [ctx(), ctx({ partySize: null })]) {
      const p = proposal([perPerson], context);
      expect(p.ok).toBe(false);
      expect(p.reason).toBe('Dis aussi combien vous êtes (« à 4 ») : un montant par personne se multiplie par le groupe');
      // L'action n'est pas multipliée.
      expect(p.action).toEqual(perPerson);
      expect(flat(p.label)).toBe('Enveloppe : 50 € par personne (groupe à préciser)');
    }
  });

  it('le plancher « déjà engagé » se compare au total, pas au montant par personne', () => {
    const p = proposal([{ type: 'set_party_size', count: 4 }, perPerson], ctx({ engaged: 300 }));
    expect(p.ok).toBe(false);
    expect(flat(p.reason ?? '')).toBe('Sous les 300 € déjà engagés');
    expect(proposal([{ type: 'set_party_size', count: 4 }, perPerson], ctx({ engaged: 120 })).ok).toBe(true);
  });

  it('un montant dit dans une autre devise : converti par le serveur, multiplié ensuite, le montant dit reste par personne', () => {
    const said = { amount: 50, currency: 'USD', date: '2026-10-08', source: 'Frankfurter (banques centrales)' };
    const p = proposal(
      [{ type: 'set_party_size', count: 4 }, { type: 'set_budget', amount: 46, currency: 'EUR', said, perPerson: true }]
    );
    expect(p.ok).toBe(true);
    expect(p.action).toMatchObject({ amount: 184, groupOf: 4 });
    expect(flat(p.label)).toMatch(
      /^Enveloppe : 184 € \(46 € par personne × 4 personnes ; 50 \$\S* par personne, taux du .*8 oct\., Frankfurter \(banques centrales\)\)$/
    );
  });

  it('la conversion serveur garde « par personne » : 50 USD par personne à 4 = environ 184 € (constat Codex)', () => {
    const dit: CompasIntentAction = { type: 'set_budget', amount: 50, currency: 'USD', perPerson: true };
    const converti = budgetConverted(dit, 'EUR', { amount: 46.2, date: '2026-10-08', source: 'Frankfurter (banques centrales)' });
    expect(converti).toMatchObject({ amount: 46, currency: 'EUR', perPerson: true, said: { amount: 50, currency: 'USD' } });
    const p = proposal([{ type: 'set_party_size', count: 4 }, converti]);
    expect(p.ok).toBe(true);
    expect(p.action).toMatchObject({ amount: 184, groupOf: 4 });
  });

  it('un montant qui n’est pas par personne n’est jamais multiplié', () => {
    const plain: CompasIntentAction = { type: 'set_budget', amount: 200, currency: 'EUR' };
    const p = proposal([{ type: 'set_party_size', count: 4 }, plain], ctx({ partySize: 4 }));
    expect(p.action).toEqual(plain);
    expect(flat(p.label)).toBe('Enveloppe : 200 €');
  });

  it('planApplication applique le total (200 €), pas le montant par personne', () => {
    const p = proposal([{ type: 'set_party_size', count: 4 }, perPerson]);
    const current: ApplyCurrent = {
      startDate: null,
      endDate: null,
      days: null,
      shortHours: null,
      preferences: { pace: 'normal', nights: 'mixte', avoid: [], wishes: [] } as unknown as ApplyCurrent['preferences'],
      hasRoute: false,
    };
    const ops = planApplication([{ type: 'set_party_size', count: 4 }, p.action], current);
    expect(ops).toContainEqual({ op: 'budget', amount: 200 });
    expect(ops).toContainEqual({ op: 'party', partySize: 4 });
  });

  it('de bout en bout : la phrase, les règles, la validation', () => {
    const list = parseIntentRules('week-end à 4 en Ardèche, 50 € par personne', TODAY).map((action) => ({ action, source: 'regles' as const }));
    const budget = validateActions(list, ctx()).find((p) => p.action.type === 'set_budget')!;
    expect(budget.ok).toBe(true);
    expect(budget.action).toMatchObject({ amount: 200, groupOf: 4 });
  });
});

describe('ancrage — un montant par personne doit être dit comme tel', () => {
  it('le drapeau « par personne » exige les mots dans la phrase', () => {
    expect(groundingIssue({ type: 'set_budget', amount: 50, perPerson: true }, 'week-end à 4, 50 € par personne')).toBeNull();
    expect(groundingIssue({ type: 'set_budget', amount: 50, perPerson: true }, 'week-end à 4, budget 50 €')).toBe(
      'Montant par personne absent de ta phrase'
    );
  });

  it('une action déjà multipliée (groupOf) ou une borne « au moins » au choix de l’IA est refusée', () => {
    expect(groundingIssue({ type: 'set_budget', amount: 200, groupOf: 4 }, 'week-end à 4, 200 € par personne')).toBe(
      'Multiplication par le groupe faite par le Compas seulement'
    );
    expect(groundingIssue({ type: 'set_duration', days: 4, hours: null, atLeast: true }, 'quelques jours en Corse')).toBe(
      'Durée vague absente de ta phrase'
    );
  });

  it('un montant sans drapeau alors que la phrase le dit par personne est refusé (l’IA ne multiplie pas à la place du Compas)', () => {
    expect(groundingIssue({ type: 'set_budget', amount: 50 }, 'week-end à 4, 50 € par personne')).toBe(
      'Montant dit par personne : à multiplier par le groupe'
    );
    expect(groundingIssue({ type: 'set_budget', amount: 200 }, 'week-end à 4, budget 200 €')).toBeNull();
  });
});

describe('« quelques jours » — jamais un nombre inventé', () => {
  it('vagueSpan : le pluriel vague et la seule borne qu’il garantit', () => {
    expect(vagueSpan('quelques jours en corse')).toEqual({ said: 'quelques jours', minDays: 2 });
    expect(vagueSpan('plusieurs jours de rando')).toEqual({ said: 'plusieurs jours', minDays: 2 });
    expect(vagueSpan('quelques nuits en refuge')).toEqual({ said: 'quelques nuits', minDays: 3 });
    expect(vagueSpan('quelques semaines au japon')).toEqual({ said: 'quelques semaines', minDays: 14 });
    expect(vagueSpan('a few days in iceland')).toEqual({ said: 'a few days', minDays: 2 });
    for (const t of ['3 jours en corse', 'une dizaine de jours', 'quelques heures', 'un week-end', 'quelques amis'])
      expect(vagueSpan(t), t).toBeNull();
  });

  it('les règles posent « au moins 2 jours » (pas 3, pas 7), marqué `atLeast`, et rien d’autre en durée', () => {
    const actions = parseIntentRules('quelques jours en Corse', TODAY);
    expect(actions.filter((a) => a.type === 'set_duration')).toEqual([{ type: 'set_duration', days: 2, hours: null, atLeast: true }]);
    expect(find(parseIntentRules('quelques nuits dans le Vercors', TODAY), 'set_duration')).toMatchObject({ days: 3, atLeast: true });
    expect(find(parseIntentRules('quelques semaines au Japon', TODAY), 'set_duration')).toMatchObject({ days: 14, atLeast: true });
  });

  it('un nombre dit l’emporte sur le pluriel vague', () => {
    const d = find(parseIntentRules('quelques jours en Corse, 5 jours de marche', TODAY), 'set_duration');
    expect(d).toEqual({ type: 'set_duration', days: 5, hours: null });
  });

  it('le libellé dit « au moins » et demande de préciser', () => {
    expect(flat(actionLabel({ type: 'set_duration', days: 2, hours: null, atLeast: true }))).toBe(
      'Durée : au moins 2 j (durée vague dans ta phrase : précise-la)'
    );
    expect(actionLabel({ type: 'set_duration', days: 2, hours: null })).not.toMatch(/au moins/);
  });

  it('l’ancrage : le chiffre de l’IA pour « quelques jours » est refusé, avec une raison claire', () => {
    expect(groundingIssue({ type: 'set_duration', days: 4, hours: null }, 'quelques jours en Corse')).toBe(
      'Durée vague dans ta phrase (« quelques jours ») : dis le nombre de jours'
    );
    expect(groundingIssue({ type: 'set_duration', days: 4, hours: null }, 'quatre jours en Corse')).toBeNull();
    // La borne des règles est ancrée par les mots, pas par un chiffre.
    expect(groundingIssue({ type: 'set_duration', days: 2, hours: null, atLeast: true }, 'quelques jours en Corse')).toBeNull();
    expect(groundingIssue({ type: 'set_duration', days: 2, hours: null, atLeast: true }, 'deux jours en Corse')).toBe(
      'Durée vague absente de ta phrase'
    );
  });

  it('planApplication applique la borne, comme n’importe quelle durée (la personne peut décocher ou préciser)', () => {
    const current: ApplyCurrent = {
      startDate: null,
      endDate: null,
      days: null,
      shortHours: null,
      preferences: { pace: 'normal', nights: 'mixte', avoid: [], wishes: [] } as unknown as ApplyCurrent['preferences'],
      hasRoute: false,
    };
    expect(planApplication([{ type: 'set_duration', days: 2, hours: null, atLeast: true }], current)).toEqual([{ op: 'span', days: 2 }]);
  });
});

describe('« Voici ce que j’ai compris » — quelques jours, par personne', () => {
  const line = (r: ReturnType<typeof understandRequest>, key: string) => r.lines.find((l) => l.key === key);

  it('« quelques jours » : « au moins 2 jours », jamais présenté comme dit ; précise-le ; la phrase part telle quelle', () => {
    const r = understandRequest('quelques jours en Corse en randonnée', TODAY);
    expect(line(r, 'quand')).toMatchObject({
      state: 'defaut',
      value: 'au moins 2 jours (« quelques jours » ne dit pas combien) · précise-le',
    });
    expect(r.say).toBe('quelques jours en Corse en randonnée');
  });

  it('avec une précision de durée : la précision prime', () => {
    const r = understandRequest('quelques jours en Corse en randonnée', TODAY, { days: 4 });
    expect(line(r, 'quand')).toMatchObject({ value: '4 jours', state: 'precise' });
    expect(r.say).toBe('quelques jours en Corse en randonnée · 4 jours');
  });

  it('avec un départ dit : « au moins » reste dit à côté de la date', () => {
    const r = understandRequest('quelques jours en Corse en avril', TODAY);
    expect(line(r, 'quand')?.value).toBe('1 avr. · au moins 2 jours (durée vague : précise-la)');
    expect(line(r, 'quand')?.state).toBe('defaut');
  });

  it('« 50 € par personne » à 4 : le total et le calcul', () => {
    const r = understandRequest('week-end à 4 à Lisbonne, 50 € par personne', TODAY);
    expect(flat(line(r, 'budget')?.value ?? '')).toBe('200 € (50 € par personne × 4 personnes)');
  });

  it('groupe précisé sous « Préciser » : il sert au calcul ; sans groupe : la demande de préciser', () => {
    expect(flat(line(understandRequest('week-end à Lisbonne, 50 € par personne', TODAY, { party: 3 }), 'budget')?.value ?? '')).toBe(
      '150 € (50 € par personne × 3 personnes)'
    );
    expect(flat(line(understandRequest('week-end à Lisbonne, 50 € par personne', TODAY), 'budget')?.value ?? '')).toBe(
      '50 € par personne · dis combien vous êtes'
    );
    // Une enveloppe de groupe reste telle quelle.
    expect(flat(line(understandRequest('week-end à 4 à Lisbonne, budget 200 €', TODAY), 'budget')?.value ?? '')).toBe('200 €');
  });
});
