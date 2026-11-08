// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CarnetCardVM } from '../../shared/types';
import { CarnetTileV2 } from '../tiles/CarnetTileV2';
import { LONG_PRESS_MS } from '../useLongPress';

afterEach(cleanup);

beforeEach(() => {
  vi.useRealTimers();
});

function carnet(overrides: Partial<CarnetCardVM> = {}): CarnetCardVM {
  return {
    id: 'c1',
    title: 'Tour des Écrins',
    destination: 'Hauts-Alpes',
    coverImage: null,
    coverAlt: null,
    days: 4,
    distanceKm: 62.4,
    elevationGainM: 3200,
    author: { id: 'u1', name: 'Camille Roux', initials: 'CR', handle: null, avatarUrl: null },
    likesCount: 128,
    commentsCount: 14,
    likedByMe: false,
    travelers: [
      { id: 'u1', name: 'Camille', initials: 'C', handle: null, avatarUrl: null },
      { id: 'u2', name: 'Marc', initials: 'M', handle: null, avatarUrl: null },
    ],
    travelersTotal: 3,
    isLive: true,
    verifiedGps: true,
    startDate: '2026-11-01',
    endDate: '2026-11-04',
    visibility: 'public',
    distanceKmFromMe: null,
    routeTrace: [
      [0, 10],
      [50, 40],
      [100, 60],
    ],
    ...overrides,
  };
}

describe('CarnetTileV2 (Carnets#1-12)', () => {
  it('est un seul lien avec un libellé complet', () => {
    render(<CarnetTileV2 carnet={carnet()} onLike={() => {}} onPeek={() => {}} />);
    const link = screen.getAllByRole('link')[0] as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/carnets/c1');
    expect(link.getAttribute('aria-label')).toContain('Tour des Écrins');
    expect(link.getAttribute('aria-label')).toContain('trace GPS vérifiée');
    expect(screen.getByTestId('cv2-tile-carnet').getAttribute('data-id')).toBe('c1');
  });

  it('affiche visa, en route, GPS, voyageurs et j’aime hors du lien', () => {
    render(<CarnetTileV2 carnet={carnet()} onLike={() => {}} onPeek={() => {}} />);
    expect(screen.getByText('En route')).toBeTruthy();
    expect(screen.getByText('GPS')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    const like = screen.getByRole('button', { name: 'J’aime : 128' });
    expect(like.getAttribute('aria-pressed')).toBe('false');
    expect(like.closest('a')).toBeNull();
  });

  it('déclenche le j’aime au clic et reflète l’état pressé', () => {
    const onLike = vi.fn();
    const { rerender } = render(<CarnetTileV2 carnet={carnet()} onLike={onLike} onPeek={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'J’aime : 128' }));
    expect(onLike).toHaveBeenCalledTimes(1);
    rerender(<CarnetTileV2 carnet={carnet({ likedByMe: true, likesCount: 129 })} onLike={onLike} onPeek={() => {}} />);
    const pressed = screen.getByRole('button', { name: /Retirer mon j’aime/ });
    expect(pressed.getAttribute('aria-pressed')).toBe('true');
  });

  it('désactive le j’aime pendant l’envoi (pas de double envoi)', () => {
    const onLike = vi.fn();
    render(<CarnetTileV2 carnet={carnet()} onLike={onLike} onPeek={() => {}} likeBusy />);
    const button = screen.getByRole('button', { name: /J’aime/ });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);
    expect(onLike).not.toHaveBeenCalled();
  });

  it('l’appui long (460 ms) ouvre le Peek et n’ouvre pas le lien', () => {
    vi.useFakeTimers();
    const onPeek = vi.fn();
    const { getByTestId } = render(<CarnetTileV2 carnet={carnet()} onLike={() => {}} onPeek={onPeek} />);
    const tile = getByTestId('cv2-tile-carnet');
    fireEvent.pointerDown(tile, { clientX: 20, clientY: 20, button: 0, pointerId: 1 });
    vi.advanceTimersByTime(LONG_PRESS_MS + 10);
    expect(onPeek).toHaveBeenCalledTimes(1);
    expect(onPeek.mock.calls[0]?.[0]?.id).toBe('c1');
    vi.useRealTimers();
  });
});
