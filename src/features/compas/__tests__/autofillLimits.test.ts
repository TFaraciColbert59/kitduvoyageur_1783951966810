import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Limites de la préparation (audit du 8 octobre) : l'état de reprise vit dans
 * `trips.metadata`, que l'éditeur peut écrire. Réécrire cet état ne doit plus
 * relancer une préparation sans compter.
 */
const h = vi.hoisted(() => ({
  meta: {} as Record<string, unknown>,
  calls: [] as Array<{ identifier: string; scope: string; limit: number }>,
  refuse: null as null | { scope: string; status: number; retryAfter?: string },
}));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async (identifier: string, config: { scope: string; limit: number }) => {
    h.calls.push({ identifier, scope: config.scope, limit: config.limit });
    if (h.refuse?.scope !== config.scope) return null;
    return new Response(null, {
      status: h.refuse.status,
      headers: h.refuse.retryAfter ? { 'Retry-After': h.refuse.retryAfter } : {},
    });
  }),
}));
vi.mock('../server/compasServer', async (orig) => {
  const real = await orig<typeof import('../server/compasServer')>();
  const supabase = {
    from: () => ({
      update: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: [] }) }) }) }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { metadata: h.meta, updated_at: 'x' } }) }) }),
    }),
  };
  return {
    ...real,
    requireEditor: vi.fn(async () => ({
      supabase,
      userId: 'u1',
      trip: {
        id: '11111111-1111-4111-8111-111111111111',
        user_id: 'u1',
        start_date: null,
        end_date: null,
        party_size: 1,
        metadata: h.meta,
      },
    })),
  };
});

import { compasAutofillAction } from '../server/autofillActions';

const TRIP = '11111111-1111-4111-8111-111111111111';
const PENDING = { runId: 'run-x', stepIds: ['s1'], routeSet: false, notes: [] };

describe('limites de la préparation', () => {
  beforeEach(() => {
    h.calls = [];
    h.refuse = null;
    h.meta = { compas: { planned_days: 3 } };
  });

  it('un lancement compte pour la personne et pour le site', async () => {
    await compasAutofillAction({ tripId: TRIP, tripSlug: 'x', from: null, phase: 'steps' });
    expect(h.calls).toEqual([
      { identifier: 'u1', scope: 'compas-autofill', limit: 6 },
      { identifier: 'site', scope: 'compas-autofill-global', limit: 120 },
    ]);
  });

  it('une reprise écrite à la main dans le voyage est comptée (plus de contournement)', async () => {
    h.meta = { compas: { planned_days: 3, autofill_pending: PENDING } };
    h.refuse = { scope: 'compas-autofill-resume', status: 429, retryAfter: '120' };
    const res = await compasAutofillAction({ tripId: TRIP, tripSlug: 'x', from: null, phase: 'rest' });
    expect(h.calls).toEqual([{ identifier: 'u1', scope: 'compas-autofill-resume', limit: 12 }]);
    expect(res).toEqual({
      success: false,
      error: 'Beaucoup de préparations d’affilée : je reprends seul dans 2 min.',
      retryInS: 120,
    });
  });

  it('plafond du site atteint : message propre au site, relance automatique', async () => {
    h.refuse = { scope: 'compas-autofill-global', status: 429, retryAfter: '3000' };
    const res = await compasAutofillAction({ tripId: TRIP, tripSlug: 'x', from: null, phase: 'all' });
    expect(res).toEqual({
      success: false,
      error: 'Le Compas prépare beaucoup de voyages en ce moment : je reprends seul dans 15 min.',
      retryInS: 900,
    });
  });

  it('compteur indisponible : refus dit tel quel, sans « déjà lancée plusieurs fois »', async () => {
    h.refuse = { scope: 'compas-autofill', status: 503 };
    const res = await compasAutofillAction({ tripId: TRIP, tripSlug: 'x', from: null, phase: 'all' });
    expect(res).toEqual({
      success: false,
      error: 'Préparation momentanément indisponible : réessaie dans quelques minutes.',
    });
    expect(h.calls.map((c) => c.scope)).toEqual(['compas-autofill']);
  });
});
