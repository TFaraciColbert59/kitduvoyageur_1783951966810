// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SportActivityCardVM } from '@/features/community/g01/activityProjection';
import { SportActivityCard } from '../SportActivityCard';

afterEach(cleanup);

function card(overrides: Partial<SportActivityCardVM> = {}): SportActivityCardVM {
  return {
    id: 'g01:post-1',
    postId: 'post-1',
    sessionId: 'session-1',
    author: { id: 'author-1', name: 'Marie Dupont', handle: 'marie', avatarUrl: null },
    sport: 'rando',
    sportLabel: 'Randonnée',
    title: 'Tour du lac',
    createdAt: '2026-11-13T10:00:00.000Z',
    sessionDate: '2026-11-13',
    coverUrl: null,
    stats: [
      { key: 'distance', label: 'Distance', unit: 'km', formatted: '12,4', value: 12.4 },
      { key: 'elevation', label: 'Dénivelé', unit: 'm D+', formatted: '850', value: 850 },
    ],
    records: [{ id: 'rec-1', label: 'Plus longue distance', formatted: '12,4 km' }],
    likesCount: 3,
    commentsCount: 1,
    likedByMe: false,
    canLike: true,
    canComment: true,
    canShare: true,
    audience: 'public',
    audienceLabel: 'Public',
    visibilityLabel: 'Partagée',
    shareStatus: 'shared',
    isOwner: false,
    ...overrides,
  };
}

describe('SportActivityCard', () => {
  it('affiche les chiffres du sport et les records', () => {
    render(<SportActivityCard item={card()} />);
    expect(screen.getByText('Tour du lac')).toBeTruthy();
    expect(screen.getByText('Distance')).toBeTruthy();
    expect(screen.getAllByText(/12,4/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Plus longue distance/)).toBeTruthy();
    expect(screen.getByText('Randonnée')).toBeTruthy();
  });

  it('appelle le like quand l’action est disponible', () => {
    const onLike = vi.fn();
    render(<SportActivityCard item={card()} onLike={onLike} />);
    fireEvent.click(screen.getByRole('button', { name: /Aimer la sortie/ }));
    expect(onLike).toHaveBeenCalledTimes(1);
  });

  it('désactive le like quand la méta l’interdit', () => {
    const onLike = vi.fn();
    render(<SportActivityCard item={card({ canLike: false })} onLike={onLike} />);
    const button = screen.getByRole('button', { name: /Like indisponible/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onLike).not.toHaveBeenCalled();
  });

  it('désactive les commentaires fermés', () => {
    render(<SportActivityCard item={card({ canComment: false })} onComment={() => {}} />);
    const button = screen.getByRole('button', {
      name: /Commentaires indisponibles/,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('n’affiche le signalement que si l’hôte le fournit', () => {
    const { rerender } = render(<SportActivityCard item={card()} />);
    expect(screen.queryByRole('button', { name: /Signaler/ })).toBeNull();
    rerender(<SportActivityCard item={card()} onReport={() => {}} />);
    expect(screen.getByRole('button', { name: /Signaler/ })).toBeTruthy();
  });
});
