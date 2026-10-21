// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoriesSlot } from '../slots/MemoriesSlot';

afterEach(cleanup);

const HIGHLIGHTS = [
  {
    id: 'h2',
    title: 'Vercors',
    items: 1,
    coverStoryId: 'story-2',
    position: 1,
  },
  {
    id: 'h1',
    title: 'Néouvielle',
    items: 4,
    coverStoryId: 'story-1',
    position: 0,
  },
];

const STORIES = [
  { id: 's9', caption: 'Story normale' },
  { id: 's10', caption: 'Une autre story hors album' },
];

describe('Souvenirs — stories À la une uniquement', () => {
  it('ne liste que les À la une, jamais les autres stories', () => {
    render(
      <MemoriesSlot
        lens="souvenirs"
        payload={{ highlights: HIGHLIGHTS, stories: STORIES }}
        stories={STORIES}
      />
    );

    expect(screen.getByText('Néouvielle')).toBeTruthy();
    expect(screen.getByText('Vercors')).toBeTruthy();
    expect(screen.queryByText('Story normale')).toBeNull();
    expect(screen.queryByText('Une autre story hors album')).toBeNull();
  });

  it('affiche la couverture résolue par /api/stories/:id/media et le nombre d’éléments', () => {
    render(
      <MemoriesSlot lens="souvenirs" payload={{ highlights: [HIGHLIGHTS[1]] }} />
    );

    const cover = screen.getByRole('img', { name: 'Couverture de Néouvielle' });
    expect(cover.getAttribute('src')).toBe('/api/stories/story-1/media');
    expect(screen.getByText('4 éléments')).toBeTruthy();
  });

  it('respecte l’ordre de position des albums', () => {
    render(<MemoriesSlot lens="souvenirs" payload={{ highlights: HIGHLIGHTS }} />);

    const cards = screen.getAllByTestId('highlight-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Néouvielle');
    expect(cards[1].textContent).toContain('Vercors');
  });

  it('ouvre la visionneuse À la une au clic', () => {
    const onOpen = vi.fn();
    render(
      <MemoriesSlot
        lens="souvenirs"
        payload={{ highlights: [HIGHLIGHTS[1]] }}
        onOpenHighlight={onOpen}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Ouvrir l’album Néouvielle' })
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'h1', title: 'Néouvielle', items: 4 })
    );
  });

  it('affiche un état vide honnête sans album', () => {
    render(
      <MemoriesSlot
        lens="souvenirs"
        payload={{ highlights: [], stories: STORIES }}
      />
    );
    expect(screen.getByText('Aucune story à la une.')).toBeTruthy();
    expect(screen.queryByText('Story normale')).toBeNull();
  });
});
