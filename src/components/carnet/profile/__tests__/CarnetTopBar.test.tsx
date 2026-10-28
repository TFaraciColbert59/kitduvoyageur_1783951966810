// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/community/feed/useAccountUnreadCount', () => ({
  useAccountUnreadCount: () => 3,
}));

import { CarnetTopBar } from '../CarnetTopBar';

afterEach(() => cleanup());

const noop = () => {};

describe('CarnetTopBar — barre de la fiche', () => {
  it('rend la pilule avec chevron, créer, notifications puis ··· en dernier', () => {
    render(<CarnetTopBar title="Tour du Mont-Blanc" onOpenCarnet={noop} onOpenMenu={noop} />);
    const pill = screen.getByRole('button', { name: 'Carnet Tour du Mont-Blanc' });
    expect(pill.className).toContain('ckp-title-pill');
    expect(pill.querySelector('.ckp-title-chevron')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Créer' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Notifications, 3/ })).toBeTruthy();
    const actions = screen.getByRole('button', { name: 'Créer' }).parentElement;
    expect(actions?.querySelectorAll('.gbtn').length).toBe(3);
    /* La loupe a laissé sa place au `···` : plus aucun bouton de recherche. */
    expect(screen.queryByRole('button', { name: /Rechercher/ })).toBeNull();
    const labels = [...(actions?.querySelectorAll('.gbtn') ?? [])].map((node) =>
      node.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['Créer', 'Notifications, 3 non lues', 'Plus d’options']);
  });

  it('ancre le menu ··· dans la barre, en dernière position', () => {
    const onOpenMenu = vi.fn();
    render(
      <CarnetTopBar
        title="Tour"
        onOpenCarnet={noop}
        onOpenMenu={onOpenMenu}
        menuOpen
        menu={<div className="pmi-options-menu">menu</div>}
      />,
    );
    const more = screen.getByRole('button', { name: 'Plus d’options' });
    expect(more.closest('.ckp-top-actions')).toBeTruthy();
    expect(more.closest('.ckp-more-anchor')).toBeTruthy();
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(more.querySelector('svg')).toBeTruthy();
    expect(document.querySelector('.ckp-more-anchor .pmi-options-menu')).toBeTruthy();
    fireEvent.click(more);
    expect(onOpenMenu).toHaveBeenCalledOnce();
  });

  it('n’affiche aucun menu sans ancre', () => {
    render(<CarnetTopBar title="Tour" onOpenCarnet={noop} menu={<div className="pmi-options-menu" />} />);
    expect(screen.queryByRole('button', { name: 'Plus d’options' })).toBeNull();
    expect(document.querySelector('.pmi-options-menu')).toBeNull();
  });

  it('ouvre le drawer Carnet au clic sur la pilule', () => {
    const onOpenCarnet = vi.fn();
    render(<CarnetTopBar title="Tour" onOpenCarnet={onOpenCarnet}  />);
    fireEvent.click(screen.getByRole('button', { name: 'Carnet Tour' }));
    expect(onOpenCarnet).toHaveBeenCalledOnce();
  });
});
