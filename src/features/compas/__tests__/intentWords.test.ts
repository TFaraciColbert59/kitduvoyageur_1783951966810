/**
 * Plan 4.10 : la phrase comprise sans IA — nombres en lettres, montants et
 * devises, dates relatives et jours fériés. Chaque cas vient d'un défaut lu
 * sur le lecteur de règles (9 oct. : « dix-huit jours » lu 8 jours, « 1,500 € »
 * lu 1,50 €, « dans 3 semaines » lu comme une durée de 21 jours).
 */
import { describe, expect, it } from 'vitest';
import { easterSunday, holidayDate, readMoney, spellNumbers } from '../engine/intentWords';
import { actionLabel, groundingIssue, parseIntentRules, validateActions, type CompasIntentAction } from '../engine/intent';
import { convertBetween } from '../engine/currency';

const TODAY = '2026-10-09'; // un vendredi
const find = <T extends CompasIntentAction['type']>(a: CompasIntentAction[], type: T) =>
  a.find((x) => x.type === type) as Extract<CompasIntentAction, { type: T }> | undefined;

describe('nombres en lettres', () => {
  it('composés et grands nombres en chiffres, aux mêmes positions', () => {
    const cases: Array<[string, string]> = [
      ['dix-huit jours', '18'],
      ['vingt-cinq jours', '25'],
      ['vingt et un jours', '21'],
      ['soixante-dix km', '70'],
      ['soixante-dix-sept km', '77'],
      ['quatre-vingt-dix km', '90'],
      ['quatre-vingts km', '80'],
      ['trois cents euros', '300'],
      ['deux mille euros', '2000'],
      ['mille cinq cents euros', '1500'],
      ['cent vingt km', '120'],
      ['une dizaine de jours', '10'],
    ];
    for (const [text, digits] of cases) {
      const out = spellNumbers(text);
      expect(out.length, text).toBe(text.length);
      expect(out.trim().split(/\s+/)[0], text).toBe(digits);
    }
  });

  it('les nombres simples et les articles restent en lettres ; « deux trois » reste deux nombres', () => {
    expect(spellNumbers('trois jours avec un ami')).toBe('trois jours avec un ami');
    expect(spellNumbers('deux trois jours')).toBe('deux trois jours');
    expect(spellNumbers('le 3 sept')).toBe('le 3 sept');
  });

  it('« partir une quinzaine » : quinze jours, pas quinze personnes', () => {
    expect(spellNumbers('pour une quinzaine').trim()).toBe('pour 15 jours');
    expect(find(parseIntentRules('partir une quinzaine en Grèce', TODAY), 'set_duration')?.days).toBe(15);
    expect(find(parseIntentRules('on sera une dizaine en Ardèche', TODAY), 'set_party_size')?.count).toBe(10);
  });

  it('la phrase entière : durée, distance, budget', () => {
    expect(find(parseIntentRules('trek de dix-huit jours au Népal', TODAY), 'set_duration')?.days).toBe(18);
    expect(find(parseIntentRules('vingt-cinq jours en Patagonie', TODAY), 'set_duration')?.days).toBe(25);
    expect(find(parseIntentRules('cent kilomètres à vélo en 2 jours', TODAY), 'set_distance')?.km).toBe(100);
    expect(find(parseIntentRules('trois cents euros pour un week-end', TODAY), 'set_budget')?.amount).toBe(300);
    expect(find(parseIntentRules('deux semaines et demie au Pérou', TODAY), 'set_duration')?.days).toBe(17);
    expect(find(parseIntentRules('un mois au Pérou', TODAY), 'set_duration')?.days).toBe(30);
  });

  it('un nombre en lettres n’est jamais une destination', () => {
    const a = parseIntentRules('rando à quatorze', TODAY);
    expect(find(a, 'set_destination')).toBeUndefined();
    expect(find(a, 'set_party_size')?.count).toBe(14);
  });

  it('ancrage de l’IA : 18 est dans « dix-huit », 8 n’y est pas', () => {
    expect(groundingIssue({ type: 'set_duration', days: 18, hours: null }, 'dix-huit jours au Népal')).toBeNull();
    expect(groundingIssue({ type: 'set_duration', days: 8, hours: null }, 'dix-huit jours au Népal')).not.toBeNull();
  });
});

