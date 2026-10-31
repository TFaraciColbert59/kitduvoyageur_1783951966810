// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DRAWER_SHELL_CSS,
  DrawerEmpty,
  DrawerShell,
  type DrawerTab,
} from '../DrawerShell';

afterEach(cleanup);

const tabs: DrawerTab[] = [
  { id: 'a', label: 'A', icon: <span>A</span>, render: () => <p>Contenu A</p> },
  { id: 'b', label: 'B', icon: <span>B</span>, render: () => <p>Contenu B</p> },
];

const filterItems = [
  { id: 'all', label: 'Tout', icon: <span>1</span> },
  { id: 'friends', label: 'Amis', icon: <span>2</span> },
  { id: 'close', label: 'Proches', icon: <span>3</span> },
];

describe('DrawerShell', () => {
  it('rend la capsule haute, marque l’onglet actif et change d’onglet', () => {
    const onIndexChange = vi.fn();

    render(
      <DrawerShell tabs={tabs} activeIndex={0} onIndexChange={onIndexChange}>
        <p>Enfant</p>
      </DrawerShell>
    );

    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeTruthy();

    const tabA = screen.getByRole('tab', { name: 'A' });
    const tabB = screen.getByRole('tab', { name: 'B' });

    expect(tabA.getAttribute('aria-selected')).toBe('true');
    expect(tabB.getAttribute('aria-selected')).toBe('false');
    // roving tabIndex : un seul onglet dans l'ordre de tabulation
    expect(tabA.getAttribute('tabindex')).toBe('0');
    expect(tabB.getAttribute('tabindex')).toBe('-1');

    fireEvent.click(tabB);

    expect(onIndexChange).toHaveBeenCalledTimes(1);
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('n’affiche aucune capsule secondaire par défaut', () => {
    render(
      <DrawerShell tabs={tabs} activeIndex={0} onIndexChange={() => {}}>
        <p>Enfant</p>
      </DrawerShell>
    );

    expect(document.querySelector('.ig-tabs-float')).toBeNull();
  });

  it('n’affiche pas de capsule secondaire pour un seul item', () => {
    render(
      <DrawerShell
        tabs={tabs}
        activeIndex={0}
        onIndexChange={() => {}}
        secondary={{ items: [filterItems[0]], active: 0, onChange: () => {} }}
      >
        <p>Enfant</p>
      </DrawerShell>
    );

    expect(document.querySelector('.ig-tabs-float')).toBeNull();
  });

  it('affiche la capsule secondaire, marque son item actif et propage le choix', () => {
    const onChange = vi.fn();

    render(
      <DrawerShell
        tabs={tabs}
        activeIndex={0}
        onIndexChange={() => {}}
        secondary={{ items: filterItems, active: 1, onChange }}
      >
        <p>Enfant</p>
      </DrawerShell>
    );

    expect(document.querySelector('.ig-tabs-float.lkdv-drawer-secondary')).toBeTruthy();

    const filters = screen.getByRole('tablist', { name: 'Filtres' });
    const items = within(filters).getAllByRole('tab');

    expect(items).toHaveLength(3);
    expect(items[0].getAttribute('aria-selected')).toBe('false');
    expect(items[1].getAttribute('aria-selected')).toBe('true');
    expect(items[2].getAttribute('aria-selected')).toBe('false');

    fireEvent.click(items[2]);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('ne rend que le panneau actif et le rend inerte sinon', () => {
    render(
      <DrawerShell tabs={tabs} activeIndex={0} onIndexChange={() => {}}>
        <p>Enfant</p>
      </DrawerShell>
    );

    const panels = document.querySelectorAll('[role="tabpanel"]');
    expect(panels).toHaveLength(2);
    expect(panels[0].hasAttribute('inert')).toBe(false);
    expect(panels[0].getAttribute('aria-hidden')).toBe('false');
    expect(panels[1].hasAttribute('inert')).toBe(true);
    expect(panels[1].getAttribute('aria-hidden')).toBe('true');

    expect(screen.getByText('Contenu A')).toBeTruthy();
    expect(screen.queryByText('Contenu B')).toBeNull();
    expect(screen.getByText('Enfant')).toBeTruthy();
  });

  it('affiche le squelette pendant le chargement', () => {
    render(
      <DrawerShell tabs={tabs} activeIndex={0} onIndexChange={() => {}} state="loading">
        <p>Enfant</p>
      </DrawerShell>
    );

    const skeleton = document.querySelector('.lkdv-drawer-skeleton[data-state="loading"]');
    expect(skeleton).toBeTruthy();
    expect(skeleton?.getAttribute('aria-busy')).toBe('true');
    expect(document.querySelector('[role="tabpanel"]')).toBeNull();
    expect(screen.queryByText('Contenu A')).toBeNull();
    expect(screen.queryByText('Enfant')).toBeNull();
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeTruthy();
  });

  it('affiche l’erreur et rappelle onRetry', () => {
    const onRetry = vi.fn();

    render(
      <DrawerShell
        tabs={tabs}
        activeIndex={0}
        onIndexChange={() => {}}
        state="error"
        onRetry={onRetry}
      >
        <p>Enfant</p>
      </DrawerShell>
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Impossible de charger ce contenu/)).toBeTruthy();

    const retry = screen.getByRole('button', { name: 'Réessayer' });
    fireEvent.click(retry);

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Enfant')).toBeNull();
  });

  it('affiche le contenu quand l’état est prêt', () => {
    render(
      <DrawerShell tabs={tabs} activeIndex={0} onIndexChange={() => {}} state="ready">
        <p>Enfant</p>
      </DrawerShell>
    );

    expect(screen.getByText('Contenu A')).toBeTruthy();
    expect(screen.getByText('Enfant')).toBeTruthy();
    expect(document.querySelector('.lkdv-drawer-skeleton')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('fixe la géométrie de la capsule (48 px, lentille `--i`) et de la secondaire (30 px, 10 px des bords)', () => {
    // La capsule haute reprend la forme du drawer Profil : `.segc.lg-tabs` 48 px,
    // padding 2 px, lentille pilotée par `--i` sur la largeur `--n`.
    expect(DRAWER_SHELL_CSS).toMatch(/\.lkdv-drawer-tabs\{[^}]*height:48px/);
    expect(DRAWER_SHELL_CSS).toMatch(/\.lkdv-drawer-tabs\{[^}]*padding:2px/);
    expect(DRAWER_SHELL_CSS).toMatch(
      /\.lkdv-drawer-tabs \.sel-lens\{[^}]*top:4px/
    );
    expect(DRAWER_SHELL_CSS).toMatch(
      /\.lkdv-drawer-tabs \.sel-lens\{[^}]*translateX\(calc\(var\(--i,0\)\*100%\)\)/
    );
    expect(DRAWER_SHELL_CSS).toMatch(
      /\.lkdv-drawer-tabs \.sel-lens\{[^}]*width:calc\(\(100% - 6px\)\/var\(--n,2\)\)/
    );

    // Capsule secondaire : 30 px, à 10 px des bords, largeur indexée sur `--n`
    // pour garder des cibles d'au moins 44 px.
    expect(DRAWER_SHELL_CSS).toMatch(/\.lkdv-drawer-shell\{[^}]*position:relative/);
    expect(DRAWER_SHELL_CSS).toMatch(
      /\.lkdv-drawer-secondary\{[^}]*right:10px[^}]*bottom:10px/
    );
    expect(DRAWER_SHELL_CSS).toMatch(
      /\.lkdv-drawer-secondary \.ig-tabs\{[^}]*height:30px/
    );
    expect(DRAWER_SHELL_CSS).toMatch(
      /\.lkdv-drawer-secondary \.ig-tabs\{[^}]*width:calc\(var\(--n,2\)\*44px \+ 5px\)/
    );
  });
});

describe('DrawerEmpty', () => {
  it('affiche le titre, l’indice et l’action', () => {
    const onAction = vi.fn();

    render(
      <DrawerEmpty
        title="Aucun abonné"
        hint="Invite tes proches pour commencer."
        action={
          <button type="button" onClick={onAction}>
            Inviter
          </button>
        }
      />
    );

    expect(screen.getByText('Aucun abonné')).toBeTruthy();
    expect(screen.getByText('Invite tes proches pour commencer.')).toBeTruthy();
    expect(document.querySelector('[data-state="empty"]')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Inviter' }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
