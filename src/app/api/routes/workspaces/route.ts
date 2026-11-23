import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRouteCollabStore } from '@/features/route-collab/store';
import { storeErrorResponse } from '@/features/route-collab/store/httpErrors';
import type { RouteWorkspaceState } from '@/features/route-collab/types';
import { getAuthenticatedRouteActor } from '@/app/api/routes/[id]/_auth';
import {
  InitialWorkspaceSchema,
  MAX_INITIAL_WORKSPACE_CHARS,
  SportSchema,
  readBoundedJson,
} from '@/app/api/routes/_schemas';

export const dynamic = 'force-dynamic';

const CreateWorkspaceSchema = z.object({
  id: z.string().min(3).max(80).optional(),
  tripId: z.string().min(1).max(80).optional(),
  title: z.string().min(2).max(160),
  sport: SportSchema.default('marche'),
  /** Instantané initial (schéma borné : coordonnées, longueurs, nombre d'éléments, taille totale). */
  workspace: InitialWorkspaceSchema.optional(),
});

export async function GET() {
  const actor = await getAuthenticatedRouteActor();
  if (!actor) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }
  try {
    const store = await getRouteCollabStore();
    return NextResponse.json({ workspaces: await store.listWorkspacesForActor(actor.userId) });
  } catch (error) {
    return storeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const actor = await getAuthenticatedRouteActor();
  if (!actor) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }
  const read = await readBoundedJson(request);
  if (!read.ok) {
    return NextResponse.json({ error: read.error }, { status: read.status });
  }
  const parsed = CreateWorkspaceSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload de création invalide.' }, { status: 400 });
  }
  if (parsed.data.workspace && JSON.stringify(parsed.data.workspace).length > MAX_INITIAL_WORKSPACE_CHARS) {
    return NextResponse.json({ error: 'Instantané initial trop volumineux.' }, { status: 413 });
  }

  const nowIso = new Date().toISOString();
  const wsId = parsed.data.id ?? `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const incoming = parsed.data.workspace;

  const existingMembers = incoming?.members ?? [];
  const hasActor = existingMembers.some((m) => m.userId === actor.userId);
  const members = hasActor
    ? existingMembers
    : [{ userId: actor.userId, displayName: actor.displayName, role: 'owner' as const }, ...existingMembers];

  // Rien d'inventé : sans instantané fourni, l'espace démarre vide (aucun point, tronçon, étape ni objet
  // de sac). Le client envoie l'état complet quand il en a un.
  const workspace = {
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
    points: incoming?.points ?? [],
    sections: incoming?.sections ?? [],
    stages: incoming?.stages ?? [],
    variants: incoming?.variants ?? [],
    proposals: incoming?.proposals ?? [],
    comments: incoming?.comments ?? [],
    kitItems: incoming?.kitItems ?? [],
    members,
    revisions: [],
    packs: [],
    participantPacks: [],
    updatedAt: nowIso,
  } as unknown as RouteWorkspaceState;

  try {
    const store = await getRouteCollabStore();
    const created = await store.createWorkspaceRecord(workspace);
    return NextResponse.json({ workspace: created }, { status: 201 });
  } catch (error) {
    return storeErrorResponse(error);
  }
}
