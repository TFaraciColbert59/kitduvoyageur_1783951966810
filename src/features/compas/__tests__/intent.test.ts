import { describe, expect, it } from 'vitest';
import {
  famousTrailIn,
  groundingIssue,
  isNamedTrail,
  mergeActions,
  numberInText,
  parseIntentRules,
  planApplication,
  sameTrailName,
  validateActions,
  type CompasActivity,
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
        { type: 'set_budget', amount: 300, currency: 'EUR' },
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
    // « sans voiture » n'est plus une chose à éviter : c'est le réglage « sans voiture » (carFree.test.ts).
    const a = parseIntentRules('sans foule, envie de voir un lac, ajoute 2 frontales', TODAY);
    expect(a).toContainEqual({ type: 'avoid', label: 'foule' });
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
    // Un nombre de jours n'est pas un groupe.
    expect(groundingIssue({ type: 'set_party_size', count: 4 }, '4 jours de rando dans les Dolomites')).toMatch(/absent/);
    expect(groundingIssue({ type: 'set_party_size', count: 4 }, 'on part à quatre')).toBeNull();
    expect(groundingIssue({ type: 'set_party_size', count: 3 }, 'rando 2 jours, nous sommes 3')).toBeNull();
    expect(groundingIssue({ type: 'set_party_size', count: 5 }, 'week-end en famille de 5')).toBeNull();
    expect(groundingIssue({ type: 'set_party_size', count: 4 }, 'Hiking 5 days for 4 people')).toBeNull();
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
  it('une envie qui redit la destination est écartée (« voyage au Japon »)', () => {
    const p = validateActions(
      [
        { action: { type: 'set_destination', place: 'Japon' }, source: 'ia' },
        { action: { type: 'wish', label: 'voyage au Japon' }, source: 'ia' },
        { action: { type: 'wish', label: 'temples de Kyoto' }, source: 'ia' },
        { action: { type: 'wish', label: 'plaisir du trail' }, source: 'ia' },
      ],
      ctx
    );
    expect(p[1]).toMatchObject({ ok: false, reason: 'Rien de plus que la destination ou l’activité' });
    expect(p[2]).toMatchObject({ ok: true });
    expect(p[3]).toMatchObject({ ok: false, reason: 'Rien de plus que la destination ou l’activité' });
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

  it('une chose à éviter proposée par l’IA doit être dite par une négation (13 oct.)', () => {
    const phrase = '5 jours en Crète à pied avec les gorges de Samaria';
    expect(groundingIssue({ type: 'avoid', label: 'gorges de Samaria' }, phrase)).toBe('Rien à éviter dans ta phrase');
    expect(groundingIssue({ type: 'wish', label: 'gorges de Samaria' }, phrase)).toBeNull();
    expect(groundingIssue({ type: 'avoid', label: 'foule' }, 'rando 3 jours sans la foule')).toBeNull();
  });

  it('l’IA colle la suite de la phrase au lieu : le nom des règles qui le commence est gardé (13 oct.)', () => {
    const merged = mergeActions([{ type: 'set_destination', place: 'Vietnam du nord au sud' }], [{ type: 'set_destination', place: 'Vietnam' }]);
    expect(merged).toEqual([{ action: { type: 'set_destination', place: 'Vietnam' }, source: 'ia' }]);
    expect(mergeActions([{ type: 'set_destination', place: 'Swiss Alps near Zermatt' }], [{ type: 'set_destination', place: 'Zermatt' }])[0].action).toEqual({
      type: 'set_destination',
      place: 'Zermatt',
    });
    // Un lieu de l'IA plus précis qui ne commence pas par celui des règles reste celui de l'IA.
    expect(mergeActions([{ type: 'set_destination', place: 'Lac d’Annecy' }], [{ type: 'set_destination', place: 'Annecy' }])[0].action).toEqual({
      type: 'set_destination',
      place: 'Lac d’Annecy',
    });
    // Deux lieux différents : celui des règles n'est pas perdu, il devient une envie (Wadi Rum).
    expect(mergeActions([{ type: 'set_destination', place: 'Jordanie' }], [{ type: 'set_destination', place: 'Désert du Wadi Rum' }])).toEqual([
      { action: { type: 'set_destination', place: 'Jordanie' }, source: 'ia' },
      { action: { type: 'wish', label: 'Désert du Wadi Rum' }, source: 'regles' },
    ]);
  });

  it('un sentier célèbre donné comme destination par l’IA devient sa région (GR34 → Bretagne)', () => {
    const merged = mergeActions(
      [{ type: 'set_destination', place: 'GR34' }],
      [
        { type: 'set_destination', place: 'Bretagne' },
        { type: 'wish', label: 'GR34' },
      ]
    );
    expect(merged).toEqual([
      { action: { type: 'set_destination', place: 'Bretagne' }, source: 'ia' },
      { action: { type: 'wish', label: 'GR34' }, source: 'regles' },
    ]);
    expect(mergeActions([{ type: 'set_destination', place: 'Tour du Mont-Blanc' }], [])[0].action).toEqual({
      type: 'set_destination',
      place: 'Mont Blanc',
    });
    expect(mergeActions([{ type: 'set_destination', place: 'Chamonix' }], [])[0].action).toEqual({
      type: 'set_destination',
      place: 'Chamonix',
    });
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
  it('ce mois-ci : à partir d’aujourd’hui pour une sortie, dans deux semaines pour un voyage', () => {
    expect(dates('Rando en octobre dans les Vosges')).toMatchObject({ start: today });
    // 2026-10-05 (lundi) : premier samedi à 14 jours ou plus = 2026-10-24.
    expect(dates('trek de 12 jours au Népal en octobre')).toMatchObject({ start: '2026-10-24' });
    expect(dates('une semaine en Corse en octobre')).toMatchObject({ start: '2026-10-24' });
    // Fin de mois : plus de samedi dans le mois → à partir d'aujourd'hui.
    expect(parseIntentRules('5 jours en Crète en octobre', '2026-10-25').find((a) => a.type === 'set_dates')).toMatchObject({ start: '2026-10-25' });
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
    // Une fin inventée dans le mois ne passe pas : « 7 jours en juillet » ≠ 1–8 juillet.
    expect(
      groundingIssue({ type: 'set_dates', start: '2027-07-01', end: '2027-07-08' }, 'Road trip en Islande 7 jours en juillet')
    ).not.toBeNull();
    expect(groundingIssue({ type: 'set_dates', start: '2027-07-01', end: '2027-07-08' }, 'du 1er au 8 juillet')).toBeNull();
    // Fin donnée par un mois : acceptée.
    expect(
      groundingIssue({ type: 'set_dates', start: '2027-06-28', end: '2027-07-03' }, 'du 28 juin à début juillet')
    ).toBeNull();
    expect(
      groundingIssue({ type: 'set_dates', start: '2027-07-01', end: '2027-07-31' }, "en juillet, jusqu'à fin juillet")
    ).toBeNull();
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

describe('Lieu précis après la destination', () => {
  it('« en Patagonie, Torres del Paine » : Torres del Paine devient une envie', () => {
    const r = parseIntentRules('Trek en Patagonie, Torres del Paine, 8 jours en janvier', '2026-10-06');
    expect(r).toContainEqual({ type: 'set_destination', place: 'Patagonie' });
    expect(r).toContainEqual({ type: 'wish', label: 'Torres del Paine' });
  });
  it('rien ajouté sans lieu après la virgule', () => {
    const r = parseIntentRules('Trek en Patagonie, 8 jours en janvier', '2026-10-06');
    expect(r.some((a) => a.type === 'wish')).toBe(false);
    const r2 = parseIntentRules('Road trip en Islande, en juillet', '2026-10-06');
    expect(r2.some((a) => a.type === 'wish')).toBe(false);
  });
});

describe('Sentier nommé (14 oct. : l’IA en propose les étapes)', () => {
  it('« le GR20 sud en 6 jours » : la Corse, un trek, et le sentier avec son tronçon en envie (sans « sur le »)', () => {
    const r = parseIntentRules('le GR20 sud en 6 jours', '2026-10-14');
    // La référence dite accompagne la région pour le référentiel `geo_trails` (main, 3.7).
    expect(r).toContainEqual({ type: 'set_destination', place: 'Corse', trail: 'GR20' });
    expect(r).toContainEqual({ type: 'set_activity', activity: 'trekking' });
    expect(r).toContainEqual({ type: 'wish', label: 'GR20 sud' });
  });
  it('« Laugavegur en 4 jours », « le chemin de Stevenson » : un trek dans la région du sentier, le sentier en envie', () => {
    const l = parseIntentRules('Laugavegur en 4 jours', '2026-10-14');
    expect(l).toContainEqual({ type: 'set_destination', place: 'Islande' });
    expect(l).toContainEqual({ type: 'set_activity', activity: 'trekking' });
    expect(l).toContainEqual({ type: 'wish', label: 'Laugavegur' });
    const s = parseIntentRules('le chemin de Stevenson en une semaine', '2026-10-14');
    expect(s).toContainEqual({ type: 'set_destination', place: 'Cévennes' });
    expect(s).toContainEqual({ type: 'set_activity', activity: 'trekking' });
    expect(s).toContainEqual({ type: 'wish', label: 'Chemin de Stevenson' });
  });
  it('« John Muir Trail », « Inca trail » : un sentier, pas du trail (la course)', () => {
    expect(parseIntentRules('John Muir Trail en 3 semaines', '2026-10-14')).toContainEqual({ type: 'set_activity', activity: 'trekking' });
    expect(parseIntentRules('Inca trail 4 jours', '2026-10-14')).toContainEqual({ type: 'set_activity', activity: 'trekking' });
    // Le trail (la course) reste du trail.
    expect(parseIntentRules('trail 30 km dans le Vercors', '2026-10-14')).toContainEqual({ type: 'set_activity', activity: 'trail' });
  });
  it('« sur le GR20 » : une seule envie pour le sentier', () => {
    const r = parseIntentRules('rando sur le GR20 en 12 jours', '2026-10-14');
    expect(r.filter((a) => a.type === 'wish')).toEqual([{ type: 'wish', label: 'GR20' }]);
  });
  it('l’IA donne le sentier comme lieu : sa région en destination, le sentier gardé en envie', () => {
    const merged = mergeActions([{ type: 'set_destination', place: 'GR20' }], []).map((m) => m.action);
    expect(merged).toContainEqual({ type: 'set_destination', place: 'Corse' });
    expect(merged).toContainEqual({ type: 'wish', label: 'GR20' });
    // Déjà en envie : pas de doublon.
    const twice = mergeActions([{ type: 'set_destination', place: 'GR20' }], [{ type: 'wish', label: 'GR20 sud' }]).map((m) => m.action);
    expect(twice.filter((a) => a.type === 'wish')).toEqual([{ type: 'wish', label: 'GR20 sud' }]);
  });
  it('isNamedTrail : les sentiers nommés, pas les formes d’itinéraire ni les lieux', () => {
    for (const t of ['GR20 sud', 'GR 34', 'HRP', 'Tour du Mont-Blanc', 'Chemin de Stevenson', 'Laugavegur', 'West Highland Way', 'Alta Via 1', 'Sentier des douaniers', 'Camino Portugués', 'Everest base camp trek'])
      expect(isNamedTrail(t), t).toBe(true);
    for (const t of ['Tour du lac d’Annecy', 'Traversée des Alpes', 'De Genève à Nice', 'Lac Blanc', 'Camp de base de l’Everest', 'Chamonix', 'Via ferrata'])
      expect(isNamedTrail(t), t).toBe(false);
    expect(famousTrailIn('Le tour du mont-blanc en 10 jours')).toBe('Tour du Mont-Blanc');
    expect(famousTrailIn('3 jours à Lyon')).toBeNull();
  });
  it('sameTrailName : un parcours du catalogue qui porte le nom du sentier', () => {
    expect(sameTrailName('GR 20 — étape 1', 'GR20')).toBe(true);
    expect(sameTrailName('Boucle du lac de Naussac', 'Chemin de Stevenson')).toBe(false);
    expect(sameTrailName('GR20 nord', 'GR20 sud')).toBe(false);
  });
});

describe('Enfants dans le groupe : rythme tranquille (revue du 14 oct.)', () => {
  const pace = (t: string) => parseIntentRules(t, '2026-10-14').find((a) => a.type === 'set_pace');
  it('des enfants comptés ou possédés : tranquille', () => {
    for (const t of ['rando avec les enfants dans le Jura', '3 jours dans le Jura avec mes 2 enfants', 'week-end en famille avec les petits', 'hiking with kids in Vermont', 'rando avec un enfant de 6 ans'])
      expect(pace(t), t).toEqual({ type: 'set_pace', pace: 'tranquille' });
  });
  it('« sans les enfants », « des petits lacs » : pas de rythme imposé', () => {
    for (const t of ['rando dans le Jura sans les enfants', 'week-end sans enfants à Rome', 'rando des petits lacs', 'trek aux petits villages du Népal'])
      expect(pace(t), t).toBeUndefined();
  });
});

// Revue de la PR #108 (16 oct.) : défauts de la lecture de la demande. Date fixe, aucun réseau.
describe('Revue #108 : lecture de la demande', () => {
  const NOW = '2026-10-16';
  const read = (t: string) => parseIntentRules(t, NOW);
  const duration = (t: string) => read(t).find((a) => a.type === 'set_duration');
  const party = (t: string) => read(t).find((a) => a.type === 'set_party_size');
  const activity = (t: string) => read(t).find((a) => a.type === 'set_activity');
  const wishes = (t: string) => read(t).flatMap((a) => (a.type === 'wish' ? [a.label] : []));
  const noOps = {
    startDate: '2026-11-01',
    endDate: null,
    days: null,
    shortHours: null,
    preferences: { pace: 'normal' as const, nights: null, avoid: [], wishes: [] },
    hasRoute: false,
  };

  describe('une distance ne fait pas un voyage d’un jour', () => {
    it('« par jour », « /jour », « per day » : la distance ne dit rien de la durée', () => {
      for (const t of [
        '3 nuits sous tente en Ardèche, 15 km par jour',
        'trek en Islande, 20 km par jour',
        'randonnée en Écosse, 20 km/jour',
        'rando dans les Vosges 18 km /j',
        'hiking in Peru, 15 km per day',
        'vélo en Bretagne, 60 km de vélo par jour',
        'randonnée en Corse 12 km chaque jour',
      ])
        expect(duration(t), t).toBeUndefined();
      // La distance reste dite.
      expect(read('trek en Islande, 20 km par jour')).toContainEqual({ type: 'set_distance', km: 20 });
    });
    it('un trek, des nuits dehors ou en refuge, un sentier nommé : pas de journée posée', () => {
      for (const t of ['Laugavegur 55 km', 'trek de 50 km dans le Vercors', 'GR20 sud 40 km', 'rando 25 km avec nuit en refuge dans les Écrins', 'itinérance de 80 km en Cévennes'])
        expect(duration(t), t).toBeUndefined();
    });
    it('« 3 nuits sous tente en Ardèche, 15 km par jour » : 3 nuits = 4 jours, du 1er au 4 nov. (et non le 1er seul)', () => {
      const ops = planApplication(read('3 nuits sous tente en Ardèche, 15 km par jour'), noOps);
      expect(ops.find((o) => o.op === 'dates')).toMatchObject({ startDate: '2026-11-01', endDate: '2026-11-04' });
    });
    it('une sortie qui tient dans la journée garde sa journée (choix de la PR #97)', () => {
      for (const t of ['marche 10 km en bord de mer', 'trail 30 km dans le Vercors', 'sortie vélo route 80 km', 'balade de 8 km autour du lac d’Annecy', 'rando 12 km jusqu’au refuge de Tuquerouye'])
        expect(duration(t), t).toEqual({ type: 'set_duration', days: 1, hours: null });
      // Une durée dite l'emporte, comme avant.
      expect(duration('trek 4 jours dans le Vercors, 15 km par jour')).toEqual({ type: 'set_duration', days: 4, hours: null });
    });
  });

  describe('le nombre de personnes', () => {
    it('« à deux heures », « d’une à deux semaines » : une durée ou une distance, pas un couple', () => {
      for (const t of ['week-end à deux heures de Paris', 'voyage d’une à deux semaines au Japon', 'rando à deux jours de marche du refuge'])
        expect(party(t), t).toBeUndefined();
    });
    it('« avec ma femme et nos 3 enfants », « avec mon mari et mes parents » : d’autres personnes suivent, pas deux', () => {
      // Comptés quand chacun est dit (main, `companionsPartyFr` / `companionsParty` : moi et ceux qui viennent).
      expect(party('week-end à Paris avec ma femme et nos 3 enfants')).toEqual({ type: 'set_party_size', count: 5 });
      expect(party('week-end à Paris avec mon mari et mes parents')).toEqual({ type: 'set_party_size', count: 4 });
      expect(party('a week in Rome with my wife and our two kids')).toEqual({ type: 'set_party_size', count: 4 });
      for (const t of ['rando avec ma copine, mes frères et mes amis', 'week-end à Rome avec mon mari et un couple d’amis', 'rando avec ma femme et Paul dans le Jura'])
        expect(party(t), t).toBeUndefined();
    });
    it('un groupe de deux reste lu : « à deux », « en couple », « avec ma femme », un animal ne compte pas', () => {
      for (const t of ['week-end à deux en Corse', 'voyage à deux au Japon', 'rando en couple dans le Jura', 'week-end à Paris avec ma femme', 'avec mon mari et notre chien en Écosse', 'a week in Rome with my wife', 'week-end avec ma femme, en Corse', 'avec mon mari, 3 jours dans le Jura', 'rando avec ma copine et en bivouac', 'week-end avec ma femme et 2 nuits en gîte'])
        expect(party(t), t).toEqual({ type: 'set_party_size', count: 2 });
    });
  });

  describe('« trail » devant un sentier célèbre', () => {
    it('« trail sur le GR20 », « trail de 40 km sur le GR5 » : la course, pas un trekking', () => {
      expect(activity('trail sur le GR20 en 3 jours')).toEqual({ type: 'set_activity', activity: 'trail' });
      expect(activity('trail de 40 km sur le GR5')).toEqual({ type: 'set_activity', activity: 'trail' });
    });
    it('« John Muir Trail », « Inca trail » : le mot fait partie du nom, un trekking', () => {
      expect(activity('John Muir Trail en 3 semaines')).toEqual({ type: 'set_activity', activity: 'trekking' });
      expect(activity('Inca trail 4 jours')).toEqual({ type: 'set_activity', activity: 'trekking' });
      expect(activity('trail sur le John Muir Trail')).toEqual({ type: 'set_activity', activity: 'trail' });
    });
  });

  describe('de fausses « envies » après « avec »', () => {
    it('« avec les Dupont », « avec la Team » : des personnes, pas des lieux', () => {
      expect(wishes('rando avec les Dupont dans le Vercors')).toEqual([]);
      expect(wishes('rando avec la Team dans le Vercors')).toEqual([]);
      expect(wishes('week-end avec les Martin dans le Jura')).toEqual([]);
    });
    it('« avec l’Etna », « avec les gorges de Samaria » : les lieux voulus restent des envies', () => {
      expect(wishes('7 jours en Sicile avec l’Etna')).toEqual(['Etna']);
      expect(wishes('5 jours en Crète à pied avec les gorges de Samaria')).toEqual(['Gorges de Samaria']);
      expect(wishes('3 jours dans le Vercors avec le lac de Paladru')).toEqual(['Lac de Paladru']);
    });
  });

  describe('« de X à Y » quand l’IA répond', () => {
    const phrase = 'traversée des Alpes à vélo en 12 jours de Genève à Nice';
    it('la destination lue par les règles reste, celle de l’IA (« Alpes ») est déjà dite dans l’envie', () => {
      const merged = mergeActions([{ type: 'set_destination', place: 'Alpes' }], read(phrase)).map((m) => m.action);
      expect(merged.filter((a) => a.type === 'set_destination')).toEqual([{ type: 'set_destination', place: 'Nice' }]);
      expect(merged).toContainEqual({ type: 'set_origin', place: 'Genève' });
      expect(merged).toContainEqual({ type: 'wish', label: 'de Genève à Nice' });
      // Nice n'est plus rangée en envie : c'est la destination.
      expect(merged).not.toContainEqual({ type: 'wish', label: 'Nice' });
    });
    it('sans envie qui redise le lieu de l’IA, il devient une envie au lieu de disparaître', () => {
      const merged = mergeActions([{ type: 'set_destination', place: 'Alpes' }], read('de Genève à Nice à vélo en 12 jours')).map((m) => m.action);
      expect(merged.filter((a) => a.type === 'set_destination')).toEqual([{ type: 'set_destination', place: 'Nice' }]);
      expect(merged).toContainEqual({ type: 'wish', label: 'Alpes' });
    });
    it('l’IA qui donne le même lieu, ou le départ comme destination : rien ne change', () => {
      const same = mergeActions([{ type: 'set_destination', place: 'Nice' }], read(phrase)).map((m) => m.action);
      expect(same.filter((a) => a.type === 'set_destination')).toEqual([{ type: 'set_destination', place: 'Nice' }]);
      const fromAsDest = mergeActions([{ type: 'set_destination', place: 'Genève' }], read(phrase)).map((m) => m.action);
      expect(fromAsDest.filter((a) => a.type === 'set_destination')).toEqual([{ type: 'set_destination', place: 'Nice' }]);
    });
    it('sans « de X à Y » lu par les règles, la destination de l’IA reste (Jordanie / Wadi Rum)', () => {
      const merged = mergeActions([{ type: 'set_destination', place: 'Jordanie' }], read('Désert du Wadi Rum 5 jours')).map((m) => m.action);
      expect(merged.filter((a) => a.type === 'set_destination')).toEqual([{ type: 'set_destination', place: 'Jordanie' }]);
    });
  });

  // Relecture du flux A (23 oct.) : l'itinéraire « de X à Y » ne se fait qu'à pied ou à vélo (`pointToPointRide`).
  describe('« de X à Y » à l’échelle d’un pays, ni à pied ni à vélo : le pays reste la destination', () => {
    const dest = (actions: CompasIntentAction[]) => actions.filter((a) => a.type === 'set_destination');
    const COUNTRY_TRIPS: Array<[string, string, string, string]> = [
      ['voyage au Japon de Tokyo à Kyoto en 10 jours', 'Japon', 'Tokyo', 'Kyoto'],
      ['10 jours en Italie de Rome à Venise en train', 'Italie', 'Rome', 'Venise'],
      ['2 semaines au Vietnam de Hanoï à Saïgon', 'Vietnam', 'Hanoï', 'Saïgon'],
      ['road trip en Écosse de Glasgow à Inverness en 8 jours', 'Écosse', 'Glasgow', 'Inverness'],
      ['road trip de 12 jours aux États-Unis de Los Angeles à San Francisco', 'États-Unis', 'Los Angeles', 'San Francisco'],
      ['trois semaines en Argentine de Buenos Aires à Ushuaia', 'Argentine', 'Buenos Aires', 'Ushuaia'],
    ];
    it('avec l’IA (qui rend le pays) : le pays reste la destination, jamais la ville d’arrivée', () => {
      for (const [t, country] of COUNTRY_TRIPS) {
        const merged = mergeActions([{ type: 'set_destination', place: country }], read(t)).map((m) => m.action);
        expect(dest(merged), t).toEqual([{ type: 'set_destination', place: country }]);
      }
    });
    it('sans l’IA : le pays lu reste la destination, les deux villes sont des envies, sans départ', () => {
      for (const [t, country, from, to] of COUNTRY_TRIPS) {
        const r = read(t);
        expect(dest(r), t).toEqual([{ type: 'set_destination', place: country }]);
        expect(wishes(t), t).toEqual([from, to]);
        expect(r.some((a) => a.type === 'set_origin'), t).toBe(false);
      }
    });
    it('à vélo, « de Genève à Nice » arrive toujours à Nice, avec ou sans l’IA', () => {
      const phrase = 'traversée des Alpes à vélo en 12 jours de Genève à Nice';
      expect(dest(read(phrase))).toEqual([{ type: 'set_destination', place: 'Nice' }]);
      const merged = mergeActions([{ type: 'set_destination', place: 'Alpes' }], read(phrase)).map((m) => m.action);
      expect(dest(merged)).toEqual([{ type: 'set_destination', place: 'Nice' }]);
      // L'activité dite par l'IA suffit : « de Genève à Nice en 12 jours » + IA « vélo ».
      const byAi = mergeActions(
        [{ type: 'set_destination', place: 'Alpes' }, { type: 'set_activity', activity: 'cycling' }],
        read('de Genève à Nice en 12 jours')
      ).map((m) => m.action);
      expect(dest(byAi)).toEqual([{ type: 'set_destination', place: 'Nice' }]);
    });
    it('le lieu de l’IA se compare mot à mot ; sa précision (« , Suisse ») est gardée', () => {
      // « Ain » n'est pas dans « Saint-Claude » : il reste une envie au lieu de disparaître.
      const ain = mergeActions([{ type: 'set_destination', place: 'Ain' }], read('rando de Nantua à Saint-Claude en 4 jours')).map((m) => m.action);
      expect(dest(ain)).toEqual([{ type: 'set_destination', place: 'Saint-Claude' }]);
      expect(ain).toContainEqual({ type: 'wish', label: 'Ain' });
      const zermatt = mergeActions([{ type: 'set_destination', place: 'Zermatt, Suisse' }], read('rando de Chamonix à Zermatt en 5 jours')).map((m) => m.action);
      expect(dest(zermatt)).toEqual([{ type: 'set_destination', place: 'Zermatt, Suisse' }]);
    });
  });

  describe('d’autres personnes après le partenaire (relecture du flux A)', () => {
    it('garçons, petits, « le », « la », prénoms après une virgule : pas deux', () => {
      for (const t of [
        'avec mon mari et nos 2 garçons en Corse',
        'avec ma femme et le petit en Bretagne',
        'avec ma femme et nos petits en Bretagne',
        'week-end avec ma femme et la famille à Annecy',
        'avec ma femme, Paul et Marie dans le Jura',
      ])
        expect(party(t)?.count, t).not.toBe(2);
    });
    it('« with my wife and I » : deux ; une ville après la virgule n’est pas une personne', () => {
      expect(party('a trip to Rome with my wife and I')).toEqual({ type: 'set_party_size', count: 2 });
      expect(party('week-end avec ma femme, Annecy')).toEqual({ type: 'set_party_size', count: 2 });
      expect(party('avec ma femme et les petits lacs du Jura')).toEqual({ type: 'set_party_size', count: 2 });
    });
  });

  describe('isNamedTrail : pas les chemins et sentiers courants', () => {
    it('« chemin de halage », « sentier côtier », « sentier botanique », « chemin des crêtes », « chemin de fer » : des noms communs', () => {
      for (const t of ['Chemin de halage', 'Sentier côtier', 'Sentier botanique', 'Chemin des crêtes', 'Chemin de fer', 'sentier de randonnée', 'chemin forestier'])
        expect(isNamedTrail(t), t).toBe(false);
    });
    it('les sentiers nommés restent reconnus', () => {
      for (const t of [
        'GR20', 'GR20 sud', 'Tour du Mont-Blanc', 'Laugavegur', 'Chemin de Stevenson', 'chemin de stevenson', 'Sentier des douaniers',
        'Sentier des Douaniers', 'Chemin de Compostelle', 'chemin de saint-jacques', 'Chemin de Saint-Jacques', 'Chemin d’Arles', 'Sentier Cathare',
        'Camino Portugués', 'Alta Via 3', 'Haute Route Chamonix-Zermatt', 'Everest base camp trek',
      ])
        expect(isNamedTrail(t), t).toBe(true);
    });
  });
});

// Deuxième relecture de la fusion (23 oct.) : le « de » d'un nom de lieu, l'activité dite ailleurs, envies en trop.
describe('Relecture #108 (2) : « de X à Y » et noms de lieu', () => {
  const NOW = '2026-10-16';
  const read = (t: string, activity: CompasActivity | null = null) => parseIntentRules(t, NOW, 'fr', { activity });
  const dest = (actions: CompasIntentAction[]) => actions.filter((a) => a.type === 'set_destination');
  const wishLabels = (actions: CompasIntentAction[]) => actions.flatMap((a) => (a.type === 'wish' ? [a.label] : []));
  const merged = (ai: CompasIntentAction[], rules: CompasIntentAction[], activity: CompasActivity | null = null) =>
    mergeActions(ai, rules, activity).map((m) => m.action);

  // [phrase, ville d'arrivée (main), nom du lieu (tel que l'IA le rendrait)]
  const NAMED: Array<[string, string, string]> = [
    ['une semaine au Pays de Galles à Cardiff', 'Cardiff', 'Pays de Galles'],
    ['au Lac de Garde à Sirmione', 'Sirmione', 'Lac de Garde'],
    ['3 jours au lac de Côme à Bellagio', 'Bellagio', 'Lac de Côme'],
    ['week-end en Val de Loire à Amboise', 'Amboise', 'Val de Loire'],
    ['week-end en Baie de Somme à Saint-Valery-sur-Somme', 'Saint-Valery-sur-Somme', 'Baie de Somme'],
    ['en Terre de Feu à Ushuaia', 'Ushuaia', 'Terre de Feu'],
    ['week-end en Vallée de Chevreuse à Rambouillet', 'Rambouillet', 'Vallée de Chevreuse'],
    ['rando en Forêt de Fontainebleau à Barbizon', 'Barbizon', 'Forêt de Fontainebleau'],
    ['au Cap de Creus à Cadaqués', 'Cadaqués', 'Cap de Creus'],
    ['en Pays de Savoie à Annecy', 'Annecy', 'Pays de Savoie'],
  ];
  const STRAY = /^(?:pays|lac|val|baie|terre|vallee|foret|cap|cote|galles|garde|come|loire|somme|feu|chevreuse|fontainebleau|creus|savoie)$/i;
  const stray = (labels: string[]) => labels.filter((l) => STRAY.test(l.normalize('NFD').replace(/\p{M}/gu, '')));

  it('sans IA : le « de » du nom de lieu n’ouvre pas un « de X à Y » ; la ville dite ensuite est la destination', () => {
    for (const [t, city] of NAMED) {
      const r = read(t);
      expect(dest(r), t).toEqual([{ type: 'set_destination', place: city }]);
      expect(r.some((a) => a.type === 'set_origin'), t).toBe(false);
      expect(stray(wishLabels(r)), t).toEqual([]);
    }
    expect(dest(read('sur la Côte de Granit Rose à Perros-Guirec'))).toEqual([{ type: 'set_destination', place: 'Côte de Granit Rose' }]);
    expect(dest(read('au Pays de Galles, à Cardiff'))).toEqual([{ type: 'set_destination', place: 'Cardiff' }]);
  });

  it('avec l’IA qui rend le nom du lieu : il reste la destination entière, la ville une envie', () => {
    for (const [t, city, name] of NAMED) {
      const m = merged([{ type: 'set_destination', place: name }], read(t));
      expect(dest(m), t).toEqual([{ type: 'set_destination', place: name }]);
      expect(wishLabels(m), t).toContain(city);
      expect(stray(wishLabels(m)), t).toEqual([]);
      expect(wishLabels(m).filter((w) => w === name), t).toEqual([]);
    }
  });

  it('avec l’IA qui rend la ville d’arrivée : elle est la destination, sans envie parasite', () => {
    for (const [t, city] of NAMED) {
      const m = merged([{ type: 'set_destination', place: city }], read(t));
      expect(dest(m), t).toEqual([{ type: 'set_destination', place: city }]);
      expect(stray(wishLabels(m)), t).toEqual([]);
      expect(wishLabels(m).filter((w) => w === city), t).toEqual([]);
    }
  });

  it('les « de X à Y » légitimes restent lus', () => {
    const route = (t: string) => {
      const r = read(t);
      const o = r.find((a) => a.type === 'set_origin');
      const d = r.find((a) => a.type === 'set_destination');
      return [o?.type === 'set_origin' ? o.place : null, d?.type === 'set_destination' ? d.place : null];
    };
    expect(route('de Genève à Nice')).toEqual(['Genève', 'Nice']);
    expect(route('de Lyon à Nice à vélo')).toEqual(['Lyon', 'Nice']);
    expect(route('rando de Saint-Jean-Pied-de-Port à Roncevaux')).toEqual(['Saint-Jean-Pied-de-Port', 'Roncevaux']);
    expect(route('rando de Le Monastier à Cévennes')).toEqual(['Le Monastier', 'Cévennes']);
    expect(route('de la gare de Lyon à Nice')).toEqual(['Lyon', 'Nice']);
    expect(route('traversée des Alpes à vélo en 12 jours de Genève à Nice')).toEqual(['Genève', 'Nice']);
    expect(route('en Val de Loire de Blois à Tours à vélo')).toEqual(['Blois', 'Tours']);
    // Le nom de lieu entier est le départ quand un « de » l'ouvre ; pas après un mot qui situe.
    expect(route('du lac de Côme à Milan à vélo')).toEqual(['Lac de Côme', 'Milan']);
    expect(route('à vélo de Mont de Marsan à Dax')).toEqual(['Mont de Marsan', 'Dax']);
    expect(route('rando du Cap de Creus à Cadaqués')).toEqual(['Cap de Creus', 'Cadaqués']);
    expect(route('rando autour du lac de Côme à Bellagio')[0]).toBeNull();
    expect(route('à vélo au bord du lac de Garde à Sirmione')).toEqual([null, 'Sirmione']);
    // Pas à pied ni à vélo : le pays reste (correctif `walksOrRides` gardé).
    const japan = read('voyage au Japon de Tokyo à Kyoto en 10 jours');
    expect(dest(japan)).toEqual([{ type: 'set_destination', place: 'Japon' }]);
    expect(wishLabels(japan)).toEqual(['Tokyo', 'Kyoto']);
  });
});

describe('Relecture #108 (2) : activité dite hors de la phrase (IA, bouton, voyage)', () => {
  const NOW = '2026-10-16';
  const dest = (actions: CompasIntentAction[]) => actions.filter((a) => a.type === 'set_destination');
  const origin = (actions: CompasIntentAction[]) => actions.filter((a) => a.type === 'set_origin');
  // [phrase, région (lue / rendue par l'IA), départ, arrivée]
  const REGIONS: Array<[string, string, string, string]> = [
    ['dans le Jura de Gex à Pontarlier en 3 jours', 'Jura', 'Gex', 'Pontarlier'],
    ['dans les Pyrénées de Hendaye à Banyuls', 'Pyrénées', 'Hendaye', 'Banyuls'],
    ['dans les Alpes de Chamonix à Zermatt', 'Alpes', 'Chamonix', 'Zermatt'],
    ['en Corse de Calenzana à Conca', 'Corse', 'Calenzana', 'Conca'],
  ];

  it('à pied (activité de l’IA, relue par les règles) : itinéraire de X à Y, la région reste une envie', () => {
    for (const [t, region, from, to] of REGIONS) {
      const rules = parseIntentRules(t, NOW, 'fr', { activity: 'hiking' });
      const m = mergeActions([{ type: 'set_destination', place: region }, { type: 'set_activity', activity: 'hiking' }], rules).map(
        (x) => x.action
      );
      expect(origin(m), t).toEqual([{ type: 'set_origin', place: from }]);
      expect(dest(m)[0]?.type === 'set_destination' && dest(m)[0].place.split(',')[0], t).toBe(to);
      expect(m, t).toContainEqual({ type: 'wish', label: region });
    }
  });

  it('activité du voyage seulement (bouton) : la lecture et la fusion la prennent', () => {
    const t = '10 jours en Italie de Rome à Florence';
    // Sans activité : l'Italie, Rome et Florence en envies (ni à pied ni à vélo).
    expect(dest(parseIntentRules(t, NOW))).toEqual([{ type: 'set_destination', place: 'Italie' }]);
    const rules = parseIntentRules(t, NOW, 'fr', { activity: 'cycling' });
    expect(origin(rules)).toEqual([{ type: 'set_origin', place: 'Rome' }]);
    expect(dest(rules)).toEqual([{ type: 'set_destination', place: 'Florence, Italie' }]);
    // L'IA rend l'Italie, sans activité : celle du voyage fait le trajet.
    const m = mergeActions([{ type: 'set_destination', place: 'Italie' }], rules, 'cycling').map((x) => x.action);
    expect(dest(m)).toEqual([{ type: 'set_destination', place: 'Florence, Italie' }]);
    expect(origin(m)).toEqual([{ type: 'set_origin', place: 'Rome' }]);
    // Une activité dite dans la phrase passe avant celle du voyage.
    expect(origin(parseIntentRules('road trip au Japon de Tokyo à Kyoto', NOW, 'fr', { activity: 'hiking' }))).toEqual([]);
  });
});

describe('Relecture #108 (2) : envies qui redisent la destination ou son pays', () => {
  const NOW = '2026-10-16';
  const wishLabels = (actions: CompasIntentAction[]) => actions.flatMap((a) => (a.type === 'wish' ? [a.label] : []));
  it('« voyage au Japon de Tokyo à Kyoto » + IA « Kyoto » : Kyoto, et Tokyo seul en envie', () => {
    const m = mergeActions([{ type: 'set_destination', place: 'Kyoto' }], parseIntentRules('voyage au Japon de Tokyo à Kyoto en 10 jours', NOW)).map(
      (x) => x.action
    );
    expect(m.filter((a) => a.type === 'set_destination')).toEqual([{ type: 'set_destination', place: 'Kyoto' }]);
    expect(wishLabels(m)).toEqual(['Tokyo']);
  });
  it('« en Italie de Rome à Florence à vélo » : pas d’envie « Italie » (déjà dans « Florence, Italie »)', () => {
    const rules = parseIntentRules('en Italie de Rome à Florence à vélo', NOW);
    for (const ai of [[], [{ type: 'set_destination', place: 'Florence' }]] as CompasIntentAction[][])
      expect(wishLabels(mergeActions(ai, rules).map((x) => x.action))).toEqual(['de Rome à Florence']);
  });
  it('deux lieux différents restent : « Jordanie » de l’IA garde « Désert du Wadi Rum » en envie ; deux pays aussi', () => {
    const wadi = mergeActions([{ type: 'set_destination', place: 'Jordanie' }], [{ type: 'set_destination', place: 'Désert du Wadi Rum' }]);
    expect(wishLabels(wadi.map((x) => x.action))).toEqual(['Désert du Wadi Rum']);
    const two = mergeActions([{ type: 'set_destination', place: 'Corée du Sud' }], [{ type: 'set_destination', place: 'Japon' }]);
    expect(wishLabels(two.map((x) => x.action))).toEqual(['Japon']);
  });
});

describe('Relecture #108 (2) : « est » après un sentier célèbre', () => {
  it('le verbe « est » n’est pas un tronçon ; « est » en fin de segment en reste un', () => {
    expect(famousTrailIn('le GR20 est magnifique, 10 jours')).toBe('GR20');
    expect(famousTrailIn('Compostelle est mon rêve')).toBe('Chemin de Saint-Jacques');
    expect(famousTrailIn('le chemin de Compostelle est long')).toBe('Chemin de Saint-Jacques');
    expect(parseIntentRules('le GR20 est magnifique, 10 jours', '2026-10-16')).toContainEqual({ type: 'wish', label: 'GR20' });
    expect(famousTrailIn('le GR5 est en 12 jours')).toBe('GR5 est');
    expect(famousTrailIn('le GR10 ouest, 8 jours')).toBe('GR10 ouest');
    expect(famousTrailIn('le GR20 nord en 7 jours')).toBe('GR20 nord');
    expect(famousTrailIn('GR20 sud')).toBe('GR20 sud');
  });
});
