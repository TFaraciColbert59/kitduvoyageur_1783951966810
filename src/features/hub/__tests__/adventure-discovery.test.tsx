// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ActiveAdventureProvider, useActiveAdventure } from '../context/ActiveAdventureContext';

const mocks = vi.hoisted(() => ({
  reloadUserTrips: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'recette-invite' }, loading: false }),
}));

vi.mock('@/features/trips/context/ActiveTripContext', () => ({
  useActiveTrip: () => ({
    userTrips: [{ id: 'ancienne-sortie', slug: 'historique', title: 'Voyage historique' }],
    reloadUserTrips: mocks.reloadUserTrips,
  }),
}));

vi.mock('../context/activeAdventureServer', () => ({
  setActiveAdventureAction: vi.fn(),
  clearActiveAdventureAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

it('alimente le sélecteur avec les sorties du HUB, dont les voyages partagés', async () => {
  const fetchList = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      trips: [{ id: 'partage', slug: 'partage', title: 'Voyage partagé', status: 'planned' }],
      groups: [],
      possession: {},
      pendingInvites: 0,
    }),
  });
  vi.stubGlobal('fetch', fetchList);

  function Choices() {
    const { groups } = useActiveAdventure();
    return <ul>{groups.sorties.map((trip) => <li key={trip.id}>{trip.title}</li>)}</ul>;
  }

  render(<ActiveAdventureProvider><Choices /></ActiveAdventureProvider>);

  expect(await screen.findByText('Voyage partagé')).toBeDefined();
  expect(screen.queryByText('Voyage historique')).toBeNull();
  expect(fetchList).toHaveBeenCalledWith('/api/hub/adventures', { cache: 'no-store' });
});
