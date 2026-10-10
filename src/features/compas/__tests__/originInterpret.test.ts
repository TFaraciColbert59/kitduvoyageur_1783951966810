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
}));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async (_id: string, config: { scope: string }) =>
    h.refuse && config.scope === 'compas-destination' ? new Response(null, { status: h.refuse }) : null
  ),
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
      },
    })),
  };
});
vi.mock('@/lib/ai/askAI', () => ({
  askAI: vi.fn(async () => ({ text: h.aiText, model: 'x', degraded: false, cached: false, provider: 'nvidia' })),
}));
vi.mock('../server/rates', () => ({ getEurRate: vi.fn(async () => null) }));

import { compasInterpretAction } from '../server/compasActions';

const TRIP = '11111111-1111-4111-8111-111111111111';

describe('compréhension : « depuis X »', () => {
  beforeEach(() => {
    h.aiText = '{"actions": []}';
    h.found = {};
    h.searched = [];
    h.refuse = null;
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

  it('compteur de recherches de lieux atteint : la carte n’est pas interrogée, le nom court reste', async () => {
    h.refuse = 429;
    h.found = { 'Bourg en Bresse': BOURG };
    const actions = await interpret('rando 3 jours depuis Bourg en Bresse');
    expect(h.searched).toEqual([]);
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
