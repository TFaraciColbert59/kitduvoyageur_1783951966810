// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ExploreEmpty,
  ExploreError,
  ExploreGeoPrompt,
  ExploreListFoot,
  ExploreOfflineBanner,
  ExploreSkeleton,
} from '../ExploreStates';

afterEach(cleanup);

describe('états du tiroir Explorer', () => {
  it('une erreur affiche un message distinct et Réessayer', () => {
    const onRetry = vi.fn();
    render(<ExploreError title="Carnets indisponibles" onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toContain('Carnets indisponibles');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('un état vide porte toujours une action', () => {
    const onCreate = vi.fn();
    render(
      <ExploreEmpty icon="book" title="Aucun carnet" description="Raconte ton premier voyage.">
        <button type="button" onClick={onCreate}>
          Créer mon premier carnet
        </button>
      </ExploreEmpty>,
    );
    expect(screen.getByRole('status').textContent).toContain('Aucun carnet');
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon premier carnet' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('refus de position : état explicatif avec bouton Autoriser', () => {
    const onRequest = vi.fn();
    render(<ExploreGeoPrompt state="denied" onRequest={onRequest} />);
    expect(screen.getByText('Position refusée')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Autoriser' }));
    expect(onRequest).toHaveBeenCalledTimes(1);
  });

  it('le bandeau hors ligne reste lisible', () => {
    render(<ExploreOfflineBanner />);
    expect(screen.getByRole('status').textContent).toContain('Hors ligne');
  });

  it('les squelettes sont décoratifs (pas de faux contenu annoncé)', () => {
    const { container } = render(<ExploreSkeleton variant="tiles" />);
    expect(container.querySelectorAll('.lkdv-cv2-skeleton-bar').length).toBeGreaterThan(0);
    expect(container.querySelector('.lkdv-cv2x-skeleton')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('le pied distingue « charger la suite » et fin de flux', () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <ExploreListFoot hasMore loadingMore={false} onLoadMore={onLoadMore} total={12} label="12 carnets" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Charger la suite' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    rerender(<ExploreListFoot hasMore={false} loadingMore={false} onLoadMore={onLoadMore} total={12} label="12 carnets" />);
    expect(screen.getByText('Tu as tout vu. 12 carnets')).toBeTruthy();
  });
});
