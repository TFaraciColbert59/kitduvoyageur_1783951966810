// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARNET_PAGE_TABS, CarnetPages, carnetPageTabs } from '../CarnetPages';
import { swipeStep } from '../CarnetDaySwipe';
import type { CarnetEtapeDay } from '@/features/carnet/detail/types';
import { detail } from './fixtures';

afterEach(() => cleanup());

const noop = () => {};

const DAY: CarnetEtapeDay = {
  id: 'd1',
  dayNumber: 1,
  label: 'JOUR 1 · 26 sept.',
  from: 'Les Houches',
  to: 'Refuge de Bellachat',
  note: null,
  distanceKm: 12.4,
  elevationM: 1050,
  durationText: '5 h',
  weather: null,
  overnight: 'Refuge de Bellachat',
};

function base(overrides: Partial<React.ComponentProps<typeof CarnetPages>> = {}) {
  return {
    detail: detail({
      isOwner: true,
      photoMoments: [
        { id: 'm1', dayNumber: 1, time: null, caption: null, authorName: null, place: null, imageUrl: 'https://cdn.test/1.jpg' },
        { id: 'm2', dayNumber: 1, time: null, caption: null, authorName: null, place: null, imageUrl: 'https://cdn.test/2.jpg' },
      ],
      etapes: [DAY],
    }),
    page: 'posts' as const,
    onPageChange: noop,
    canWrite: false,
    onRequireAuth: noop,
    onOpenPost: noop,
    onDownloadGpx: noop,
    ...overrides,
  };
}

/* jsdom n'implémente pas PointerEvent : un MouseEvent porte les clientX/Y
   lus par le geste, et React l'écoute sur `pointerdown` / `pointerup`. */
function pointer(element: Element, type: 'pointerdown' | 'pointerup', x: number, y: number) {
  fireEvent(
    element,
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }),
  );
}

function swipe(element: Element, x1: number, y1: number, x2: number, y2: number) {
  pointer(element, 'pointerdown', x1, y1);
  pointer(element, 'pointerup', x2, y2);
}

