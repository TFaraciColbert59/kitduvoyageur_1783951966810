// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readRouteDraft } from '@/features/adventure-prep/routeRevision';
import { clearPendingRouteDraft } from '@/features/compas/engine/pendingDraft';
import { RouteCollabPageClient } from '../components/RouteCollabPageClient';
import { buildTripEntry } from '../entry';
import { saveGuestWorkspace } from '../guestDraft';
import { baseWorkspace } from '../insights/__tests__/fixtures';

const TRIP_ID = '11111111-2222-4333-8444-555555555555';

function tripWithDraft() {
  return buildTripEntry({
    id: TRIP_ID,
    title: 'Tour du lac',
    start_date: null,
    end_date: null,
    destination_name: 'Annecy',
    destination_country_code: 'FR',
    party_size: 2,
    primary_activity: 'velo',
    metadata: {
      compas: {
        routeDraft: {
          id: 'draft-1',
          version: 3,
          sport: 'vtt',
          engine: 'lkdv-route-editor/2',
          savedAt: '2026-11-20T08:00:00.000Z',
          points: [
            { id: 'p0', lat: 45.9, lon: 6.0, kind: 'start', name: 'Annecy' },
            { id: 'p1', lat: 45.9, lon: 6.13, kind: 'end', name: 'Talloires' },
          ],
          geometry: { type: 'LineString', coordinates: [[6.0, 45.9], [6.13, 45.9]] },
          sections: [
            {
              id: 'leg-1', mode: 'routed', fromIndex: 0, toIndex: 1,
              geometry: { type: 'LineString', coordinates: [[6.0, 45.9], [6.13, 45.9]] },
              distanceKm: 10.2, durationMin: 80, provider: 'valhalla',
            },
          ],
          distanceKm: 10.2,
          durationMin: 80,
          provider: 'valhalla',
          warnings: [],
        },
      },
    },
  });
}

