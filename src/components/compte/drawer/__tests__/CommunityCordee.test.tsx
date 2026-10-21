// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CommunitySlot } from '../slots/CommunitySlot';

afterEach(cleanup);

const companion = {
  id: 'u2',
  n: 'Léa',
  ps: 'lea',
  i: 'L',
  outings: 2,
  massif: 'Néouvielle',
  avatar: null,
};

describe('Communauté — cordée', () => {
  it('affiche les compagnons réels', () => {
    render(
      <CommunitySlot
        lens="cordee"
        companions={[companion]}
        followers={[{ id: 'f1', n: 'Marc', ps: 'marc' }]}
        following={[{ id: 'f2', n: 'Ana', ps: 'ana' }]}
      />
    );

    expect(screen.getByText('2 sorties communes')).toBeTruthy();
    expect(screen.getByText('Léa')).toBeTruthy();
    expect(screen.getByText('@lea')).toBeTruthy();
    expect(screen.getByText(/Dernier massif/)).toBeTruthy();
    expect(screen.getByText(/Néouvielle/)).toBeTruthy();

    expect(screen.getByText('Abonnés')).toBeTruthy();
    expect(screen.getByText('Abonnements')).toBeTruthy();
    expect(screen.getByTestId('cordee-followers-count').textContent).toBe('1');
    expect(screen.getByTestId('cordee-following-count').textContent).toBe('1');
    expect(screen.getByText('Cordée de confiance')).toBeTruthy();
  });

  it('lit aussi le payload du bootstrap et accepte les alias massif/mass', () => {
    render(
      <CommunitySlot
        lens="cordee"
        payload={{
          companions: [
            { id: 'u3', n: 'Nino', ps: 'nino', outings: 1, mass: 'Vercors', avatar: null },
          ],
          followers: [],
          following: [],
        }}
      />
    );

    expect(screen.getByText('1 sortie commune')).toBeTruthy();
    expect(screen.getByText('@nino')).toBeTruthy();
    expect(screen.getByText(/Vercors/)).toBeTruthy();
  });

  it('affiche un état vide sans sortie partagée', () => {
    render(<CommunitySlot lens="cordee" companions={[]} followers={[]} following={[]} />);

    expect(screen.getByText('Aucune sortie partagée.')).toBeTruthy();
    expect(screen.getByTestId('slot-content').getAttribute('data-state')).toBe('empty');
  });

  it("n'affiche pas de handle inventé quand il manque", () => {
    render(
      <CommunitySlot
        lens="cordee"
        companions={[{ id: 'u4', n: 'Anonyme', ps: null, outings: 3, massif: '' }]}
        followers={[]}
        following={[]}
      />
    );

    expect(screen.getByText('Anonyme')).toBeTruthy();
    expect(screen.getByText('3 sorties communes')).toBeTruthy();
    expect(screen.queryByText(/^@/)).toBeNull();
  });
});
