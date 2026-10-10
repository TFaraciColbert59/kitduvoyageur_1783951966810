import { describe, expect, it } from 'vitest';
import {
  actionLabel,
  groundingIssue,
  intentActionSchema,
  mergeActions,
  parseIntentRules,
  validateActions,
  type IntentContext,
} from '../engine/intent';
import { buildCompasIntentSystem, parseCompasIntentOutput } from '@/lib/ai/features/compasIntent';

// Vendredi 9 octobre 2026.
const TODAY = '2026-10-09';
const ctx: IntentContext = {
  today: TODAY,
  startDate: null,
  endDate: null,
  engaged: 0,
  currency: 'EUR',
  avoid: [],
  wishes: [],
};
/** Départ et destination lus par les règles, dans l'ordre. */
const places = (text: string) =>
  parseIntentRules(text, TODAY).filter((a) => a.type === 'set_origin' || a.type === 'set_destination');

describe('« depuis X » : le lieu de départ, jamais la destination', () => {
  it('« rando 3 jours dans le Vercors depuis Lyon » : destination Vercors, départ Lyon', () => {
    const a = parseIntentRules('rando 3 jours dans le Vercors depuis Lyon', TODAY);
    expect(a).toContainEqual({ type: 'set_destination', place: 'Vercors' });
    expect(a).toContainEqual({ type: 'set_origin', place: 'Lyon' });
    expect(a).not.toContainEqual({ type: 'set_destination', place: 'Lyon' });
    expect(a).not.toContainEqual({ type: 'set_destination', place: 'Vercors depuis Lyon' });
    expect(a).toContainEqual({ type: 'search_route', query: 'Vercors' });
  });

  it('« au départ de Genève » → départ Genève, aucune destination', () => {
    expect(places('au départ de Genève')).toEqual([{ type: 'set_origin', place: 'Genève' }]);
  });

  it('le dernier recours ne prend plus le lieu de départ pour la destination', () => {
    expect(places('rando 3 jours depuis Lyon')).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
    expect(places('ski 2 jours depuis Lyon avec Paul')).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
  });

  it('les quatre tournures, l’article et l’élision', () => {
    expect(places('trek 5 jours en Sardaigne au départ de Lyon')).toEqual([
      { type: 'set_origin', place: 'Lyon' },
      { type: 'set_destination', place: 'Sardaigne' },
    ]);
    expect(places('week-end en Corse en partant de Marseille')).toEqual([
      { type: 'set_origin', place: 'Marseille' },
      { type: 'set_destination', place: 'Corse' },
    ]);
    expect(places('on part de Grenoble pour 2 jours dans le Vercors')).toEqual([
      { type: 'set_origin', place: 'Grenoble' },
      { type: 'set_destination', place: 'Vercors' },
    ]);
    expect(places("rando dans le Vercors au départ d'Annecy")).toEqual([
      { type: 'set_origin', place: 'Annecy' },
      { type: 'set_destination', place: 'Vercors' },
    ]);
    expect(places('trek en Islande depuis la Suisse')).toEqual([
      { type: 'set_origin', place: 'Suisse' },
      { type: 'set_destination', place: 'Islande' },
    ]);
    expect(places('rando au départ du Grand-Bornand')).toEqual([{ type: 'set_origin', place: 'Grand-Bornand' }]);
    expect(places('depuis Lyon, 3 jours en Ardèche')).toEqual([
      { type: 'set_origin', place: 'Lyon' },
      { type: 'set_destination', place: 'Ardèche' },
    ]);
  });

  it('phrase tapée sans majuscule : « depuis lyon » ; « depuis longtemps » n’est pas un lieu', () => {
    expect(places('rando 3 jours dans le vercors depuis lyon')).toEqual([
      { type: 'set_origin', place: 'Lyon' },
      { type: 'set_destination', place: 'Vercors' },
    ]);
    expect(places('rando dans les vosges depuis longtemps')).toEqual([
      { type: 'set_destination', place: 'Vosges' },
    ]);
  });

  it('CONTRE-EXEMPLES : « depuis 3 ans », « depuis Noël » ne sont pas des départs', () => {
    expect(places('depuis 3 ans je rêve du Népal')).toEqual([{ type: 'set_destination', place: 'Népal' }]);
    expect(places('rando depuis Noël')).toEqual([]);
  });

  it('un nom qui commence comme un mois reste un lieu (« Marseille », « Octon »), un mois non', () => {
    expect(places('week-end à Marseille')).toEqual([{ type: 'set_destination', place: 'Marseille' }]);
    expect(places('trek à Octon')).toEqual([{ type: 'set_destination', place: 'Octon' }]);
    expect(places('5 jours en avril à 3')).toEqual([]);
  });
});

