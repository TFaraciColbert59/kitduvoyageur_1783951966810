import { describe, expect, it, vi } from 'vitest';

/**
 * Relecture 3 de la PR #108 : la lecture d'un « de X à Y » a besoin de l'activité du voyage
 * (`compasInterpretAction` → `tripActivityHint`). `requireEditor` lit la ligne du voyage par une liste de
 * colonnes : une base simulée qui ne rend que les colonnes demandées montre qu'elle y est.
 */
const ROW: Record<string, unknown> = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'u1',
  title: 'Vélo · nouvelle aventure',
  start_date: null,
  end_date: null,
  destination_name: null,
  destination_country_code: null,
  party_size: 1,
  budget_currency: 'EUR',
  metadata: {},
  primary_activity: 'cycling',
  estimated_budget: 1200,
};

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    rpc: async () => ({ data: true }),
    from: () => ({
      // Seules les colonnes demandées reviennent, comme avec PostgREST.
      select: (cols: string) => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: Object.fromEntries(cols.split(',').map((c) => c.trim()).map((c) => [c, ROW[c]])),
          }),
        }),
      }),
    }),
  }),
}));

import { requireEditor } from '../server/compasServer';

describe('requireEditor : la ligne du voyage', () => {
  it('lit l’activité du voyage (repère de lecture d’un « de X à Y »)', async () => {
    const auth = await requireEditor(String(ROW.id));
    if ('error' in auth) throw new Error(String(auth.error));
    expect(auth.trip.primary_activity).toBe('cycling');
    // Rien de plus que ce qui sert : pas le budget estimé.
    expect((auth.trip as unknown as Record<string, unknown>).estimated_budget).toBeUndefined();
  });
});
