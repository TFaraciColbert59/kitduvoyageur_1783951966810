// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetLikesPane } from '../panes/CarnetLikesPane';
import { detail } from './fixtures';

afterEach(() => cleanup());

const DETAIL = detail({
  likers: [
    { id: 'u1', name: 'Léonie Fabre', handle: 'leonie', avatarUrl: null, reaction: 'like' },
    { id: 'u2', name: 'Rachid Benali', handle: 'rachid', avatarUrl: null, reaction: 'bravo' },
  ],
});

describe('CarnetLikesPane', () => {
  it('affiche les réactions réelles avec leur libellé', () => {
    render(<CarnetLikesPane detail={DETAIL} currentUserId="u1" />);
    expect(screen.getByText('Léonie Fabre')).toBeTruthy();
    expect(screen.getByText('Rachid Benali')).toBeTruthy();
    /* « Bravo » est le libellé de la réaction et l'une des trois pastilles. */
    expect(screen.getAllByText('Bravo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('group', { name: 'Filtre des j’aime' })).toBeTruthy();
  });

  it('trie par réaction avec trois pastilles, sans masquer la liste au repos', () => {
    const { container } = render(<CarnetLikesPane detail={DETAIL} currentUserId="u1" />);
    const pills = [...container.querySelectorAll('.ckp-like-filter')];
    expect(pills.map((pill) => pill.textContent)).toEqual(['J’aime', 'Bravo']);
    expect(pills.every((pill) => pill.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(container.querySelectorAll('.ckp-liker')).toHaveLength(2);
    fireEvent.click(pills[1]);
    expect(container.querySelectorAll('.ckp-liker')).toHaveLength(1);
    fireEvent.click(pills[1]);
    expect(container.querySelectorAll('.ckp-liker')).toHaveLength(2);
    expect(screen.getByText('2 réactions')).toBeTruthy();
  });

  it('affiche l’état vide honnête', () => {
    render(<CarnetLikesPane detail={detail({ likers: [] })} currentUserId={null} />);
    expect(screen.getByText('Aucun j’aime pour l’instant.')).toBeTruthy();
  });

  it('porte la bascule J’aime du carnet quand elle est fournie', () => {
    const onToggle = vi.fn();
    render(
      <CarnetLikesPane
        detail={DETAIL}
        currentUserId="u1"
        like={{ liked: false, count: 22, onToggle }}
      />,
    );
    const toggle = screen.getByRole('button', { name: 'J’aime ce carnet' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('affiche l’état actif de la bascule sans changer les réactions', () => {
    render(
      <CarnetLikesPane
        detail={DETAIL}
        currentUserId="u1"
        like={{ liked: true, count: 22, onToggle: () => {} }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Retirer mon j’aime' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('22 j’aime')).toBeTruthy();
  });
});
