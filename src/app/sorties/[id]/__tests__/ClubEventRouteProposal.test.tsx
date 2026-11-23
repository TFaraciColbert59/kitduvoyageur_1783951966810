// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ClubEventRouteProposal from '../ClubEventRouteProposal';

const { rpc, selectTrace, routeMap } = vi.hoisted(() => ({ rpc: vi.fn(), selectTrace: vi.fn(), routeMap: vi.fn() }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: true }) }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: (...args: unknown[]) => ({ abortSignal: () => rpc(...args) }),
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: selectTrace }) }) }) }) }),
  }),
}));
vi.mock('@/features/hub/components/mobile/HubRouteMap', () => ({
  default: (props: { routeSegments: unknown }) => { routeMap(props.routeSegments); return <div data-testid="map" />; },
}));
vi.mock('dexie', async (importOriginal) => ({
  ...(await importOriginal<typeof import('dexie')>()),
  liveQuery: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
}));
vi.mock('@/features/adventure-intelligence/offline/clubRouteCopies', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/adventure-intelligence/offline/clubRouteCopies')>()),
  readClubRouteCopy: vi.fn(async () => []), removeClubRouteCopy: vi.fn(), saveClubRouteCopy: vi.fn(),
}));
vi.mock('../clubRouteDecisionAction', () => ({ saveClubRouteDecision: vi.fn(async () => ({})) }));

const base = {
  eventId: 'ev', viewerId: 'u1', revision: 2, routeName: 'Traversée', distanceM: 3300, elevationGainM: 200,
  canDecide: true, decision: null, adoptedRevision: null,
};
const trace = { type: 'MultiLineString', coordinates: [[[6.1, 45.9], [6.2, 46.0]]] };

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('révision issue d’un espace : mention « version N » et mêmes gestes de décision', () => {
  render(<ClubEventRouteProposal {...base} sourceRevisionNo={4} />);
  expect(screen.getByTestId('club-route-source').textContent).toBe('Proposé depuis l’itinéraire · version 4');
  expect(screen.getByRole('button', { name: 'Adopter ce tracé' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Garder mon tracé' })).toBeTruthy();
});

it('révision du catalogue : aucune mention d’itinéraire', () => {
  render(<ClubEventRouteProposal {...base} />);
  expect(screen.queryByTestId('club-route-source')).toBeNull();
  expect(screen.getByRole('button', { name: 'Adopter ce tracé' })).toBeTruthy();
});

it('sans fonction de lecture en base, le tracé de la révision est lu dans sa colonne trace', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'function not found' } });
  selectTrace.mockResolvedValue({ data: { trace }, error: null });
  render(<ClubEventRouteProposal {...base} sourceRevisionNo={1} />);
  fireEvent.click(screen.getByRole('button', { name: 'Voir le tracé' }));
  await screen.findByTestId('map');
  expect(routeMap).toHaveBeenLastCalledWith([[[45.9, 6.1], [46.0, 6.2]]]);
});

it('la fonction de lecture renvoie la trace d’une révision issue d’un espace', async () => {
  rpc.mockResolvedValue({ data: trace, error: null });
  render(<ClubEventRouteProposal {...base} sourceRevisionNo={1} />);
  fireEvent.click(screen.getByRole('button', { name: 'Voir le tracé' }));
  await waitFor(() => expect(screen.getByTestId('map')).toBeTruthy());
  expect(selectTrace).not.toHaveBeenCalled();
});