describe('montants et devises', () => {
  const money = (text: string) => readMoney(spellNumbers(text.toLowerCase()), text);

  it('séparateurs de milliers, décimales, « k »', () => {
    expect(money('1,500 € par personne')).toMatchObject({ amount: 1500, currency: 'EUR' });
    expect(money('1.500,50 €')).toMatchObject({ amount: 1500.5, currency: 'EUR' });
    expect(money('2,5 €')).toMatchObject({ amount: 2.5 });
    expect(money('budget 3k€')).toMatchObject({ amount: 3000, currency: 'EUR' });
    expect(money('3,5 k euros')).toMatchObject({ amount: 3500, currency: 'EUR' });
    expect(money('budget de 1 500 euros')).toMatchObject({ amount: 1500, currency: 'EUR' });
  });

  it('devises dites, avant ou après le montant', () => {
    expect(money('2000 $')).toMatchObject({ amount: 2000, currency: 'USD' });
    expect(money('$2000')).toMatchObject({ amount: 2000, currency: 'USD' });
    expect(money('800£')).toMatchObject({ amount: 800, currency: 'GBP' });
    expect(money('2000 CHF')).toMatchObject({ amount: 2000, currency: 'CHF' });
    expect(money('3000 dollars canadiens')).toMatchObject({ amount: 3000, currency: 'CAD' });
    expect(money('50 000 ISK')).toMatchObject({ amount: 50000, currency: 'ISK' });
    expect(money('100000 yens')).toMatchObject({ amount: 100000, currency: 'JPY' });
  });

  it('sans devise : « budget 800 » ; jamais « 10 ans » ni « 20 km »', () => {
    expect(money('budget 800')).toMatchObject({ amount: 800, currency: null });
    expect(money('10 ans de rando')).toBeNull();
    expect(money('20 km')).toBeNull();
    expect(money('budget 10 jours')).toBeNull();
  });

  it('un montant en dollars n’est pas un groupe', () => {
    const a = parseIntentRules('budget pour 2000 $ au Canada', TODAY);
    expect(find(a, 'set_party_size')).toBeUndefined();
    expect(find(a, 'set_budget')).toMatchObject({ amount: 2000, currency: 'USD' });
  });

  it('l’IA ne pose pas une devise que la phrase ne dit pas', () => {
    expect(groundingIssue({ type: 'set_budget', amount: 2000, currency: 'USD' }, 'budget 2000 € en Grèce')).toMatch(/Devise/);
    expect(groundingIssue({ type: 'set_budget', amount: 2000, currency: 'USD' }, 'budget 2000 $')).toBeNull();
    expect(groundingIssue({ type: 'set_budget', amount: 3000 }, 'budget 3k€')).toBeNull();
  });

  it('conversion par l’euro : taux du jour, date la plus ancienne, sources dites', () => {
    const usd = { base: 'EUR' as const, currency: 'USD', rate: 1.1, date: '2026-10-08', source: 'Frankfurter (banques centrales)' };
    const gbp = { base: 'EUR' as const, currency: 'GBP', rate: 0.85, date: '2026-10-07', source: 'Frankfurter (banques centrales)' };
    expect(convertBetween(2200, 'USD', 'EUR', { USD: usd })).toMatchObject({ amount: 2000, currency: 'EUR', date: '2026-10-08' });
    expect(convertBetween(1000, 'EUR', 'USD', { USD: usd })?.amount).toBe(1100);
    expect(convertBetween(1100, 'USD', 'GBP', { USD: usd, GBP: gbp })).toMatchObject({ amount: 850, date: '2026-10-07' });
    // Un taux manquant : rien de deviné.
    expect(convertBetween(2000, 'USD', 'EUR', {})).toBeNull();
    expect(convertBetween(2000, 'USD', 'EUR', { USD: null })).toBeNull();
    expect(convertBetween(2000, 'EUR', 'EUR', {})).toBeNull();
  });

  it('libellé : montant dans la devise du voyage, montant dit et taux à côté', () => {
    const label = actionLabel(
      { type: 'set_budget', amount: 1818, currency: 'EUR', said: { amount: 2000, currency: 'USD', date: '2026-10-08', source: 'Frankfurter (banques centrales)' } },
      'EUR'
    );
    expect(label).toMatch(/1\s818\s€/);
    expect(label).toMatch(/2\s000\s\$US/);
    expect(label).toContain('8 oct.');
    expect(label).toContain('Frankfurter');
  });

  it('sans taux, une devise étrangère est refusée en le disant', () => {
    const [p] = validateActions([{ action: { type: 'set_budget', amount: 2000, currency: 'USD' }, source: 'regles' }], {
      today: TODAY,
      startDate: null,
      endDate: null,
      engaged: 0,
      currency: 'EUR',
      avoid: [],
      wishes: [],
    });
    expect(p.ok).toBe(false);
    expect(p.reason).toMatch(/Taux de change indisponible/);
  });
});

