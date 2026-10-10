import { describe, it, expect } from 'vitest';
import { createSupabaseGdprExportClient, GDPR_USER_TABLES, isMissingRelation } from '@/server/gdprExport';
import { createSupabaseGdprDeleteDeps } from '@/server/gdprDelete';

/**
 * La base se migre à la main : le code peut être déployé avant la table `user_traveller`.
 * Une table optionnelle absente est vide ; ailleurs, une panne reste une panne. Surtout :
 * la suppression de compte ne doit pas échouer au recomptage APRÈS avoir supprimé
 * l'utilisateur.
 */
type Err = { code?: string; message: string };
function fake(errors: Record<string, Err>) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: async () =>
          errors[table]
            ? { data: null, count: null, error: errors[table] }
            : { data: [], count: 0, error: null },
      }),
    }),
  } as never;
}

const MISSING_PG: Err = { code: '42P01', message: 'relation "public.user_traveller" does not exist' };
const MISSING_REST: Err = {
  code: 'PGRST205',
  message: "Could not find the table 'public.user_traveller' in the schema cache",
};

describe('isMissingRelation', () => {
  it('Postgres 42P01, PostgREST PGRST205 et leurs messages ; pas une autre panne', () => {
    expect(isMissingRelation(MISSING_PG)).toBe(true);
    expect(isMissingRelation(MISSING_REST)).toBe(true);
    expect(isMissingRelation({ message: 'relation "x" does not exist' })).toBe(true);
    expect(isMissingRelation({ code: '42501', message: 'permission denied for table user_traveller' })).toBe(false);
    expect(isMissingRelation(null)).toBe(false);
  });
});

describe('export RGPD : table optionnelle absente', () => {
  it('user_traveller absente : vide, sans erreur (42P01 comme PGRST205)', async () => {
    for (const err of [MISSING_PG, MISSING_REST]) {
      const client = createSupabaseGdprExportClient(fake({ user_traveller: err }));
      await expect(client.selectByUser('user_traveller', 'user_id', 'u1')).resolves.toEqual([]);
    }
  });

  it('une autre table absente, ou un refus de droits sur user_traveller : l’erreur reste', async () => {
    const other = createSupabaseGdprExportClient(fake({ saved_trails: MISSING_PG }));
    await expect(other.selectByUser('saved_trails', 'user_id', 'u1')).rejects.toThrow(/saved_trails/);
    const denied = createSupabaseGdprExportClient(
      fake({ user_traveller: { code: '42501', message: 'permission denied for table user_traveller' } })
    );
    await expect(denied.selectByUser('user_traveller', 'user_id', 'u1')).rejects.toThrow(/permission denied/);
  });
});

describe('suppression de compte : recomptage avec une table optionnelle absente', () => {
  it('user_traveller absente : comptée à 0, toutes les autres tables recomptées', async () => {
    const deps = createSupabaseGdprDeleteDeps(fake({ user_traveller: MISSING_REST }));
    const counts = await deps.countUserRows('u1');
    expect(counts.user_traveller).toBe(0);
    expect(Object.keys(counts)).toEqual(GDPR_USER_TABLES.map((t) => t.table));
  });

  it('une autre table qui manque : le recomptage échoue (jamais un silence)', async () => {
    const deps = createSupabaseGdprDeleteDeps(fake({ saved_trails: MISSING_PG }));
    await expect(deps.countUserRows('u1')).rejects.toThrow(/saved_trails/);
  });
});
