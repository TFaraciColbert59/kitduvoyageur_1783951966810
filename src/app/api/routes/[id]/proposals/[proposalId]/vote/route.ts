import { NextResponse } from 'next/server';
import { z } from 'zod';
import { voteWorkspaceProposal } from '@/features/route-collab/serverStore';
import { getAuthenticatedRouteActor } from '../../../_auth';

export const dynamic = 'force-dynamic';

const VoteSchema = z.object({ vote: z.enum(['up', 'down']) });

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
  const res = voteWorkspaceProposal({
    workspaceId: id,
    proposalId,
    actorId: actor.userId,
    vote: parsed.data.vote,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res);
}
