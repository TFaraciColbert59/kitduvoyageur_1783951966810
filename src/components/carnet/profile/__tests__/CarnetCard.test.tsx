// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetCard } from '../CarnetCard';
import { detail } from './fixtures';

afterEach(() => cleanup());

const noop = () => {};

function base(overrides: Partial<React.ComponentProps<typeof CarnetCard>> = {}) {
  return {
    detail: detail({ photoMoments: [
      { id: 'm1', dayNumber: 3, time: '18:30', caption: 'Bivouac', authorName: null, place: 'Col', imageUrl: 'https://cdn.test/1.jpg' },
      { id: 'm2', dayNumber: 4, time: null, caption: null, authorName: null, place: null, imageUrl: 'https://cdn.test/2.jpg' },
    ] }),
    mediaMode: 'grid' as const,
    onMediaModeChange: noop,
    onOpenCarnet: noop,
    onOpenStat: noop,
    onOpenComments: noop,
    onOpenLikes: noop,
    onOpenParcours: noop,
    onOpenManage: noop,
    onLike: noop,
    onOpenAuthor: noop,
    onOpenPost: noop,
    onDownloadGpx: noop,
    ...overrides,
  };
}

describe('CarnetCard — carte du carnet', () => {
  it('ouvre le drawer Carnet au clic sur la couverture', () => {
    const onOpenCarnet = vi.fn();
    render(<CarnetCard {...base({ onOpenCarnet })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le carnet' }));
    expect(onOpenCarnet).toHaveBeenCalledOnce();
  });

  it('rend les statistiques comme des boutons de drawer', () => {
    const onOpenStat = vi.fn();
    render(<CarnetCard {...base({ onOpenStat })} />);
    fireEvent.click(screen.getByRole('button', { name: 'DISTANCE 106,4 km' }));
    expect(onOpenStat).toHaveBeenCalledWith('parcours');
    fireEvent.click(screen.getByRole('button', { name: 'JOURS 7' }));
    expect(onOpenStat).toHaveBeenCalledWith('etapes');
  });

  it('ouvre le post du moment au clic sur une tuile', () => {
    const onOpenPost = vi.fn();
    render(<CarnetCard {...base({ onOpenPost })} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Moment / })[1]);
    expect(onOpenPost).toHaveBeenCalledWith(1);
  });

  it('expose le sélecteur 31 px avec lentille et deux cellules', () => {
    const { container } = render(<CarnetCard {...base()} />);
    const tabs = container.querySelector('.ckp-tabs');
    expect(tabs?.getAttribute('aria-label')).toBe('Affichage des médias');
    expect(container.querySelector('.ckp-th')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Grille des moments' }).getAttribute('aria-selected')).toBe('true');
  });

  it('bascule en carte du parcours', () => {
    const onMediaModeChange = vi.fn();
    render(<CarnetCard {...base({ onMediaModeChange })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Carte du parcours' }));
    expect(onMediaModeChange).toHaveBeenCalledWith('map');
  });

  it('affiche les compteurs réels et le like actif', () => {
    render(<CarnetCard {...base({ detail: detail({ engagement: { ...detail().engagement, liked: true } }) })} />);
    expect(screen.getByRole('button', { name: 'J’aime, 22' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Commenter, 3' })).toBeTruthy();
  });
});
