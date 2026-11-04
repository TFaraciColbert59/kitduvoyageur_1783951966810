// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePostInteractions } from '../usePostInteractions';

const mocks = vi.hoisted(() => {
  const rpc = vi.fn();
  const upsert = vi.fn();
  const del = vi.fn();
  return { rpc, upsert, del };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: mocks.rpc,
    from: () => ({
      upsert: mocks.upsert,
      delete: () => ({ eq: () => ({ eq: mocks.del }) }),
    }),
  }),
}));

vi.mock('@/lib/native/ui', () => ({ shareNativeURL: vi.fn(async () => false) }));
vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ triggerHaptic: vi.fn() }),
}));

const POST = {
  id: 'post-1',
  likes_count: 3,
  user_liked: false,
  user_saved: false,
} as never;

describe('usePostInteractions — verrous synchrones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('un double clic sur le like ne lance qu’un seul RPC', async () => {
    let resolveRpc: (value: { error: null }) => void = () => {};
    mocks.rpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve;
      }),
    );

    const { result } = renderHook(() =>
      usePostInteractions(POST, { id: 'user-1' }),
    );

    let first: Promise<string> | undefined;
    let second: Promise<string> | undefined;
    await act(async () => {
      first = result.current.toggleLike();
      second = result.current.toggleLike();
    });

    // Le second clic est refusé avant le prochain rendu : le serveur ne voit
    // qu'un seul toggle, donc le like ne s'inverse pas deux fois.
    await expect(second).resolves.toBe('error');
    expect(mocks.rpc).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRpc({ error: null });
      await first;
    });
    expect(result.current.liked).toBe(true);
    expect(result.current.likesCount).toBe(4);
  });

  it('un double clic sur le favori ne lance qu’une seule écriture', async () => {
    let resolveUpsert: (value: { error: null }) => void = () => {};
    mocks.upsert.mockReturnValue(
      new Promise((resolve) => {
        resolveUpsert = resolve;
      }),
    );

    const { result } = renderHook(() =>
      usePostInteractions(POST, { id: 'user-1' }),
    );

    let first: Promise<string> | undefined;
    let second: Promise<string> | undefined;
    await act(async () => {
      first = result.current.toggleSave();
      second = result.current.toggleSave();
    });

    await expect(second).resolves.toBe('error');
    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveUpsert({ error: null });
      await first;
    });
    expect(result.current.saved).toBe(true);
  });

  it('un échec du RPC rend l’état et le compteur d’avant', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'network down' } });

    const { result } = renderHook(() =>
      usePostInteractions(POST, { id: 'user-1' }),
    );

    await act(async () => {
      await expect(result.current.toggleLike()).resolves.toBe('error');
    });

    expect(result.current.liked).toBe(false);
    expect(result.current.likesCount).toBe(3);
  });
});
