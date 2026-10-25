// @vitest-environment jsdom

/* Lot Q, 5.2 — ce qu'un `title` seul porte (info-bulle) est doublé en texte pour le clavier et le lecteur d'écran. */

import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/compas',
}));
vi.mock('../server/compasActions', () => ({ compasCreateTripAction: vi.fn() }));

import { CompasStart } from '../components/CompasStart';
import { ACTIVITY_META } from '../components/CompasOuFlows';

afterEach(cleanup);

const described = (el: HTMLElement): string =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .trim();

describe('CompasStart : les info-bulles sont aussi dites', () => {
  it('les étapes grisées disent pourquoi elles le sont', () => {
    render(<CompasStart signedIn />);
    const nav = screen.getByRole('navigation', { name: 'Étapes du Compas' });
    const locked = within(nav)
      .getAllByRole('button')
      .filter((b) => (b as HTMLButtonElement).disabled);
    expect(locked.length).toBeGreaterThan(0);
    for (const b of locked) expect(described(b)).toBe('Disponible dès le premier choix');
  });

  it('chaque activité proposée a sa description lue avec elle (aria-describedby)', () => {
    render(<CompasStart signedIn />);
    fireEventOpenDetails();
    const group = screen.getByRole('group', { name: 'Activité' });
    const tiles = within(group)
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-pressed'));
    expect(tiles.length).toBeGreaterThan(2);
    for (const tile of tiles) {
      const hint = Object.values(ACTIVITY_META).find((m) => m.hint === described(tile))?.hint;
      expect(hint).toBeTruthy();
    }
  });
});

/** `<details>` ne s'ouvre pas seul en jsdom : on l'ouvre pour atteindre les tuiles « Préciser ». */
function fireEventOpenDetails() {
  for (const d of document.querySelectorAll('details')) d.setAttribute('open', '');
}
