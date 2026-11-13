// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SportProfileSummaryVM } from '@/features/community/g01/sportProfile';
import { defaultSportProfilePreferences } from '@/features/community/g01/sportProfile';
import { SportProfileSummary } from '../SportProfileSummary';

afterEach(cleanup);

function summary(overrides: Partial<SportProfileSummaryVM> = {}): SportProfileSummaryVM {
  const preferences = defaultSportProfilePreferences();
  preferences.audience = 'public';
  preferences.sports.rando = true;
  return {
    visible: true,
    reason: 'public',
    owner: true,
    audience: 'public',
    audienceLabel: 'Public',
    sports: [
      {
        sport: 'rando',
        label: 'Randonnée',
        sessions: 4,
        distanceKm: 48.2,
        elevationGainM: 3200,
        durationSeconds: 36000,
        distanceLabel: '48,2 km',
        elevationLabel: '3 200 m D+',
        durationLabel: '10 h',
      },
    ],
    records: [{ id: 'rec-1', label: 'Record distance', formatted: '21 km' }],
    hasData: true,
    preferences,
    ...overrides,
  };
}

describe('SportProfileSummary', () => {
  it('ne rend rien quand la politique refuse', () => {
    const { container } = render(
      <SportProfileSummary summary={summary({ visible: false, reason: 'profile_private' })} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('affiche les sports cochés et les records', () => {
    render(<SportProfileSummary summary={summary()} />);
    expect(screen.getByText('Profil sportif')).toBeTruthy();
    expect(screen.getAllByText('Randonnée').length).toBeGreaterThan(0);
    expect(screen.getByText('48,2 km')).toBeTruthy();
    expect(screen.getByText(/Record distance/)).toBeTruthy();
  });

  it('laisse le propriétaire changer l’audience', () => {
    const onChange = vi.fn();
    render(<SportProfileSummary summary={summary()} onPreferencesChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Privé' }));
    expect(onChange).toHaveBeenCalledWith({ audience: 'private' });
  });

  it('ne montre pas l’éditeur à un visiteur', () => {
    render(
      <SportProfileSummary
        summary={summary({ owner: false, reason: 'public' })}
        onPreferencesChange={() => {}}
      />
    );
    expect(screen.queryByText('Qui voit ces chiffres ?')).toBeNull();
  });

  it('ne rend rien sans donnée pour un visiteur', () => {
    const { container } = render(
      <SportProfileSummary
        summary={summary({
          owner: false,
          sports: [],
          records: [],
          hasData: false,
        })}
      />
    );
    expect(container.innerHTML).toBe('');
  });
});
