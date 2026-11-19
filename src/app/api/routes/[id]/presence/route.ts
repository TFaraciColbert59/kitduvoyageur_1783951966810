import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateWorkspacePresence } from '@/features/route-collab/serverStore';
import { getAuthenticatedRouteActor } from '../_auth';

export const dynamic = 'force-dynamic';

const PresenceSchema = z.object({
  activeStageId: z.string().max(80).nullable().optional(),
  selectedEntityId: z.string().max(80).nullable().optional(),
  softLockEntityId: z.string().max(80).nullable().optional(),
  mode: z.enum(['viewing', 'editing', 'reviewing']).default('viewing'),
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
  const parsed = PresenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Présence invalide.' }, { status: 400 });
  }

  const res = updateWorkspacePresence({
    workspaceId: id,
    actorId: actor.userId,
    actorName: actor.displayName,
    ...parsed.data,
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res);
}
