import { describe, expect, it } from 'vitest';
import { defaultDays, precisionActions, understandRequest } from '../engine/request';

const TODAY = '2026-10-07';
const line = (r: ReturnType<typeof understandRequest>, key: string) => r.lines.find((l) => l.key === key);

describe('understandRequest — « voici ce que j’ai compris »', () => {
  it('la phrase seule suffit', () => {
    const r = understandRequest('5 jours de trek dans le Vercors à 3, en refuge', TODAY);
    expect(r.activity).toBe('trekking');
    expect(line(r, 'lieu')).toMatchObject({ value: 'Vercors', state: 'compris' });
    expect(line(r, 'quand')).toMatchObject({ value: '5 jours', state: 'compris' });
    expect(line(r, 'groupe')).toMatchObject({ value: '3 personnes', state: 'compris' });
    expect(line(r, 'nuits')).toMatchObject({ value: 'Refuges' });
    expect(r.say).toBe('5 jours de trek dans le Vercors à 3, en refuge');
    expect(r.empty).toBe(false);
  });

  it('sans durée : durée par défaut annoncée et ajoutée à la phrase', () => {
    const r = understandRequest('escalade à Kalymnos', TODAY);
    expect(line(r, 'quand')).toMatchObject({ state: 'defaut', value: '3 jours par défaut · date choisie au mieux' });
    expect(r.say).toBe('escalade à Kalymnos · 3 jours');
  });

  it('les précisions priment et partent avec la phrase', () => {
    const r = understandRequest('rando dans les Vosges', TODAY, { days: 4, party: 2, activity: 'trekking' });
    expect(r.activity).toBe('trekking');
    expect(line(r, 'activite')?.state).toBe('precise');
    expect(line(r, 'quand')).toMatchObject({ value: '4 jours', state: 'precise' });
    expect(line(r, 'groupe')).toMatchObject({ value: '2 personnes', state: 'precise' });
    expect(r.say).toBe('rando dans les Vosges · 4 jours · à 2 · activité : trekking');
  });

  it('les précisions priment sur la phrase à la lecture (« 3 jours … à 4 » puis 5 jours, 2 personnes)', () => {
    const r = understandRequest('3 jours de rando dans le Vercors à 4', TODAY, { days: 5, party: 2, activity: 'trekking' });
    expect(r.say).toBe('3 jours de rando dans le Vercors à 4 · 5 jours · à 2 · activité : trekking');
    expect(precisionActions(r.say)).toEqual([
      { type: 'set_duration', days: 5, hours: null },
      { type: 'set_party_size', count: 2 },
      { type: 'set_activity', activity: 'trekking' },
    ]);
    // Sans précision : rien d'imposé (la durée par défaut ajoutée vaut précision).
    expect(precisionActions('5 jours de trek dans le Vercors à 3')).toEqual([]);
    expect(precisionActions('escalade à Kalymnos · 3 jours')).toEqual([{ type: 'set_duration', days: 3, hours: null }]);
    expect(precisionActions('Japon · activité : inconnue')).toEqual([]);
  });

  it('nom propre sans préposition : lu comme le lieu', () => {
    const r = understandRequest('Le Népal en trek, 3 semaines', TODAY);
    expect(line(r, 'lieu')).toMatchObject({ value: 'Népal', state: 'compris' });
    expect(line(r, 'quand')?.value).toBe('21 jours');
  });

  it('lieu non lu par les règles : cherché dans la phrase (l’IA le trouvera)', () => {
    const r = understandRequest('trek 5 jours', TODAY);
    expect(line(r, 'lieu')).toMatchObject({ state: 'a_trouver' });
  });

  // Jeu P2 des 50 demandes nouvelles (7 octobre) : chaque écart corrigé à la règle.
  it.each([
    ['10 jours en Norvège dans les fjords', 'Norvège'],
    ['vélo 3 jours le long de la Loire', 'Loire'],
    ['tour de Bretagne à vélo en 8 jours', 'Bretagne'],
    ['GR20 en 12 jours', 'Corse'],
    ['alpinisme 4 jours Mont Blanc', 'Mont Blanc'],
    ['randoo 3 jour dans les vosges', 'Vosges'],
    ['séjour 7 jours au Maroc à Marrakech', 'Marrakech'],
    ['trek 7 jours au Népal autour des Annapurnas', 'Népal'],
    ['6 jours dans les Dolomites via ferrata', 'Dolomites'],
    ['weekend à Barcelone pas cher', 'Barcelone'],
    ['9 jours au Kenya safari', 'Kenya'],
    ['vélo 7 jours de Nantes à la mer', 'Nantes'],
    ['randonnée 5 jours en Corse sur le Mare a Mare', 'Corse'],
    ["descente de l'Ardèche en canoë 2 jours en août", 'Ardèche'],
    ['descente du Tarn en kayak 3 jours', 'Tarn'],
  ])('lieu de « %s » : %s', (text, place) => {
    expect(line(understandRequest(text, TODAY), 'lieu')).toMatchObject({ value: place, state: 'compris' });
  });

  it.each([
    ['randoo 3 jour dans les vosges', 'Randonnée'],
    ['marche nordique 2 heures', 'Randonnée'],
    ['balade de 3h en forêt de Fontainebleau', 'Randonnée'],
    ['tour du Queyras en 6 jours', 'Trek'],
    ['5 jours dans les Dolomites en refuge', 'Randonnée'],
    ['4 jours dans les Cévennes à pied avec un âne', 'Randonnée'],
    ['marche 3 heures en forêt près de Paris', 'Randonnée'],
  ])('activité de « %s » : %s', (text, activity) => {
    expect(line(understandRequest(text, TODAY), 'activite')).toMatchObject({ value: activity, state: 'compris' });
  });

  it('week-end, avec ou sans tiret : 2 jours, jamais « une week » de 7 jours', () => {
    for (const text of ['un week-end à Lisbonne', 'week end surf à Biarritz', 'weekend camping dans le Morvan'])
      expect(line(understandRequest(text, TODAY), 'quand')?.value).toBe('10 oct. · 2 jours');
  });

  it('départ seul et durée dite : les deux sont affichés', () => {
    expect(line(understandRequest('10 jours au Japon en avril', TODAY), 'quand')?.value).toBe('1 avr. · 10 jours');
  });

  it('moment de la journée sans durée : quelques heures, aujourd’hui', () => {
    expect(line(understandRequest('activité cet après-midi', TODAY), 'quand')?.value).toBe('7 oct. · 3 h');
    expect(line(understandRequest('course à pied 10 km ce soir', TODAY), 'quand')?.value).toBe('7 oct. · 2 h');
    expect(line(understandRequest('course à pied 10 km ce soir', TODAY), 'lieu')?.state).toBe('a_trouver');
  });

  it('sortie sans durée : une journée ; camping : nuits en bivouac', () => {
    expect(line(understandRequest('sortie vélo route 80 km', TODAY), 'quand')?.value).toBe('1 jour');
    expect(line(understandRequest('weekend camping dans le Morvan', TODAY), 'nuits')?.value).toBe('Bivouac');
  });

  it('sortie de quelques heures : pas de durée par défaut', () => {
    const r = understandRequest('rando 2h demain autour de Grenoble', TODAY);
    expect(line(r, 'quand')?.state).toBe('compris');
    expect(r.say).toBe('rando 2h demain autour de Grenoble');
  });

  it('vide sans phrase ni activité', () => {
    expect(understandRequest('  ', TODAY).empty).toBe(true);
    expect(understandRequest('', TODAY, { activity: 'ski' }).empty).toBe(false);
    expect(understandRequest('', TODAY, { activity: 'ski' }).say).toBe('6 jours · activité : ski');
  });

  it('durées par défaut cohérentes', () => {
    expect(defaultDays('running')).toBe(1);
    expect(defaultDays('trekking')).toBe(7);
    expect(defaultDays(null)).toBe(7);
  });
});

