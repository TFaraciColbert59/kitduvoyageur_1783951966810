// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RankingsHub from '../RankingsHub';

const leaderboardPayload = {
  success: true,
  data: {
    result: {
      window: {
        kind: 'weekly',
        startsAt: '2026-11-09T00:00:00.000Z',
        endsAt: '2026-11-15T23:59:59.999Z',
        periodKey: '2026-W46',
      },
      sport: 'all',
      metric: 'distanceMeters',
      totalParticipants: 0,
      entries: [],
      currentUserEntry: null,
    },
    meta: { generatedAt: '2026-11-13T12:00:00.000Z', privacy: 'fail_closed' },
  },
};

const challengesPayload = {
  success: true,
  data: {
    items: [],
    meta: { generatedAt: '2026-11-13T12:00:00.000Z', privacy: 'fail_closed' },
  },
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/challenges') ? challengesPayload : leaderboardPayload;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('RankingsHub', () => {
  it('expose une tablist accessible et charge le panneau actif', async () => {
    render(<RankingsHub />);
    expect(screen.getByRole('tablist', { name: /Classements/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Local Legends' })).toBeTruthy();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'La cordée du moment' })).toBeTruthy()
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Défis' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Les défis de la saison' })).toBeTruthy()
    );
    expect(screen.getByRole('tab', { name: 'Défis' }).getAttribute('aria-selected')).toBe('true');
  });

  it('ferme les preuves personnelles à un visiteur non connecté', () => {
    render(<RankingsHub />);
    fireEvent.click(screen.getByRole('tab', { name: 'Trophées' }));
    expect(screen.getByText('Connectez-vous pour cette preuve')).toBeTruthy();
  });
});
