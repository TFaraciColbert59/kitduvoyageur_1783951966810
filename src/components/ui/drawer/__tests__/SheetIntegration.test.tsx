// @vitest-environment jsdom

import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommunitySheetShell } from '@/features/community/v2/shared/CommunitySheetShell';
import { DynamicIsland } from '../DynamicIsland';
import { SortMenuButton } from '../SortMenuButton';

afterEach(cleanup);

const capsuleItems = [
  { id: 'carnets', label: 'Carnets', icon: <span>1</span> },
  { id: 'clubs', label: 'Clubs', icon: <span>2</span> },
];

const miniItems = [
  { id: 'discover', label: 'Découvrir', icon: <span>1</span> },
  { id: 'mine', label: 'Mes carnets', icon: <span>2</span> },
];

const sortOptions = [
  { value: 'recent', label: 'Récents' },
  { value: 'popular', label: 'Populaires' },
  { value: 'near', label: 'Proches' },
  { value: 'duration', label: 'Durée' },
];

function Harness({
  onClose = () => {},
  onSortChange = () => {},
  island,
}: {
  onClose?: () => void;
  onSortChange?: (value: string) => void;
  island?: React.ReactNode;
}) {
  const [sort, setSort] = useState('recent');
  return (
    <CommunitySheetShell
      open
      onClose={onClose}
      label="Explorer la communauté"
      capsule={{ items: capsuleItems, active: 0, onChange: () => {} }}
      mini={{
        items: miniItems,
        active: 0,
        onChange: () => {},
        label: 'Filtres',
        sort: {
          value: sort,
          defaultValue: 'recent',
          options: sortOptions,
          onChange: (value) => {
            setSort(value);
            onSortChange(value);
          },
        },
      }}
      panes={[<div key="carnets">Contenu du volet Carnets</div>, <div key="clubs">Contenu du volet Clubs</div>]}
      island={island}
    />
  );
}

describe('SortMenuButton intégré à la coque CommunitySheetShell', () => {
  it('s’ancre dans la mini-capsule, ouvre le menu et expose aria-expanded', () => {
    render(<Harness />);

    const button = screen.getByRole('button', { name: 'Trier' });
    const slot = button.closest('.lkdv-cv2-mini-slot');
    expect(slot).toBeTruthy();
    expect(slot?.querySelector('.lkdv-lens-float')).toBeTruthy();
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(button);

    const menu = screen.getByRole('menu');
    expect(menu.closest('.lkdv-cv2-mini-slot')).toBe(slot);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(sortOptions.length);
  });

  it('Échap ferme le menu de tri sans fermer le tiroir', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Trier' }));
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('Tab ferme le menu et rend le focus au bouton de tri', async () => {
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Trier' });
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' });

    expect(screen.queryByRole('menu')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it('choisit une option, remonte le changement et referme le menu', async () => {
    const onSortChange = vi.fn();
    render(<Harness onSortChange={onSortChange} />);
    const button = screen.getByRole('button', { name: 'Trier' });
    fireEvent.click(button);

    const options = screen.getAllByRole('menuitemradio');
    fireEvent.click(options[1] as HTMLElement);

    expect(onSortChange).toHaveBeenCalledTimes(1);
    expect(onSortChange).toHaveBeenCalledWith('popular');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button.getAttribute('data-modified')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it('ferme le menu au clic hors du bouton sans fermer le tiroir', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trier' }));
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.pointerDown(screen.getByText('Contenu du volet Carnets'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('DynamicIsland intégrée à la coque (prop island)', () => {
  it('rend l’île hors du tiroir, au-dessus de la couche, sans fermer la coque', () => {
    const onClose = vi.fn();
    render(
      <Harness
        onClose={onClose}
        island={<DynamicIsland open title="Club rejoint" subtitle="Vercors Alpin" onClose={onClose} />}
      />,
    );

    const island = screen.getByTestId('dynamic-island');
    expect(island.getAttribute('role')).toBe('status');
    expect(island.closest('.lkdv-cv2-layer')).toBeNull();
    expect(document.querySelector('.lkdv-island-host')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('SortMenuButton isolé (harnais de recette)', () => {
  it('reste utilisable hors coque : ancre relative et menu dans le flux du DOM', () => {
    render(
      <SortMenuButton
        value="near"
        defaultValue="recent"
        options={sortOptions}
        onChange={() => {}}
      />,
    );
    const button = screen.getByRole('button', { name: 'Trier' });
    expect(button.closest('.lkdv-sort-anchor')).toBeTruthy();
    fireEvent.click(button);
    expect(screen.getByRole('menu').closest('.lkdv-sort-anchor')).toBeTruthy();
  });
});