describe('ancrage des nuits dehors proposées par l’IA', () => {
  it('« tour du Queyras en 6 jours » : 6 nuits dehors refusées (le nombre est celui des jours)', async () => {
    const { groundingIssue } = await import('../engine/intent');
    expect(groundingIssue({ type: 'set_outdoor_nights', nights: 6 }, 'tour du Queyras en 6 jours')).not.toBeNull();
    expect(groundingIssue({ type: 'set_outdoor_nights', nights: 4 }, 'hiking 5 days in the Swiss Alps')).not.toBeNull();
    expect(groundingIssue({ type: 'set_outdoor_nights', nights: 3 }, 'rando 4 jours avec 3 nuits en bivouac')).toBeNull();
    expect(groundingIssue({ type: 'set_outdoor_nights', nights: 2 }, 'dormir dehors 2 nuits dans le Vercors')).toBeNull();
  });
});

describe('sans lieu dit', () => {
  it('« week-end bivouac au bord d’un lac » : aucun lieu inventé (préparé près de chez toi)', async () => {
    const { understandRequest } = await import('../engine/request');
    const r = understandRequest('week-end bivouac au bord d’un lac', '2026-10-07');
    expect(r.lines.find((l) => l.key === 'lieu')?.state).toBe('a_trouver');
  });
});

