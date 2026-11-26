import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Constat C-027 (jeu monde local du 26 nov., n°4) : la création du voyage a été annulée par la base
 * (57014, délai de 8 s du rôle `authenticated` dépassé dans les déclencheurs pendant un ralentissement
 * de toute la base) et la personne a lu « L'aventure n'a pas pu être créée ». Une requête annulée est
 * défaite en entier : la création est rejouée une fois pour un refus passager, jamais pour une autre erreur.
 */
const h = vi.hoisted(() => ({
  inserts: 0,
  /** Codes d'erreur rendus par les insertions successives (null : réussite). */
  codes: [] as Array<string | null>,
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', async (orig) => ({ ...(await orig<typeof import('next/cache')>()), revalidatePath: vi.fn() }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('@/features/hub/context/activeAdventureServer', () => ({
  setActiveAdventureAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: (table: string) => {
      if (table === 'trips') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => {
                const code = h.codes[h.inserts] ?? null;
                h.inserts += 1;
                return code
                  ? { data: null, error: { code, message: 'canceling statement due to statement timeout' } }
                  : { data: { id: 't1', slug: 'randonnee-abc', title: 'Randonnée · nouvelle aventure' }, error: null };
              },
            }),
          }),
          delete: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      // trip_collaborators : la personne est bien propriétaire (déclencheur `handle_trip_owner_collaborator`).
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'owner' } }) }) }) }),
      };
    },
  }),
}));

import { compasCreateTripAction } from '../server/compasActions';

describe('C-027 · création du voyage rejouée une fois après un refus passager de la base', () => {
  beforeEach(() => {
    h.inserts = 0;
    h.codes = [];
  });

  it('délai dépassé (57014) puis réussite : le voyage est créé, deux essais', async () => {
    h.codes = ['57014', null];
    const res = await compasCreateTripAction({ activity: 'hiking', say: '2 semaines en Nouvelle-Zélande en janvier' });
    expect(res.success).toBe(true);
    expect(h.inserts).toBe(2);
  });

  it('verrou indisponible (55P03), conflit (40001) ou interblocage (40P01) : rejoué aussi', async () => {
    for (const code of ['55P03', '40001', '40P01']) {
      h.inserts = 0;
      h.codes = [code, null];
      const res = await compasCreateTripAction({ activity: 'hiking', say: 'Vercors 3 jours' });
      expect(res.success, code).toBe(true);
      expect(h.inserts, code).toBe(2);
    }
  });

  it('un seul nouvel essai : deux refus de suite → échec annoncé', async () => {
    h.codes = ['57014', '57014', null];
    const res = await compasCreateTripAction({ activity: 'hiking', say: 'Vercors 3 jours' });
    expect(res.success).toBe(false);
    expect(h.inserts).toBe(2);
  });

  it('une autre erreur (droits, contrainte) n’est pas rejouée', async () => {
    h.codes = ['42501', null];
    const res = await compasCreateTripAction({ activity: 'hiking', say: 'Vercors 3 jours' });
    expect(res.success).toBe(false);
    expect(h.inserts).toBe(1);
  });
});
