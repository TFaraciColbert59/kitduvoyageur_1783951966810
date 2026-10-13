import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * « à Bourg en Bresse » de bout en bout dans la compréhension : les règles lisent le nom court et
 * proposent le nom long, la carte tranche, l'IA n'y change rien. Même montage que
 * `originInterpret.test.ts`.
 */
const h = vi.hoisted(() => ({
  aiText: '{"actions": []}',
  /** Ce que la carte répond, par requête exacte (`lookupDestination`). */
  found: {} as Record<string, unknown>,
  /** Requêtes envoyées à la carte, dans l'ordre. */
  searched: [] as string[],
  /** La carte tombe en panne. */
  broken: false,
  /** Compteurs consultés, dans l'ordre. */
  scopes: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async (_id: string, config: { scope: string }) => {
    h.scopes.push(config.scope);
    return null;
  }),
}));
vi.mock('../server/placeLookup', async (orig) => ({
  ...(await orig<typeof import('../server/placeLookup')>()),
  lookupDestination: vi.fn(async (q: string) => {
    h.searched.push(q);
    if (h.broken) throw new Error('carte injoignable');
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
  askAI: vi.fn(async () => ({
    text: h.aiText,
    model: 'x',
    degraded: false,
    cached: false,
    provider: 'nvidia',
  })),
}));
vi.mock('../server/rates', () => ({ getEurRate: vi.fn(async () => null) }));

import { compasInterpretAction } from '../server/compasActions';

const TRIP = '11111111-1111-4111-8111-111111111111';
const place = (name: string, over: Record<string, unknown> = {}) => ({
  name,
  lat: 46.2,
  lon: 5.23,
  countryCode: 'FR',
  country: 'France',
  kind: 'city',
  settlement: true,
  settlementRank: 4,
  extent: null,
  ...over,
});

describe('compréhension : une destination dont le nom contient « en » ou « sur »', () => {
  beforeEach(() => {
    h.aiText = '{"actions": []}';
    h.found = {};
    h.searched = [];
    h.broken = false;
    h.scopes = [];
  });

  const interpret = async (text: string) => {
    const res = await compasInterpretAction({ tripId: TRIP, text });
    if (!res.success) throw new Error(res.error);
    return res.proposals.map((p) => p.action);
  };
  const destinations = (actions: Array<{ type: string }>) =>
    actions.filter((a) => a.type === 'set_destination');

  it('« à Bourg en Bresse » : la carte connaît ce nom, il devient la destination', async () => {
    h.found = { 'Bourg en Bresse': place('Bourg-en-Bresse') };
    const actions = await interpret('rando 3 jours à Bourg en Bresse');
    expect(h.searched).toEqual(['Bourg en Bresse']);
    expect(destinations(actions)).toEqual([{ type: 'set_destination', place: 'Bourg en Bresse' }]);
  });

  it.each([
    ['week-end à La Roche sur Yon', 'La Roche sur Yon', 'La Roche-sur-Yon'],
    ['week-end à Neuilly sur Seine', 'Neuilly sur Seine', 'Neuilly-sur-Seine'],
  ])('« %s » : nom long confirmé, gardé', async (text, asked, mapName) => {
    h.found = { [asked]: place(mapName) };
    const actions = await interpret(text);
    expect(h.searched).toEqual([asked]);
    expect(destinations(actions)).toEqual([{ type: 'set_destination', place: asked }]);
  });

  it('la carte ne connaît pas le nom long : la destination reste le nom court, comme avant', async () => {
    const actions = await interpret('rando 3 jours à Bourg en Bresse');
    expect(h.searched).toEqual(['Bourg en Bresse']);
    expect(destinations(actions)).toEqual([{ type: 'set_destination', place: 'Bourg' }]);
  });

  it('un résultat de la carte au nom différent (approchant) n’est pas pris : le nom court reste', async () => {
    h.found = { 'Bourg en Bresse': place('Bourg-Saint-Maurice') };
    const actions = await interpret('rando 3 jours à Bourg en Bresse');
    expect(destinations(actions)).toEqual([{ type: 'set_destination', place: 'Bourg' }]);
  });

  it('carte injoignable : le nom court reste, la compréhension n’échoue pas', async () => {
    h.broken = true;
    const actions = await interpret('rando 3 jours à Bourg en Bresse');
    expect(destinations(actions)).toEqual([{ type: 'set_destination', place: 'Bourg' }]);
  });

  it('une région ou un massif au nom exact est une destination valable (pas besoin d’un lieu habité)', async () => {
    h.found = {
      'Aix en Provence': place('Aix-en-Provence', { kind: 'region', settlement: false }),
    };
    const actions = await interpret('rando à Aix en Provence');
    expect(destinations(actions)).toEqual([{ type: 'set_destination', place: 'Aix en Provence' }]);
  });

  it('l’IA qui reprend le nom court : le nom long confirmé le remplace', async () => {
    h.found = { 'Bourg en Bresse': place('Bourg-en-Bresse') };
    h.aiText = JSON.stringify({ actions: [{ type: 'set_destination', place: 'Bourg' }] });
    const actions = await interpret('rando 3 jours à Bourg en Bresse');
    expect(destinations(actions)).toEqual([{ type: 'set_destination', place: 'Bourg en Bresse' }]);
  });

  it('l’IA qui propose déjà le nom long : une seule destination, pas de doublon avec les règles', async () => {
    h.aiText = JSON.stringify({ actions: [{ type: 'set_destination', place: 'Bourg en Bresse' }] });
    h.found = { 'Bourg en Bresse': place('Bourg-en-Bresse') };
    const actions = await interpret('rando 3 jours à Bourg en Bresse');
    expect(destinations(actions)).toHaveLength(1);
  });

  it('« depuis Lyon en Corse » se comporte comme avant : une seule recherche, départ Lyon, destination Corse', async () => {
    const actions = await interpret('5 jours depuis Lyon en Corse');
    expect(h.searched).toEqual(['Lyon en Corse']);
    expect(actions.filter((a) => a.type === 'set_origin')).toEqual([
      { type: 'set_origin', place: 'Lyon' },
    ]);
    expect(destinations(actions)).toEqual([{ type: 'set_destination', place: 'Corse' }]);
  });

  it('« depuis Bourg en Bresse » reste un départ : « Bresse » n’est pas une destination quand la carte confirme', async () => {
    h.found = { 'Bourg en Bresse': place('Bourg-en-Bresse') };
    const actions = await interpret('rando 3 jours depuis Bourg en Bresse');
    expect(actions.filter((a) => a.type === 'set_origin')).toEqual([
      { type: 'set_origin', place: 'Bourg en Bresse' },
    ]);
    expect(destinations(actions)).toEqual([]);
  });

  it('un départ et une destination à nom long : chacun tranché par la carte, une recherche chacun', async () => {
    h.found = {
      'Bourg en Bresse': place('Bourg-en-Bresse'),
      'Aix en Provence': place('Aix-en-Provence'),
    };
    const actions = await interpret('depuis Bourg en Bresse à Aix en Provence');
    expect([...h.searched].sort()).toEqual(['Aix en Provence', 'Bourg en Bresse']);
    expect(actions.filter((a) => a.type === 'set_origin')).toEqual([
      { type: 'set_origin', place: 'Bourg en Bresse' },
    ]);
    expect(destinations(actions)).toEqual([{ type: 'set_destination', place: 'Aix en Provence' }]);
  });

  it('seule la destination est confirmée : le départ garde son nom court', async () => {
    h.found = { 'Aix en Provence': place('Aix-en-Provence') };
    const actions = await interpret('depuis Bourg en Bresse à Aix en Provence');
    expect(actions.filter((a) => a.type === 'set_origin')).toEqual([
      { type: 'set_origin', place: 'Bourg' },
    ]);
    expect(destinations(actions)).toEqual([{ type: 'set_destination', place: 'Aix en Provence' }]);
  });

  it('une destination sans « en » ni « sur » ne cherche rien sur la carte', async () => {
    await interpret('rando 3 jours dans le Vercors depuis Lyon');
    await interpret('week-end à Lyon en train');
    await interpret('week-end à Lyon et Grenoble');
    expect(h.searched).toEqual([]);
  });

  it('la compréhension ne consomme que son propre compteur : l’application de la destination compte la sienne', async () => {
    h.found = { 'Bourg en Bresse': place('Bourg-en-Bresse') };
    await interpret('rando 3 jours à Bourg en Bresse');
    expect(h.scopes).toEqual(['compas-interpret']);
  });

  it('le nom long ne sort jamais de la compréhension, confirmé ou non', async () => {
    h.found = { 'Bourg en Bresse': place('Bourg-en-Bresse') };
    for (const known of [true, false]) {
      if (!known) h.found = {};
      const actions = await interpret('rando 3 jours à Bourg en Bresse');
      expect(JSON.stringify(actions)).not.toContain('longer');
    }
  });
});
