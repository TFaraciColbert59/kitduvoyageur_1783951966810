// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PeekOverlay, type PeekItem } from '../details/PeekOverlay';

afterEach(cleanup);

function peek(overrides: Partial<PeekItem> = {}): PeekItem {
  return {
    kind: 'carnet',
    title: 'Tour des Écrins',
    subtitle: 'Hauts-Alpes · 4 j · 62,4 km',
    initials: 'CR',
    actions: [
      { label: 'Lire', icon: 'book', primary: true, onSelect: vi.fn() },
      { label: 'Enregistrer', icon: 'bookmark', onSelect: vi.fn() },
      { label: 'Partager', icon: 'send', onSelect: vi.fn() },
    ],
    ...overrides,
  };
}

describe('PeekOverlay', () => {
  it('affiche l’aperçu et ses actions, focus sur la première', () => {
    render(<PeekOverlay peek={peek()} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Aperçu : Tour des Écrins' });
    expect(dialog.textContent).toContain('Hauts-Alpes · 4 j · 62,4 km');
    expect(screen.getByRole('button', { name: 'Lire' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeTruthy();
  });

  it('exécute l’action puis ferme l’aperçu', () => {
    const onClose = vi.fn();
    const item = peek();
    render(<PeekOverlay peek={item} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(item.actions[1]?.onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('le fond et le bouton Fermer ferment sans action', () => {
    const onClose = vi.fn();
    render(<PeekOverlay peek={peek()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer l’aperçu' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('rend un billet daté pour une sortie et un blason pour un club', () => {
    const { rerender } = render(
      <PeekOverlay
        peek={peek({ kind: 'sortie', title: 'Footing', dateIso: '2026-11-14T08:00:00+01:00' })}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('dialog').textContent).toContain('14');
    rerender(<PeekOverlay peek={peek({ kind: 'club', title: 'La Cordée' })} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Aperçu : La Cordée' })).toBeTruthy();
  });

  it('ne rend rien sans aperçu', () => {
    const { container } = render(<PeekOverlay peek={null} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
