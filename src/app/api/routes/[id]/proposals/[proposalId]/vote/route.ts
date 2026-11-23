import { NextResponse } from 'next/server';
import { getRouteCollabStore } from '@/features/route-collab/store';
import { storeErrorResponse } from '@/features/route-collab/store/httpErrors';
import { VoteSchema } from '../../../../_teamSchemas';
import { getAuthenticatedRouteActor } from '../../../_auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; proposalId: string }> },
) {
  const { id, proposalId } = await params;
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
  const parsed = VoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Vote invalide.' }, { status: 400 });
  }
  try {
    const store = await getRouteCollabStore();
    const res = await store.voteWorkspaceProposal({
      workspaceId: id,
      proposalId,
      actorId: actor.userId,
      vote: parsed.data.vote,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json(res);
  } catch (error) {
    return storeErrorResponse(error);
  }
}