/**
 * La ligne « Lieu » avant l'envoi : même lecture que la compréhension (`settleLinkedOrigin`,
 * `settleLinkedDestination`), sans la carte. Quand « en » ou « sur » peut faire partie d'un nom,
 * les deux lectures sont dites ; jamais un bout de nom seul (« Bresse ») donné pour la destination.
 */
describe('« Lieu » : « en » et « sur » dans un nom (aperçu avant l’envoi)', () => {
  const lieu = (text: string) => line(understandRequest(text, TODAY), 'lieu');

  it('« depuis Bourg en Bresse » : « Bresse » n’est jamais dit comme la destination', () => {
    const l = lieu('rando 3 jours depuis Bourg en Bresse');
    expect(l?.value).not.toBe('Bresse');
    expect(l).toMatchObject({
      value: '« Bourg en Bresse » est le départ si la carte le connaît ; sinon Bresse',
      state: 'defaut',
    });
  });

  it('« depuis La Roche sur Yon » et « depuis Neuilly sur Seine » : même lecture, le nom long est nommé', () => {
    expect(lieu('un week-end depuis La Roche sur Yon')?.value).toMatch(/^« La Roche sur Yon » est le départ/);
    expect(lieu('depuis Neuilly sur Seine, 2 jours')?.value).toMatch(/^« Neuilly sur Seine » est le départ/);
    expect(lieu('un week-end depuis La Roche sur Yon')?.value).not.toBe('Yon');
    expect(lieu('depuis Neuilly sur Seine, 2 jours')?.value).not.toBe('Seine');
  });

  it('« depuis Lyon en Corse » : la Corse reste lue, le doute est dit', () => {
    expect(lieu('5 jours depuis Lyon en Corse')).toMatchObject({
      value: '« Lyon en Corse » est le départ si la carte le connaît ; sinon Corse',
      state: 'defaut',
    });
  });

  it('« à Bourg en Bresse » : le nom long d’abord, le nom court si la carte ne le connaît pas', () => {
    expect(lieu('rando 3 jours à Bourg en Bresse')).toMatchObject({
      value: 'Bourg en Bresse si la carte le connaît ; sinon Bourg',
      state: 'defaut',
    });
    expect(lieu('rando à La Roche sur Yon 3 jours')?.value).toBe('La Roche sur Yon si la carte le connaît ; sinon Roche');
    expect(lieu('week-end à Neuilly sur Seine')?.value).toBe('Neuilly sur Seine si la carte le connaît ; sinon Neuilly');
  });

  it('sans doute possible, la ligne ne change pas', () => {
    expect(lieu('rando 3 jours depuis Lyon')).toMatchObject({ state: 'a_trouver' });
    expect(lieu('5 jours de trek dans le Vercors depuis Lyon')).toMatchObject({ value: 'Vercors', state: 'compris' });
    expect(lieu('week-end à Lyon en train')).toMatchObject({ value: 'Lyon', state: 'compris' });
    expect(lieu('rando en Corse en juin')).toMatchObject({ value: 'Corse', state: 'compris' });
    expect(lieu('week-end à Lyon et Grenoble')).toMatchObject({ value: 'Lyon', state: 'compris' });
  });

  it('le nom long ne part pas dans la phrase envoyée', () => {
    const r = understandRequest('rando 3 jours à Bourg en Bresse', TODAY);
    expect(r.say).toBe('rando 3 jours à Bourg en Bresse');
    expect(JSON.stringify(r.lines)).not.toContain('longer');
  });
});
