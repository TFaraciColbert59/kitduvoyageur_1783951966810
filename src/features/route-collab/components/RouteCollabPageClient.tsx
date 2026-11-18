'use client';

import React, { useMemo } from 'react';
import { RouteCollabWorkspace } from './RouteCollabWorkspace';
import type { RouteWorkspaceState } from '../types';

function buildDefaultWorkspace(userId: string, userName: string): RouteWorkspaceState {
  const nowIso = new Date().toISOString();
  const wsId = 'ws-default-compas';
  let title = 'Nouvel itinéraire collaboratif';
  let sourceKind: 'blank' | 'explorer_route' = 'blank';
  let sourceId: string | null = null;
  let attribution: string | null = null;
  let coords: Array<[number, number]> = [
    [5.512, 45.052],
    [5.535, 45.068],
    [5.558, 45.084],
  ];

  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem('lkdv:compas:explorerImport:v1');
      if (raw) {
        const parsed = JSON.parse(raw) as {
          routeId?: string;
          title?: string;
          geojson?: { coordinates?: Array<[number, number]> };
          attribution?: string;
        };
        if (parsed.title) title = parsed.title;
        if (parsed.routeId) sourceId = parsed.routeId;
        if (parsed.attribution) attribution = parsed.attribution;
        if (Array.isArray(parsed.geojson?.coordinates) && parsed.geojson!.coordinates.length >= 2) {
          coords = parsed.geojson!.coordinates;
          sourceKind = 'explorer_route';
        }
      }
    } catch {
      /* ignore */
    }
  }

  const start = coords[0];
  const mid = coords[Math.floor(coords.length / 2)];
  const end = coords[coords.length - 1];

  return {
    id: wsId,
    tripId: 'trip-compas-active',
    title,
    status: 'draft',
    sport: 'marche',
    routingOptions: {},
    headSeq: 0,
    reviewedSeq: null,
    publishedRevisionId: null,
    publishedRevisionNo: null,
    sourceOrigin: {
      kind: sourceKind,
      sourceId,
      sourceTitle: title,
      attribution,
      importedAt: nowIso,
    },
    points: [
      {
        id: 'pt-start',
        workspaceId: wsId,
        kind: 'start',
        orderKey: 'A',
        lat: start[1],
        lon: start[0],
        eleM: 1100,
        name: 'Départ',
        entityVersion: 1,
      },
      {
        id: 'pt-mid',
        workspaceId: wsId,
        kind: 'stage_boundary',
        orderKey: 'M',
        lat: mid[1],
        lon: mid[0],
        eleM: 1450,
        name: 'Refuge intermédiaire',
        semanticKind: 'refuge',
        entityVersion: 1,
      },
      {
        id: 'pt-end',
        workspaceId: wsId,
        kind: 'finish',
        orderKey: 'Z',
        lat: end[1],
        lon: end[0],
        eleM: 1250,
        name: 'Arrivée',
        entityVersion: 1,
      },
    ],
    sections: [
      {
        id: 'sec-1',
        workspaceId: wsId,
        fromPointId: 'pt-start',
        toPointId: 'pt-mid',
        mode: sourceKind === 'explorer_route' ? 'imported_preserved' : 'routed',
        geometry: {
          type: 'LineString',
          coordinates: [start, mid],
        },
        distanceKm: 8.4,
        durationMin: 155,
        ascentM: 420,
        descentM: 70,
        surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'trail', source: attribution }],
        routingInputHash: null,
        provenance: {
          provider: sourceKind === 'explorer_route' ? 'explorer-catalog' : 'compas',
          calculatedAt: nowIso,
          profile: 'marche',
          confidence: 'estimated',
        },
        warnings: [],
        entityVersion: 1,
      },
      {
        id: 'sec-2',
        workspaceId: wsId,
        fromPointId: 'pt-mid',
        toPointId: 'pt-end',
        mode: sourceKind === 'explorer_route' ? 'imported_preserved' : 'routed',
        geometry: {
          type: 'LineString',
          coordinates: [mid, end],
        },
        distanceKm: 7.9,
        durationMin: 140,
        ascentM: 180,
        descentM: 380,
        surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'unknown', source: null }],
        routingInputHash: null,
        provenance: {
          provider: sourceKind === 'explorer_route' ? 'explorer-catalog' : 'compas',
          calculatedAt: nowIso,
          profile: 'marche',
          confidence: 'estimated',
        },
        warnings: [],
        entityVersion: 1,
      },
    ],
    stages: [
      {
        id: 'stage-1',
        workspaceId: wsId,
        orderKey: '001',
        dayNumber: 1,
        title: 'Jour 1',
        dateIso: null,
        departureTimeLocal: '08:30',
        timezone: 'Europe/Paris',
        startPointId: 'pt-start',
        endPointId: 'pt-mid',
        overnightPlace: {
          id: 'stay-1',
          name: 'Refuge intermédiaire',
          type: 'refuge',
          lat: mid[1],
          lon: mid[0],
          bookingStatus: 'planned',
          provenance: 'Catalogue LKDV',
          lastVerifiedAt: nowIso,
        },
        notes: '',
        waterObservations: [],
        weatherSlice: null,
        hazards: [],
        entityVersion: 1,
      },
      {
        id: 'stage-2',
        workspaceId: wsId,
        orderKey: '002',
        dayNumber: 2,
        title: 'Jour 2',
        dateIso: null,
        departureTimeLocal: '08:30',
        timezone: 'Europe/Paris',
        startPointId: 'pt-mid',
        endPointId: 'pt-end',
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
        id: 'kit-water',
        name: 'Poche à eau 2 L',
        category: 'hydratation',
        weightGrams: 180,
        quantity: 1,
        shared: false,
        assigneeUserId: userId,
        assigneeName: userName,
        dependsOn: ['water', 'distance', 'duration'],
        status: 'confirmed',
      },
      {
        id: 'kit-tent',
        name: 'Tente 3 places',
        category: 'abri',
        weightGrams: 2150,
        quantity: 1,
        shared: true,
        assigneeUserId: userId,
        assigneeName: userName,
        dependsOn: ['overnight', 'weather'],
        status: 'confirmed',
      },
    ],
    members: [{ userId, displayName: userName, role: 'owner' }],
    revisions: [],
    packs: [],
    participantPacks: [],
    updatedAt: nowIso,
  };
}

export function RouteCollabPageClient({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const initialWorkspace = useMemo(
    () => buildDefaultWorkspace(userId, userName),
    [userId, userName],
  );
  return (
    <RouteCollabWorkspace
      initialWorkspace={initialWorkspace}
      currentUserId={userId}
      currentUserName={userName}
    />
  );
}
