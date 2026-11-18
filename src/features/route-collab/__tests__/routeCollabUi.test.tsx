// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RouteCollabWorkspace } from '../components/RouteCollabWorkspace';
import type { RouteWorkspaceState } from '../types';

function makeUiWorkspace(): RouteWorkspaceState {
  const now = '2026-11-18T10:00:00.000Z';
  const wsId = 'ws-ui-1';
  return {
    id: wsId,
    tripId: 'trip-ui-1',
    title: 'Boucle Chartreuse 2 jours',
    status: 'draft',
    sport: 'marche',
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
        ascentM: 300,
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
    kitItems: [
      {
        id: 'k1',
        name: 'Réchaud',
        category: 'cuisine',
        weightGrams: 320,
        quantity: 1,
        shared: true,
        assigneeUserId: 'u1',
        assigneeName: 'Alice',
        dependsOn: ['overnight'],
        status: 'confirmed',
      },
    ],
    members: [
      { userId: 'u1', displayName: 'Alice', role: 'owner' },
      { userId: 'u2', displayName: 'Éloi', role: 'editor' },
    ],
    revisions: [],
    packs: [],
    participantPacks: [],
    updatedAt: now,
  };
}

describe('RouteCollabWorkspace UI — Sans WebGL, Édition, Publication, Pack & Carnet', () => {
  it('reste pleinement utilisable sans WebGL (mode liste) et couvre le cycle jusqu’au carnet', () => {
    render(
      <RouteCollabWorkspace
        initialWorkspace={makeUiWorkspace()}
        currentUserId="u1"
        currentUserName="Alice"
        forceNoWebGL={true}
      />,
    );

    expect(screen.getByTestId('list-mode-fallback')).toBeTruthy();
    expect(screen.getByText(/Mode liste \(WebGL indisponible\)/i)).toBeTruthy();

    // Ajouter un point en vue liste sans WebGL
    fireEvent.click(screen.getByRole('button', { name: /\+ Ajouter un point/i }));
    expect(screen.getByText(/Points \(3\)/i)).toBeTruthy();

    // Publier v1
    fireEvent.click(screen.getByRole('button', { name: /Publier v1/i }));
    expect(screen.getByText(/Publiée v1/i)).toBeTruthy();

    // Aller dans Départ, télécharger le pack, démarrer puis terminer vers Carnet
    fireEvent.click(screen.getByRole('tab', { name: 'Départ' }));
    fireEvent.click(screen.getByRole('button', { name: /Télécharger le pack/i }));
    expect(screen.getByText(/Version 1 vérifiée/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Démarrer l’activité/i }));
    fireEvent.click(screen.getByRole('button', { name: /Terminer et ouvrir le carnet/i }));
    expect(screen.getByText(/Bilan Carnet/i)).toBeTruthy();
    expect(screen.getByText(/Version suivie : v1/i)).toBeTruthy();
  });
});
