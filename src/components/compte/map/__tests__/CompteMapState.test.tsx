// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompteMapState } from '../CompteMapState';

describe('CompteMapState', () => {
  it('invité : CTA connexion', () => {
    render(<CompteMapState kind="guest" />);
    expect(screen.getByText('Connecte-toi pour voir ta carte.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Se connecter' }).getAttribute('href')).toBe(
      '/connexion?redirect=/compte'
    );
  });

  it('vide : un seul message et un CTA', () => {
    render(<CompteMapState kind="empty" />);
    expect(screen.getByText('Ta carte se dessine à ta première sortie.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Enregistrer une sortie' }).getAttribute('href')).toBe(
      '/compas'
    );
  });

  it('sorties sans GPS : compte et action', () => {
    render(<CompteMapState kind="no-tracks" count={4} onOpenOutings={vi.fn()} />);
    expect(screen.getByText('4 sortie(s) enregistrée(s), aucune trace GPS.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Voir mes sorties' })).toBeTruthy();
  });

  it('erreur : bouton réessayer', () => {
    const onRetry = vi.fn();
    render(<CompteMapState kind="error" onRetry={onRetry} />);
    screen.getByRole('button', { name: 'Réessayer' }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('neutre : titre et explication fournis', () => {
    render(
      <CompteMapState kind="neutral" title="Les prêts n’ont pas de position." hint="Explication." />
    );
    expect(screen.getByText('Les prêts n’ont pas de position.')).toBeTruthy();
    expect(screen.getByText('Explication.')).toBeTruthy();
  });
});
