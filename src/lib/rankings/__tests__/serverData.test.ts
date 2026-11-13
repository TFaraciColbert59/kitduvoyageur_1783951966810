import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { loadRankingProfiles } from '../serverData';

function fakeClient(rows: unknown[]): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        in: async () => ({ data: rows, error: null }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const ROWS = [
  {
    id: 'u1',
    full_name: 'Public',
    handle: 'public',
    avatar_url: null,
    profile_visibility: 'public',
    is_demo: false,
  },
  {
    id: 'u2',
    full_name: 'Communauté',
    handle: 'commu',
    avatar_url: null,
    profile_visibility: 'communaute',
    is_demo: false,
  },
  {
    id: 'u3',
    full_name: 'Privé',
    handle: 'prive',
    avatar_url: null,
    profile_visibility: 'private',
    is_demo: false,
  },
];

describe('lecture des profils de classement', () => {
  it('exclut les profils non publics pour un visiteur', async () => {
    const profiles = await loadRankingProfiles(fakeClient(ROWS), ['u1', 'u2', 'u3'], {
      authenticated: false,
    });
    const byId = new Map(profiles.map((profile) => [profile.userId, profile]));

    expect(byId.get('u1')?.rankingsOptOut).toBe(false);
    expect(byId.get('u2')?.rankingsOptOut).toBe(true);
    expect(byId.get('u3')?.rankingsOptOut).toBe(true);
  });

  it('laisse les profils communauté visibles à une session, jamais les privés', async () => {
    const profiles = await loadRankingProfiles(fakeClient(ROWS), ['u1', 'u2', 'u3'], {
      authenticated: true,
    });
    const byId = new Map(profiles.map((profile) => [profile.userId, profile]));

    expect(byId.get('u1')?.rankingsOptOut).toBe(false);
    expect(byId.get('u2')?.rankingsOptOut).toBe(false);
    expect(byId.get('u3')?.rankingsOptOut).toBe(true);
  });
});
