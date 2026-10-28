// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetIdentityCard } from '../CarnetIdentityCard';
import type { CarnetDetail } from '@/features/carnet/detail/types';

afterEach(() => cleanup());

function detail(overrides: Partial<CarnetDetail> = {}): CarnetDetail {
  return {
    id: 'c1',
    title: 'Tour du Mont-Blanc',
    destination: 'France / Italie / Suisse',
    description: 'Dix jours, trois pays, deux bivouacs.',
    coverImage: 'https://cdn.test/cover.jpg',
    coverImageAlt: 'Crête au lever du jour',
    startDate: '2026-09-26',
    endDate: '2026-10-02',
    dateRange: '26 sept. – 2 oct. 2026',
    visibility: 'public',
    isPublic: true,
    verified: true,
    isOwner: false,
    author: { id: 'u1', name: 'Camille Rochat', handle: 'camille', avatarUrl: null, trustScore: 94 },
    stats: [
      { key: 'distance', label: 'DISTANCE', value: '106,4 km' },
      { key: 'elevation', label: 'DÉNIVELÉ +', value: '2 002 m' },
      { key: 'days', label: 'JOURS', value: '7' },
    ],
    engagement: { likes: 6, comments: 3, views: 2320, liked: false, favorited: false },
    moments: [],
    photoMoments: [],
    days: [],
    kit: { totalWeightG: null, items: [] },
    trace: null,
    dayTraces: [],
    distanceKm: 106.4,
    elevationM: 2002,
    ...overrides,
  };
}

const noop = () => {};

function renderCard(props: Partial<React.ComponentProps<typeof CarnetIdentityCard>> = {}) {
  return render(
    <CarnetIdentityCard
      detail={detail()}
      activeSection={0}
      onSectionChange={noop}
      onOpenViewer={noop}
      onOpenAuthor={noop}
      onOpenComments={noop}
      onLike={noop}
      onOpenManage={noop}
      onExpandDescription={noop}
      {...props}
    />,
  );
}

describe('CarnetIdentityCard — carte profil', () => {
  it('rend la couverture 1:1, le titre, la destination et les dates', () => {
    const { container } = renderCard();
    const img = container.querySelector('.ckp-cover') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://cdn.test/cover.jpg');
    expect(img.getAttribute('alt')).toBe('Crête au lever du jour');
    expect(screen.getByRole('heading', { level: 2, name: 'Tour du Mont-Blanc' })).toBeTruthy();
    expect(screen.getByText('France / Italie / Suisse')).toBeTruthy();
    expect(screen.getByText('26 sept. – 2 oct. 2026')).toBeTruthy();
  });

  it('affiche les trois statistiques réelles, jamais une valeur inventée', () => {
    const { container } = renderCard();
    const values = [...container.querySelectorAll('.ckp-stat-v')].map((n) => n.textContent);
    expect(values).toEqual(['106,4 km', '2 002 m', '7']);
  });

  it('supprime les cellules absentes', () => {
    const { container } = renderCard({ detail: detail({ stats: [] }) });
    expect(container.querySelectorAll('.ckp-stat')).toHaveLength(0);
  });

  it('ne montre le badge Vérifié que si verified', () => {
    renderCard();
    expect(screen.getByText('Vérifié')).toBeTruthy();
    cleanup();
    renderCard({ detail: detail({ verified: false }) });
    expect(screen.queryByText('Vérifié')).toBeNull();
  });

  it('affiche le badge Privé au propriétaire seulement', () => {
    renderCard({ detail: detail({ isPublic: false, isOwner: true }) });
    expect(screen.getByText('Privé')).toBeTruthy();
    cleanup();
    renderCard({ detail: detail({ isPublic: false, isOwner: false }) });
    expect(screen.queryByText('Privé')).toBeNull();
  });

  it('affiche « Auteur non renseigné » sans auteur, sans lien', () => {
    renderCard({ detail: detail({ author: null }) });
    expect(screen.getByText('Auteur non renseigné')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Camille/ })).toBeNull();
  });

  it('affiche les compteurs réels des pilules et bascule le like', () => {
    const onLike = vi.fn();
    const onOpenComments = vi.fn();
    renderCard({ onLike, onOpenComments });
    const like = screen.getByRole('button', { name: /J’aime, 6/ });
    expect(like.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(like);
    expect(onLike).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /Commentaires, 3/ }));
    expect(onOpenComments).toHaveBeenCalledOnce();
  });

  it('ouvre la gestion pour le propriétaire', () => {
    const onOpenManage = vi.fn();
    renderCard({ detail: detail({ isOwner: true }), onOpenManage });
    fireEvent.click(screen.getByRole('button', { name: 'Gérer le carnet' }));
    expect(onOpenManage).toHaveBeenCalledOnce();
  });

  it('rend la capsule des 5 sections dans la carte', () => {
    const { container } = renderCard();
    const tablist = screen.getByRole('tablist', { name: 'Sections du carnet' });
    expect(tablist.className).toContain('lkdv-capsule');
    expect(container.querySelector('.ckp-tabs')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });
});