const MONTHS_FR = [
  'janvier', 'février', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'aout',
  'septembre', 'octobre', 'novembre', 'décembre', 'decembre',
];
const MONTHS_EN = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
];
const cap = (w: string) => w[0].toLocaleUpperCase('fr') + w.slice(1);

describe('un mois n’est jamais une destination, ni seul ni en série', () => {
  it.each([
    ...MONTHS_FR.flatMap((m) => [`rando en ${m}`, `rando en ${cap(m)}`, `trek à ${cap(m)}`]),
    ...MONTHS_EN.flatMap((m) => [`hiking in ${m}`, `Hiking in ${cap(m)}`]),
  ])('« %s » : aucune destination', (text) => {
    expect(places(text)).toEqual([]);
  });

  it.each([
    ['rando en juillet-aout', '2027-07-01'],
    ['randonnee en septembre-octobre', '2027-09-01'],
    ['trek en mai-juin', '2027-05-01'],
    ['rando en juillet aout', '2027-07-01'],
    ['trek 5 jours en juin puis juillet', '2027-06-01'],
    ['Rando en Juillet-Août', '2027-07-01'],
    ['trek en Mai ou Juin', '2027-05-01'],
    ['Hiking in July and August', '2027-07-01'],
  ])('« %s » : aucune destination, la date du premier mois reste lue', (text, start) => {
    expect(places(text)).toEqual([]);
    expect(parseIntentRules(text, TODAY)).toContainEqual(expect.objectContaining({ type: 'set_dates', start }));
  });

  it.each(['Marseille', 'Juillac', 'Octon', 'Novara', 'Maillane'])(
    '« %s » commence comme un mois et reste une destination',
    (name) => {
      expect(places(`trek à ${name}`)).toEqual([{ type: 'set_destination', place: name }]);
    }
  );
});

describe('le départ s’arrête où finit le lieu', () => {
  it('« depuis Lyon vers le Vercors » : départ Lyon, le Vercors reste lu', () => {
    const a = parseIntentRules('Départ depuis Lyon vers le Vercors, 3 jours', TODAY);
    expect(a).toContainEqual({ type: 'set_origin', place: 'Lyon' });
    expect(a).toContainEqual({ type: 'set_destination', place: 'Vercors' });
  });

  it('« depuis Lyon vers Grenoble » : le parcours après « vers » est lu, pas avalé par le départ', () => {
    const a = parseIntentRules('Rando depuis Lyon vers Grenoble', TODAY);
    expect(a).toContainEqual({ type: 'set_origin', place: 'Lyon' });
    expect(a).toContainEqual({ type: 'search_route', query: 'Grenoble' });
  });

  it('« depuis Lyon dans le Vercors » : départ Lyon, destination Vercors', () => {
    expect(places('Rando depuis Lyon dans le Vercors')).toEqual([
      { type: 'set_origin', place: 'Lyon' },
      { type: 'set_destination', place: 'Vercors' },
    ]);
  });

  it('« jusqu’à Zermatt » n’est pas dans le départ', () => {
    expect(places('Trek depuis Chamonix jusqu’à Zermatt')).toEqual([
      { type: 'set_origin', place: 'Chamonix' },
      { type: 'set_destination', place: 'Zermatt' },
    ]);
  });

  it.each([
    ['Rando depuis Paris par le train', 'Paris'],
    ['Rando depuis Marseille puis retour', 'Marseille'],
    ['Rando depuis Marseille ou Nice', 'Marseille'],
    ['Rando depuis Lyon après le boulot', 'Lyon'],
    ['Rando depuis Lyon apres le boulot', 'Lyon'],
    ['Rando depuis Lyon ensuite le Vercors', 'Lyon'],
    ['Rando depuis Lyon direction Annecy', 'Lyon'],
  ])('« %s » : le départ est seulement « %s »', (text, origin) => {
    const origins = parseIntentRules(text, TODAY).filter((a) => a.type === 'set_origin');
    expect(origins).toEqual([{ type: 'set_origin', place: origin }]);
  });

  it('apostrophe typographique : « au départ d’Annecy »', () => {
    expect(places('Rando au départ d’Annecy')).toEqual([{ type: 'set_origin', place: 'Annecy' }]);
  });
});

