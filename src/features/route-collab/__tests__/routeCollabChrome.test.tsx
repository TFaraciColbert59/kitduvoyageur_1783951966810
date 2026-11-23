// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouteCollabWorkspace } from '../components/RouteCollabWorkspace';
import type { RouteWorkspaceState } from '../types';

function makeWorkspace(members: RouteWorkspaceState['members']): RouteWorkspaceState {
  const now = '2026-11-18T10:00:00.000Z';
  const wsId = 'ws-chrome-1';
  return {
    id: wsId,
    tripId: 'trip-chrome-1',
    title: 'Boucle Chartreuse',
    status: 'draft',
    sport: 'marche',
    shapeMode: 'one_way',
    routingOptions: {},
    headSeq: 0,
    reviewedSeq: null,
    publishedRevisionId: null,
    publishedRevisionNo: null,
    sourceOrigin: { kind: 'blank', importedAt: now },
    points: [
      { id: 'p1', workspaceId: wsId, kind: 'start', orderKey: 'A', lat: 45.3, lon: 5.8, eleM: 900, name: 'Saint-Pierre', entityVersion: 1 },
      { id: 'p2', workspaceId: wsId, kind: 'finish', orderKey: 'Z', lat: 45.35, lon: 5.85, eleM: 1200, name: 'Chamechaude', entityVersion: 1 },
    ],
    sections: [
      {
        id: 's1',
        workspaceId: wsId,
        fromPointId: 'p1',
        toPointId: 'p2',
        mode: 'routed',
        geometry: { type: 'LineString', coordinates: [[5.8, 45.3], [5.85, 45.35]] },
        distanceKm: 7.5,
        durationMin: 130,
        ascentM: null,
        descentM: 0,
        surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'trail', source: 'OSM' }],
        routingInputHash: null,
        provenance: { provider: 'compas', calculatedAt: now, profile: 'marche', confidence: 'estimated' },
        warnings: [],
        entityVersion: 1,
      },
    ],
    stages: [
      {
        id: 'st1',
        workspaceId: wsId,
        orderKey: '001',
        dayNumber: 1,
        title: 'Jour 1',
        dateIso: null,
        departureTimeLocal: '08:30',
        timezone: 'Europe/Paris',
        startPointId: 'p1',
        endPointId: 'p2',
        overnightPlace: null,
        notes: '',
        waterObservations: [],
        weatherSlice: null,
        hazards: [],
        entityVersion: 1,
      },
    ],
    variants: [],
    proposals: [],
    comments: [],
    kitItems: [],
    members,
    revisions: [],
    packs: [],
    participantPacks: [],
    updatedAt: now,
  };
}

const TEAM = [
  { userId: 'u1', displayName: 'Alice', role: 'owner' as const },
  { userId: 'u2', displayName: 'Éloi', role: 'editor' as const },
];
const SOLO = [{ userId: 'u1', displayName: 'Alice', role: 'owner' as const }];

function mount(members = TEAM) {
  return render(
    <RouteCollabWorkspace initialWorkspace={makeWorkspace(members)} currentUserId="u1" currentUserName="Alice" forceNoWebGL={true} />,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  // Le routeur réel n'existe pas sous jsdom : « indisponible », comme hors réseau.
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Pilule et îlot (3.1 à 3.8)', () => {
  it('la pilule dit le voyage en toutes lettres, l’inconnu n’est pas zéro, la sauvegarde est honnête', () => {
    mount();
    const summary = screen.getByTestId('route-pill-summary').textContent ?? '';
    expect(summary).toMatch(/^1 j · \d+ km · D\+ \?$/);
    expect(screen.getByTestId('save-status').textContent).toBe('Non enregistré');
    expect(screen.getByTestId('readiness-status').textContent).toMatch(/^(Presque prêt|À compléter) · \d points?$/);
    // jours à glisser : un chip par jour, le jour choisi est annoncé
    const day = within(screen.getByTestId('pill-days')).getByRole('tab', { name: /Jour 1/ });
    expect(day.getAttribute('aria-selected')).toBe('true');
    // voyant : orange (altitude inconnue), un toucher ouvre le tronçon fautif
    expect(screen.getByTestId('route-light').getAttribute('data-level')).toBe('orange');
    fireEvent.click(screen.getByTestId('route-light'));
    expect(screen.getByTestId('subdrawer-section')).toBeTruthy();
  });

  it('tiroir fermé, le lanceur parle au lieu de trois points muets', () => {
    mount();
    fireEvent.click(screen.getByRole('tab', { name: 'Départ' }));
    fireEvent.click(screen.getByRole('button', { name: /Activité & Carnet/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    const launcher = screen.getByTestId('route-drawer-pill');
    expect(launcher.textContent).toMatch(/^1 j · \d+ km · D\+ \?$/);
    expect(launcher.querySelector('.xp-pill-dots')).toBeNull();
  });

  it('une annonce à la fois, avec « Annuler » : l’ajout d’un point est défait par l’opération inverse', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un point/i }));
    const island = await screen.findByTestId('impact-banner');
    const undo = within(island).getByRole('button', { name: 'Annuler' });
    expect(document.querySelectorAll('.v5-island').length).toBe(1);
    fireEvent.click(undo);
    await waitFor(() => expect(screen.getByTestId('status-message').textContent).toMatch(/Annulé : ajout d’un point/));
    // le geste annulé n'est plus proposé deux fois
    expect(within(screen.getByTestId('status-message')).queryByRole('button', { name: 'Annuler' })).toBeNull();
  });

  it('« Dis-le » : aperçu avant d’appliquer, puis un seul geste annulable', async () => {
    mount();
    fireEvent.click(screen.getByTestId('say-trigger'));
    fireEvent.change(screen.getByLabelText(/Dis-le : une modification/), { target: { value: 'inverse le sens' } });
    fireEvent.click(screen.getByTestId('say-read'));
    expect(screen.getByTestId('say-preview').textContent).toMatch(/sens/i);
    const headBefore = screen.getByTestId('route-collab-workspace').getAttribute('data-head-seq');
    fireEvent.click(screen.getByTestId('say-apply'));
    await waitFor(() => expect(screen.getByTestId('route-collab-workspace').getAttribute('data-head-seq')).not.toBe(headBefore));
    expect(screen.queryByTestId('say-panel')).toBeNull();
  });

  it('une phrase non comprise est dite, rien n’est deviné', () => {
    mount();
    fireEvent.click(screen.getByTestId('say-trigger'));
    fireEvent.change(screen.getByLabelText(/Dis-le : une modification/), { target: { value: 'fais-moi un café' } });
    fireEvent.click(screen.getByTestId('say-read'));
    expect(screen.getByTestId('say-unknown').textContent).toMatch(/pas compris/);
    expect(screen.queryByTestId('say-apply')).toBeNull();
  });
});

