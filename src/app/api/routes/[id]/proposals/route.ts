import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createWorkspaceProposal } from '@/features/route-collab/serverStore';
import type { RouteOperationInput } from '@/features/route-collab/types';
import { getAuthenticatedRouteActor } from '../_auth';

export const dynamic = 'force-dynamic';

const ProposalSchema = z.object({
  title: z.string().min(2).max(160),
  rationale: z.string().max(500).default(''),
  operations: z.array(z.record(z.string(), z.unknown())).min(1),
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
  const parsed = ProposalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Proposition invalide.' }, { status: 400 });
  }

  const res = createWorkspaceProposal({
    workspaceId: id,
    actorId: actor.userId,
    actorName: actor.displayName,
    title: parsed.data.title,
    rationale: parsed.data.rationale,
    operations: parsed.data.operations as unknown as RouteOperationInput[],
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res, { status: 201 });
}
