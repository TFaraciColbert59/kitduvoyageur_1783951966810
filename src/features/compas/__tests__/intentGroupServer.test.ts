import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Lot AC (PLAN-100 4.10) de bout en bout dans la compréhension d'une phrase : « 50 € par personne » multiplié par
 * le groupe (celui de la phrase, sinon celui du voyage) et « quelques jours » jamais transformé en nombre, ni par les
 * règles ni par l'IA.
 */
const h = vi.hoisted(() => ({
  aiText: '{"actions": []}',
  /** Taille du groupe rangée sur le voyage (null : pas encore dite). */
  party: null as number | null,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('../server/placeLookup', async (orig) => ({
  ...(await orig<typeof import('../server/placeLookup')>()),
  lookupDestination: vi.fn(async () => null),
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
        party_size: h.party,
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
const flat = (s: string) => s.replace(/[  ]/g, ' ');
const interpret = async (text: string) => {
  const res = await compasInterpretAction({ tripId: TRIP, text });
  if (!res.success) throw new Error(res.error);
  return res.proposals;
};

beforeEach(() => {
  h.aiText = '{"actions": []}';
  h.party = null;
});

describe('« par personne » multiplié par le groupe', () => {
  it('groupe dit dans la phrase : 50 € × 4, le calcul est dans la proposition', async () => {
    const budget = (await interpret('week-end à 4 en Ardèche, 50 € par personne')).find((p) => p.action.type === 'set_budget')!;
    expect(budget.ok).toBe(true);
    expect(budget.action).toMatchObject({ amount: 200, groupOf: 4 });
    expect(flat(budget.label)).toBe('Enveloppe : 200 € (50 € par personne × 4 personnes)');
  });

  it('sans groupe dans la phrase : le groupe du voyage', async () => {
    h.party = 3;
    const budget = (await interpret('week-end en Ardèche, 50 € par personne')).find((p) => p.action.type === 'set_budget')!;
    expect(budget.ok).toBe(true);
    expect(budget.action).toMatchObject({ amount: 150, groupOf: 3 });
  });

  it('aucun groupe connu : proposition refusée avec la précision à donner, rien d’appliqué', async () => {
    const budget = (await interpret('week-end en Ardèche, 50 € par personne')).find((p) => p.action.type === 'set_budget')!;
    expect(budget.ok).toBe(false);
    expect(budget.reason).toMatch(/^Dis aussi combien vous êtes/);
  });

  it('l’IA ne multiplie pas à la place du Compas : son enveloppe de 50 € (ou de 200 €) n’est pas proposée en plus', async () => {
    h.party = 4;
    h.aiText = JSON.stringify({ actions: [{ type: 'set_budget', amount: 50 }] });
    const budgets = (await interpret('week-end en Ardèche, 50 € par personne')).filter((p) => p.action.type === 'set_budget');
    expect(budgets).toHaveLength(1);
    expect(budgets[0].action).toMatchObject({ amount: 200, groupOf: 4 });
  });

  it('une enveloppe de groupe reste telle quelle, même avec un groupe connu', async () => {
    h.party = 4;
    const budget = (await interpret('week-end en Ardèche, budget 200 €')).find((p) => p.action.type === 'set_budget')!;
    expect(budget.action).toEqual({ type: 'set_budget', amount: 200, currency: 'EUR' });
  });
});

describe('« quelques jours »', () => {
  it('les règles posent « au moins 2 jours » ; le « 4 jours » de l’IA n’est ni proposé ni appliqué', async () => {
    h.aiText = JSON.stringify({ actions: [{ type: 'set_duration', days: 4, hours: null }] });
    const durations = (await interpret('quelques jours en Corse')).filter((p) => p.action.type === 'set_duration');
    expect(durations).toHaveLength(1);
    expect(durations[0].action).toEqual({ type: 'set_duration', days: 2, hours: null, atLeast: true });
    expect(durations[0].ok).toBe(true);
    expect(flat(durations[0].label)).toMatch(/^Durée : au moins 2 j/);
  });

  it('un nombre dit reste la durée', async () => {
    const durations = (await interpret('5 jours en Corse')).filter((p) => p.action.type === 'set_duration');
    expect(durations.map((p) => p.action)).toEqual([{ type: 'set_duration', days: 5, hours: null }]);
  });
});
