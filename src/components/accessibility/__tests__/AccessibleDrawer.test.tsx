// @vitest-environment jsdom
import React, { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { getSharedAnnouncer } from '@/features/accessibility';
import { AccessibleDrawer } from '../AccessibleDrawer';

afterEach(() => {
  cleanup();
  getSharedAnnouncer().destroy();
});

interface HarnessProps {
  modal?: boolean;
  announceOnOpen?: boolean;
  onEscape?: () => void;
  withCustomInitialFocus?: boolean;
}

function Harness({
  modal = true,
  announceOnOpen = true,
  onEscape,
  withCustomInitialFocus = false,
}: HarnessProps) {
  const [open, setOpen] = useState(false);
  const actionBRef = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Ouvrir la couverture
      </button>
      <AccessibleDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Couverture géographique"
        description="Choisissez la région gratuite ou le Pack Monde."
        modal={modal}
        announceOnOpen={announceOnOpen}
        onEscape={onEscape}
        initialFocusRef={withCustomInitialFocus ? actionBRef : undefined}
      >
        <button type="button">Action A</button>
        <button ref={actionBRef} type="button">
          Action B
        </button>
      </AccessibleDrawer>
    </>
  );
}

describe('AccessibleDrawer — dialogue, piège de focus et restauration', () => {
  it('rend un dialogue nommé, décrit, et focalise le bouton Fermer', () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Ouvrir la couverture' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Couverture géographique' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('Choisissez la région gratuite ou le Pack Monde.')).toBeTruthy();

    const close = screen.getByRole('button', { name: 'Fermer Couverture géographique' });
    expect(document.activeElement).toBe(close);
  });

  it('boucle Tab et Maj+Tab sans jamais sortir du panneau', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la couverture' }));

    const close = screen.getByRole('button', { name: 'Fermer Couverture géographique' });
    const actionA = screen.getByRole('button', { name: 'Action A' });
    const actionB = screen.getByRole('button', { name: 'Action B' });

    actionB.focus();
    fireEvent.keyDown(actionB, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(actionB);

    actionA.focus();
    expect(document.activeElement).toBe(actionA);
  });

  it('ferme sur Échap et rend le focus au déclencheur', async () => {
    const onEscape = vi.fn();
    render(<Harness onEscape={onEscape} />);
    const opener = screen.getByRole('button', { name: 'Ouvrir la couverture' });
    opener.focus();
    fireEvent.click(opener);

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Couverture géographique' }), {
      key: 'Escape',
    });

    expect(onEscape).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(opener);
    });
  });

  it('ferme au clic sur le fond sans fermer au clic dans le panneau', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la couverture' }));

    fireEvent.click(screen.getByRole('dialog', { name: 'Couverture géographique' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByTestId('accessible-drawer-scrim'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('annonce l’ouverture et applique une cible de focus personnalisée', () => {
    render(<Harness withCustomInitialFocus />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la couverture' }));

    expect(screen.getByRole('button', { name: 'Action B' })).toBe(document.activeElement);
    expect(
      Array.from(document.querySelectorAll('[data-lkdv-live-region="polite"]')).some(
        (region) => region.textContent === 'Panneau Couverture géographique ouvert',
      ),
    ).toBe(true);
  });

  it('ne produit aucune violation WCAG A/AA détectable par axe-core', async () => {
    render(<Harness announceOnOpen={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la couverture' }));

    const result = await axe.run(document.body, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
        'landmark-one-main': { enabled: false },
        'page-has-heading-one': { enabled: false },
      },
    });

    expect(
      result.violations.map(
        (violation) =>
          `${violation.id} : ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`,
      ),
    ).toEqual([]);
  });

  it('ne pose ni aria-modal ni piège de focus en mode non modal', () => {
    render(<Harness modal={false} announceOnOpen={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la couverture' }));

    const dialog = screen.getByRole('dialog', { name: 'Couverture géographique' });
    expect(dialog.getAttribute('aria-modal')).toBeNull();

    const actionA = screen.getByRole('button', { name: 'Action A' });
    actionA.focus();
    expect(document.activeElement).toBe(actionA);
  });
});
