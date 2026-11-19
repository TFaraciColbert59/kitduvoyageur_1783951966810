import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createWorkspaceRecord,
  listWorkspacesForActor,
} from '@/features/route-collab/serverStore';
import type { RouteWorkspaceState } from '@/features/route-collab/types';
import { getAuthenticatedRouteActor } from '@/app/api/routes/[id]/_auth';

export const dynamic = 'force-dynamic';

const CreateWorkspaceSchema = z.object({
  id: z.string().min(3).max(80).optional(),
  tripId: z.string().min(1).max(80).optional(),
  title: z.string().min(2).max(160),
  sport: z.enum(['marche', 'route', 'gravel', 'vtt', 'enduro']).default('marche'),
  workspace: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  const actor = await getAuthenticatedRouteActor();
  if (!actor) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }
  return NextResponse.json({ workspaces: listWorkspacesForActor(actor.userId) });
}

export async function POST(request: Request) {
  const actor = await getAuthenticatedRouteActor();
  if (!actor) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 });
  }
  const parsed = CreateWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload de création invalide.' }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const wsId = parsed.data.id ?? `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const incoming = parsed.data.workspace as Partial<RouteWorkspaceState> | undefined;

  const existingMembers = Array.isArray(incoming?.members) ? incoming.members : [];
  const hasActor = existingMembers.some((m) => m.userId === actor.userId);
  const members = hasActor
    ? existingMembers
    : [{ userId: actor.userId, displayName: actor.displayName, role: 'owner' as const }, ...existingMembers];

  const workspace: RouteWorkspaceState = {
    id: wsId,
    tripId: parsed.data.tripId ?? incoming?.tripId ?? `trip-${wsId}`,
    title: parsed.data.title,
    status: 'draft',
    sport: parsed.data.sport,
    shapeMode: incoming?.shapeMode ?? 'one_way',
    routingOptions: incoming?.routingOptions ?? {},
    headSeq: 0,
    reviewedSeq: null,
    publishedRevisionId: null,
    publishedRevisionNo: null,
    sourceOrigin: incoming?.sourceOrigin ?? { kind: 'blank', importedAt: nowIso },
    shareLink: null,
    clubEventId: incoming?.clubEventId ?? null,
    points: incoming?.points ?? [
      {
        id: 'pt-start',
        workspaceId: wsId,
        kind: 'start',
        orderKey: 'A',
        lat: 45.052,
        lon: 5.512,
        eleM: 1100,
        name: 'Corrençon-en-Vercors',
        entityVersion: 1,
      },
      {
        id: 'pt-mid',
        workspaceId: wsId,
        kind: 'stage_boundary',
        orderKey: 'M',
        lat: 45.068,
        lon: 5.535,
        eleM: 1520,
        name: 'Refuge des Aigles',
        semanticKind: 'refuge',
        entityVersion: 1,
      },
      {
        id: 'pt-end',
        workspaceId: wsId,
        kind: 'finish',
        orderKey: 'Z',
        lat: 45.084,
        lon: 5.558,
        eleM: 1240,
        name: 'Villard-de-Lans',
        entityVersion: 1,
      },
    ],
    sections: incoming?.sections ?? [
      {
        id: 'sec-1',
        workspaceId: wsId,
        fromPointId: 'pt-start',
        toPointId: 'pt-mid',
        mode: 'routed',
        geometry: {
          type: 'LineString',
          coordinates: [
            [5.512, 45.052],
            [5.535, 45.068],
          ],
        },
        distanceKm: 8.4,
        durationMin: 155,
        ascentM: 420,
        descentM: 70,
        surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'trail', source: 'OSM' }],
        routingInputHash: null,
        provenance: { provider: 'compas', calculatedAt: nowIso, profile: parsed.data.sport, confidence: 'estimated' },
        warnings: [],
        entityVersion: 1,
      },
      {
        id: 'sec-2',
        workspaceId: wsId,
        fromPointId: 'pt-mid',
        toPointId: 'pt-end',
        mode: 'routed',
        geometry: {
          type: 'LineString',
          coordinates: [
            [5.535, 45.068],
            [5.558, 45.084],
          ],
        },
        distanceKm: 7.9,
        durationMin: 140,
        ascentM: 180,
        descentM: 380,
        surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'unknown', source: null }],
        routingInputHash: null,
        provenance: { provider: 'compas', calculatedAt: nowIso, profile: parsed.data.sport, confidence: 'estimated' },
        warnings: [],
        entityVersion: 1,
      },
    ],
    stages: incoming?.stages ?? [
      {
        id: 'stage-1',
        workspaceId: wsId,
        orderKey: '001',
        dayNumber: 1,
        title: 'Jour 1',
        dateIso: '2026-11-22',
        departureTimeLocal: '08:30',
        timezone: 'Europe/Paris',
        startPointId: 'pt-start',
        endPointId: 'pt-mid',
        overnightPlace: {
          id: 'ref-aigles',
          name: 'Refuge des Aigles',
          type: 'refuge',
          lat: 45.068,
          lon: 5.535,
          bookingStatus: 'confirmed',
          provenance: 'FFCAM',
          lastVerifiedAt: nowIso,
        },
        notes: 'Départ matinal',
        waterObservations: [
          {
            id: 'w1',
            name: 'Source du Col',
            lat: 45.06,
            lon: 5.523,
            status: 'flowing',
            potableClaim: 'unknown',
            observedAt: nowIso,
            source: 'osm',
          },
        ],
        weatherSlice: {
          pointId: 'pt-mid',
          locationLabel: 'Refuge des Aigles',
          forecastFor: '2026-11-22 14:00 Europe/Paris',
          fetchedAt: nowIso,
          provider: 'Open-Meteo',
          temperatureC: 9,
          precipitationProbability: 25,
          windKph: 18,
          status: 'fresh',
        },
        hazards: [],
        entityVersion: 1,
      },
      {
        id: 'stage-2',
        workspaceId: wsId,
        orderKey: '002',
        dayNumber: 2,
        title: 'Jour 2',
        dateIso: '2026-11-23',
        departureTimeLocal: '08:30',
        timezone: 'Europe/Paris',
        startPointId: 'pt-mid',
        endPointId: 'pt-end',
        overnightPlace: null,
        notes: 'Descente vers Villard',
        waterObservations: [],
        weatherSlice: null,
        hazards: [],
        entityVersion: 1,
      },
    ],
    variants: incoming?.variants ?? [],
    proposals: incoming?.proposals ?? [],
    comments: incoming?.comments ?? [],
    kitItems: incoming?.kitItems ?? [
      {
        id: 'kit-tent',
        inventoryItemId: 'inv-tent-3p',
        name: 'Tente 3 places',
        category: 'abri',
        weightGrams: 2150,
        quantity: 1,
        shared: true,
        assigneeUserId: actor.userId,
        assigneeName: actor.displayName,
        dependsOn: ['overnight', 'weather'],
        status: 'confirmed',
      },
      {
        id: 'kit-water',
        inventoryItemId: 'inv-water-2l',
        name: 'Poche à eau 2 L',
        category: 'hydratation',
        weightGrams: 180,
        quantity: 1,
        shared: false,
        assigneeUserId: actor.userId,
        assigneeName: actor.displayName,
        dependsOn: ['water', 'distance', 'duration'],
        status: 'confirmed',
      },
      {
        id: 'kit-boots',
        inventoryItemId: 'inv-boots',
        name: 'Chaussures de randonnée',
        category: 'chaussant',
        weightGrams: 980,
        quantity: 1,
        shared: false,
        assigneeUserId: actor.userId,
        assigneeName: actor.displayName,
        dependsOn: [],
        status: 'confirmed',
      },
    ],
    members,
    revisions: [],
    packs: [],
    participantPacks: [],
    updatedAt: nowIso,
  };

  const created = createWorkspaceRecord(workspace);
  return NextResponse.json({ workspace: created }, { status: 201 });
}
