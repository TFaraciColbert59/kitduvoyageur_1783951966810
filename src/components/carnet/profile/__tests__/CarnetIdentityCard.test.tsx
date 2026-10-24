// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetIdentityCard } from '../CarnetIdentityCard';
import { detail } from './fixtures';

afterEach(() => cleanup());

const noop = () => {};

function renderCard(props: Partial<React.ComponentProps<typeof CarnetIdentityCard>> = {}) {
  return render(
    <CarnetIdentityCard
      detail={detail()}
      onOpenViewer={noop}
      onOpenAuthor={noop}
      onLike={noop}
      onOpenComments={noop}
      onOpenParcours={noop}
      onOpenManage={noop}
      onExpandDescription={noop}
      onDownloadGpx={noop}
      {...props}
    />,
  );
}

describe('CarnetIdentityCard — carte profil du Compte', () => {
  it('rend la couverture 66 et son alt', () => {
    const { container } = renderCard();
    const img = container.querySelector('.ckp-cover') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://cdn.test/cover.jpg');
    expect(img.getAttribute('alt')).toBe('Crête au lever du jour');
  });

  it('affiche les trois statistiques réelles', () => {
    const { container } = renderCard();
    const values = [...container.querySelectorAll('.ckp-stat-v')].map((n) => n.textContent);
    expect(values).toEqual(['106,4 km', '2 002 m', '7']);
    expect(container.querySelectorAll('.ckp-stat')).toHaveLength(3);
  });

  it('supprime les cellules absentes', () => {
    const { container } = renderCard({ detail: detail({ stats: [] }) });
    expect(container.querySelectorAll('.ckp-stat')).toHaveLength(0);
  });

  it('rend trois actions rapides avec libellés, sans capsule', () => {
    renderCard();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByRole('button', { name: 'J’aime, 22' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Commenter, 3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Parcours' })).toBeTruthy();
  });

  it('remplace Parcours par Gérer pour le propriétaire', () => {
    renderCard({ detail: detail({ isOwner: true }) });
    expect(screen.getByRole('button', { name: 'Gérer' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Parcours' })).toBeNull();
  });

  it('délègue like, commentaires et parcours', () => {
    const onLike = vi.fn();
    const onOpenComments = vi.fn();
    const onOpenParcours = vi.fn();
    renderCard({ onLike, onOpenComments, onOpenParcours });
    fireEvent.click(screen.getByRole('button', { name: 'J’aime, 22' }));
    fireEvent.click(screen.getByRole('button', { name: 'Commenter, 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Parcours' }));
    expect(onLike).toHaveBeenCalledOnce();
    expect(onOpenComments).toHaveBeenCalledOnce();
    expect(onOpenParcours).toHaveBeenCalledOnce();
  });

  it('marque le like actif', () => {
    renderCard({ detail: detail({ engagement: { ...detail().engagement, liked: true } }) });
    expect(screen.getByRole('button', { name: 'J’aime, 22' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('ne montre le badge Vérifié que si verified', () => {
    renderCard();
    expect(screen.getByText('Vérifié')).toBeTruthy();
    cleanup();
    renderCard({ detail: detail({ verified: false }) });
    expect(screen.queryByText('Vérifié')).toBeNull();
  });

  it('affiche « Auteur non renseigné » sans auteur', () => {
    renderCard({ detail: detail({ author: null }) });
    expect(screen.getByText('Auteur non renseigné')).toBeTruthy();
  });

  it('ne répète pas le titre dans la carte (il vit dans la pilule du haut)', () => {
    const { container } = renderCard();
    expect(screen.queryByRole('heading', { name: 'Tour du Mont-Blanc' })).toBeNull();
    expect(container.querySelector('.ckp-card h2')).toBeNull();
    expect(container.querySelector('.ckp-bio-line')?.textContent).toBe(
      'France / Italie / Suisse · 26 sept. – 2 oct. 2026',
    );
  });

  it('regroupe auteur, score et vérification sur la ligne de bio', () => {
    renderCard();
    expect(screen.getByRole('button', { name: 'Camille Rochat' })).toBeTruthy();
    expect(screen.getByText('94')).toBeTruthy();
    expect(screen.getByText('Vérifié')).toBeTruthy();
  });

  it('bascule la grille en carte du parcours', () => {
    const { container } = renderCard();
    expect(container.querySelector('.ckp-grid-wrap')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Carte du parcours' }));
    expect(container.querySelector('.ckp-grid-wrap')).toBeNull();
    expect(screen.getByText('Aucune trace GPS.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Grille des moments' }));
    expect(container.querySelector('.ckp-grid-wrap')).toBeTruthy();
  });

  it('propose le GPX quand la trace existe', () => {
    const onDownloadGpx = vi.fn();
    const trace = { coordinates: [[5.6, 45.1], [5.7, 45.2]] };
    renderCard({ detail: detail({ trace }), onDownloadGpx });
    fireEvent.click(screen.getByRole('button', { name: 'Carte du parcours' }));
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger le GPX' }));
    expect(onDownloadGpx).toHaveBeenCalledOnce();
  });

  it('rend la grille de moments dans la carte', () => {
    const { container } = renderCard();
    expect(container.querySelector('.ckp-card .ckp-grid-wrap')).toBeTruthy();
    expect(container.querySelectorAll('.ckp-card .ckp-tile')).toHaveLength(1);
  });
});