describe('phrase tapée sans majuscule : ni un moment, ni un nom commun, ni la suite de la phrase ne sont le départ', () => {
  it.each([
    'depuis le sommet',
    'rando depuis la veille',
    'on part de zero',
    'rando depuis lundi dernier',
    'rando depuis janvier dernier',
    'rando depuis le lendemain',
    'rando depuis demain',
    'rando depuis hier',
    'rando depuis les',
  ])('« %s » : aucun départ', (text) => {
    expect(places(text)).toEqual([]);
  });

  it.each([
    'rando depuis lyon par le train',
    'rando depuis lyon puis retour',
    'rando depuis lyon ou nice',
    "rando depuis lyon jusqu'a zermatt",
    'rando depuis lyon jusqu’à zermatt',
    'rando depuis lyon vers le vercors',
    'rando depuis lyon ensuite le vercors',
    'rando depuis lyon apres le boulot',
    'rando depuis lyon direction annecy',
  ])('« %s » : le départ s’arrête à « Lyon »', (text) => {
    const origins = parseIntentRules(text, TODAY).filter((a) => a.type === 'set_origin');
    expect(origins).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
  });

  it('un vrai lieu tapé en minuscules reste un départ', () => {
    expect(places('rando depuis lyon')).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
    expect(places('rando depuis la suisse')).toEqual([{ type: 'set_origin', place: 'Suisse' }]);
  });
});

