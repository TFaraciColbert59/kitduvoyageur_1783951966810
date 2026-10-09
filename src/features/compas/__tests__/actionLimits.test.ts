import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Limites par personne sur la destination (carte : Photon, LocationIQ, Geoapify,
 * parfois l'IA) et sur la compréhension d'une phrase (IA, taux de change)
 * — plan 2.2. Aucune recherche ni appel IA ne part une fois la limite atteinte.
 */
const h = vi.hoisted(() => ({
  calls: [] as Array<{
    identifier: string;
    scope: string;
    limit: number;
    windowMs: number;
    failMode?: string;
  }>,
  refuse: null as null | { scope: string; status: number },
  denied: false,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(
    async (
      identifier: string,
      config: { scope: string; limit: number; windowMs: number; failMode?: string }
    ) => {
      h.calls.push({
        identifier,
        scope: config.scope,
        limit: config.limit,
        windowMs: config.windowMs,
        failMode: config.failMode,
      });
      if (h.refuse?.scope !== config.scope) return null;
      return new Response(null, { status: h.refuse.status });
    }
  ),
}));
vi.mock('../server/compasServer', async (orig) => {
  const real = await orig<typeof import('../server/compasServer')>();
  const supabase = {
    from: () => ({
      select: () => ({ eq: async () => ({ data: [] }) }),
    }),
  };
  return {
    ...real,
    requireEditor: vi.fn(async () =>
      h.denied
        ? { error: 'Accès refusé' }
        : {
            supabase,
            userId: 'u1',
            trip: {
              id: '11111111-1111-4111-8111-111111111111',
              user_id: 'u1',
              title: 'Trek · nouvelle aventure',
              start_date: null,
              end_date: null,
              party_size: 1,
              budget_currency: 'EUR',
              metadata: {},
            },
          }
    ),
  };
});
vi.mock('../server/placeLookup', async (orig) => ({
  ...(await orig<typeof import('../server/placeLookup')>()),
  lookupDestination: vi.fn(async () => null),
  lookupBase: vi.fn(async () => null),
  lookupLoose: vi.fn(async () => null),
  lookupNatural: vi.fn(async () => null),
  lookupMassif: vi.fn(async () => null),
  lookupReverse: vi.fn(async () => null),
  lookupRiver: vi.fn(async () => null),
  stageCandidates: vi.fn(async () => []),
  stageAliasCandidates: vi.fn(async () => []),
}));
vi.mock('@/lib/ai/askAI', () => ({
  askAI: vi.fn(async () => ({
    text: '{}',
    model: 'x',
    degraded: true,
    cached: false,
    provider: 'fallback',
  })),
}));
vi.mock('../server/rates', () => ({ getEurRate: vi.fn(async () => null) }));

import { askAI } from '@/lib/ai/askAI';
import { compasInterpretAction, compasSetDestinationAction } from '../server/compasActions';
import { lookupDestination, lookupLoose, lookupNatural } from '../server/placeLookup';

const TRIP = '11111111-1111-4111-8111-111111111111';

describe('limites de la destination et de la phrase', () => {
  beforeEach(() => {
    h.calls = [];
    h.refuse = null;
    h.denied = false;
    vi.clearAllMocks();
  });

  it('destination : limite atteinte → message clair, aucune recherche sur la carte', async () => {
    h.refuse = { scope: 'compas-destination', status: 429 };
    const res = await compasSetDestinationAction({ tripId: TRIP, tripSlug: 'x', place: 'Vercors' });
    expect(res).toEqual({
      success: false,
      error: 'Trop de lieux cherchés d’affilée : patiente quelques minutes.',
    });
    expect(lookupDestination).not.toHaveBeenCalled();
    expect(lookupNatural).not.toHaveBeenCalled();
    expect(lookupLoose).not.toHaveBeenCalled();
    expect(askAI).not.toHaveBeenCalled();
  });

  it('destination : compteur indisponible → refus dit, aucune recherche', async () => {
    h.refuse = { scope: 'compas-destination', status: 503 };
    const res = await compasSetDestinationAction({ tripId: TRIP, tripSlug: 'x', place: 'Vercors' });
    expect(res).toEqual({
      success: false,
      error: 'Recherche de lieux indisponible pour le moment : réessaie dans un instant.',
    });
    expect(lookupDestination).not.toHaveBeenCalled();
    expect(askAI).not.toHaveBeenCalled();
  });

  it('destination : compte 20 par 10 min par personne', async () => {
    await compasSetDestinationAction({ tripId: TRIP, tripSlug: 'x', place: 'Vercors' });
    expect(h.calls).toContainEqual({
      identifier: 'u1',
      scope: 'compas-destination',
      limit: 20,
      windowMs: 600_000,
      failMode: 'closed',
    });
  });

  it('destination : accès refusé → rien n’est compté', async () => {
    h.denied = true;
    const res = await compasSetDestinationAction({ tripId: TRIP, tripSlug: 'x', place: 'Vercors' });
    expect(res).toEqual({ success: false, error: 'Accès refusé' });
    expect(h.calls).toEqual([]);
    expect(lookupDestination).not.toHaveBeenCalled();
  });

  it('phrase : limite atteinte → message clair, aucune IA', async () => {
    h.refuse = { scope: 'compas-interpret', status: 429 };
    const res = await compasInterpretAction({ tripId: TRIP, text: 'rando 3 jours dans le Vercors' });
    expect(res).toEqual({
      success: false,
      error: 'Trop de demandes d’affilée : patiente quelques minutes.',
    });
    expect(askAI).not.toHaveBeenCalled();
  });

  it('phrase : compteur indisponible → refus dit, aucune IA', async () => {
    h.refuse = { scope: 'compas-interpret', status: 503 };
    const res = await compasInterpretAction({ tripId: TRIP, text: 'rando 3 jours dans le Vercors' });
    expect(res).toEqual({
      success: false,
      error: 'Compréhension indisponible pour le moment : réessaie dans un instant.',
    });
    expect(askAI).not.toHaveBeenCalled();
  });

  it('phrase : compte 30 par 10 min par personne', async () => {
    // askAI mocké : rend { degraded: true, provider: 'fallback', text: '{}' }
    const res = await compasInterpretAction({ tripId: TRIP, text: 'rando 3 jours dans le Vercors' });
    expect(res.success).toBe(true);
    expect(h.calls).toContainEqual({
      identifier: 'u1',
      scope: 'compas-interpret',
      limit: 30,
      windowMs: 600_000,
      failMode: 'closed',
    });
  });

  it('phrase : accès refusé → rien n’est compté', async () => {
    h.denied = true;
    const res = await compasInterpretAction({ tripId: TRIP, text: 'rando 3 jours dans le Vercors' });
    expect(res).toEqual({ success: false, error: 'Accès refusé' });
    expect(h.calls).toEqual([]);
    expect(askAI).not.toHaveBeenCalled();
  });
});
