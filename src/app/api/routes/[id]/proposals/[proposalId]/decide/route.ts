import { NextResponse } from 'next/server';
import { z } from 'zod';
import { decideWorkspaceProposal } from '@/features/route-collab/serverStore';
import { getAuthenticatedRouteActor } from '../../_auth';

export const dynamic = 'force-dynamic';

const DecideSchema = z.object({
  decision: z.enum(['accept', 'reject']),
  expectedHeadSeq: z.number().int().nonnegative().optional(),
});

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
  const parsed = DecideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Décision invalide.' }, { status: 400 });
  }

  const res = decideWorkspaceProposal({
    workspaceId: id,
    proposalId,
    actorId: actor.userId,
    actorName: actor.displayName,
    decision: parsed.data.decision,
    expectedHeadSeq: parsed.data.expectedHeadSeq,
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res);
}