describe('phrase tapée sans majuscule : seuls « depuis » et « au départ de » lisent un départ', () => {
  // Ces phrases partaient au géocodeur comme lieu de départ, sans qu'on le voie.
  it.each([
    'on part de bonne heure',
    'on part du principe que',
    'je pars de nuit',
    'on part de bon matin',
    'je pars du boulot vendredi',
    'depuis le parking du col',
    'depuis le col de rousset',
    'au départ du refuge de la pra',
    'depuis le village',
    'depuis le temps que',
    'depuis midi',
  ])('« %s » : ni départ ni destination', (text) => {
    expect(places(text)).toEqual([]);
  });

  it.each([
    'depuis la gare',
    "depuis l'aeroport",
    'depuis la station',
    'depuis la gare du nord',
    'depuis le nord',
    'depuis le week-end',
    'depuis des semaines',
    'depuis ce matin',
    'depuis une heure',
    'depuis le bureau',
    'depuis la maison',
    'depuis le travail',
    'depuis quelques jours',
    'depuis tout ce temps',
    'depuis plus de deux ans',
    'depuis moins de deux ans',
  ])('« %s » : aucun départ', (text) => {
    expect(places(text)).toEqual([]);
  });

  it.each([
    'je pars de lyon',
    'on part de grenoble',
    'nous partons de lyon',
    'en partant de lyon',
  ])('« %s » : ces tournures ne lisent un départ qu’avec une majuscule', (text) => {
    expect(places(text)).toEqual([]);
  });

  it('les mêmes tournures avec une majuscule restent lues', () => {
    expect(places('Je pars de Lyon')).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
    expect(places('On part de Chamonix')).toEqual([{ type: 'set_origin', place: 'Chamonix' }]);
    expect(places('je pars de Lyon')).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
  });

  it('« depuis lyon », « au départ de grenoble », « au départ d’annecy » restent lus', () => {
    expect(places('depuis lyon')).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
    expect(places('au départ de grenoble')).toEqual([{ type: 'set_origin', place: 'Grenoble' }]);
    expect(places('au départ d’annecy')).toEqual([{ type: 'set_origin', place: 'Annecy' }]);
    expect(places("au depart d'annecy")).toEqual([{ type: 'set_origin', place: 'Annecy' }]);
    expect(places('rando 3 jours dans le vercors depuis lyon')).toEqual([
      { type: 'set_origin', place: 'Lyon' },
      { type: 'set_destination', place: 'Vercors' },
    ]);
  });

  it('gare, aéroport, station : le lieu qui suit « de », pas le mot « gare »', () => {
    expect(places('depuis la gare de briancon')).toEqual([{ type: 'set_origin', place: 'Briancon' }]);
    expect(places('au départ de la gare de grenoble')).toEqual([{ type: 'set_origin', place: 'Grenoble' }]);
    expect(places('depuis l’aéroport de geneve')).toEqual([{ type: 'set_origin', place: 'Geneve' }]);
    expect(places("depuis l'aeroport de lyon")).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
    expect(places('depuis la station de la plagne')).toEqual([{ type: 'set_origin', place: 'Plagne' }]);
  });
});

describe('l’action set_origin', () => {
  it('schéma : un nom de 1 à 80 caractères', () => {
    expect(intentActionSchema.safeParse({ type: 'set_origin', place: 'Lyon' }).success).toBe(true);
    expect(intentActionSchema.safeParse({ type: 'set_origin', place: ' ' }).success).toBe(false);
    expect(intentActionSchema.safeParse({ type: 'set_origin', place: 'x'.repeat(81) }).success).toBe(false);
  });

  it('libellé « Départ : X », proposé tel quel', () => {
    expect(actionLabel({ type: 'set_origin', place: 'Lyon' })).toBe('Départ : Lyon');
    const [p] = validateActions([{ action: { type: 'set_origin', place: 'Genève' }, source: 'regles' }], ctx);
    expect(p).toMatchObject({ ok: true, label: 'Départ : Genève', reason: null });
  });

  it('ancrage : un départ absent de la phrase est refusé', () => {
    expect(groundingIssue({ type: 'set_origin', place: 'Lyon' }, 'rando depuis Lyon')).toBeNull();
    expect(groundingIssue({ type: 'set_origin', place: 'Paris' }, 'rando depuis Lyon')).toBe('Lieu absent de ta phrase');
  });

  it('l’IA ne fait pas du lieu de départ dit la destination', () => {
    const rules = parseIntentRules('rando 3 jours depuis Lyon', TODAY);
    const merged = mergeActions([{ type: 'set_destination', place: 'Lyon' }], rules).map((m) => m.action);
    expect(merged).not.toContainEqual({ type: 'set_destination', place: 'Lyon' });
    expect(merged).toContainEqual({ type: 'set_origin', place: 'Lyon' });
  });
});

describe('contrat de l’IA', () => {
  it('liste set_origin et dit que « depuis Lyon » est un départ', () => {
    const system = buildCompasIntentSystem();
    expect(system).toContain('{"type": "set_origin", "place":');
    expect(system).toMatch(/« depuis Lyon ».*= set_origin/);
    expect(parseCompasIntentOutput({ actions: [{ type: 'set_origin', place: 'Lyon' }] })).toEqual([
      { type: 'set_origin', place: 'Lyon' },
    ]);
  });
});
