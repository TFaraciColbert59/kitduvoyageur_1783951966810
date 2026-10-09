import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  later: [] as Array<() => Promise<void>>,
  meta: {} as Record<string, unknown>,
  updatedAt: '2026-10-09T00:00:00+00:00',
  steps: 0,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ after: (fn: () => Promise<void>) => h.later.push(fn) }));
vi.mock('../server/compasServer', async (orig) => {
  const real = await orig<typeof import('../server/compasServer')>();
  const supabase = {
    from: () => ({
      update: () => ({ eq: async () => ({ error: null }) }),
      select: (_cols: string, opts?: { head?: boolean }) =>
        opts?.head
          ? { eq: async () => ({ count: h.steps }) }
          : { eq: () => ({ maybeSingle: async () => ({ data: { metadata: h.meta, updated_at: h.updatedAt } }) }) },
    }),
  };
  return {
    ...real,
    requireEditor: vi.fn(async () => ({
      supabase,
      userId: 'u1',
      trip: { id: '11111111-1111-4111-8111-111111111111', start_date: null, end_date: null, party_size: 1, metadata: h.meta },
    })),
    updateTripMetadata: vi.fn(async (_s: unknown, _id: string, fn: (m: Record<string, unknown>) => Record<string, unknown>) => {
      h.meta = fn(h.meta);
      return { metadata: h.meta, error: null };
    }),
  };
});

import { compasAutofillOutcomeAction, compasAutofillStartAction } from '../server/autofillActions';

const TRIP = '11111111-1111-4111-8111-111111111111';

describe('préparation en arrière-plan', () => {
  beforeEach(() => {
    h.later = [];
    h.meta = {};
    h.updatedAt = '2026-10-09T00:00:00+00:00';
    h.steps = 0;
  });

  it('le repère relu change quand le voyage change (étapes écrites, voyage mis à jour), pas sinon', async () => {
    const started = await compasAutofillStartAction({ tripId: TRIP, tripSlug: 'x', from: null, phase: 'all' });
    const token = started.success ? started.token : '';
    const first = (await compasAutofillOutcomeAction({ tripId: TRIP, token })).stamp;
    expect(first).not.toBeNull();
    expect((await compasAutofillOutcomeAction({ tripId: TRIP, token })).stamp).toBe(first);
    h.steps = 3;
    const withSteps = (await compasAutofillOutcomeAction({ tripId: TRIP, token })).stamp;
    expect(withSteps).not.toBe(first);
    h.updatedAt = '2026-10-09T00:00:05+00:00';
    expect((await compasAutofillOutcomeAction({ tripId: TRIP, token })).stamp).not.toBe(withSteps);
  });

  it('rend un jeton tout de suite ; l’issue est écrite sur le voyage puis relue par ce jeton seul', async () => {
    const started = await compasAutofillStartAction({ tripId: TRIP, tripSlug: 'x', from: null, phase: 'all' });
    expect(started.success).toBe(true);
    const token = started.success ? started.token : '';
    // Rien n'a encore tourné : l'issue n'existe pas.
    expect((await compasAutofillOutcomeAction({ tripId: TRIP, token })).outcome).toBeNull();
    // Le travail après la réponse (ici : sans durée, refus immédiat) écrit son issue.
    await Promise.all(h.later.map((fn) => fn()));
    const { outcome } = await compasAutofillOutcomeAction({ tripId: TRIP, token });
    expect(outcome).toMatchObject({ success: false, error: expect.stringMatching(/combien de jours/), token });
    // Un autre jeton (préparation plus ancienne) ne lit pas cette issue.
    expect((await compasAutofillOutcomeAction({ tripId: TRIP, token: '99999999-9999-4999-8999-999999999999' })).outcome).toBeNull();
  });

  it('deux lancements ensemble (écran remonté) : le second lit la réussite du premier', async () => {
    const a = await compasAutofillStartAction({ tripId: TRIP, tripSlug: 'x', from: null, phase: 'all' });
    const b = await compasAutofillStartAction({ tripId: TRIP, tripSlug: 'x', from: null, phase: 'all' });
    if (!a.success || !b.success) throw new Error('lancement refusé');
    // Le premier a réussi (issue écrite à son jeton) ; le second a trouvé la place prise.
    h.meta = {
      compas: {
        autofill_result: { success: true, summary: { total: 1 }, token: a.token, at: a.at + 1000 },
      },
    };
    expect((await compasAutofillOutcomeAction({ tripId: TRIP, token: b.token, since: b.at })).outcome).toMatchObject({ token: a.token });
    // Sans heure de lancement, ou avant elle : rien.
    expect((await compasAutofillOutcomeAction({ tripId: TRIP, token: b.token })).outcome).toBeNull();
    expect((await compasAutofillOutcomeAction({ tripId: TRIP, token: b.token, since: a.at + 60_000 })).outcome).toBeNull();
  });

  it('lancé en double juste après une réussite : l’issue réussie vaut pour les deux, jamais « déjà prérempli »', async () => {
    const A = '22222222-2222-4222-8222-222222222222';
    const success = { success: true, summary: { total: 320 }, token: A, at: 1_000 };
    h.meta = { compas: { planned_days: 3, autofill: { runId: 'run-a' }, autofill_result: success } };
    const b = await compasAutofillStartAction({ tripId: TRIP, tripSlug: 'x', from: null, phase: 'all' });
    if (!b.success) throw new Error('lancement refusé');
    await Promise.all(h.later.map((fn) => fn()));
    // Le second écran lit la réussite sous son jeton ; le premier la lit encore (même heure).
    expect((await compasAutofillOutcomeAction({ tripId: TRIP, token: b.token })).outcome).toMatchObject({ success: true, summary: { total: 320 }, at: 1_000 });
    expect((await compasAutofillOutcomeAction({ tripId: TRIP, token: A, since: 500 })).outcome).toMatchObject({ success: true, summary: { total: 320 } });
  });

  it('relance d’une préparation arrêtée : l’erreur reste dite', async () => {
    h.meta = { compas: { planned_days: 3, autofill: { runId: 'run-a', stopped: true } } };
    const b = await compasAutofillStartAction({ tripId: TRIP, tripSlug: 'x', from: null, phase: 'all' });
    if (!b.success) throw new Error('lancement refusé');
    await Promise.all(h.later.map((fn) => fn()));
    expect((await compasAutofillOutcomeAction({ tripId: TRIP, token: b.token })).outcome).toMatchObject({
      success: false,
      error: expect.stringMatching(/arrêtée en cours de route/),
    });
  });
});
