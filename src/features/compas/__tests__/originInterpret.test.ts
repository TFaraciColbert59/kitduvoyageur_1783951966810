import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * « depuis X » de bout en bout dans la compréhension : les règles lisent le
 * départ, l'IA ne le remplace pas (RULES_FIRST) et ne le prend pas pour la
 * destination.
 */
const h = vi.hoisted(() => ({
  aiText: '{"actions": []}',
  /** Ce que la carte répond, par requête exacte (`lookupDestination`). */
  found: {} as Record<string, unknown>,
  /** Requêtes envoyées à la carte, dans l'ordre. */
  searched: [] as string[],
  /** Réponse du compteur de recherches de lieux (null : autorisé). */
  refuse: null as null | number,
  /** Compteurs consultés, dans l'ordre. */
  scopes: [] as string[],
  /** Activité du voyage (bouton du Compas vide). */
  tripActivity: 'mixed' as string | null,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async (_id: string, config: { scope: string }) => {
    h.scopes.push(config.scope);
    return h.refuse && config.scope === 'compas-destination' ? new Response(null, { status: h.refuse }) : null;
  }),
}));
vi.mock('../server/placeLookup', async (orig) => ({
  ...(await orig<typeof import('../server/placeLookup')>()),
  lookupDestination: vi.fn(async (q: string) => {
    h.searched.push(q);
    return h.found[q] ?? null;
  }),
}));
vi.mock('../server/compasServer', async (orig) => {
  const real = await orig<typeof import('../server/compasServer')>();
  const supabase = { from: () => ({ select: () => ({ eq: async () => ({ data: [] }) }) }) };
  return {
    ...real,
    requireEditor: vi.fn(async () => ({
      supabase,
      userId: 'u1',
      trip: {
        id: '11111111-1111-4111-8111-111111111111',
        user_id: 'u1',
        title: 'Rando · nouvelle aventure',
        start_date: null,
        end_date: null,
        party_size: 1,
        budget_currency: 'EUR',
        metadata: {},
        primary_activity: h.tripActivity,
      },
    })),
  };
});
vi.mock('@/lib/ai/askAI', () => ({
  askAI: vi.fn(async () => ({ text: h.aiText, model: 'x', degraded: false, cached: false, provider: 'nvidia' })),
}));
vi.mock('../server/rates', () => ({ getEurRate: vi.fn(async () => null) }));

import { compasInterpretAction } from '../server/compasActions';
import type { CompasIntentAction } from '../engine/intent';

const TRIP = '11111111-1111-4111-8111-111111111111';

describe('compréhension : « depuis X »', () => {
  beforeEach(() => {
    h.aiText = '{"actions": []}';
    h.found = {};
    h.searched = [];
    h.refuse = null;
    h.scopes = [];
  });

  it('sans IA utile : départ Lyon et destination Vercors, proposés et valides', async () => {
    const res = await compasInterpretAction({ tripId: TRIP, text: 'rando 3 jours dans le Vercors depuis Lyon' });
    if (!res.success) throw new Error(res.error);
    const ok = res.proposals.filter((p) => p.ok).map((p) => p.action);
    expect(ok).toContainEqual({ type: 'set_origin', place: 'Lyon' });
    expect(ok).toContainEqual({ type: 'set_destination', place: 'Vercors' });
    expect(res.proposals.find((p) => p.action.type === 'set_origin')?.label).toBe('Départ : Lyon');
  });

  it('l’IA ne remplace pas le départ lu par les règles, ni n’en fait la destination', async () => {
    h.aiText = JSON.stringify({
      actions: [
        { type: 'set_origin', place: 'Paris' },
        { type: 'set_destination', place: 'Lyon' },
      ],
    });
    const res = await compasInterpretAction({
      tripId: TRIP,
      text: 'rando 3 jours dans le Vercors depuis Lyon, retour à Paris',
    });
    if (!res.success) throw new Error(res.error);
    const actions = res.proposals.map((p) => p.action);
    expect(actions.filter((a) => a.type === 'set_origin')).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
    expect(actions.filter((a) => a.type === 'set_destination')).toEqual([{ type: 'set_destination', place: 'Vercors' }]);
  });
});

