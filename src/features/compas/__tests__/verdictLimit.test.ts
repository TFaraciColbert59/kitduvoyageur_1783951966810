import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Plan 100, 2.2 : `compasExplainVerdictAction` appelle l'IA, donc elle est comptée
 * par personne comme les autres actions qui appellent la carte ou l'IA (la
 * compréhension d'une phrase, la destination). Elle n'était bornée que par le
 * quota IA du jour : une rafale de clics lisait la base (`getCompasData`) et
 * tapait le fournisseur à chaque fois que les faits changeaient.
 *
 * Limite atteinte (429) ou compteur indisponible (503) : message dit, ni lecture
 * du voyage ni appel IA.
 */
const h = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  calls: [] as Array<{
    identifier: string;
    scope: string;
    limit: number;
    windowMs: number;
    failMode?: string;
  }>,
  refuse: null as null | { scope: string; status: number },
}));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
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
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));
vi.mock('../server/getCompasData', () => ({
  getCompasData: vi.fn(async () => ({
    model: { tripId: '11111111-1111-4111-8111-111111111111', verdict: { level: 'vigilance', reasons: [] } },
    danger: {
      signals: [],
      axes: {
        physique: { level: 'ok', note: '' },
        technique: { level: 'ok', note: '' },
        conjoncturel: { level: 'non_evalue', note: 'Aucune source.' },
      },
    },
  })),
}));
vi.mock('@/lib/ai/askAI', () => ({
  askAI: vi.fn(async () => ({
    text: 'Vigilance sur ce voyage.',
    model: 'x',
    degraded: false,
    cached: false,
    provider: 'nvidia',
  })),
}));

import { askAI } from '@/lib/ai/askAI';
import { compasExplainVerdictAction } from '../server/compasActions';
import { getCompasData } from '../server/getCompasData';

const TRIP = '11111111-1111-4111-8111-111111111111';

describe('verdict expliqué par l’IA : limite par personne (plan 2.2)', () => {
  beforeEach(() => {
    h.user = { id: 'u1' };
    h.calls = [];
    h.refuse = null;
    vi.clearAllMocks();
  });

  it('limite atteinte → message clair, ni lecture du voyage ni appel IA', async () => {
    h.refuse = { scope: 'compas-verdict', status: 429 };
    const res = await compasExplainVerdictAction({ tripId: TRIP });
    expect(res).toEqual({
      success: false,
      error: 'Trop d’explications d’affilée : patiente quelques minutes.',
    });
    expect(getCompasData).not.toHaveBeenCalled();
    expect(askAI).not.toHaveBeenCalled();
  });

  it('compteur indisponible → refus dit (fermé), ni lecture du voyage ni appel IA', async () => {
    h.refuse = { scope: 'compas-verdict', status: 503 };
    const res = await compasExplainVerdictAction({ tripId: TRIP });
    expect(res).toEqual({
      success: false,
      error: 'Explication indisponible pour le moment : réessaie dans un instant.',
    });
    expect(getCompasData).not.toHaveBeenCalled();
    expect(askAI).not.toHaveBeenCalled();
  });

  it('compte 10 par 10 min et par personne, fermé', async () => {
    const res = await compasExplainVerdictAction({ tripId: TRIP });
    expect(res).toMatchObject({ success: true });
    expect(h.calls).toEqual([
      { identifier: 'u1', scope: 'compas-verdict', limit: 10, windowMs: 600_000, failMode: 'closed' },
    ]);
    expect(askAI).toHaveBeenCalledTimes(1);
  });

  it('sans session : rien n’est compté ni appelé', async () => {
    h.user = null;
    const res = await compasExplainVerdictAction({ tripId: TRIP });
    expect(res).toEqual({ success: false, error: 'Connecte-toi pour obtenir une explication.' });
    expect(h.calls).toEqual([]);
    expect(askAI).not.toHaveBeenCalled();
  });

  it('entrée invalide : rien n’est compté', async () => {
    const res = await compasExplainVerdictAction({ tripId: 'pas-un-uuid' });
    expect(res).toEqual({ success: false, error: 'Voyage invalide' });
    expect(h.calls).toEqual([]);
  });
});
