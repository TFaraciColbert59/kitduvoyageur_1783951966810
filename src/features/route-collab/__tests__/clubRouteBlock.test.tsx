// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ClubRouteBlock } from '../components/workspace/depart/ClubRouteBlock';
import type { ClubFetch } from '../components/workspace/depart/clubRouteClient';

const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });
const EVENTS = { events: [{ id: 'e1', title: 'Traversée du Vercors', startsAt: '2026-12-05T08:00:00Z', visibility: 'public' }] };

describe('Proposer à la sortie du club (10.5)', () => {
  afterEach(cleanup);

  it('n’apparaît pas sans sortie organisée, sans droit de publier ni sans version publiée', async () => {
    const none: ClubFetch = vi.fn(async () => json(200, { events: [] }));
    const { container, rerender } = render(<ClubRouteBlock workspaceId="w" canPublish hasPublished fetchFn={none} />);
    await waitFor(() => expect(none).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="club-route-block"]')).toBeNull();
    const denied: ClubFetch = vi.fn(async () => json(401, {}));
    rerender(<ClubRouteBlock workspaceId="w" canPublish hasPublished fetchFn={denied} />);
    expect(container.querySelector('[data-testid="club-route-block"]')).toBeNull();
    const spy: ClubFetch = vi.fn(async () => json(200, EVENTS));
    rerender(<ClubRouteBlock workspaceId="w" canPublish={false} hasPublished fetchFn={spy} />);
    rerender(<ClubRouteBlock workspaceId="w" canPublish hasPublished={false} fetchFn={spy} />);
    expect(spy).not.toHaveBeenCalled();
  });

  it('propose la version publiée à la sortie choisie et annonce le masquage du départ', async () => {
    const f = vi.fn(async (_u: string, init?: { method?: string; body?: string }) =>
      init?.method === 'POST' ? json(200, { status: 'ok', revision: 2, unchanged: false }) : json(200, EVENTS));
    render(<ClubRouteBlock workspaceId="w1" canPublish hasPublished fetchFn={f as ClubFetch} />);
    fireEvent.click(await screen.findByText('Proposer à la sortie du club'));
    await waitFor(() => expect(screen.getByTestId('club-route-message').textContent).toMatch(/révision 2/));
    expect(screen.getByText(/zone de départ privée est masquée/)).toBeTruthy();
    const post = f.mock.calls.find((c) => c[1]?.method === 'POST')!;
    expect(JSON.parse(post[1]!.body!)).toEqual({ workspaceId: 'w1', eventId: 'e1' });
  });

  it('dit le refus de la base (inscrit, non-propriétaire) sans rien présenter comme envoyé', async () => {
    const f = vi.fn(async (_u: string, init?: { method?: string }) =>
      init?.method === 'POST' ? json(403, { error: 'organisateur_et_proprietaire_requis' }) : json(200, EVENTS));
    render(<ClubRouteBlock workspaceId="w1" canPublish hasPublished fetchFn={f as ClubFetch} />);
    fireEvent.click(await screen.findByText('Proposer à la sortie du club'));
    await waitFor(() => expect(screen.getByTestId('club-route-message').textContent).toMatch(/Réservé à l’organisateur/));
  });
});
