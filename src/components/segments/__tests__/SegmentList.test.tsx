// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { UserSegmentPreferences } from '@/features/segments';
import { SegmentList } from '../SegmentList';
import { buildSegment } from './fixtures';

afterEach(cleanup);

const preferences: UserSegmentPreferences = {
  userId: 'user-1',
  starredSegmentIds: [],
  hiddenSegmentIds: [],
};

const segments = [
  buildSegment(),
  buildSegment({
    id: 'seg-2',
    name: 'Boucle des Crêtes',
    sport: 'hiking',
    lengthM: 8400,
    createdByUserId: 'user-2',
    verified: false,
  }),
];

describe('SegmentList', () => {
  it('affiche la liste et filtre par recherche textuelle', () => {
    render(
      <SegmentList segments={segments} viewerUserId="user-1" preferences={preferences} />
    );

    expect(screen.getByRole('heading', { name: 'Segments' })).toBeTruthy();
    expect(screen.getByText('Montée du Belvédère')).toBeTruthy();
    expect(screen.getByText('Boucle des Crêtes')).toBeTruthy();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un segment' }), {
      target: { value: 'crêtes' },
    });

    expect(screen.queryByText('Montée du Belvédère')).toBeNull();
    expect(screen.getByText('Boucle des Crêtes')).toBeTruthy();
    expect(screen.getByText('1 segment')).toBeTruthy();
  });

  it('filtre les favoris et remonte le clic étoile au parent', () => {
    const onPreferencesChange = vi.fn();
    render(
      <SegmentList
        segments={segments}
        viewerUserId="user-1"
        preferences={{ ...preferences, starredSegmentIds: ['seg-2'] }}
        onPreferencesChange={onPreferencesChange}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Ajouter Montée du Belvédère aux favoris' })
    );
    expect(onPreferencesChange).toHaveBeenCalledWith(
      expect.objectContaining({ starredSegmentIds: ['seg-2', 'seg-1'] })
    );

    fireEvent.click(screen.getByRole('button', { name: /Favoris/ }));
    expect(screen.queryByText('Montée du Belvédère')).toBeNull();
    expect(screen.getByText('Boucle des Crêtes')).toBeTruthy();
  });

  it('masque un segment et propose de réafficher les masqués', () => {
    const onPreferencesChange = vi.fn();
    render(
      <SegmentList
        segments={segments}
        viewerUserId="user-1"
        preferences={{ ...preferences, hiddenSegmentIds: ['seg-1'] }}
        onPreferencesChange={onPreferencesChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Masqués/ }));
    expect(screen.getByRole('button', { name: 'Afficher Montée du Belvédère' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Afficher Montée du Belvédère' }));
    expect(onPreferencesChange).toHaveBeenCalledWith(
      expect.objectContaining({ hiddenSegmentIds: [] })
    );
  });

  it('rend un état vide actionnable', () => {
    const onCreate = vi.fn();
    render(
      <SegmentList
        segments={[]}
        viewerUserId="user-1"
        preferences={preferences}
        onCreate={onCreate}
      />
    );

    expect(screen.getByText('Aucun segment')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Créer le premier segment' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
