// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SORT_MENU_CSS, SortMenuButton } from '../SortMenuButton';

afterEach(cleanup);

const options = [
  { value: 'recent', label: 'Récents' },
  { value: 'popular', label: 'Populaires' },
  { value: 'near', label: 'Proches' },
  { value: 'duration', label: 'Durée' },
];

function renderSort(props: Partial<React.ComponentProps<typeof SortMenuButton>> = {}) {
  const onChange = vi.fn();
  render(
    <SortMenuButton
      value="recent"
      defaultValue="recent"
      options={options}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
}

describe('SortMenuButton', () => {
  it('rend un bouton 30 px nommé « Trier » avec aria-haspopup et sans menu au repos', () => {
    renderSort();
    const button = screen.getByRole('button', { name: 'Trier' });
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBeNull();
    expect(button.getAttribute('data-modified')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('signale un tri différent du tri par défaut par un point vert', () => {
    const { rerender } = render(
      <SortMenuButton
        value="recent"
        defaultValue="recent"
        options={options}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Trier' }).getAttribute('data-modified')).toBe(
      'false',
    );
    rerender(
      <SortMenuButton
        value="popular"
        defaultValue="recent"
        options={options}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Trier' }).getAttribute('data-modified')).toBe(
      'true',
    );
  });

  it('ouvre un menu role=menu avec des options menuitemradio et coche le tri actif', async () => {
    renderSort({ value: 'popular' });
    const button = screen.getByRole('button', { name: 'Trier' });
    fireEvent.click(button);

    const menu = screen.getByRole('menu', { name: 'Trier' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe(menu.id);

    const items = within(menu).getAllByRole('menuitemradio');
    expect(items).toHaveLength(options.length);
    expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
    // Le focus part sur l'option cochée.
    await waitFor(() => expect(document.activeElement).toBe(items[1]));
  });

  it('sélectionne une option, remonte le choix et rend le focus au bouton', async () => {
    const { onChange } = renderSort();
    fireEvent.click(screen.getByRole('button', { name: 'Trier' }));
    const items = screen.getAllByRole('menuitemradio');
    fireEvent.click(items[2]);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('near');
    expect(screen.queryByRole('menu')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Trier' })),
    );
  });

  it('ne rappelle pas onChange quand on choisit le tri déjà actif', () => {
    const { onChange } = renderSort();
    fireEvent.click(screen.getByRole('button', { name: 'Trier' }));
    fireEvent.click(screen.getAllByRole('menuitemradio')[0]);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('ouvre au clavier et circule avec ↑ ↓ Home End', async () => {
    renderSort();
    const button = screen.getByRole('button', { name: 'Trier' });
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitemradio');
    await waitFor(() => expect(document.activeElement).toBe(items[0]));

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    await waitFor(() => expect(document.activeElement).toBe(items[1]));
    fireEvent.keyDown(menu, { key: 'End' });
    await waitFor(() => expect(document.activeElement).toBe(items[3]));
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    // Bouclage.
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    await waitFor(() => expect(document.activeElement).toBe(items[3]));
    fireEvent.keyDown(menu, { key: 'Home' });
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
  });

  it('ferme sur Échap sans propager l’événement au tiroir et rend le focus', async () => {
    const onDrawerKeyDown = vi.fn();
    render(
      <div onKeyDown={onDrawerKeyDown}>
        <SortMenuButton
          value="recent"
          defaultValue="recent"
          options={options}
          onChange={() => {}}
        />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Trier' }));
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(onDrawerKeyDown).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Trier' })),
    );
  });

  it('ferme sur Tab et rend le focus au bouton', async () => {
    renderSort();
    fireEvent.click(screen.getByRole('button', { name: 'Trier' }));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' });
    expect(screen.queryByRole('menu')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Trier' })),
    );
  });

  it('ferme au clic extérieur', () => {
    render(
      <div>
        <button type="button">Ailleurs</button>
        <SortMenuButton
          value="recent"
          defaultValue="recent"
          options={options}
          onChange={() => {}}
        />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Trier' }));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ailleurs' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('ne s’ouvre pas quand il est désactivé', () => {
    renderSort({ disabled: true });
    const button = screen.getByRole('button', { name: 'Trier' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('expose la CSS du menu et la place réservée à la mini-capsule', () => {
    expect(SORT_MENU_CSS).toContain('.lkdv-sort-menu');
    expect(SORT_MENU_CSS).toContain('has-sort');
    expect(SORT_MENU_CSS).toContain('right:46px');
    expect(SORT_MENU_CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(SORT_MENU_CSS).not.toContain('cubic-bezier(');
  });
});