describe('entrée de /compas/itineraire : premier écran, voyage, brouillon', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearPendingRouteDraft();
  });
  afterEach(() => cleanup());

  it('sans voyage ni compte : cinq tuiles, bandeau « Rattacher à un voyage », puis carte vide sans exemple inventé', async () => {
    render(<RouteCollabPageClient userId="guest-local" userName="Voyageur" authenticated={false} />);
    await waitFor(() => expect(screen.getByTestId('route-start-screen')).toBeTruthy());
    for (const id of ['blank', 'phrase', 'explorer', 'gpx', 'past']) {
      expect(screen.getByTestId(`start-tile-${id}`)).toBeTruthy();
    }
    expect(screen.getByTestId('start-attach-note').textContent).toContain('Rattacher à un voyage');

    fireEvent.click(screen.getByTestId('start-tile-blank'));
    // jsdom n'a pas de WebGL : la liste s'ouvre seule, avec l'ajout par adresse (1.10).
    await waitFor(() => expect(screen.getByTestId('list-mode-fallback')).toBeTruthy());
    expect(screen.getByTestId('add-by-address')).toBeTruthy();
    expect(screen.getByTestId('list-mode-empty')).toBeTruthy();
    // Connexion demandée au dernier moment (1.7) : le lien ramène sur l'itinéraire.
    const login = screen.getByTestId('login-to-save') as HTMLAnchorElement;
    expect(decodeURIComponent(login.getAttribute('href') ?? '')).toContain('/connexion?next=/compas/itineraire');
    expect(screen.getByTestId('attach-trip-banner')).toBeTruthy();
    expect(screen.queryByTestId('provenance-badge')).toBeNull();
    // Aucune donnée d'exemple : ni refuge ni Grenoble.
    expect(screen.queryByText(/Refuge intermédiaire/)).toBeNull();
  });

  it('avec un tracé du Compas pour le voyage : il devient le point de départ, badge « Tracé du Compas »', async () => {
    const trip = tripWithDraft();
    expect(trip.routeDraft).not.toBeNull();
    expect(trip.sport).toBe('vtt');
    render(<RouteCollabPageClient userId="guest-local" userName="Voyageur" authenticated={false} trip={trip} tripLink="ok" />);
    await waitFor(() => expect(screen.getByTestId('list-mode-fallback')).toBeTruthy());
    expect(screen.getByTestId('provenance-badge').textContent).toContain('Tracé du Compas');
    expect(screen.queryByTestId('attach-trip-banner')).toBeNull();
    expect(screen.getByText(/Annecy/)).toBeTruthy();
    expect(screen.getByText(/Talloires/)).toBeTruthy();
  });

  it('reprend le brouillon gardé sur l’appareil avant le tracé du Compas', async () => {
    const guest = baseWorkspace({
      id: 'w-guest',
      tripId: TRIP_ID,
      sport: 'marche',
      title: 'Mon brouillon',
      members: [{ userId: 'guest-local', displayName: 'Voyageur', role: 'owner' }],
    });
    saveGuestWorkspace(guest);
    render(<RouteCollabPageClient userId="guest-local" userName="Voyageur" authenticated={false} trip={tripWithDraft()} tripLink="ok" />);
    await waitFor(() => expect(screen.getByTestId('list-mode-fallback')).toBeTruthy());
    expect(screen.getByText(/Mon brouillon/)).toBeTruthy();
    expect(screen.queryByText(/Talloires/)).toBeNull();
  });

  it('?point= ouvre directement le point visé ; un point absent est annoncé, jamais remplacé', async () => {
    const guest = baseWorkspace({
      id: 'w-guest',
      tripId: 't',
      sport: 'marche',
      members: [{ userId: 'guest-local', displayName: 'Voyageur', role: 'owner' }],
    });
    saveGuestWorkspace(guest);
    render(<RouteCollabPageClient userId="guest-local" userName="Voyageur" authenticated={false} deepLink={{ pointId: 'b' }} />);
    await waitFor(() => expect(screen.getByTestId('subdrawer-point')).toBeTruthy());
    cleanup();

    saveGuestWorkspace(guest);
    render(<RouteCollabPageClient userId="guest-local" userName="Voyageur" authenticated={false} deepLink={{ day: 2 }} />);
    await waitFor(() => expect(screen.getByTestId('subdrawer-stage')).toBeTruthy());
    cleanup();

    saveGuestWorkspace(guest);
    render(<RouteCollabPageClient userId="guest-local" userName="Voyageur" authenticated={false} deepLink={{ pointId: 'absent' }} />);
    await waitFor(() => expect(screen.getByTestId('list-mode-fallback')).toBeTruthy());
    expect(screen.queryByTestId('subdrawer-point')).toBeNull();
  });

  it('un lien ?trip= illisible est dit, et l’itinéraire s’ouvre sans voyage', async () => {
    render(<RouteCollabPageClient userId="guest-local" userName="Voyageur" authenticated={false} tripLink="invalid" />);
    await waitFor(() => expect(screen.getByTestId('start-trip-note')).toBeTruthy());
    expect(screen.getByTestId('start-trip-note').textContent).toContain('illisible');
  });

  it('ajout par adresse en mode liste : le lieu retrouvé est posé en fin de tracé', async () => {
    const guest = baseWorkspace({
      id: 'w-guest',
      tripId: 't',
      sport: 'marche',
      members: [{ userId: 'guest-local', displayName: 'Voyageur', role: 'owner' }],
    });
    saveGuestWorkspace(guest);
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).startsWith('/api/geocode')) {
        return new Response(
          JSON.stringify({ status: 'ok', matches: [{ id: 'g1', name: 'Doussard', context: 'Haute-Savoie', country: 'France', lat: 45.78, lon: 6.19, precision: 'commune' }] }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 503 });
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      render(<RouteCollabPageClient userId="guest-local" userName="Voyageur" authenticated={false} />);
      await waitFor(() => expect(screen.getByTestId('add-by-address')).toBeTruthy());
      fireEvent.change(screen.getByTestId('address-input'), { target: { value: 'Doussard' } });
      fireEvent.click(screen.getByTestId('address-search'));
      const row = await screen.findByText(/Doussard · Haute-Savoie · France/);
      fireEvent.click(row);
      await waitFor(() => expect(screen.getByText(/4\. Doussard/)).toBeTruthy());
      expect(within(screen.getByTestId('list-mode-fallback')).queryByTestId('add-by-address')).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('lecture du brouillon Compas : le module de lecture reste celui du dépôt', () => {
    expect(readRouteDraft({ compas: { routeDraft: { nope: true } } })).toBeNull();
  });
});
