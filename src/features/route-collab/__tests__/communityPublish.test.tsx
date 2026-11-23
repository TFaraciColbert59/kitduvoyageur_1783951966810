// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouteCollabWorkspace } from '../components/RouteCollabWorkspace';
import type { RouteRevisionSnapshot, RouteWorkspaceState } from '../types';

const NOW = '2026-11-20T10:00:00.000Z';
const WS = 'ws-pub-ui';
// Le tracé s'éloigne du départ de plus de 500 m par pas.
const coords: Array<[number, number]> = Array.from({ length: 30 }, (_, i) => [6 + i * 0.01, 45 + i * 0.0005]);

function makeWorkspace(published: boolean): RouteWorkspaceState {
  const pt = (id: string, order: string, c: [number, number], name: string, kind: 'start' | 'finish') => ({
    id, workspaceId: WS, kind, orderKey: order, lat: c[1], lon: c[0], eleM: 1000, name, entityVersion: 1,
  });
  const points = [pt('p1', 'A', coords[0], 'Maison', 'start'), pt('p2', 'Z', coords[29], 'Sommet', 'finish')];
  const sections = [
    {
      id: 's1', workspaceId: WS, fromPointId: 'p1', toPointId: 'p2', mode: 'manual' as const,
      geometry: { type: 'LineString' as const, coordinates: coords }, distanceKm: 30, durationMin: 400, ascentM: 700, descentM: 100,
      surfaceSegments: [], routingInputHash: null,
      provenance: { provider: 'compas', calculatedAt: NOW, profile: 'marche', confidence: 'estimated' as const },
      warnings: [], entityVersion: 1,
    },
  ];
  const rev: RouteRevisionSnapshot = {
    id: 'rev-1', workspaceId: WS, revisionNo: 3, parentRevisionId: null, basedOnSeq: 0, createdBy: 'u1', createdByName: 'Alice', createdAt: NOW,
    kind: 'published', summary: 'v3', points, sections, stages: [], kitSnapshot: [], acknowledgedUnknowns: [],
  };
  return {
    id: WS, tripId: 'trip-1', title: 'Crête du Mont', status: published ? 'published' : 'draft', sport: 'marche', shapeMode: 'one_way', routingOptions: {},
    headSeq: 0, reviewedSeq: null, publishedRevisionId: published ? rev.id : null, publishedRevisionNo: published ? 3 : null,
    sourceOrigin: { kind: 'blank', importedAt: NOW },
    points, sections, stages: [], variants: [], proposals: [], comments: [], kitItems: [],
    members: [
      { userId: 'u1', displayName: 'Alice Martin', role: 'owner' },
      { userId: 'u3', displayName: 'Éloi Perret', role: 'contributor' },
    ],
    revisions: published ? [rev] : [], packs: [], participantPacks: [], updatedAt: NOW,
  } as RouteWorkspaceState;
}

const fetchMock = vi.fn();