const BOURG = {
  name: 'Bourg-en-Bresse',
  lat: 46.2,
  lon: 5.23,
  countryCode: 'FR',
  country: 'France',
  kind: 'city',
  settlement: true,
  settlementRank: 4,
  extent: null,
};
const CAMPING = { ...BOURG, name: 'Camping Bourg en Bresse', kind: 'other', settlement: false };

describe('compréhension : un départ dont le nom contient « en » ou « sur »', () => {
  beforeEach(() => {
    h.aiText = '{"actions": []}';
    h.found = {};
    h.searched = [];
    h.refuse = null;
    h.scopes = [];
  });

  const interpret = async (text: string) => {
    const res = await compasInterpretAction({ tripId: TRIP, text });
    if (!res.success) throw new Error(res.error);
    return res.proposals.map((p) => p.action);
  };

  it('« depuis Bourg en Bresse » : la carte connaît ce nom, il devient le départ — Bresse n’est pas une destination', async () => {
    h.found = { 'Bourg en Bresse': BOURG };
    const actions = await interpret('rando 3 jours depuis Bourg en Bresse');
    expect(h.searched).toEqual(['Bourg en Bresse']);
    expect(actions.filter((a) => a.type === 'set_origin')).toEqual([{ type: 'set_origin', place: 'Bourg en Bresse' }]);
    expect(actions.filter((a) => a.type === 'set_destination')).toEqual([]);
  });

  it('« depuis Lyon en Corse » : la carte ne connaît pas « Lyon en Corse » — départ Lyon, destination Corse', async () => {
    const actions = await interpret('5 jours depuis Lyon en Corse');
    expect(h.searched).toEqual(['Lyon en Corse']);
    expect(actions.filter((a) => a.type === 'set_origin')).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
    expect(actions.filter((a) => a.type === 'set_destination')).toEqual([{ type: 'set_destination', place: 'Corse' }]);
  });

  it('un résultat de la carte au nom différent (fuzzy) n’est pas pris : le nom court reste', async () => {
    h.found = { 'Lyon en Corse': { ...BOURG, name: 'Lyon' } };
    const actions = await interpret('5 jours depuis Lyon en Corse');
    expect(actions.filter((a) => a.type === 'set_origin')).toEqual([{ type: 'set_origin', place: 'Lyon' }]);
  });

  it('un lieu au bon nom mais qui n’est pas un lieu habité (camping) n’est jamais un départ', async () => {
    h.found = { 'Camping Bourg en Bresse': CAMPING };
    const actions = await interpret('depuis Camping Bourg en Bresse');
    expect(actions.filter((a) => a.type === 'set_origin').every((a) => !('longer' in a))).toBe(true);
  });

  it('la compréhension ne consomme pas le compteur de recherches de lieux : l’application le fait une fois', async () => {
    h.found = { 'Bourg en Bresse': BOURG };
    await interpret('rando 3 jours depuis Bourg en Bresse');
    expect(h.scopes).toEqual(['compas-interpret']);
  });

  it('compteur de recherches de lieux déjà atteint : le nom long confirmé reste le départ proposé', async () => {
    h.refuse = 429;
    h.found = { 'Bourg en Bresse': BOURG };
    const actions = await interpret('rando 3 jours depuis Bourg en Bresse');
    expect(actions.filter((a) => a.type === 'set_origin')).toEqual([{ type: 'set_origin', place: 'Bourg en Bresse' }]);
  });

  it('carte muette (aucun résultat ni erreur) : le nom court reste', async () => {
    const actions = await interpret('rando 3 jours depuis Bourg en Bresse');
    expect(actions.filter((a) => a.type === 'set_origin')).toEqual([{ type: 'set_origin', place: 'Bourg' }]);
  });

  it('un départ sans « en » ni « sur » ne cherche rien sur la carte', async () => {
    await interpret('rando 3 jours dans le Vercors depuis Lyon');
    expect(h.searched).toEqual([]);
  });

  it('l’IA qui pose « Bresse » comme destination est écartée quand le nom long est confirmé', async () => {
    h.found = { 'Bourg en Bresse': BOURG };
    h.aiText = JSON.stringify({ actions: [{ type: 'set_destination', place: 'Bresse' }] });
    const actions = await interpret('rando 3 jours depuis Bourg en Bresse');
    expect(actions.filter((a) => a.type === 'set_destination')).toEqual([]);
  });
});

