import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * « depuis X » de bout en bout dans la compréhension : les règles lisent le
 * départ, l'IA ne le remplace pas (RULES_FIRST) et ne le prend pas pour la
 * destination.
 */
const h = vi.hoisted(() => ({ aiText: '{"actions": []}' }));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
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
