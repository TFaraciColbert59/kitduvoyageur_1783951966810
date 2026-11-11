// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { CompteMapState } from '../CompteMapState';

afterEach(() => cleanup());

describe('CompteMapState — action de l’état vide', () => {
  it('rend l’action proposée sous le message', () => {
    render(
      <CompteMapState
        kind="neutral"
        title="Aucun tracé enregistré pour ce carnet."
        hint="L’auteur n’a pas joint de trace GPS à ce carnet."
        action={<button type="button">Rechercher une randonnée</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Rechercher une randonnée' })).toBeTruthy();
  });

  it('garde le CTA par défaut des états du compte', () => {
    render(<CompteMapState kind="guest" />);
    expect(screen.getByRole('link', { name: /Se connecter/i })).toBeTruthy();
  });
});
