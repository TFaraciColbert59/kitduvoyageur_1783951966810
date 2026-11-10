import { beforeEach, describe, expect, it, vi } from 'vitest';

const CARNET = '749e9e8c-9540-5a73-8b6c-6ab07264f62f';
const USER = '11111111-1111-4111-8111-111111111111';
const BASE = 'https://proj.supabase.co';
const audioUrl = `${BASE}/storage/v1/object/public/carnet-moments-media/${USER}/carnet-moments/${CARNET}/a.webm`;
const imageUrl = `${BASE}/storage/v1/object/public/carnet-media/${USER}/carnet-moments/${CARNET}/p.jpg`;

const state = {
  removed: [] as Array<{ bucket: string; paths: string[] }>,
  listed: [] as string[],
  removeError: null as { message: string } | null,
  responses: {} as Record<string, { data: unknown; error?: unknown }>,
  revalidated: [] as string[],
};

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => state.revalidated.push(p) }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => {
          state.removed.push({ bucket, paths });
          return { error: state.removeError };
        },
        list: async (folder: string) => {
          state.listed.push(`${bucket}:${folder}`);
          return { data: bucket === 'carnet-media' ? [{ name: 'orphan.jpg' }] : [], error: null };
        },
      }),
    },
  }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: USER, is_anonymous: false } } }) },
    rpc: async () => ({ data: true, error: null }),
    from: (table: string) => {
      let op = 'select';
      const chain: Record<string, unknown> = {};
      for (const o of ['delete', 'update']) chain[o] = () => ((op = o), chain);
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) => {
        const r = state.responses[`${table}.${op}`] ?? { data: null };
        return Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(resolve);
      };
      return chain;
    },
  }),
}));

import { deleteCarnetAction, deleteMomentAction } from '../editActions';
import { MomentInputSchema, momentInsertRow } from '../createMoment';
import { parseMomentMeta } from '../momentTypes';

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = BASE;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  state.removed = [];
  state.listed = [];
  state.removeError = null;
  state.responses = {};
  state.revalidated = [];
});

describe('effacement des médias', () => {
  it('supprime les fichiers du moment après la ligne', async () => {
    state.responses['carnet_moments.delete'] = {
      data: [{ id: 'm1', image_url: imageUrl, moment_meta: { audioUrl }, auteur_id: USER }],
    };
    const result = await deleteMomentAction({ carnetId: CARNET, id: '0b1c9c0e-3c1d-4f6a-9a2e-0d4c1b7e8f01' });
    expect(result).toEqual({ ok: true });
    expect(state.removed).toContainEqual({
      bucket: 'carnet-media',
      paths: [`${USER}/carnet-moments/${CARNET}/p.jpg`],
    });
    expect(state.removed).toContainEqual({
      bucket: 'carnet-moments-media',
      paths: [`${USER}/carnet-moments/${CARNET}/a.webm`],
    });
  });

  it('ignore une URL visant un autre carnet', async () => {
    const foreign = `${BASE}/storage/v1/object/public/carnet-media/${USER}/carnet-moments/autre/p.jpg`;
    state.responses['carnet_moments.delete'] = { data: [{ id: 'm1', image_url: foreign, moment_meta: null }] };
    await deleteMomentAction({ carnetId: CARNET, id: '0b1c9c0e-3c1d-4f6a-9a2e-0d4c1b7e8f01' });
    expect(state.removed).toHaveLength(0);
  });

  it('un échec de suppression de fichier n’échoue pas l’action', async () => {
    state.removeError = { message: 'boom' };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    state.responses['carnet_moments.delete'] = { data: [{ id: 'm1', image_url: imageUrl, moment_meta: null }] };
    const result = await deleteMomentAction({ carnetId: CARNET, id: '0b1c9c0e-3c1d-4f6a-9a2e-0d4c1b7e8f01' });
    expect(result).toEqual({ ok: true });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('carnet entier : liste le préfixe dans les deux seaux, supprime, revalide', async () => {
    state.responses['carnet_moments.select'] = {
      data: [{ image_url: imageUrl, moment_meta: null, auteur_id: USER }],
    };
    state.responses['carnets.delete'] = { data: [{ id: CARNET }] };
    expect(await deleteCarnetAction({ carnetId: CARNET })).toEqual({ ok: true });
    expect(state.listed).toEqual([
      `carnet-media:${USER}/carnet-moments/${CARNET}`,
      `carnet-moments-media:${USER}/carnet-moments/${CARNET}`,
    ]);
    const media = state.removed.find((r) => r.bucket === 'carnet-media');
    expect(media?.paths).toContain(`${USER}/carnet-moments/${CARNET}/orphan.jpg`);
    expect(state.revalidated).toEqual(['/carnets', `/carnets/${CARNET}`]);
  });

  it('carnet refusé par la RLS : aucun fichier touché', async () => {
    state.responses['carnets.delete'] = { data: [] };
    expect((await deleteCarnetAction({ carnetId: CARNET })).ok).toBe(false);
    expect(state.removed).toHaveLength(0);
  });
});

describe('URL média restreintes au projet', () => {
  const base = { type: 'voice', place: 'Col', day: 1, caption: 'Note' } as const;
  it('refuse un hôte tiers et un autre seau, accepte le seau voix', () => {
    expect(MomentInputSchema.safeParse({ ...base, audioUrl: 'https://evil.example/a.webm' }).success).toBe(false);
    expect(MomentInputSchema.safeParse({ ...base, audioUrl: imageUrl }).success).toBe(false);
    expect(MomentInputSchema.safeParse({ ...base, audioUrl }).success).toBe(true);
  });
  it('image_url hors seaux du projet écartée, lecture de moment_meta filtrée', () => {
    const ctx = { carnetId: CARNET, userId: USER, authorName: null, now: new Date() };
    const value = { type: 'photo', place: 'Col', day: 1, caption: undefined } as const;
    expect(momentInsertRow(value, { ...ctx, imageUrl: 'https://evil.example/x.jpg' }).image_url).toBeNull();
    expect(momentInsertRow(value, { ...ctx, imageUrl }).image_url).toBe(imageUrl);
    expect(parseMomentMeta({ audioUrl: 'https://evil.example/a.webm' })).toBeNull();
    expect(parseMomentMeta({ audioUrl })).toEqual({ audioUrl });
  });
});
