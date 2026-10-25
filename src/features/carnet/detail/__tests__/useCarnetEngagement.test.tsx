// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertCalls: Array<{ table: string; payload: unknown }> = [];
const deleteCalls: Array<{ table: string }> = [];
let failWrites = false;

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: (payload: unknown) => {
        insertCalls.push({ table, payload });
        return Promise.resolve({ error: failWrites ? { message: 'boom' } : null });
      },
      upsert: (payload: unknown) => {
        insertCalls.push({ table, payload });
        return Promise.resolve({ error: failWrites ? { message: 'boom' } : null });
      },
      delete: () => {
        deleteCalls.push({ table });
        return {
          eq: () => ({
            eq: () => Promise.resolve({ error: failWrites ? { message: 'boom' } : null }),
          }),
        };
      },
    }),
  }),
}));

import { useCarnetEngagement } from '../useCarnetEngagement';

beforeEach(() => {
  insertCalls.length = 0;
  deleteCalls.length = 0;
  failWrites = false;
});

const INITIAL = { likes: 6, comments: 3, views: 40, liked: false, favorited: false };

describe('useCarnetEngagement', () => {
  it('like de façon optimiste et écrit carnet_likes', async () => {
    const { result } = renderHook(() =>
      useCarnetEngagement({ carnetId: 'c1', initial: INITIAL, userId: 'u1', onRequireAuth: () => {} }),
    );
    expect(result.current.likes).toBe(6);

    await act(async () => {
      await result.current.toggleLike();
    });

    expect(result.current.liked).toBe(true);
    expect(result.current.likes).toBe(7);
    expect(insertCalls).toEqual([
      { table: 'carnet_likes', payload: { carnet_id: 'c1', user_id: 'u1', reaction: 'like' } },
    ]);
  });

  it('retire le like existant', async () => {
    const { result } = renderHook(() =>
      useCarnetEngagement({
        carnetId: 'c1',
        initial: { ...INITIAL, liked: true, likes: 7 },
        userId: 'u1',
        onRequireAuth: () => {},
      }),
    );

    await act(async () => {
      await result.current.toggleLike();
    });

    expect(result.current.liked).toBe(false);
    expect(result.current.likes).toBe(6);
    expect(deleteCalls).toEqual([{ table: 'carnet_likes' }]);
  });

  it('demande l’authentification sans écrire en base pour un visiteur', async () => {
    const onRequireAuth = vi.fn();
    const { result } = renderHook(() =>
      useCarnetEngagement({ carnetId: 'c1', initial: INITIAL, userId: null, onRequireAuth }),
    );

    await act(async () => {
      await result.current.toggleLike();
    });

    expect(onRequireAuth).toHaveBeenCalledOnce();
    expect(result.current.liked).toBe(false);
    expect(insertCalls).toHaveLength(0);
  });

  it('revient à l’état précédent si l’écriture échoue', async () => {
    failWrites = true;
    const { result } = renderHook(() =>
      useCarnetEngagement({ carnetId: 'c1', initial: INITIAL, userId: 'u1', onRequireAuth: () => {} }),
    );

    await act(async () => {
      await result.current.toggleLike();
    });

    expect(result.current.liked).toBe(false);
    expect(result.current.likes).toBe(6);
  });

  it('enregistre une vue une seule fois', async () => {
    const { result } = renderHook(() =>
      useCarnetEngagement({ carnetId: 'c1', initial: INITIAL, userId: null, onRequireAuth: () => {} }),
    );

    await act(async () => {
      await result.current.registerView();
      await result.current.registerView();
    });

    expect(insertCalls.filter((call) => call.table === 'carnet_views')).toHaveLength(1);
  });

  it('bascule le favori', async () => {
    const { result } = renderHook(() =>
      useCarnetEngagement({ carnetId: 'c1', initial: INITIAL, userId: 'u1', onRequireAuth: () => {} }),
    );

    await act(async () => {
      await result.current.toggleFavorite();
    });

    expect(result.current.favorited).toBe(true);
    expect(insertCalls).toEqual([
      { table: 'carnet_favorites', payload: { carnet_id: 'c1', user_id: 'u1' } },
    ]);
  });
});