describe('Tiroir principal (4.1, 4.3 à 4.8)', () => {
  it('interrupteur Simple / Expert : la méthode apparaît sous chaque chiffre en expert seulement', () => {
    mount();
    const tiles = screen.getByTestId('metric-tiles');
    expect(tiles.getAttribute('data-expert')).toBe('false');
    expect(tiles.querySelector('.rcw-tile-method')).toBeNull();
    // D+ inconnu : « Inconnu » et la raison, jamais 0 m
    const ascent = tiles.querySelector('[data-figure="ascent"]');
    expect(ascent?.textContent).toMatch(/Inconnu/);
    expect(ascent?.textContent).toMatch(/D\+ inconnu sur 7,5 km/);
    expect(ascent?.textContent).not.toMatch(/\b0 m/);
    fireEvent.click(screen.getByTestId('view-mode-expert'));
    expect(screen.getByTestId('metric-tiles').getAttribute('data-expert')).toBe('true');
    expect(screen.getByTestId('metric-tiles').querySelectorAll('.rcw-tile-method').length).toBe(4);
    expect(window.localStorage.getItem('lkdv:itineraire:viewMode:v1')).toBe('expert');
    fireEvent.click(screen.getByTestId('view-mode-simple'));
    expect(screen.getByTestId('metric-tiles').getAttribute('data-expert')).toBe('false');
  });

  it('trois hauteurs : aperçu, moitié (par défaut), plein', () => {
    mount();
    const sheet = document.querySelector('.xp-sheet') as HTMLElement;
    expect(sheet.getAttribute('data-detent')).toBe('mid');
    const handle = screen.getByRole('button', { name: 'Ajuster la hauteur du tiroir' });
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(document.querySelector('.xp-sheet')?.getAttribute('data-detent')).toBe('full');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(document.querySelector('.xp-sheet')?.getAttribute('data-detent')).toBe('peek');
  });

  it('en solo, « Équipe » devient « Inviter » ; en groupe, elle reste « Équipe »', () => {
    const solo = mount(SOLO);
    fireEvent.click(screen.getByRole('tab', { name: 'Inviter' }));
    expect(screen.getByTestId('tab-panel-equipe').getAttribute('data-solo')).toBe('true');
    expect(screen.getByTestId('invite-share-link')).toBeTruthy();
    solo.unmount();
    mount(TEAM);
    expect(screen.queryByRole('tab', { name: 'Inviter' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Équipe' }));
    expect(screen.getByTestId('member-rows').querySelectorAll('.v5-li').length).toBe(2);
  });

  it('Échap ferme un seul niveau à la fois : sous-tiroir, puis tiroir', () => {
    mount();
    fireEvent.click(screen.getByRole('tab', { name: 'Départ' }));
    fireEvent.click(screen.getByRole('button', { name: /Activité & Carnet/i }));
    expect(screen.getByTestId('subdrawer-offline-carnet')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('subdrawer-offline-carnet')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Départ' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByTestId('route-drawer-pill').textContent).toMatch(/^1 j · \d+ km · D\+ \?$/);
  });

  it('un seul « Retour » ferme un seul niveau', () => {
    mount();
    fireEvent.click(screen.getByRole('tab', { name: 'Départ' }));
    fireEvent.click(screen.getByRole('button', { name: /Activité & Carnet/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.queryByTestId('subdrawer-offline-carnet')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Tracer' })).toBeTruthy();
  });
});