// Relecture #108 (2) : « de X à Y » quand l'activité n'est pas dite dans la phrase.
describe('compréhension : « de X à Y » avec l’activité de l’IA ou du voyage', () => {
  beforeEach(() => {
    h.aiText = '{"actions": []}';
    h.found = {};
    h.searched = [];
    h.refuse = null;
    h.scopes = [];
    h.tripActivity = 'mixed';
  });
  const interpret = async (text: string) => {
    const res = await compasInterpretAction({ tripId: TRIP, text });
    if (!res.success) throw new Error(res.error);
    return res.proposals.map((p) => p.action);
  };
  const where = (actions: CompasIntentAction[]) => ({
    origin: actions.flatMap((a) => (a.type === 'set_origin' ? [a.place] : [])),
    destination: actions.flatMap((a) => (a.type === 'set_destination' ? [a.place] : [])),
  });

  it('« dans le Jura de Gex à Pontarlier » + IA « Jura, randonnée » : de Gex à Pontarlier, le Jura en envie', async () => {
    h.aiText = JSON.stringify({
      actions: [
        { type: 'set_destination', place: 'Jura' },
        { type: 'set_activity', activity: 'hiking' },
      ],
    });
    const actions = await interpret('dans le Jura de Gex à Pontarlier en 3 jours');
    expect(where(actions)).toEqual({ origin: ['Gex'], destination: ['Pontarlier'] });
    expect(actions).toContainEqual({ type: 'wish', label: 'Jura' });
  });

  it('IA « Corse » sans activité, voyage « randonnée » : de Calenzana à Conca', async () => {
    h.tripActivity = 'hiking';
    h.aiText = JSON.stringify({ actions: [{ type: 'set_destination', place: 'Corse' }] });
    expect(where(await interpret('en Corse de Calenzana à Conca'))).toEqual({ origin: ['Calenzana'], destination: ['Conca'] });
  });

  it('« 10 jours en Italie de Rome à Florence », voyage « vélo », IA muette : de Rome à Florence', async () => {
    h.tripActivity = 'cycling';
    expect(where(await interpret('10 jours en Italie de Rome à Florence'))).toEqual({
      origin: ['Rome'],
      destination: ['Florence, Italie'],
    });
  });

  it('voyage « mixte » et IA « culture » : l’Italie reste, sans départ', async () => {
    h.aiText = JSON.stringify({ actions: [{ type: 'set_activity', activity: 'cultural' }] });
    expect(where(await interpret('10 jours en Italie de Rome à Florence'))).toEqual({ origin: [], destination: ['Italie'] });
  });

  it('l’activité de l’IA passe avant celle du voyage', async () => {
    h.tripActivity = 'hiking';
    h.aiText = JSON.stringify({ actions: [{ type: 'set_activity', activity: 'cultural' }] });
    expect(where(await interpret('voyage au Japon de Tokyo à Kyoto en 10 jours'))).toEqual({ origin: [], destination: ['Japon'] });
  });
});

