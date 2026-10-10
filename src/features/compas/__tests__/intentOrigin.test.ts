import { describe, expect, it } from 'vitest';
import {
  actionLabel,
  groundingIssue,
  intentActionSchema,
  linkedOriginOf,
  mergeActions,
  parseIntentRules,
  settleLinkedOrigin,
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

describe('phrase tapée sans majuscule : séjour, passage, relief, liaison et possessif ne sont jamais un départ', () => {
  // Un départ faux est appliqué sans qu'on le voie (et devient l'ancre du voyage) : les familles de
  // noms communs sont fermées ici, et le serveur refuse en plus tout lieu qui n'est pas habité.
  const none = (texts: string[]) => {
    for (const text of texts) expect(places(text), text).toEqual([]);
  };

  it('hébergement et lieux de vie : camping, hôtel, chalet, gîte, cabane…', () => {
    none([
      'depuis le camping',
      "depuis l'hôtel",
      "depuis l'hotel",
      'depuis le chalet',
      'depuis le gîte',
      'depuis la cabane',
      'depuis le hameau',
      'depuis le centre',
      'depuis la fac',
      'depuis le lycée',
      "depuis l'école",
      'depuis la ferme',
      "depuis l'abri",
      'depuis le bivouac',
      'depuis le camp de base',
      "depuis l'auberge",
      "depuis l'appartement",
      'depuis la chambre',
      'depuis la tente',
      'depuis le domicile',
      "depuis l'hôpital",
      "depuis l'université",
      'depuis le quartier',
    ]);
  });

  it('transport et chemins : port, pont, sentier, piste, voiture, train, route…', () => {
    none([
      'depuis le port',
      'depuis le pont',
      'au départ du pont de normandie',
      'au départ du sentier',
      'depuis le chemin',
      'depuis la piste',
      'depuis la voiture',
      'depuis le train',
      'depuis le bus',
      'depuis la route',
      'depuis le bateau',
      "depuis l'avion",
      'depuis le métro',
      'depuis le tram',
    ]);
  });

  it('relief et eau : pic, cime, crête, source, massif, île, plage…', () => {
    none([
      'depuis le pic',
      'depuis la cime',
      'depuis la crête',
      'depuis la source',
      'depuis le massif',
      "depuis l'île de ré",
      "depuis l'ile",
      'depuis la plage',
      'depuis la colline',
      'depuis le glacier',
      'depuis la falaise',
      'depuis le plateau',
      'depuis la grotte',
      'depuis le château',
    ]);
  });

  it('adverbes et mots de liaison : tôt, déjà, environ, cela, dernier, année…', () => {
    none([
      'depuis tôt',
      'depuis tard',
      'depuis déjà trois ans',
      'depuis maintenant un an',
      'depuis bientôt un mois',
      'depuis presque un an',
      'depuis environ un mois',
      'depuis cela fait longtemps',
      'depuis combien de temps',
      'depuis tout petit',
      'depuis la dernière fois',
      'depuis le dernier week-end',
      "depuis l'année dernière",
      'depuis une semaine',
    ]);
  });

  it('possessifs : « depuis votre arrivée », « depuis ton départ »…', () => {
    none([
      'depuis votre arrivée',
      'depuis vos conseils',
      'depuis ton départ',
      'depuis tes photos',
      'depuis son arrivée',
      'depuis ses vacances',
      'depuis notre arrivée',
      'depuis nos photos',
      'depuis leur départ',
      'depuis leurs conseils',
      'depuis mon arrivée',
      'depuis mes photos',
    ]);
  });

  it('les mêmes mots précédés d’« au départ de » : jamais un départ non plus', () => {
    none(['au départ du camping', "au départ de l'hôtel", 'au départ du chalet', 'au départ de votre arrivée']);
  });

  it.each([
    'rando depuis lyon vendredi',
    'rando depuis lyon samedi matin',
    'rando depuis lyon lundi',
    'rando depuis lyon dimanche soir',
    'rando depuis lyon midi',
    'rando depuis lyon fin juin',
    'rando depuis lyon pendant les vacances',
    'rando depuis lyon sur trois jours',
    'depuis lyon svp',
    'depuis lyon merci',
    'depuis lyon rando de trois jours',
    'depuis lyon randonnee',
    'depuis lyon train',
    'depuis lyon hiver',
    'depuis lyon été',
    'depuis lyon printemps',
    'depuis lyon automne',
    'depuis lyon octobre',
    'depuis lyon weekend',
    'depuis lyon deux jours',
    'depuis lyon avec paul',
    'depuis lyon pour une semaine',
    'depuis lyon puis retour',
  ])('« %s » : le départ s’arrête au lieu, « Lyon »', (text) => {
    expect(places(text)).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
  });

  it('les villes tapées en minuscules restent lues, composées ou non', () => {
    const origins = (text: string) => places(text).filter((a) => a.type === 'set_origin');
    expect(origins('rando depuis paris')).toEqual([{ type: 'set_origin', place: 'Paris' }]);
    expect(origins('rando depuis saint etienne')).toEqual([{ type: 'set_origin', place: 'Saint Etienne' }]);
    expect(origins('rando au départ de clermont-ferrand')).toEqual([{ type: 'set_origin', place: 'Clermont-ferrand' }]);
    expect(origins('depuis port-vendres')).toEqual([{ type: 'set_origin', place: 'Port-vendres' }]);
    expect(origins('depuis bordeaux vendredi')).toEqual([{ type: 'set_origin', place: 'Bordeaux' }]);
    expect(origins('depuis neuilly sur seine')).toEqual([
      { type: 'set_origin', place: 'Neuilly', longer: 'Neuilly sur seine' },
    ]);
  });
});

describe('« depuis Bourg en Bresse » : « en » et « sur » peuvent faire partie du nom', () => {
  const origin = (text: string) => places(text).find((a) => a.type === 'set_origin');

  it('le nom court reste le départ, le nom long est proposé à côté (la carte tranche)', () => {
    expect(origin('rando 3 jours depuis Bourg en Bresse')).toEqual({
      type: 'set_origin',
      place: 'Bourg',
      longer: 'Bourg en Bresse',
    });
    expect(origin('un week-end depuis La Roche sur Yon')).toEqual({
      type: 'set_origin',
      place: 'La Roche',
      longer: 'La Roche sur Yon',
    });
    expect(origin('depuis Aix en Provence pour 3 jours')).toEqual({
      type: 'set_origin',
      place: 'Aix',
      longer: 'Aix en Provence',
    });
  });

  it('« depuis Lyon en Corse » : même forme, la destination reste lue', () => {
    const a = parseIntentRules('5 jours depuis Lyon en Corse', TODAY);
    expect(a).toContainEqual({ type: 'set_origin', place: 'Lyon', longer: 'Lyon en Corse' });
    expect(a).toContainEqual({ type: 'set_destination', place: 'Corse' });
  });

  it('tapé en minuscules, avec les mêmes garde-fous', () => {
    expect(origin('rando depuis bourg en bresse')).toEqual({
      type: 'set_origin',
      place: 'Bourg',
      longer: 'Bourg en bresse',
    });
    expect(origin('depuis aix en provence')).toMatchObject({ place: 'Aix', longer: 'Aix en provence' });
  });

  it('minuscules : un nom à connecteur est proposé en entier (« saint jean de luz », « aix les bains »)', () => {
    expect(origin('depuis saint jean de luz')).toEqual({
      type: 'set_origin',
      place: 'Saint Jean',
      longer: 'Saint Jean de luz',
    });
    expect(origin('rando depuis aix les bains pour 3 jours')).toEqual({
      type: 'set_origin',
      place: 'Aix',
      longer: 'Aix les bains',
    });
    expect(origin('depuis mont de marsan vendredi')).toEqual({
      type: 'set_origin',
      place: 'Mont',
      longer: 'Mont de marsan',
    });
    expect(origin("depuis l'isle sur la sorgue")).toMatchObject({ place: 'Isle', longer: "L'Isle sur la sorgue" });
  });

  it.each([
    'depuis lyon le matin',
    'depuis paris le weekend',
    'depuis grenoble de nuit',
    'depuis lyon la semaine prochaine',
    'depuis lyon de bon matin',
    'depuis lyon le vendredi',
    'depuis lyon de temps en temps',
    'depuis lyon pour 3 jours',
  ])('minuscules : « %s » n’étend pas le nom (un moment n’est pas un bout de nom)', (text) => {
    expect(origin(text)).not.toHaveProperty('longer');
  });

  it('« et » relie aussi des noms (« Saint-Pierre-et-Miquelon », « Trinité et Tobago »)', () => {
    expect(origin('rando depuis Saint Pierre et Miquelon')).toEqual({
      type: 'set_origin',
      place: 'Saint Pierre',
      longer: 'Saint Pierre et Miquelon',
    });
    expect(origin('depuis saint pierre et miquelon')).toEqual({
      type: 'set_origin',
      place: 'Saint Pierre',
      longer: 'Saint Pierre et miquelon',
    });
    expect(origin('depuis lyon et on rentre dimanche')).not.toHaveProperty('longer');
    expect(origin('depuis Lyon et retour dimanche')).not.toHaveProperty('longer');
  });

  it('l’article tombé devant le nom court revient dans le nom long (« la roche sur yon »)', () => {
    expect(origin('rando depuis la roche sur yon')).toEqual({
      type: 'set_origin',
      place: 'Roche',
      longer: 'La Roche sur yon',
    });
    expect(origin('rando depuis la Roche sur Yon')).toEqual({
      type: 'set_origin',
      place: 'Roche',
      longer: 'La Roche sur Yon',
    });
    expect(origin('depuis le puy en velay')).toMatchObject({ longer: 'Le Puy en velay' });
    expect(origin("depuis l'Isle sur la Sorgue")).toMatchObject({ longer: "L'Isle sur la Sorgue" });
  });

  it.each([
    'rando depuis Lyon en voiture',
    'rando depuis Lyon en juin',
    'rando depuis Lyon en Juin',
    'rando depuis Lyon en famille',
    'rando depuis Lyon sur 3 jours',
    'depuis Lyon en train',
    'depuis lyon en voiture',
    'depuis lyon en juin',
    'depuis lyon en famille',
    'depuis lyon en camping car',
    'depuis lyon en rando',
    'depuis lyon sur 3 jours',
    'depuis Lyon',
  ])('« %s » : pas de nom long à proposer', (text) => {
    expect(origin(text)).not.toHaveProperty('longer');
  });
});

describe('départ à nom long : ce que la carte a tranché', () => {
  const rules = (text: string) => parseIntentRules(text, TODAY);

  it('nom long confirmé : il devient le départ, son bout n’est plus une destination', () => {
    const actions = rules('rando 3 jours depuis Bourg en Bresse');
    expect(actions).toContainEqual({ type: 'set_destination', place: 'Bresse' });
    const link = linkedOriginOf(actions);
    expect(link).toEqual({ place: 'Bourg', longer: 'Bourg en Bresse' });
    const settled = settleLinkedOrigin(actions, link, true);
    expect(settled).toContainEqual({ type: 'set_origin', place: 'Bourg en Bresse' });
    expect(settled.filter((a) => a.type === 'set_destination')).toEqual([]);
  });

  it('nom long inconnu de la carte : le départ est le nom court, la destination reste', () => {
    const actions = rules('5 jours depuis Lyon en Corse');
    const settled = settleLinkedOrigin(actions, linkedOriginOf(actions), false);
    expect(settled).toContainEqual({ type: 'set_origin', place: 'Lyon' });
    expect(settled).toContainEqual({ type: 'set_destination', place: 'Corse' });
    expect(settled.some((a) => a.type === 'set_origin' && 'longer' in a)).toBe(false);
  });

  it('le bout du nom long tombe aussi quand l’article précède le nom court', () => {
    const link = { place: 'Puy', longer: 'Le Puy en velay' };
    expect(settleLinkedOrigin([{ type: 'set_destination', place: 'Velay' }], link, true)).toEqual([]);
    expect(settleLinkedOrigin([{ type: 'set_origin', place: 'Puy', longer: link.longer }], link, true)).toEqual([
      { type: 'set_origin', place: 'Le Puy en velay' },
    ]);
  });

  it('« L’Isle sur la Sorgue » : l’article du bout ne garde pas « Sorgue » comme destination', () => {
    const actions = rules('rando depuis L’Isle sur la Sorgue');
    const link = linkedOriginOf(actions);
    expect(link).toMatchObject({ longer: 'L’Isle sur la Sorgue' });
    const settled = settleLinkedOrigin(actions, link, true);
    expect(settled).toContainEqual({ type: 'set_origin', place: 'L’Isle sur la Sorgue' });
    expect(settled.filter((a) => a.type === 'set_destination')).toEqual([]);
  });

  it.each([
    ['Saint Jean', 'Saint Jean de luz', 'Luz'],
    ['Aix', 'Aix les bains', 'Bains'],
    ['Saint Pierre', 'Saint Pierre et Miquelon', 'Miquelon'],
    ['Mont', 'Mont de marsan', 'Marsan'],
    ['Villefranche', 'Villefranche sur Saône', 'Saône'],
  ])('« %s » → « %s » confirmé : « %s » n’est plus une destination, une autre reste', (place, longer, tail) => {
    const link = { place, longer };
    expect(settleLinkedOrigin([{ type: 'set_destination', place: tail }], link, true)).toEqual([]);
    expect(settleLinkedOrigin([{ type: 'set_destination', place: 'Corse' }], link, true)).toEqual([
      { type: 'set_destination', place: 'Corse' },
    ]);
    expect(settleLinkedOrigin([{ type: 'set_destination', place: tail }], link, false)).toEqual([
      { type: 'set_destination', place: tail },
    ]);
  });

  it('la destination que l’IA tire du même bout tombe aussi, et rien ne bouge sans nom long', () => {
    const actions = rules('depuis La Roche sur Yon');
    const link = linkedOriginOf(actions);
    expect(settleLinkedOrigin([{ type: 'set_destination', place: 'Yon' }], link, true)).toEqual([]);
    expect(settleLinkedOrigin([{ type: 'set_destination', place: 'Corse' }], link, true)).toEqual([
      { type: 'set_destination', place: 'Corse' },
    ]);
    const plain = rules('rando depuis Lyon');
    expect(linkedOriginOf(plain)).toBeNull();
    expect(settleLinkedOrigin(plain, null, false)).toEqual(plain);
  });

  it('schéma : le nom long est facultatif, de 1 à 80 caractères', () => {
    expect(intentActionSchema.safeParse({ type: 'set_origin', place: 'Bourg', longer: 'Bourg en Bresse' }).success).toBe(true);
    expect(intentActionSchema.safeParse({ type: 'set_origin', place: 'Bourg', longer: 'x'.repeat(81) }).success).toBe(false);
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
