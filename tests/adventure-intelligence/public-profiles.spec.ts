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
  PUBLIC_PROFILES_SELECT,
  type PublicProfile,
} from '@/lib/queries/publicProfiles';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';

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
    expect(query.select).toHaveBeenCalledWith(PUBLIC_PROFILES_SELECT);
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

  it('TEST-A10-F1-04: helper core navigateur — dédup/cap, erreur et exception sans lever', async () => {
    const query = makeQueryClient({ data: [profile(P1)], error: null });
    const ids: Array<string | null | undefined> = [
      P1,
      P1,
      P2,
      null,
      undefined,
      '',
      ...Array.from({ length: 260 }, (_, i) => `x-${i}`),
    ];

    const map = await fetchPublicProfilesWith(query.client as never, ids);

    expect(query.from).toHaveBeenCalledWith('public_profiles');
    expect(query.select).toHaveBeenCalledWith(PUBLIC_PROFILES_SELECT);
    const [column, bounded] = query.in.mock.calls[0];
    expect(column).toBe('id');
    expect(bounded).toHaveLength(PUBLIC_PROFILES_MAX_IDS);
    expect(new Set(bounded).size).toBe(PUBLIC_PROFILES_MAX_IDS);
    expect(bounded[0]).toBe(P1);
    expect(bounded[1]).toBe(P2);
    expect(map[P1]).toEqual(profile(P1));

    const errorQuery = makeQueryClient({ data: null, error: { message: 'boom' } });
    await expect(fetchPublicProfilesWith(errorQuery.client as never, [P1])).resolves.toEqual({});

    const thrownQuery = makeQueryClient({ data: null, error: null });
    thrownQuery.in.mockImplementationOnce(() => Promise.reject(new Error('réseau')));
    await expect(fetchPublicProfilesWith(thrownQuery.client as never, [P1])).resolves.toEqual({});

    const emptyQuery = makeQueryClient({ data: [], error: null });
    await expect(fetchPublicProfilesWith(emptyQuery.client as never, [])).resolves.toEqual({});
    expect(emptyQuery.from).not.toHaveBeenCalled();
  });

  it("TEST-A10-F1-05: plus aucun embed public `user_profiles!` ni `:user_profiles(` dans les fichiers migrés", () => {
    const migratedFiles = [
      'src/app/carnets/page.tsx',
      'src/app/avis/page.tsx',
      'src/features/hub/server/getHubAdventureData.ts',
      'src/lib/home-queries.ts',
      'src/lib/queries-trips.ts',
      'src/lib/queries-crews.ts',
      'src/lib/queries/groupe.ts',
      'src/app/communaute/page.tsx',
      'src/components/compte/CarnetsTab.tsx',
      'src/components/pays/PaysCarnetsList.tsx',
      'src/components/pays/BouteilleALaMer.tsx',
      'src/components/communaute/CommentItem.tsx',
      'src/components/social/PostCard.tsx',
      'src/app/clubs/page.tsx',
      'src/app/clubs/[id]/page.tsx',
      'src/app/evenements/page.tsx',
      'src/app/guides/[slug]/GuideDetailClient.tsx',
      'src/components/groupes/VoyageursCard.tsx',
      'src/components/groupes/TachesCard.tsx',
      'src/app/api/materiel/fork/route.ts',
      'src/app/api/produit/trust-score-check/route.ts',
      'src/features/messaging/services/messagingService.ts',
      'src/features/messaging/components/NewConversationModal.tsx',
    ];
    const embedPattern = /user_profiles!|:user_profiles\(|user_profiles\s*\(/;
    const offenders: string[] = [];

    for (const relative of migratedFiles) {
      const full = path.resolve(process.cwd(), relative);
      expect(fs.existsSync(full), `${relative} introuvable`).toBe(true);
      const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
      lines.forEach((line, index) => {
        if (embedPattern.test(line)) offenders.push(`${relative}:${index + 1}: ${line.trim()}`);
      });
    }

    expect(offenders).toEqual([]);
  });

  it("TEST-A10-F1-06: public_read_user_profiles n'est plus recréée par aucune migration", () => {
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
