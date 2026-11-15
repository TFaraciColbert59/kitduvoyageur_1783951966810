// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LeaderboardTable } from '../LeaderboardTable';
import { ENTRIES } from './fixtures';

afterEach(cleanup);

describe('LeaderboardTable', () => {
  it('affiche rangs, égalités, titres et la ligne du spectateur', () => {
    render(<LeaderboardTable entries={ENTRIES} viewerEntry={ENTRIES[0]} sport="cycling" />);

    expect(screen.getByRole('columnheader', { name: 'Rang' })).toBeTruthy();
    expect(screen.getByText('Camille Martin')).toBeTruthy();
    expect(screen.getByText('Nils Bernard')).toBeTruthy();
    expect(screen.getByText('QOM')).toBeTruthy();
    expect(screen.getByText('KOM')).toBeTruthy();
    expect(screen.getByText('Vous')).toBeTruthy();
    expect(screen.getAllByText('4:00', { selector: '.lkb-time' }).length).toBe(2);
    expect(screen.getAllByLabelText('ex æquo').length).toBeGreaterThan(0);
  });

  it('rappelle la position du spectateur hors de la page courante', () => {
    render(
      <LeaderboardTable entries={ENTRIES.slice(1)} viewerEntry={ENTRIES[0]} sport="cycling" />
    );

    expect(screen.getByLabelText('Votre position au classement')).toBeTruthy();
    expect(screen.getByText('#1')).toBeTruthy();
  });

  it('rend un état vide explicite', () => {
    render(<LeaderboardTable entries={[]} sport="cycling" />);
    expect(screen.getByText('Aucun passage classé pour ces filtres.')).toBeTruthy();
  });
});
