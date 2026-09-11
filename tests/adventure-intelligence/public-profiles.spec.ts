import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import {
  fetchPublicProfiles,
  limitPublicProfileIds,
  PUBLIC_PROFILES_MAX_IDS,
  type PublicProfile,
} from '@/lib/queries/publicProfiles';

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';

function profile(id: string, overrides: Partial<PublicProfile> = {}): PublicProfile {
  return { id, full_name: `Nom ${id}`, avatar_url: null, trust_score: 50, ...overrides };
}

function makeQueryClient(result: { data: unknown; error: unknown }) {
  const inFn = vi.fn((column: string, ids: string[]) => Promise.resolve(result));
  const select = vi.fn(() => ({ in: inFn }));
  const from = vi.fn(() => ({ select }));
  return { client: { from }, from, select, in: inFn };
}

describe('F1 — profils publics (TEST-A10-F1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TEST-A10-F1-01: déduplique et borne les ids à 200 avant la lecture de la vue", async () => {
    const query = makeQueryClient({ data: [], error: null });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(query.client);

    const ids = Array.from({ length: 250 }, (_, i) => `profil-${i}`);
    await fetchPublicProfiles([...ids, 'profil-0', 'profil-1', '']);

    expect(query.from).toHaveBeenCalledWith('public_profiles');
    expect(query.select).toHaveBeenCalledWith('id, full_name, avatar_url, trust_score');
    const [column, bounded] = query.in.mock.calls[0];
    expect(column).toBe('id');
    expect(bounded).toHaveLength(PUBLIC_PROFILES_MAX_IDS);
    expect(new Set(bounded).size).toBe(PUBLIC_PROFILES_MAX_IDS);
    expect(bounded[0]).toBe('profil-0');
    expect(bounded[PUBLIC_PROFILES_MAX_IDS - 1]).toBe(`profil-${PUBLIC_PROFILES_MAX_IDS - 1}`);

    expect(limitPublicProfileIds(['a', 'a', 'b', null, undefined, ''])).toEqual(['a', 'b']);
  });

  it('TEST-A10-F1-02: renvoie une map indexée par id de profil', async () => {
    const query = makeQueryClient({
      data: [profile(P1), profile(P2, { full_name: 'Zoé', trust_score: 88 })],
      error: null,
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(query.client);

    const map = await fetchPublicProfiles([P1, P2]);

    expect(Object.keys(map).sort()).toEqual([P1, P2].sort());
    expect(map[P2]).toEqual({ id: P2, full_name: 'Zoé', avatar_url: null, trust_score: 88 });
    expect(map[P1].full_name).toBe(`Nom ${P1}`);
  });

  it('TEST-A10-F1-03: renvoie {} sans lever sur erreur, exception ou liste vide', async () => {
    const errorQuery = makeQueryClient({ data: null, error: { message: 'boom' } });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(errorQuery.client);
    await expect(fetchPublicProfiles([P1])).resolves.toEqual({});

    const thrownQuery = makeQueryClient({ data: null, error: null });
    thrownQuery.in.mockImplementationOnce(() => Promise.reject(new Error('réseau')));
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(thrownQuery.client);
    await expect(fetchPublicProfiles([P1])).resolves.toEqual({});

    vi.clearAllMocks();
    await expect(fetchPublicProfiles([])).resolves.toEqual({});
    expect(createClient).not.toHaveBeenCalled();
  });

  it("TEST-A10-F1-04: public_read_user_profiles n'est plus recréée par aucune migration", () => {
    const dir = path.resolve(process.cwd(), 'supabase/migrations');
    const legacyCreationFile = '20260713210000_auth_trigger_and_rls_cleanup.sql';
    const offenders: string[] = [];

    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      if (file === legacyCreationFile) continue;
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      content.split(/\r?\n/).forEach((line, index) => {
        if (!line.includes('public_read_user_profiles')) return;
        if (/^\s*--/.test(line)) return;
        if (/^\s*DROP POLICY IF EXISTS/.test(line)) return;
        offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      });
    }

    expect(offenders).toEqual([]);

    const a10 = fs.readFileSync(
      path.join(dir, '20260911290000_a10_f1_public_profiles.sql'),
      'utf8'
    );
    expect(a10).toContain('DROP POLICY IF EXISTS "public_read_user_profiles" ON public.user_profiles;');
    expect(a10).not.toMatch(/CREATE POLICY\s+"public_read_user_profiles"/);
  });
});
