import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  later: [] as Array<() => Promise<void>>,
  meta: {} as Record<string, unknown>,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ after: (fn: () => Promise<void>) => h.later.push(fn) }));
vi.mock('../server/compasServer', async (orig) => {
  const real = await orig<typeof import('../server/compasServer')>();
  const supabase = {
    from: () => ({
      update: () => ({ eq: async () => ({ error: null }) }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { metadata: h.meta } }) }) }),
    }),
  };
  return {
    ...real,
    requireEditor: vi.fn(async () => ({
      supabase,
      userId: 'u1',
      trip: { id: '11111111-1111-4111-8111-111111111111', start_date: null, end_date: null, metadata: {} },
    })),
    patchTripMetadata: vi.fn(async (_s: unknown, _id: string, fn: (m: Record<string, unknown>) => Record<string, unknown>) => {
      h.meta = fn(h.meta);
      return h.meta;
    }),
  };
});

import { compasAutofillOutcomeAction, compasAutofillStartAction } from '../server/autofillActions';

const TRIP = '11111111-1111-4111-8111-111111111111';

describe('préparation en arrière-plan', () => {
  beforeEach(() => {
    h.later = [];
    h.meta = {};
  });

  it('rend un jeton tout de suite ; l’issue est écrite sur le voyage puis relue par ce jeton seul', async () => {
    const started = await compasAutofillStartAction({ tripId: TRIP, tripSlug: 'x', from: null, phase: 'all' });
    expect(started.success).toBe(true);
    const token = started.success ? started.token : '';
    // Rien n'a encore tourné : l'issue n'existe pas.
    expect(await compasAutofillOutcomeAction({ tripId: TRIP, token })).toBeNull();
    // Le travail après la réponse (ici : sans durée, refus immédiat) écrit son issue.
    await Promise.all(h.later.map((fn) => fn()));
    const outcome = await compasAutofillOutcomeAction({ tripId: TRIP, token });
    expect(outcome).toMatchObject({ success: false, error: expect.stringMatching(/combien de jours/), token });
    // Un autre jeton (préparation plus ancienne) ne lit pas cette issue.
    expect(await compasAutofillOutcomeAction({ tripId: TRIP, token: '99999999-9999-4999-8999-999999999999' })).toBeNull();
  });
});
