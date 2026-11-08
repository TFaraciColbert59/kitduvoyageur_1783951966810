// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DYNAMIC_ISLAND_CSS, DynamicIsland } from '../DynamicIsland';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('DynamicIsland', () => {
  it('ne rend rien quand elle est fermée', () => {
    render(<DynamicIsland open={false} title="Publié" onClose={() => {}} />);
    expect(screen.queryByTestId('cv2-island')).toBeNull();
  });

  it('annonce le titre et le sous-titre en role=status aria-live=polite', () => {
    render(
      <DynamicIsland
        open
        title="Publication publiée"
        subtitle="Visible par tes abonnés"
        onClose={() => {}}
      />,
    );
    const island = screen.getByTestId('cv2-island');
    expect(island.getAttribute('role')).toBe('status');
    expect(island.getAttribute('aria-live')).toBe('polite');
    expect(island.getAttribute('aria-atomic')).toBe('true');
    expect(screen.getByText('Publication publiée')).toBeTruthy();
    expect(screen.getByText('Visible par tes abonnés')).toBeTruthy();
    // Sans action ni annulation : aucun bouton.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('appelle onUndo puis onClose au clic sur Annuler', () => {
    const onUndo = vi.fn();
    const onClose = vi.fn();
    render(
      <DynamicIsland
        open
        title="Club rejoint"
        undo={{ onUndo }}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('accepte un libellé d’annulation personnalisé', () => {
    render(
      <DynamicIsland
        open
        title="Inscription annulée"
        undo={{ label: 'Rétablir', onUndo: () => {} }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Rétablir' })).toBeTruthy();
  });

  it('appelle onAction puis onClose au clic sur l’action principale', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(
      <DynamicIsland
        open
        title="Story publiée"
        action={{ label: 'Voir', onAction }}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Voir' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('affiche l’action et l’annulation ensemble', () => {
    render(
      <DynamicIsland
        open
        title="Inscription confirmée"
        subtitle="GR20 · samedi 14 novembre"
        undo={{ onUndo: () => {} }}
        action={{ label: 'Partager', onAction: () => {} }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Partager' })).toBeTruthy();
  });

  it('se referme au repos après 3800 ms', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<DynamicIsland open title="Commentaire supprimé" onClose={onClose} />);
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3799);
    });
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('respecte une durée personnalisée et réarme le repos au changement de titre', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { rerender } = render(
      <DynamicIsland open title="Club rejoint" onClose={onClose} durationMs={1000} />,
    );
    act(() => {
      vi.advanceTimersByTime(600);
    });
    rerender(
      <DynamicIsland open title="Club quitté" onClose={onClose} durationMs={1000} />,
    );
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('annule le minuteur au démontage', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { unmount } = render(<DynamicIsland open title="Publié" onClose={onClose} />);
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('n’utilise que des jetons dans sa CSS (aucun hex, aucune courbe littérale)', () => {
    expect(DYNAMIC_ISLAND_CSS).toContain('--cv2-island-bg');
    expect(DYNAMIC_ISLAND_CSS).toContain('--cv2-z-island');
    expect(DYNAMIC_ISLAND_CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(DYNAMIC_ISLAND_CSS).not.toContain('cubic-bezier(');
  });
});
