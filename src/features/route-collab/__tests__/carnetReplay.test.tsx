// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { clearPendingRouteDraft } from '@/features/compas/engine/pendingDraft';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/features/compas/server/compasActions', () => ({ compasCreateTripAction: vi.fn() }));

import { RouteCollabPageClient } from '../components/RouteCollabPageClient';
import { buildCarnetReplayWorkspace, carnetReplayNote, carnetTraceCoordinates, parseCarnetReplayParams, type CarnetReplay } from '../carnetReplay';
import { buildCarnetReplayHref } from '../insights/deepLinks';
import { readGuestWorkspace } from '../guestDraft';

const CARNET = '3c9d6d2e-6c0e-4c53-9f5c-1d5f7a1a2b3d';
const TRIP = '0b9d6d2e-6c0e-4c53-9f5c-1d5f7a1a2b3c';
const replay: CarnetReplay = {
  carnetId: CARNET,
  title: 'Tour du Queyras',
  coordinates: [[6.0, 44.7], [6.05, 44.72], [6.1, 44.75]],
  traceMasked: true,
};

describe('9.10 lien et lecture', () => {
  it('le lien ouvre /compas/itineraire?…&from=carnet&carnetId=…, pas /compas?nouvelle=1', () => {
    expect(buildCarnetReplayHref(CARNET)).toBe(`/compas/itineraire?from=carnet&carnetId=${CARNET}`);
    expect(buildCarnetReplayHref(CARNET, TRIP)).toBe(`/compas/itineraire?trip=${TRIP}&from=carnet&carnetId=${CARNET}`);
  });

  it('paramètres validés : uuid exigé, valeur illisible ignorée', () => {
    expect(parseCarnetReplayParams({ from: 'carnet', carnetId: CARNET })).toEqual({ carnetId: CARNET });
    expect(parseCarnetReplayParams({ from: 'carnet', carnetId: 'x' })).toBeNull();
    expect(parseCarnetReplayParams({ carnetId: CARNET })).toBeNull();
  });

  it('trace GeoJSON ou tableau lue ; la provenance ne contient aucune coordonnée', () => {
    expect(carnetTraceCoordinates({ type: 'LineString', coordinates: [[1, 2], [3, 4]] })).toEqual([[1, 2], [3, 4]]);
    expect(carnetTraceCoordinates(null)).toEqual([]);
    const ws = buildCarnetReplayWorkspace(replay, { userId: 'u1', userName: 'Léa', tripId: TRIP, sport: 'marche', nowIso: '2026-11-23T10:00:00.000Z', idSeed: 'a1' });
    expect(ws?.tripId).toBe(TRIP);
    expect(ws?.id).toBe('ws-local-a1');
    expect(ws?.sourceOrigin).toMatchObject({ kind: 'activity_replay', sourceId: `carnet-${CARNET}`, sourceTitle: 'Tour du Queyras' });
    expect(ws?.sourceOrigin.attribution).toContain('zone de départ masquée');
    expect(JSON.stringify(ws?.sourceOrigin)).not.toMatch(/44\.7/);
    expect(carnetReplayNote({ status: 'no_trace' })).toMatch(/pas de tracé/);
    expect(carnetReplayNote({ status: 'none' })).toBeNull();
  });
});

describe('9.10 page : reprise du carnet', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearPendingRouteDraft();
    push.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('avec le voyage : brouillon enregistré côté serveur (POST création d’espace, provenance activity_replay)', async () => {
    const bodies: Array<{ tripId: string; workspace: { sourceOrigin: { kind: string } } }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init?: { body?: string; method?: string }) => {
      if (String(url) === '/api/routes/workspaces' && init?.method === 'POST') {
        const b = JSON.parse(init.body ?? '{}');
        bodies.push(b);
        return new Response(JSON.stringify({ workspace: b.workspace }), { status: 201 });
      }
      return new Response('{}', { status: 503 });
    }));
    const trip = { tripId: TRIP, title: 'Queyras', destinationName: 'Queyras', countryCode: 'FR', anchor: null, days: 3, activity: null, sport: 'marche' as const, sportFrom: 'default' as const, routeDraft: null };
    render(<RouteCollabPageClient userId="u1" userName="Léa" authenticated trip={trip} tripLink="ok" carnetReplay={replay} />);
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0].tripId).toBe(TRIP);
    expect(bodies[0].workspace.sourceOrigin.kind).toBe('activity_replay');
  });

  it('sans voyage, connecté : le tracé repris est gardé puis le voyage est choisi', async () => {
    render(<RouteCollabPageClient userId="u1" userName="Léa" authenticated attachChoices={[]} carnetReplay={replay} />);
    await waitFor(() => expect(screen.getByTestId('route-attach-screen')).toBeTruthy());
    expect(screen.getByTestId('attach-draft-note').textContent).toContain('Sortie passée');
    expect(readGuestWorkspace(null)?.sourceOrigin.kind).toBe('activity_replay');
  });

  it('carnet illisible : la raison est dite sur l’écran de départ', async () => {
    render(<RouteCollabPageClient userId="guest-local" userName="Voyageur" authenticated={false} carnetNote="Carnet introuvable ou privé : l’itinéraire s’ouvre sans reprise." />);
    await waitFor(() => expect(screen.getByTestId('start-entry-note').textContent).toContain('introuvable'));
  });
});
