// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TurnByTurnBanner } from '../TurnByTurnBanner';
import { makeTurnState } from './fixtures';

afterEach(cleanup);

describe('TurnByTurnBanner (K4.02 / S3.11)', () => {
  it('affiche l’instruction, la distance et la manœuvre secondaire', () => {
    render(<TurnByTurnBanner state={makeTurnState()} />);

    expect(screen.getByText('Tourner à gauche')).toBeTruthy();
    expect(screen.getByLabelText('Distance avant la manœuvre : 280 m')).toBeTruthy();
    expect(screen.getByText(/Puis arrivée à destination dans 680 m/)).toBeTruthy();
    expect(screen.getByText('Bientôt')).toBeTruthy();
    expect(screen.getByText('Hors ligne')).toBeTruthy();
  });

  it('passe en annonce immédiate et expose la progression accessible', () => {
    render(
      <TurnByTurnBanner
        state={makeTurnState({
          stage: 'imminent',
          distanceToNextM: 12,
          formattedDistanceToNext: '12 m',
          spokenInstruction: 'Tourner à gauche maintenant.',
        })}
      />,
    );

    expect(screen.getByText('Maintenant')).toBeTruthy();
    const progress = screen.getByRole('progressbar', {
      name: 'Progression sur le parcours',
    });
    expect(progress.getAttribute('aria-valuenow')).toBe('15');
  });

  it('alerte en cas de contresens', () => {
    render(<TurnByTurnBanner state={makeTurnState({ reverseDirection: true })} />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Sens inverse détecté');
    expect(screen.getByText('Sens inverse détecté : faites demi-tour pour reprendre le parcours.')).toBeTruthy();
  });

  it('retire la ligne secondaire quand demandé', () => {
    render(<TurnByTurnBanner state={makeTurnState()} showSecondary={false} />);

    expect(screen.queryByText(/Puis arrivée à destination/)).toBeNull();
  });

  it('affiche un état vide sans parcours', () => {
    render(
      <TurnByTurnBanner
        state={makeTurnState({
          maneuvers: [],
          nextManeuver: null,
          secondaryManeuver: null,
          progress: null,
        })}
      />,
    );

    expect(screen.getByText('Aucun guidage actif')).toBeTruthy();
    expect(screen.getByText(/Choisissez un parcours/)).toBeTruthy();
  });

  it('rend le glyphe de manœuvre décoratif et le texte complet pour les lecteurs d’écran', () => {
    const { container } = render(<TurnByTurnBanner state={makeTurnState()} />);

    expect(container.querySelectorAll('svg[aria-hidden="true"]').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Tourner à gauche\. Distance restante 280 m\. Puis arrivée à destination\./),
    ).toBeTruthy();
  });
});