describe('CarnetPages — pages du carnet', () => {
  it('expose les huit pages dans l’ordre du contrat', () => {
    expect(CARNET_PAGE_TABS.map((tab) => tab.id)).toEqual([
      'posts',
      'parcours',
      'etapes',
      'materiel',
      'nature',
      'likes',
      'comments',
      'manage',
    ]);
    expect(CARNET_PAGE_TABS.map((tab) => tab.label)).toEqual([
      'Posts',
      'Parcours',
      'Étapes',
      'Matériel',
      'Nature',
      'J’aime',
      'Commentaires',
      'Gérer',
    ]);
    for (const tab of CARNET_PAGE_TABS) expect(tab.icon).toBeTruthy();
  });

  it('ne propose Gérer qu’au propriétaire', () => {
    expect(carnetPageTabs(true).map((tab) => tab.id)).toEqual([
      'posts',
      'parcours',
      'etapes',
      'materiel',
      'nature',
      'likes',
      'comments',
      'manage',
    ]);
    expect(carnetPageTabs(false).map((tab) => tab.id)).toEqual([
      'posts',
      'parcours',
      'etapes',
      'materiel',
      'nature',
      'likes',
      'comments',
    ]);
    const visitor = render(<CarnetPages {...base({ detail: detail({ photoMoments: [] }), page: 'manage' })} />);
    expect(visitor.container.querySelector('.ckp-page-pad')).toBeNull();
    visitor.unmount();
  });

  it('rend les contenus J’aime, Commentaires et Gérer dans le même carrousel', () => {
    const { container, rerender } = render(
      <CarnetPages
        {...base({
          page: 'likes',
          likesPage: <p>liste réelle</p>,
          commentsPage: <p>fil réel</p>,
          managePage: <p>gestion réelle</p>,
        })}
      />,
    );
    expect(container.querySelector('.ckp-pages > .ckp-page .ckp-page-pad')?.textContent).toBe('liste réelle');
    expect(container.querySelector('.ckp-pages')?.getAttribute('aria-label')).toBe('J’aime');
    rerender(
      <CarnetPages
        {...base({
          page: 'comments',
          likesPage: <p>liste réelle</p>,
          commentsPage: <p>fil réel</p>,
          managePage: <p>gestion réelle</p>,
        })}
      />,
    );
    expect(container.querySelector('.ckp-pages > .ckp-page .ckp-page-pad')?.textContent).toBe('fil réel');
    expect(container.querySelector('.ckp-pages')?.getAttribute('aria-label')).toBe('Commentaires');
    rerender(
      <CarnetPages
        {...base({
          page: 'manage',
          likesPage: <p>liste réelle</p>,
          commentsPage: <p>fil réel</p>,
          managePage: <p>gestion réelle</p>,
        })}
      />,
    );
    expect(container.querySelector('.ckp-pages > .ckp-page .ckp-page-pad')?.textContent).toBe('gestion réelle');
    expect(container.querySelector('.ckp-pages')?.getAttribute('aria-label')).toBe('Gérer');
  });

  it('rend la grille de posts en page 1 et ouvre le post d’une tuile', () => {
    const onOpenPost = vi.fn();
    const { container } = render(<CarnetPages {...base({ onOpenPost })} />);
    expect(container.querySelectorAll('.ckp-grid-wrap .ckp-tile')).toHaveLength(2);
    /* Gabarit du Compte : aucune décoration de tuile, rien que l'image. */
    expect(container.querySelector('.ckp-tile-expand')).toBeNull();
    expect(container.querySelector('.ckp-grid-wrap .ckp-tile img')).toBeTruthy();
    expect(container.querySelector('.ckp-pages')?.getAttribute('role')).toBe('tabpanel');
    expect(container.querySelector('.ckp-pages')?.getAttribute('id')).toBe('carnet-page-posts');
    fireEvent.click(screen.getAllByRole('button', { name: /^Moment / })[1]);
    expect(onOpenPost).toHaveBeenCalledWith(1);
  });

  it('affiche l’état vide honnête de la grille', () => {
    render(<CarnetPages {...base({ detail: detail({ photoMoments: [] }) })} />);
    expect(screen.getByText('Aucun moment pour l’instant.')).toBeTruthy();
  });

  it('ne capte plus aucun geste horizontal : la page ne change jamais au swipe', () => {
    const onPageChange = vi.fn();
    const { container, rerender } = render(<CarnetPages {...base({ onPageChange })} />);
    const pages = container.querySelector('.ckp-pages') as Element;
    /* Gauche, droite : le geste appartient aux jours, jamais au carrousel. */
    swipe(pages, 300, 100, 180, 105);
    swipe(pages, 120, 100, 260, 105);
    rerender(<CarnetPages {...base({ page: 'likes', onPageChange })} />);
    swipe(container.querySelector('.ckp-pages') as Element, 300, 100, 180, 105);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('garde le pas du geste et ignore un geste vertical ou trop court', () => {
    const onPageChange = vi.fn();
    const { container } = render(<CarnetPages {...base({ onPageChange })} />);
    const pages = container.querySelector('.ckp-pages') as Element;
    /* Trop court. */
    swipe(pages, 200, 100, 175, 100);
    /* Vertical : le scroll de la page garde la main. */
    swipe(pages, 200, 60, 160, 220);
    expect(onPageChange).not.toHaveBeenCalled();
    expect(swipeStep(-120, 10)).toBe(1);
    expect(swipeStep(120, 10)).toBe(-1);
    expect(swipeStep(10, 10)).toBe(0);
    expect(swipeStep(30, 90)).toBe(0);
  });

  it('avance et recule au clavier, sans sortir des bornes', () => {
    const onPageChange = vi.fn();
    const pages = () => container.querySelector('.ckp-pages') as Element;
    const { container, rerender } = render(<CarnetPages {...base({ onPageChange })} />);
    fireEvent.keyDown(pages(), { key: 'ArrowRight' });
    expect(onPageChange).toHaveBeenLastCalledWith('parcours');
    rerender(<CarnetPages {...base({ page: 'parcours', onPageChange })} />);
    fireEvent.keyDown(pages(), { key: 'ArrowLeft' });
    expect(onPageChange).toHaveBeenLastCalledWith('posts');
    expect(onPageChange).toHaveBeenCalledTimes(2);
    /* Bornes : rien avant la première page ni après la dernière. */
    rerender(<CarnetPages {...base({ page: 'posts', onPageChange })} />);
    fireEvent.keyDown(pages(), { key: 'ArrowLeft' });
    rerender(<CarnetPages {...base({ page: 'manage', onPageChange })} />);
    fireEvent.keyDown(pages(), { key: 'ArrowRight' });
    expect(onPageChange).toHaveBeenCalledTimes(2);
    /* Home / End. */
    fireEvent.keyDown(pages(), { key: 'Home' });
    expect(onPageChange).toHaveBeenLastCalledWith('posts');
    fireEvent.keyDown(pages(), { key: 'End' });
    expect(onPageChange).toHaveBeenLastCalledWith('manage');
  });

  it('garde son animation d’entrée, dans le sens du changement de page', () => {
    const onPageChange = vi.fn();
    const { container, rerender } = render(<CarnetPages {...base({ page: 'parcours', onPageChange })} />);
    const page = () => container.querySelector('.ckp-pages > .ckp-page') as Element;
    fireEvent.keyDown(container.querySelector('.ckp-pages') as Element, { key: 'ArrowLeft' });
    expect(onPageChange).toHaveBeenLastCalledWith('posts');
    rerender(<CarnetPages {...base({ page: 'posts', onPageChange })} />);
    expect(page().className).toContain('ckp-page--prev');
    fireEvent.keyDown(container.querySelector('.ckp-pages') as Element, { key: 'ArrowRight' });
    rerender(<CarnetPages {...base({ page: 'parcours', onPageChange })} />);
    expect(page().className).toContain('ckp-page--next');
  });

  it('garde le clic tuile quand le geste n’a pas swipé', () => {
    const onOpenPost = vi.fn();
    const { container } = render(<CarnetPages {...base({ onOpenPost })} />);
    const pages = container.querySelector('.ckp-pages') as Element;
    const tile = screen.getAllByRole('button', { name: /^Moment / })[0];
    pointer(tile, 'pointerdown', 100, 100);
    pointer(tile, 'pointerup', 105, 102);
    expect(pages).toBeTruthy();
    fireEvent.click(tile);
    expect(onOpenPost).toHaveBeenCalledWith(0);
  });

  it('rend le volet Étapes du drawer tel quel', () => {
    render(<CarnetPages {...base({ page: 'etapes' })} />);
    expect(screen.getByText('Les Houches → Refuge de Bellachat')).toBeTruthy();
    expect(screen.getByText('Nuit · Refuge de Bellachat')).toBeTruthy();
  });

  it('rend le volet Matériel et son état vide, jamais de mock', () => {
    render(<CarnetPages {...base({ page: 'materiel' })} />);
    expect(screen.getByText('Matériel non renseigné.')).toBeTruthy();
  });

  it('rend le volet Nature et son bouton d’identification', () => {
    render(<CarnetPages {...base({ page: 'nature' })} />);
    expect(screen.getByRole('button', { name: /Se connecter pour identifier/ })).toBeTruthy();
  });
});