function openSharing(userId: string, published: boolean) {
  render(<RouteCollabWorkspace initialWorkspace={makeWorkspace(published)} currentUserId={userId} currentUserName="Moi" forceNoWebGL />);
  fireEvent.click(screen.getByRole('tab', { name: 'Équipe' }));
  fireEvent.click(screen.getByRole('button', { name: /Partage & Lien/ }));
  return screen.getByTestId('subdrawer-sharing');
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => ({ ok: false, status: 503, json: async () => ({}) }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('10.9 « Publier dans la communauté »', () => {
  it('propriétaire, version publiée : aperçu avec zone de départ masquée, puis confirmation', async () => {
    const drawer = openSharing('u1', true);
    fireEvent.click(within(drawer).getByTestId('community-publish-open'));
    const preview = within(drawer).getByTestId('community-publish-preview');
    expect(within(preview).getByTestId('community-preview-title').textContent).toBe('Crête du Mont');
    expect(within(preview).getByTestId('community-preview-facts').textContent).toMatch(/30 km · 700 m D\+ · 0 étape · version 3/);
    expect(within(preview).getByTestId('community-preview-mask').textContent).toMatch(/Zone de départ masquée sur 500 m/);
    // Rien n'est parti avant la confirmation.
    expect(fetchMock.mock.calls.filter(([u, init]) => String(u).includes('share-community') && (init as RequestInit | undefined)?.method === 'POST')).toHaveLength(0);

    fetchMock.mockImplementation(async (url: RequestInfo | URL) =>
      String(url).includes('share-community')
        ? { ok: true, status: 200, json: async () => ({ status: 'ok', postId: 'post-1', idempotent: false }) }
        : { ok: false, status: 503, json: async () => ({}) },
    );
    fireEvent.click(within(preview).getByTestId('community-publish-confirm'));
    await waitFor(() => expect(within(drawer).getByTestId('community-publish-result').textContent).toBe('Publié dans la communauté.'));
    const call = fetchMock.mock.calls.find(([u, init]) => String(u).includes('share-community') && (init as RequestInit | undefined)?.method === 'POST')!;
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body).toMatchObject({ workspaceId: WS, audience: 'abonnies' });
    expect(JSON.stringify(body)).not.toMatch(/lat|lon|coordinates/);
  });

  it('« Annuler » referme l’aperçu sans rien envoyer ; une erreur serveur est dite', async () => {
    const drawer = openSharing('u1', true);
    fireEvent.click(within(drawer).getByTestId('community-publish-open'));
    fireEvent.click(within(drawer).getByTestId('community-publish-cancel'));
    expect(within(drawer).queryByTestId('community-publish-preview')).toBeNull();
    fireEvent.click(within(drawer).getByTestId('community-publish-open'));
    fetchMock.mockImplementation(async () => ({ ok: false, status: 403, json: async () => ({ status: 'forbidden' }) }));
    fireEvent.click(within(drawer).getByTestId('community-publish-confirm'));
    await waitFor(() => expect(within(drawer).getByTestId('community-publish-result').textContent).toMatch(/Seul le propriétaire/));
  });

  it('sans version publiée : pas de bouton, la raison est dite', () => {
    const drawer = openSharing('u1', false);
    expect(within(drawer).queryByTestId('community-publish-open')).toBeNull();
    expect(within(drawer).getByTestId('community-publish').textContent).toMatch(/Aucune version publiée/);
  });

  it('un participant qui n’est pas propriétaire ne voit rien', () => {
    const drawer = openSharing('u3', true);
    expect(within(drawer).queryByTestId('community-publish')).toBeNull();
  });

  it('10.9 story, carnet et club : cibles cochées, club proposé seulement aux membres, club envoyé', async () => {
    fetchMock.mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).includes('share-community') && init?.method === 'POST') {
        return { ok: true, status: 200, json: async () => ({ status: 'ok', postId: 'p', idempotent: false, results: {} }) };
      }
      if (String(url).includes('share-community')) {
        return { ok: true, status: 200, json: async () => ({ clubs: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Les Marcheurs' }] }) };
      }
      return { ok: false, status: 503, json: async () => ({}) };
    });
    const drawer = openSharing('u1', true);
    fireEvent.click(within(drawer).getByTestId('community-publish-open'));
    const preview = within(drawer).getByTestId('community-publish-preview');
    await waitFor(() => expect(within(preview).getByRole('option', { name: 'Mon club' })).toBeTruthy());
    fireEvent.click(within(preview).getByTestId('community-target-story'));
    fireEvent.click(within(preview).getByTestId('community-target-carnet'));
    fireEvent.change(within(preview).getByDisplayValue('Mes abonnés'), { target: { value: 'club' } });
    expect(within(preview).getByText(/Un carnet n’a pas d’audience club/)).toBeTruthy();
    fireEvent.click(within(preview).getByTestId('community-publish-confirm'));
    await waitFor(() => expect(within(drawer).getByTestId('community-publish-result').textContent).toBe('Publié dans la communauté.'));
    const call = fetchMock.mock.calls.find(([u, init]) => String(u).includes('share-community') && (init as RequestInit | undefined)?.method === 'POST')!;
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body).toMatchObject({ audience: 'club', clubId: '22222222-2222-4222-8222-222222222222', targets: { post: true, story: true, carnet: true } });
  });

  it('10.9 sans club : l’audience « Mon club » n’est pas proposée', async () => {
    const drawer = openSharing('u1', true);
    fireEvent.click(within(drawer).getByTestId('community-publish-open'));
    const preview = within(drawer).getByTestId('community-publish-preview');
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('share-community'))).toBe(true));
    expect(within(preview).queryByRole('option', { name: 'Mon club' })).toBeNull();
  });
});
