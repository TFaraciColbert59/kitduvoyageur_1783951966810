// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  getLeaderboardFilterCapabilities,
  sanitizeLeaderboardFilters,
  type LeaderboardFilterQuery,
} from '@/features/leaderboards';
import { LeaderboardFilters } from '../LeaderboardFilters';

afterEach(cleanup);

const capabilities = getLeaderboardFilterCapabilities();
const filters = sanitizeLeaderboardFilters({ scope: 'global', period: 'all_time' });

describe('LeaderboardFilters', () => {
  it('expose période, genre et périmètre sans âge ni poids', () => {
    render(
      <LeaderboardFilters
        filters={filters}
        capabilities={capabilities}
        isAuthenticated={false}
        onChange={() => undefined}
      />
    );

    expect(screen.getByLabelText('Période')).toBeTruthy();
    expect(screen.getByLabelText('Catégorie')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tous les voyageurs' })).toBeTruthy();
    expect(screen.getByText(/Les filtres d’âge et de poids/)).toBeTruthy();
    expect(screen.getByText(/demandent une session/)).toBeTruthy();

    const friends = screen.getByRole('button', { name: 'Mes amis' }) as HTMLButtonElement;
    expect(friends.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Mon club' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('remonte un filtre de période complet et conserve le périmètre', () => {
    const onChange = vi.fn<(next: LeaderboardFilterQuery) => void>();
    render(
      <LeaderboardFilters
        filters={filters}
        capabilities={capabilities}
        isAuthenticated={false}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Période'), { target: { value: 'this_month' } });

    expect(onChange).toHaveBeenCalledWith({
      period: 'this_month',
      scope: 'global',
      clubId: null,
      gender: 'all',
    });
  });

  it('active les scopes privés pour une session et sélectionne le premier club', () => {
    const onChange = vi.fn<(next: LeaderboardFilterQuery) => void>();
    render(
      <LeaderboardFilters
        filters={filters}
        capabilities={capabilities}
        clubOptions={[
          { id: 'club-alpin', name: 'Club Alpin' },
          { id: 'club-2', name: 'Club des Crêtes' },
        ]}
        isAuthenticated
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mes amis' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'friends', clubId: null })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mon club' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'club', clubId: 'club-alpin' })
    );
  });

  it('affiche le club courant et laisse changer de club', () => {
    const onChange = vi.fn<(next: LeaderboardFilterQuery) => void>();
    render(
      <LeaderboardFilters
        filters={sanitizeLeaderboardFilters({ scope: 'club', clubId: 'club-alpin' })}
        capabilities={capabilities}
        clubOptions={[
          { id: 'club-alpin', name: 'Club Alpin' },
          { id: 'club-2', name: 'Club des Crêtes' },
        ]}
        isAuthenticated
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Club'), { target: { value: 'club-2' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'club', clubId: 'club-2' })
    );
  });
});
