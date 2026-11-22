import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRouteCollabStore } from '@/features/route-collab/store';
import { storeErrorResponse } from '@/features/route-collab/store/httpErrors';
import { getAuthenticatedRouteActor } from '../_auth';

export const dynamic = 'force-dynamic';

const MemberActionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('member'),
    targetUserId: z.string().min(1).max(120),
    displayName: z.string().max(120).optional(),
    role: z.enum(['owner', 'co_organizer', 'editor', 'contributor', 'participant', 'external_viewer']).optional(),
    delegatedPublish: z.boolean().optional(),
    revoke: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('share_link'),
    action: z.enum(['create', 'revoke']),
    expiresInHours: z.number().positive().max(720).optional(),
    hidePrivateStartRadiusM: z.number().min(0).max(5000).optional(),
  }),
]);

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
  const parsed = MemberActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête membres/partage invalide.' }, { status: 400 });
  }

  try {
    const store = await getRouteCollabStore();
    if (parsed.data.kind === 'share_link') {
      const res = await store.manageShareLink({
        workspaceId: id,
        actorId: actor.userId,
        action: parsed.data.action,
        expiresInHours: parsed.data.expiresInHours,
        hidePrivateStartRadiusM: parsed.data.hidePrivateStartRadiusM,
      });
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
      return NextResponse.json(res);
    }

    const res = await store.updateMemberRoleOrRevoke({
      workspaceId: id,
      actorId: actor.userId,
      targetUserId: parsed.data.targetUserId,
      displayName: parsed.data.displayName,
      role: parsed.data.role,
      delegatedPublish: parsed.data.delegatedPublish,
      revoke: parsed.data.revoke,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json(res);
  } catch (error) {
    return storeErrorResponse(error);
  }
}