// Relecture 3 de la PR #108 (23 oct.) : le départ des règles passe avant celui de l'IA (RULES_FIRST) ; un
// faux départ (« Mer de Marseille ») écrasait donc le bon départ que l'IA rendait.
describe('compréhension : nom commun devant « de X à Y », avec l’IA qui rend le départ', () => {
  beforeEach(() => {
    h.aiText = '{"actions": []}';
    h.found = {};
    h.searched = [];
    h.refuse = null;
    h.scopes = [];
    h.tripActivity = 'mixed';
  });
  const interpret = async (text: string) => {
    const res = await compasInterpretAction({ tripId: TRIP, text });
    if (!res.success) throw new Error(res.error);
    return res.proposals.map((p) => p.action);
  };
  const where = (actions: CompasIntentAction[]) => ({
    origin: actions.flatMap((a) => (a.type === 'set_origin' ? [a.place] : [])),
    destination: actions.flatMap((a) => (a.type === 'set_destination' ? [a.place.split(',')[0]] : [])),
  });
  const CASES: Array<[string, string | null, string]> = [
    ['kayak de mer de Marseille à Cassis en 3 jours', 'Marseille', 'Cassis'],
    ['voyage par voie de terre de Paris à Istanbul', 'Paris', 'Istanbul'],
    ['longer la côte de Biarritz à Hendaye à vélo', 'Biarritz', 'Hendaye'],
    ['la côte de Nice à Menton à pied en 3 jours', 'Nice', 'Menton'],
    ['le canal de Nantes à Brest à vélo en 7 jours', 'Nantes', 'Brest'],
    ['rando en bord de mer de Dieppe à Étretat', 'Dieppe', 'Étretat'],
    ['sentier du bord de mer de Saint-Malo à Cancale', 'Saint-Malo', 'Cancale'],
    ['descendre la vallée de Chamonix à Martigny à pied', 'Chamonix', 'Martigny'],
    ['la vallée de Chamonix à Zermatt', 'Chamonix', 'Zermatt'],
    ['rando le long de la côte de Collioure à Banyuls', 'Collioure', 'Banyuls'],
    ['une semaine au Pays de Galles à Cardiff', null, 'Cardiff'],
    ['au Lac de Garde à Sirmione', null, 'Sirmione'],
    ['3 jours au lac de Côme à Bellagio', null, 'Bellagio'],
    ['de la gare de Lyon à Nice', 'Lyon', 'Nice'],
    ['de Genève à Nice à vélo', 'Genève', 'Nice'],
    ['de Paris à Lyon en train', 'Paris', 'Lyon'],
  ];
  it('sans IA et avec l’IA qui rend le bon départ : le départ et l’arrivée attendus, jamais « Mer de Marseille »', async () => {
    for (const [text, from, to] of CASES) {
      h.aiText = '{"actions": []}';
      expect(where(await interpret(text)), `${text} (sans IA)`).toEqual({ origin: from ? [from] : [], destination: [to] });
      h.aiText = JSON.stringify({
        actions: [{ type: 'set_destination', place: to }, ...(from ? [{ type: 'set_origin', place: from }] : [])],
      });
      expect(where(await interpret(text)), `${text} (IA)`).toEqual({ origin: from ? [from] : [], destination: [to] });
    }
  });
});

// Relecture 3 : l'activité DU VOYAGE (« hiking » par défaut en base) n'est qu'un repère.
describe('compréhension : activité du voyage ignorée pour un autre moyen ou un pays à pied', () => {
  beforeEach(() => {
    h.aiText = '{"actions": []}';
    h.found = {};
    h.searched = [];
    h.refuse = null;
    h.scopes = [];
    h.tripActivity = 'hiking';
  });
  const interpret = async (text: string) => {
    const res = await compasInterpretAction({ tripId: TRIP, text });
    if (!res.success) throw new Error(res.error);
    const actions = res.proposals.map((p) => p.action);
    return {
      origin: actions.flatMap((a) => (a.type === 'set_origin' ? [a.place] : [])),
      destination: actions.flatMap((a) => (a.type === 'set_destination' ? [a.place] : [])),
    };
  };

  it('voyage « hiking » : « voyage au Japon de Tokyo à Kyoto » et « en Espagne … en train » gardent le pays', async () => {
    expect(await interpret('voyage au Japon de Tokyo à Kyoto en 10 jours')).toEqual({ origin: [], destination: ['Japon'] });
    expect(await interpret('en Espagne de Barcelone à Séville en train')).toEqual({ origin: [], destination: ['Espagne'] });
    expect(await interpret('10 jours en Italie de Rome à Florence')).toEqual({ origin: [], destination: ['Italie'] });
  });

  it('le vélo dit par « Préciser » ou par l’IA fait le trajet, même sur un voyage « hiking »', async () => {
    expect(await interpret('10 jours en Italie de Rome à Florence · activité : cycling')).toEqual({
      origin: ['Rome'],
      destination: ['Florence, Italie'],
    });
    h.aiText = JSON.stringify({ actions: [{ type: 'set_activity', activity: 'cycling' }] });
    expect(await interpret('10 jours en Italie de Rome à Florence')).toEqual({ origin: ['Rome'], destination: ['Florence, Italie'] });
  });

  it('voyage « hiking » dans une région (pas un pays) : le trajet reste', async () => {
    expect(await interpret('dans le Jura de Gex à Pontarlier en 3 jours')).toEqual({ origin: ['Gex'], destination: ['Pontarlier'] });
  });
});
