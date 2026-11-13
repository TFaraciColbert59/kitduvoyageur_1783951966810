// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActivityAudioControl } from '../ActivityAudioControl';

afterEach(cleanup);

describe('ActivityAudioControl — sous-drawer audio', () => {
  it('ouvre un panneau explicite et annonce l’indisponibilité', () => {
    render(<ActivityAudioControl />);

    fireEvent.click(screen.getByRole('button', { name: /contrôle audio/i }));

    expect(screen.getByRole('dialog', { name: /Spotify|Aucun fournisseur/i })).toBeTruthy();
    expect(screen.getByText(/Contrôle audio indisponible/)).toBeTruthy();
    expect(screen.getByText(/L’enregistrement GPS et la trace continuent/)).toBeTruthy();
  });

  it('laisse les commandes de lecture inertes sans adaptateur', () => {
    render(<ActivityAudioControl />);
    fireEvent.click(screen.getByRole('button', { name: /contrôle audio/i }));

    for (const label of [/Piste précédente/, /Lecture ou pause/, /Mettre en pause/, /Piste suivante/]) {
      const button = screen.getByRole('button', { name: label }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    }
  });

  it('se ferme par le bouton et rend le focus au déclencheur', () => {
    render(<ActivityAudioControl />);
    const trigger = screen.getByRole('button', { name: /contrôle audio/i });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: /Fermer le contrôle audio/i }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('se ferme avec Échap sans toucher à la sortie', () => {
    render(<ActivityAudioControl />);
    fireEvent.click(screen.getByRole('button', { name: /contrôle audio/i }));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
