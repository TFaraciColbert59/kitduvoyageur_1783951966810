import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PLAN-100 6.1 : « Tout préparer » répond dans la langue de la personne. Le français
 * reste celui d'avant (les autres tests de la préparation le vérifient mot pour mot).
 */
const h = vi.hoisted(() => ({
  locale: 'fr' as 'fr' | 'en',
  meta: {} as Record<string, unknown>,
  refuse: null as null | { scope: string; status: number; retryAfter?: string },
}));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/i18n/serverLocale', () => ({ getRequestLocale: async () => h.locale }));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async (_id: string, config: { scope: string }) => {
    if (h.refuse?.scope !== config.scope) return null;
    return new Response(null, {
      status: h.refuse.status,
      headers: h.refuse.retryAfter ? { 'Retry-After': h.refuse.retryAfter } : {},
    });
  }),
}));
vi.mock('../server/compasServer', async (orig) => {
  const real = await orig<typeof import('../server/compasServer')>();
  return {
    ...real,
    requireEditor: vi.fn(async () => ({
      supabase: {},
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

import {
  compasAutofillAction,
  compasRefreshAutofillAction,
  compasUndoAutofillAction,
} from '../server/autofillActions';

const TRIP = '11111111-1111-4111-8111-111111111111';
const input = { tripId: TRIP, tripSlug: 'x', from: null, phase: 'steps' as const };

beforeEach(() => {
  h.locale = 'fr';
  h.meta = {};
  h.refuse = null;
});

describe('préparation : refus dans la langue de la requête', () => {
  it('sans durée ni dates', async () => {
    expect(await compasAutofillAction(input)).toEqual({
      success: false,
      error: 'Dis-moi combien de jours, ou choisis les dates.',
    });
    h.locale = 'en';
    expect(await compasAutofillAction(input)).toEqual({
      success: false,
      error: 'Tell me how many days, or choose the dates.',
    });
  });

  it('déjà préparé', async () => {
    h.locale = 'en';
    h.meta = { compas: { planned_days: 3, autofill: { runId: 'r1' } } };
    expect(await compasAutofillAction(input)).toEqual({
      success: false,
      error: 'This trip is already prepared: undo it first to start again.',
      already: true,
    });
  });

  it('limite de fréquence : minutes dans le gabarit', async () => {
    h.locale = 'en';
    h.meta = { compas: { planned_days: 3 } };
    h.refuse = { scope: 'compas-autofill', status: 429, retryAfter: '120' };
    const res = await compasAutofillAction(input);
    expect(res).toMatchObject({
      success: false,
      error: 'Lots of preparations in a row: I’ll pick this up on my own in 2 min.',
    });
  });

  it('annuler sans rien à annuler, et entrée invalide', async () => {
    const undo = { tripId: TRIP, tripSlug: 'x' };
    expect(await compasUndoAutofillAction(undo)).toEqual({
      success: false,
      error: 'Rien à annuler.',
    });
    h.locale = 'en';
    expect(await compasUndoAutofillAction(undo)).toEqual({
      success: false,
      error: 'Nothing to undo.',
    });
    expect(await compasRefreshAutofillAction({ tripId: 'pas-un-uuid', tripSlug: 'x' })).toEqual({
      success: false,
      error: 'Invalid request',
    });
  });
});
