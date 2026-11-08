// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCursorFeed, type FeedPageOutcome } from '../useCursorFeed';
import type { FeedCursor } from '../communityFeedRpc';

interface Item {
  id: string;
}

function page(items: string[], nextCursor: FeedCursor | null): FeedPageOutcome<Item> {
  return { ok: true, items: items.map((id) => ({ id })), nextCursor };
}

describe('useCursorFeed', () => {
  it('charge la page 1, puis la page suivante avec le curseur reçu', async () => {
    const loadPage = vi
      .fn<(cursor: FeedCursor | null) => Promise<FeedPageOutcome<Item>>>()
      .mockResolvedValueOnce(page(['a', 'b'], { v: 10, id: 'b' }))
      .mockResolvedValueOnce(page(['c'], null));

    const { result } = renderHook(() => useCursorFeed<Item>({ resetKey: 'r1', enabled: true, loadPage }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(result.current.hasMore).toBe(true);
    expect(loadPage).toHaveBeenCalledWith(null);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.loadingMore).toBe(false));
    expect(result.current.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(result.current.hasMore).toBe(false);
    expect(loadPage).toHaveBeenLastCalledWith({ v: 10, id: 'b' });
  });

  it('distingue une erreur d’un flux vide et laisse Réessayer relancer la page 1', async () => {
    const loadPage = vi
      .fn<(cursor: FeedCursor | null) => Promise<FeedPageOutcome<Item>>>()
      .mockResolvedValueOnce({ ok: false, items: [], nextCursor: null, message: 'Les carnets sont indisponibles.' })
      .mockResolvedValueOnce(page(['a'], null));

    const { result } = renderHook(() => useCursorFeed<Item>({ resetKey: 'r1', enabled: true, loadPage }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Les carnets sont indisponibles.');
    expect(result.current.items).toEqual([]);
    expect(result.current.hasMore).toBe(false);

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['a']));
    expect(result.current.error).toBeNull();
  });

  it('ignore la réponse d’un ancien filtre (requêtes périmées)', async () => {
    let resolveFirst: ((outcome: FeedPageOutcome<Item>) => void) | null = null;
    const first = new Promise<FeedPageOutcome<Item>>((resolve) => {
      resolveFirst = resolve;
    });
    const loadPage = vi
      .fn<(cursor: FeedCursor | null) => Promise<FeedPageOutcome<Item>>>()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce(page(['nouveau'], null));

    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey: string }) => useCursorFeed<Item>({ resetKey, enabled: true, loadPage }),
      { initialProps: { resetKey: 'r1' } },
    );

    rerender({ resetKey: 'r2' });
    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['nouveau']));

    await act(async () => {
      resolveFirst?.(page(['ancien'], null));
      await first;
    });
    expect(result.current.items.map((item) => item.id)).toEqual(['nouveau']);
  });

  it('ne charge rien tant que le volet est inactif', async () => {
    const loadPage = vi.fn<(cursor: FeedCursor | null) => Promise<FeedPageOutcome<Item>>>();
    renderHook(() => useCursorFeed<Item>({ resetKey: 'r1', enabled: false, loadPage }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(loadPage).not.toHaveBeenCalled();
  });
});
