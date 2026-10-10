// @vitest-environment jsdom

/* Lot Q, 5.2 — focus des tiroirs : piégé dedans, rendu au déclencheur. */

import { afterEach, describe, expect, it, vi } from 'vitest';
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CompasSheet, type Detent } from '../components/CompasSheet';

afterEach(cleanup);

/** Un déclencheur qui ouvre un tiroir ; `nested` ajoute un second tiroir par-dessus (clé qui change, comme l'écran). */
function Host({ nested = false }: { nested?: boolean }) {
  const [depth, setDepth] = useState(0);
  const [detent, setDetent] = useState<Detent>('medium');
  return (
    <div>
      <button type="button" onClick={() => setDepth(1)}>
        Ouvrir
      </button>
      <button type="button">Autre bouton de la page</button>
      {depth > 0 && (
        <CompasSheet
          key={depth}
          title={depth === 1 ? 'Premier' : 'Second'}
          detent={detent}
          onDetent={setDetent}
          onClose={() => setDepth(0)}
          onBack={depth > 1 ? () => setDepth(depth - 1) : undefined}
        >
          <input aria-label="Un champ" />
          {nested && depth === 1 ? (
            <button type="button" onClick={() => setDepth(2)}>
              Aller plus loin
            </button>
          ) : (
            <button type="button">Dernier bouton</button>
          )}
        </CompasSheet>
      )}
    </div>
  );
}

const open = () => {
  const trigger = screen.getByRole('button', { name: 'Ouvrir' });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
};
const tab = (shift = false) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab', shiftKey: shift });

describe('tiroir — focus piégé', () => {
  it('le focus entre dans le tiroir à l’ouverture', async () => {
    render(<Host />);
    open();
    const dialog = await screen.findByRole('dialog', { name: 'Premier' });
    await waitFor(() => expect(document.activeElement).toBe(dialog));
  });

  it('Tab depuis le dernier élément revient au premier, Maj+Tab depuis le premier va au dernier', async () => {
    render(<Host />);
    open();
    const dialog = await screen.findByRole('dialog', { name: 'Premier' });
    const buttons = within(dialog).getAllByRole('button');
    const first = buttons[0];
    const last = within(dialog).getByRole('button', { name: 'Dernier bouton' });
    expect(buttons[buttons.length - 1]).toBe(last);

    last.focus();
    tab();
    expect(document.activeElement).toBe(first);

    tab(true);
    expect(document.activeElement).toBe(last);
  });

  it('Maj+Tab depuis le tiroir lui-même va au dernier élément', async () => {
    render(<Host />);
    open();
    const dialog = await screen.findByRole('dialog', { name: 'Premier' });
    dialog.focus();
    tab(true);
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Dernier bouton' }));
  });

  it('un focus resté derrière le tiroir y est ramené par Tab', async () => {
    render(<Host />);
    open();
    const dialog = await screen.findByRole('dialog', { name: 'Premier' });
    screen.getByRole('button', { name: 'Autre bouton de la page' }).focus();
    tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('les éléments désactivés ou masqués ne sont pas des arrêts', async () => {
    render(
      <CompasSheet title="Réglages" detent="medium" onDetent={() => {}} onClose={() => {}}>
        <button type="button" disabled>
          Grisé
        </button>
        <button type="button" hidden>
          Caché
        </button>
        <button type="button">Seul utilisable</button>
      </CompasSheet>
    );
    const dialog = await screen.findByRole('dialog', { name: 'Réglages' });
    const only = within(dialog).getByRole('button', { name: 'Seul utilisable' });
    only.focus();
    tab();
    expect(document.activeElement).toBe(within(dialog).getAllByRole('button')[0]);
    tab(true);
    expect(document.activeElement).toBe(only);
  });

  it('un « Annuler » de l’îlot, hors du tiroir, reste atteignable au clavier', async () => {
    render(
      <>
        <CompasSheet title="Réglages" detent="medium" onDetent={() => {}} onClose={() => {}}>
          <button type="button">Dernier</button>
        </CompasSheet>
        <div className="cp-island">
          <button type="button" className="cp-island__btn">
            Annuler
          </button>
        </div>
      </>
    );
    const dialog = await screen.findByRole('dialog', { name: 'Réglages' });
    within(dialog).getByRole('button', { name: 'Dernier' }).focus();
    tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Annuler' }));
    tab();
    expect(document.activeElement).toBe(within(dialog).getAllByRole('button')[0]);
  });
});

describe('tiroir — Échap et retour du focus', () => {
  it('Échap ferme le tiroir', async () => {
    const onClose = vi.fn();
    render(
      <CompasSheet title="Réglages" detent="medium" onDetent={() => {}} onClose={onClose}>
        <button type="button">Un bouton</button>
      </CompasSheet>
    );
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('à la fermeture, le focus revient au déclencheur', async () => {
    render(<Host />);
    const trigger = open();
    await screen.findByRole('dialog', { name: 'Premier' });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('le bouton « Fermer » rend aussi le focus au déclencheur', async () => {
    render(<Host />);
    const trigger = open();
    const dialog = await screen.findByRole('dialog', { name: 'Premier' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fermer' }));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('deux tiroirs empilés : fermer le second puis le premier rend le focus au premier déclencheur', async () => {
    render(<Host nested />);
    const trigger = open();
    const first = await screen.findByRole('dialog', { name: 'Premier' });
    fireEvent.click(within(first).getByRole('button', { name: 'Aller plus loin' }));
    const second = await screen.findByRole('dialog', { name: 'Second' });
    await waitFor(() => expect(document.activeElement).toBe(second));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('un focus déjà posé ailleurs par la page n’est pas volé à la fermeture', async () => {
    render(<Host />);
    open();
    await screen.findByRole('dialog', { name: 'Premier' });
    const other = screen.getByRole('button', { name: 'Autre bouton de la page' });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    other.focus();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await Promise.resolve();
    expect(document.activeElement).toBe(other);
  });
});
