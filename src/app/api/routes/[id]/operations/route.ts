import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRouteCollabStore } from '@/features/route-collab/store';
import { storeErrorResponse } from '@/features/route-collab/store/httpErrors';
import type { RouteOperationInput } from '@/features/route-collab/types';
import { RouteOperationSchema, operationSizeLimit, readBoundedJson } from '../../_schemas';
import { getAuthenticatedRouteActor } from '../_auth';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  opId: z.string().min(1).max(120),
  baseSeq: z.number().int().nonnegative(),
  expectedVersions: z.record(z.string(), z.number().int().nonnegative()).optional(),
  // Union discriminée de toutes les opérations du domaine (coordonnées, longueurs et tailles bornées).
  operation: RouteOperationSchema,
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
  const read = await readBoundedJson(request);
  if (!read.ok) {
    return NextResponse.json({ error: read.error }, { status: read.status });
  }
  const parsed = BodySchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Opération invalide.' }, { status: 400 });
  }
  if (JSON.stringify(parsed.data.operation).length > operationSizeLimit(parsed.data.operation.type)) {
    return NextResponse.json({ error: 'Opération trop volumineuse.' }, { status: 413 });
  }

  try {
    const store = await getRouteCollabStore();
    const res = await store.submitWorkspaceOperation(id, {
      opId: parsed.data.opId,
      baseSeq: parsed.data.baseSeq,
      actorId: actor.userId,
      actorName: actor.displayName,
      expectedVersions: parsed.data.expectedVersions,
      operation: parsed.data.operation as RouteOperationInput,
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
