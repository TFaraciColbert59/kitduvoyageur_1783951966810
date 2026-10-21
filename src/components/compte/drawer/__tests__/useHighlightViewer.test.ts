// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  links: [] as Array<{ story_id: string; position: number }>,
  linksError: null as { message: string } | null,
  stories: [] as Array<Record<string, unknown>>,
  storiesError: null as { message: string } | null,
  highlightId: '',
  inIds: [] as string[],
  calls: [] as string[],
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      db.calls.push(table);
      if (table === 'story_highlight_items') {
        return {
          select: () => ({
            eq: (_column: string, value: string) => {
              db.highlightId = value;
              return {
                order: async () => ({ data: db.links, error: db.linksError }),
              };
            },
          }),
        };
      }
      return {
        select: () => ({
          in: async (_column: string, ids: string[]) => {
            db.inIds = ids;
            return { data: db.stories, error: db.storiesError };
          },
        }),
      };
    },
  }),
}));

import type { HighlightCardData } from '../cards/HighlightCard';
import { useHighlightViewer } from '../memories/useHighlightViewer';

const HIGHLIGHT: HighlightCardData = {
  id: 'h1',
  title: 'Néouvielle',
  items: 2,
  coverStoryId: null,
  cover: '',
  position: 0,
};

beforeEach(() => {
  db.links = [];
  db.linksError = null;
  db.stories = [];
  db.storiesError = null;
  db.highlightId = '';
  db.inIds = [];
  db.calls = [];
});

describe('useHighlightViewer — stories À la une', () => {
  it('ne charge que les stories épinglées de l’album, jamais un id non épinglé', async () => {
    db.links = [{ story_id: 'pinned', position: 0 }];
    db.stories = [
      {
        id: 'pinned',
        image_url: 'https://images.test/pinned.jpg',
        storage_path: null,
        media_type: 'image',
        caption: 'Épinglée',
      },
      {
        id: 'unpinned',
        image_url: 'https://images.test/unpinned.jpg',
        storage_path: null,
        media_type: 'image',
        caption: 'Hors album',
      },
    ];

    const { result } = renderHook(() => useHighlightViewer());
    await act(async () => {
      await result.current.open(HIGHLIGHT);
    });

    expect(db.highlightId).toBe('h1');
    expect(db.calls).toEqual(['story_highlight_items', 'post_stories']);
    expect(db.inIds).toEqual(['pinned']);
    expect(result.current.slides).toEqual([
      {
        image: 'https://images.test/pinned.jpg',
        caption: 'Épinglée',
        storyId: 'pinned',
        mediaType: 'image',
      },
    ]);
    expect(result.current.error).toBeNull();
    expect(result.current.openingId).toBeNull();
  });

  it('signale un album vide sans interroger les stories', async () => {
    const { result } = renderHook(() => useHighlightViewer());
    await act(async () => {
      await result.current.open(HIGHLIGHT);
    });

    expect(result.current.error).toBe('Aucune story dans cet album.');
    expect(result.current.slides).toBeNull();
    expect(db.calls).toEqual(['story_highlight_items']);
  });

  it('signale un album dont aucune story n’est visible', async () => {
    db.links = [{ story_id: 'pinned', position: 0 }];
    db.stories = [];

    const { result } = renderHook(() => useHighlightViewer());
    await act(async () => {
      await result.current.open(HIGHLIGHT);
    });

    expect(result.current.error).toBe('Aucune story visible dans cet album.');
    expect(result.current.slides).toBeNull();
  });

  it('affiche une alerte et journalise la cause sans la divulguer', async () => {
    db.linksError = { message: 'boom interne' };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useHighlightViewer());
    await act(async () => {
      await result.current.open(HIGHLIGHT);
    });

    expect(result.current.error).toBe('La visionneuse À la une n’a pas pu s’ouvrir.');
    expect(result.current.slides).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('visionneuse À la une'),
      expect.anything()
    );
    warn.mockRestore();
  });

  it('laisse un override hôte court-circuiter Supabase', async () => {
    const onOpen = vi.fn();
    const { result } = renderHook(() => useHighlightViewer({ onOpenHighlight: onOpen }));
    await act(async () => {
      await result.current.open(HIGHLIGHT);
    });

    expect(onOpen).toHaveBeenCalledWith(HIGHLIGHT);
    expect(db.calls).toEqual([]);
    expect(result.current.slides).toBeNull();
  });

  it('ferme la visionneuse en vidant les slides', async () => {
    db.links = [{ story_id: 'pinned', position: 0 }];
    db.stories = [
      {
        id: 'pinned',
        image_url: 'https://images.test/pinned.jpg',
        storage_path: null,
        media_type: 'image',
        caption: null,
      },
    ];

    const { result } = renderHook(() => useHighlightViewer());
    await act(async () => {
      await result.current.open(HIGHLIGHT);
    });
    expect(result.current.slides).toHaveLength(1);

    act(() => {
      result.current.close();
    });
    expect(result.current.slides).toBeNull();
  });
});
