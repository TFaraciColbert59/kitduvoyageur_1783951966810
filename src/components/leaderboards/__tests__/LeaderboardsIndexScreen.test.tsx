// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LeaderboardsIndexScreen } from '../LeaderboardsIndexScreen';
import type { SegmentLeaderboardSummary } from '@/lib/leaderboards/types';
import { ENTRIES, NOW_ISO, SEGMENT } from './fixtures';

afterEach(cleanup);

const SUMMARY: SegmentLeaderboardSummary = {
  segment: SEGMENT,
  totalEntries: 3,
  rejectedCount: 1,
  topEntries: ENTRIES,
  titles: { kom: ENTRIES[1], qom: ENTRIES[0], cr: null },
  localLegend: { displayName: 'Camille Martin', effortCount: 7 },
  computedAt: NOW_ISO,
};

describe('LeaderboardsIndexScreen', () => {
  it('rend les cartes, le top 3 et la Local Legend autorisée', () => {
    render(<LeaderboardsIndexScreen segments={[SUMMARY]} />);

    expect(screen.getByRole('heading', { name: 'Classements de segments' })).toBeTruthy();
    expect(screen.getByText('Montée du Belvédère')).toBeTruthy();
    expect(screen.getByText('3 passages')).toBeTruthy();
    expect(screen.getByText('Local Legend · Camille Martin')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/classements/seg-col-1');
  });

  it('rend un état vide honnête quand aucun segment n’est classable', () => {
    render(<LeaderboardsIndexScreen segments={[]} />);

    expect(screen.getByText('Aucun classement disponible')).toBeTruthy();
    expect(screen.getByText(/Les classements apparaissent/)).toBeTruthy();
  });
});
