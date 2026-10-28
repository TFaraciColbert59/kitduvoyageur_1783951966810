// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetMediaBlock } from '../CarnetMediaBlock';
import type { CarnetDetail, CarnetMomentItem } from '@/features/carnet/detail/types';

afterEach(() => cleanup());

vi.mock('../CarnetTraceMap', () => ({
  CarnetTraceMap: () => <div data-testid="trace-map" />,
}));

function moment(id: string, imageUrl: string | null): CarnetMomentItem {
  return {
    id,
    dayNumber: 1,
    time: null,
    caption: null,
    authorName: null,
    place: null,
    imageUrl,
  };
}

function detail(photoMoments: CarnetMomentItem[], overrides: Partial<CarnetDetail> = {}): CarnetDetail {
  return {
    id: 'c1',
    title: 'Tour du Mont-Blanc',
    destination: null,
    description: null,
    coverImage: null,
    coverImageAlt: null,
    startDate: null,
    endDate: null,
    dateRange: null,
    visibility: 'public',
    isPublic: true,
    verified: false,
    isOwner: false,
    author: null,
    stats: [],
    engagement: { likes: 0, comments: 0, views: 0, liked: false, favorited: false },
    moments: photoMoments,
    photoMoments,
    days: [],
    kit: { totalWeightG: null, items: [] },
    trace: null,
    distanceKm: null,
    elevationM: null,
    ...overrides,
  };
}

const noop = () => {};

describe('CarnetMediaBlock — grille du Compte', () => {
  it('rend une tuile carrée par photo', () => {
    const { container } = render(
      <CarnetMediaBlock
        detail={detail([moment('a', 'https://cdn.test/a.jpg'), moment('b', 'https://cdn.test/b.jpg')])}
        mode="grid"
        onModeChange={noop}
        onOpenViewer={noop}
        onOpenMap={noop}
        onDownloadGpx={noop}
      />,
    );
    expect(container.querySelectorAll('.ckp-tile')).toHaveLength(2);
    expect(container.querySelector('.ckp-grid')).toBeTruthy();
  });

  it('affiche un état vide honnête sans photo', () => {
    render(
      <CarnetMediaBlock
        detail={detail([])}
        mode="grid"
        onModeChange={noop}
        onOpenViewer={noop}
        onOpenMap={noop}
        onDownloadGpx={noop}
      />,
    );
    expect(screen.getByText('Aucun moment pour l’instant.')).toBeTruthy();
  });

  it('plafonne à 9 tuiles et résume le reste en « +N »', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      moment(`m${index}`, `https://cdn.test/${index}.jpg`),
    );
    const { container } = render(
      <CarnetMediaBlock
        detail={detail(many)}
        mode="grid"
        onModeChange={noop}
        onOpenViewer={noop}
        onOpenMap={noop}
        onDownloadGpx={noop}
      />,
    );
    expect(container.querySelectorAll('.ckp-tile')).toHaveLength(9);
    expect(container.querySelector('.ckp-tile-more')?.textContent).toBe('+3');
  });

  it('ouvre le viewer sur la bonne image', () => {
    const onOpenViewer = vi.fn();
    const { container } = render(
      <CarnetMediaBlock
        detail={detail([moment('a', 'https://cdn.test/a.jpg'), moment('b', 'https://cdn.test/b.jpg')])}
        mode="grid"
        onModeChange={noop}
        onOpenViewer={onOpenViewer}
        onOpenMap={noop}
        onDownloadGpx={noop}
      />,
    );
    fireEvent.click(container.querySelectorAll('.ckp-tile')[1]);
    expect(onOpenViewer).toHaveBeenCalledWith(1);
  });

  it('bascule en mode carte avec la trace réelle', async () => {
    const trace = { type: 'LineString', coordinates: [] };
    const { rerender } = render(
      <CarnetMediaBlock
        detail={detail([], { trace })}
        mode="grid"
        onModeChange={noop}
        onOpenViewer={noop}
        onOpenMap={noop}
        onDownloadGpx={noop}
      />,
    );
    expect(screen.queryByTestId('trace-map')).toBeNull();
    rerender(
      <CarnetMediaBlock
        detail={detail([], { trace })}
        mode="map"
        onModeChange={noop}
        onOpenViewer={noop}
        onOpenMap={noop}
        onDownloadGpx={noop}
      />,
    );
    expect(await screen.findByTestId('trace-map')).toBeTruthy();
  });

  it('affiche « Aucune trace GPS. » sans trace, et désactive le GPX', () => {
    render(
      <CarnetMediaBlock
        detail={detail([])}
        mode="map"
        onModeChange={noop}
        onOpenViewer={noop}
        onOpenMap={noop}
        onDownloadGpx={noop}
      />,
    );
    expect(screen.getByText('Aucune trace GPS.')).toBeTruthy();
    const gpx = screen.getByRole('button', { name: 'Télécharger le GPX' }) as HTMLButtonElement;
    expect(gpx.disabled).toBe(true);
  });

  it('expose le toggle 30 grille/carte comme un sélecteur à deux états', () => {
    const onModeChange = vi.fn();
    const { container } = render(
      <CarnetMediaBlock
        detail={detail([moment('a', 'https://cdn.test/a.jpg')])}
        mode="grid"
        onModeChange={onModeChange}
        onOpenViewer={noop}
        onOpenMap={noop}
        onDownloadGpx={noop}
      />,
    );
    const toggle = container.querySelector('.ckp-toggle') as HTMLElement;
    expect(toggle.querySelectorAll('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Grille' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Carte' }));
    expect(onModeChange).toHaveBeenCalledWith('map');
  });
});
