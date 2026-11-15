// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClubLeaderboard } from '../ClubLeaderboard';
import { makeLeaderboard } from './fixtures';

afterEach(() => cleanup());

describe('G02 — classement S5.11', () => {
  it('affiche le podium, le tableau et la ligne du lecteur', () => {
    render(<ClubLeaderboard leaderboard={makeLeaderboard()} sports={['trail', 'route']} />);
    expect(screen.getByRole('table', { name: /classement hebdomadaire/i })).toBeTruthy();
    expect(screen.getAllByText('Alice Martin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('42 km').length).toBeGreaterThan(0);
    expect(document.querySelector('tr[data-current="true"]')?.textContent).toContain('Alice Martin');
  });

  it('signale les exclusions sans révéler les noms', () => {
    render(<ClubLeaderboard leaderboard={makeLeaderboard({ excludedCount: 3 })} />);
    const notice = screen.getByText(/3 membres masqués/i);
    expect(notice).toBeTruthy();
    expect(notice.textContent).not.toMatch(/Bob|Alice/);
  });

  it('change de métrique et de sport', () => {
    const onMetricChange = vi.fn();
    const onSportChange = vi.fn();
    render(
      <ClubLeaderboard
        leaderboard={makeLeaderboard()}
        sports={['trail', 'route']}
        onMetricChange={onMetricChange}
        onSportChange={onSportChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Métrique'), { target: { value: 'duration_s' } });
    expect(onMetricChange).toHaveBeenCalledWith('duration_s');
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: 'trail' } });
    expect(onSportChange).toHaveBeenCalledWith('trail');
  });

  it('affiche un état vide honnête, sans faux classement', () => {
    render(<ClubLeaderboard leaderboard={makeLeaderboard({ entries: [] })} />);
    expect(screen.getByText('Pas encore de classement cette semaine')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('affiche une erreur avec reprise', () => {
    const onRetry = vi.fn();
    render(<ClubLeaderboard leaderboard={makeLeaderboard()} error="Réseau indisponible" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