describe('dates relatives et numériques', () => {
  const dates = (text: string) => find(parseIntentRules(text, TODAY), 'set_dates');

  it('« dans 3 semaines » est un départ, pas une durée', () => {
    const a = parseIntentRules('dans 3 semaines, une semaine en Corse', TODAY);
    expect(find(a, 'set_dates')).toEqual({ type: 'set_dates', start: '2026-10-30', end: null });
    expect(find(a, 'set_duration')?.days).toBe(7);
    expect(dates('dans quinze jours, rando dans les Bauges')?.start).toBe('2026-10-24');
    expect(dates('dans 2 mois au Maroc')?.start).toBe('2026-12-09');
    expect(dates('partir dans une quinzaine')?.start).toBe('2026-10-24');
  });

  it('semaine et mois prochains', () => {
    expect(dates('la semaine prochaine en Ardèche')?.start).toBe('2026-10-12');
    expect(dates('fin de semaine prochaine à Annecy')?.start).toBe('2026-10-17');
    expect(dates('le mois prochain au Maroc')?.start).toBe('2026-11-01');
    expect(dates('mi mois prochain au Maroc')?.start).toBe('2026-11-15');
  });

  it('jours fériés : le prochain, jamais une destination', () => {
    const a = parseIntentRules('à Noël en Laponie', TODAY);
    expect(find(a, 'set_dates')?.start).toBe('2026-12-25');
    expect(find(a, 'set_destination')?.place).toBe('Laponie');
    expect(dates('pour la Toussaint, 4 jours dans les Cévennes')?.start).toBe('2026-11-01');
    expect(dates('week-end de Pâques dans le Lubéron')?.start).toBe('2027-03-28');
    expect(dates('Noël 2027 au Québec')?.start).toBe('2027-12-25');
    // Les vacances durent et changent selon les zones : aucun jour inventé.
    expect(holidayDate('vacances de noel en laponie', TODAY)).toBeNull();
    expect(easterSunday(2027)).toBe('2027-03-28');
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2030)).toBe('2030-04-21');
  });

  it('dates numériques : intervalle, ISO, mois-jour quand jour-mois n’existe pas', () => {
    expect(dates('du 12/11 au 15/11 dans le Vercors')).toEqual({ type: 'set_dates', start: '2026-11-12', end: '2026-11-15' });
    expect(dates('le 2026-11-14 au Pic du Midi')?.start).toBe('2026-11-14');
    expect(dates('du 2026-11-14 au 2026-11-16')).toEqual({ type: 'set_dates', start: '2026-11-14', end: '2026-11-16' });
    expect(dates('départ le 11/25')?.start).toBe('2026-11-25');
  });

  it('anglais : le mois avant le jour', () => {
    const a = parseIntentRules('hiking in Iceland from July 3 to July 12', TODAY);
    expect(find(a, 'set_dates')).toEqual({ type: 'set_dates', start: '2027-07-03', end: '2027-07-12' });
    expect(find(a, 'set_destination')?.place).toBe('Iceland');
  });

  it('« août 3 semaines » reste une durée en août, pas le 3 août', () => {
    const a = parseIntentRules('Corse en août 3 semaines', TODAY);
    expect(find(a, 'set_dates')?.start).toBe('2027-08-01');
    expect(find(a, 'set_duration')?.days).toBe(21);
  });

  it('ancrage : une date de l’IA tirée d’une fête ou de « dans N » est ancrée', () => {
    expect(groundingIssue({ type: 'set_dates', start: '2026-12-24', end: null }, 'à Noël en Laponie')).toBeNull();
    expect(groundingIssue({ type: 'set_dates', start: '2026-10-30', end: null }, 'dans 3 semaines en Corse')).toBeNull();
  });
});

describe('groupe', () => {
  it('« famille de 5 », « groupe de 6 »', () => {
    expect(find(parseIntentRules('nous sommes une famille de 5', TODAY), 'set_party_size')?.count).toBe(5);
    expect(find(parseIntentRules('un groupe de 6 dans les Écrins', TODAY), 'set_party_size')?.count).toBe(6);
  });

  it('adultes et enfants comptés à part : leur somme, ancrée pour l’IA', () => {
    expect(find(parseIntentRules('avec 2 enfants et 2 adultes en Bretagne', TODAY), 'set_party_size')?.count).toBe(4);
    expect(find(parseIntentRules('2 adultes, 3 enfants et 2 grands-parents', TODAY), 'set_party_size')?.count).toBe(7);
    expect(groundingIssue({ type: 'set_party_size', count: 4 }, '2 adultes et 2 enfants')).toBeNull();
  });
});

describe('fin des noms de lieu', () => {
  it('« Vercors dans 3 semaines », « Écosse le mois prochain » : le nom s’arrête avant', () => {
    const a = parseIntentRules('rando de trois jours dans le Vercors dans 3 semaines à 4', TODAY);
    expect(find(a, 'search_route')?.query).toBe('Vercors');
    expect(find(parseIntentRules('une dizaine de jours en Écosse le mois prochain', TODAY), 'set_destination')?.place).toBe('Écosse');
    expect(find(parseIntentRules('en Corse la semaine prochaine', TODAY), 'set_destination')?.place).toBe('Corse');
  });
});

describe('week-end ou semaine d’un mois', () => {
  it('« premier week-end de novembre » : le premier samedi du mois ; « première semaine de mars » : le 1er', () => {
    const d = (text: string) => find(parseIntentRules(text, TODAY), 'set_dates')?.start;
    expect(d('premier week-end de novembre dans le Jura')).toBe('2026-11-07');
    expect(d('week-end de décembre en Chartreuse')).toBe('2026-12-05');
    expect(d('la première semaine de mars au Maroc')).toBe('2027-03-01');
  });
});
