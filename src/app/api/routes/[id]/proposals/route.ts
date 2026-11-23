import { NextResponse } from 'next/server';
import { getRouteCollabStore } from '@/features/route-collab/store';
import { storeErrorResponse } from '@/features/route-collab/store/httpErrors';
import type { RouteOperationInput } from '@/features/route-collab/types';
import { MAX_OPERATION_CHARS, readBoundedJson } from '../../_schemas';
import { ProposalSchema } from '../../_teamSchemas';
import { getAuthenticatedRouteActor } from '../_auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await getAuthenticatedRouteActor();
  if (!actor) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }
  const read = await readBoundedJson(request, MAX_OPERATION_CHARS * 5);
  if (!read.ok) {
    return NextResponse.json({ error: read.error }, { status: read.status });
  }
  const parsed = ProposalSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Proposition invalide.' }, { status: 400 });
  }
  // La proposition est stockée dans le snapshot (partie `proposals`, 1 Mo maximum côté base).
  if (JSON.stringify(parsed.data.operations).length > 600_000) {
    return NextResponse.json({ error: 'Proposition trop volumineuse.' }, { status: 413 });
  }

  try {
    const store = await getRouteCollabStore();
    const res = await store.createWorkspaceProposal({
      workspaceId: id,
      actorId: actor.userId,
      actorName: actor.displayName,
      title: parsed.data.title,
      rationale: parsed.data.rationale,
      operations: parsed.data.operations as RouteOperationInput[],
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json(res, { status: 201 });
  } catch (error) {
    return storeErrorResponse(error);
  }
}
