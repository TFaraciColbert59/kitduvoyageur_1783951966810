import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRouteCollabStore } from '@/features/route-collab/store';
import { storeErrorResponse } from '@/features/route-collab/store/httpErrors';
import type { RouteOperationInput } from '@/features/route-collab/types';
import { getAuthenticatedRouteActor } from '../_auth';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  opId: z.string().min(1).max(120),
  baseSeq: z.number().int().nonnegative(),
  expectedVersions: z.record(z.string(), z.number().int().nonnegative()).optional(),
  operation: z.record(z.string(), z.unknown()),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success || typeof parsed.data.operation.type !== 'string') {
    return NextResponse.json({ error: 'Opération invalide.' }, { status: 400 });
  }

  try {
    const store = await getRouteCollabStore();
    const res = await store.submitWorkspaceOperation(id, {
      opId: parsed.data.opId,
      baseSeq: parsed.data.baseSeq,
      actorId: actor.userId,
      actorName: actor.displayName,
      expectedVersions: parsed.data.expectedVersions,
      operation: parsed.data.operation as unknown as RouteOperationInput,
    });

    if (res.status === 'not_found') {
      return NextResponse.json({ error: 'Itinéraire introuvable.' }, { status: 404 });
    }
    if (res.status === 'denied') {
      return NextResponse.json(res, { status: 403 });
    }
    if (res.status === 'conflict') {
      return NextResponse.json(res, { status: 409 });
    }
    return NextResponse.json(res);
  } catch (error) {
    return storeErrorResponse(error);
  }
}
