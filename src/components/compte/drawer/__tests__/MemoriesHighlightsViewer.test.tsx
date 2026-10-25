// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const db = vi.hoisted(() => ({
  links: [] as Array<{ story_id: string; position: number }>,
  linksError: null as { message: string } | null,
  stories: [] as Array<Record<string, unknown>>,
  inIds: [] as string[],
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'story_highlight_items') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: db.links, error: db.linksError }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          in: async (_column: string, ids: string[]) => {
            db.inIds = ids;
            return { data: db.stories, error: null };
          },
        }),
      };
    },
  }),
}));

vi.mock('@/components/communaute/StoriesViewer', async () => {
  const ReactModule = await import('react');
  return {
    default: ({
      users,
      onClose,
    }: {
      users: Array<{ slides: Array<{ storyId?: string; caption?: string }> }>;
      onClose: () => void;
    }) =>
      ReactModule.createElement(
        'div',
        { 'data-testid': 'stories-viewer' },
        users[0]?.slides.map((slide) =>
          ReactModule.createElement('span', { key: slide.storyId ?? slide.caption }, slide.caption)
        ),
        ReactModule.createElement('button', { type: 'button', onClick: onClose }, 'Fermer')
      ),
  };
});

import { MemoriesSlot } from '../slots/MemoriesSlot';

const HIGHLIGHT = {
  id: 'h1',
  title: 'Néouvielle',
  items: 1,
  coverStoryId: 'cover-story',
  position: 0,
};

beforeEach(() => {
  db.links = [];
  db.linksError = null;
  db.stories = [];
  db.inIds = [];
});

afterEach(cleanup);

describe('Souvenirs — chemin réel de la visionneuse À la une', () => {
  it('ouvre la visionneuse livrée avec les stories épinglées puis restaure le focus', async () => {
    db.links = [{ story_id: 'pinned', position: 0 }];
    db.stories = [
      {
        id: 'pinned',
        image_url: 'https://images.test/pinned.jpg',
        storage_path: null,
        media_type: 'image',
        caption: 'Story épinglée',
      },
    ];

    render(<MemoriesSlot lens="souvenirs" payload={{ highlights: [HIGHLIGHT] }} />);
    const card = screen.getByRole('button', { name: 'Ouvrir l’album Néouvielle' });
    card.focus();
    fireEvent.click(card);

    expect(await screen.findByTestId('stories-viewer')).toBeTruthy();
    expect(screen.getByText('Story épinglée')).toBeTruthy();
    expect(db.inIds).toEqual(['pinned']);

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    await waitFor(() => expect(screen.queryByTestId('stories-viewer')).toBeNull());
    expect(document.activeElement).toBe(card);
  });

  it('affiche une alerte role=alert quand l’album est vide', async () => {
    render(<MemoriesSlot lens="souvenirs" payload={{ highlights: [HIGHLIGHT] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir l’album Néouvielle' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Aucune story dans cet album.');
    expect(screen.queryByTestId('stories-viewer')).toBeNull();
  });

  it('ne transmet aucun id non épinglé à la requête média', async () => {
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
        id: 'intrus',
        image_url: 'https://images.test/intrus.jpg',
        storage_path: null,
        media_type: 'image',
        caption: 'Hors album',
      },
    ];

    render(<MemoriesSlot lens="souvenirs" payload={{ highlights: [HIGHLIGHT] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir l’album Néouvielle' }));

    expect(await screen.findByText('Épinglée')).toBeTruthy();
    expect(screen.queryByText('Hors album')).toBeNull();
    expect(db.inIds).toEqual(['pinned']);
  });
});
