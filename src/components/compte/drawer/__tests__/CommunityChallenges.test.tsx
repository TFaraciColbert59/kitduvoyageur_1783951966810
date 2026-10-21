// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CommunitySlot } from '../slots/CommunitySlot';

afterEach(cleanup);

const activeChallenge = {
  id: 'c1',
  title: 'Kit parfait',
  category: 'Équipement',
  difficulty: 'Moyen',
  xp: 300,
  progress: 2,
  target: 5,
  deadline: '2026-10-30',
};

describe('Communauté — défis', () => {
  it('affiche les défis réels', () => {
    render(<CommunitySlot lens="challenges" challenges={[activeChallenge]} />);

    expect(screen.getByText('Kit parfait')).toBeTruthy();
    expect(screen.getByText('Équipement')).toBeTruthy();
    expect(screen.getByText('Moyen')).toBeTruthy();
    expect(screen.getByText(/300 XP/)).toBeTruthy();
    expect(screen.getByText('2 / 5')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: /Progression : Kit parfait/ })).toBeTruthy();
    expect(screen.getByText(/Échéance/)).toBeTruthy();
  });

  it('lit aussi le payload du bootstrap', () => {
    render(
      <CommunitySlot
        lens="challenges"
        payload={{ challenges: [{ ...activeChallenge, id: 'c2', title: 'Bivouac léger' }] }}
      />
    );

    expect(screen.getByText('Bivouac léger')).toBeTruthy();
    expect(screen.getByText('2 / 5')).toBeTruthy();
  });

  it('replie les défis terminés et ne montre que les actifs', () => {
    render(
      <CommunitySlot
        lens="challenges"
        challenges={[
          activeChallenge,
          {
            id: 'c3',
            title: 'Sommet atteint',
            category: 'Montagne',
            difficulty: 'Difficile',
            xp: 500,
            progress: 5,
            target: 5,
            completed: true,
          },
          {
            id: 'c4',
            title: 'Défi archivé',
            category: 'Équipement',
            difficulty: 'Facile',
            xp: 100,
            progress: 1,
            target: 2,
            active: false,
          },
        ]}
      />
    );

    expect(screen.queryByText('Sommet atteint')).toBeNull();
    expect(screen.queryByText('Défi archivé')).toBeNull();

    const toggle = screen.getByRole('button', { name: /Terminés/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Sommet atteint')).toBeTruthy();
  });

  it('affiche un état vide sans défi', () => {
    render(<CommunitySlot lens="challenges" challenges={[]} />);

    expect(screen.getByText('Aucun défi en cours.')).toBeTruthy();
    expect(screen.getByTestId('slot-content').getAttribute('data-state')).toBe('empty');
  });

  it("n'invente pas de cible absente", () => {
    render(
      <CommunitySlot
        lens="challenges"
        challenges={[{ id: 'c5', title: 'Sans cible', progress: 2, target: null }]}
      />
    );

    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByText('2 / 0')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
