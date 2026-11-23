import { NextResponse } from 'next/server';
import { getRouteCollabStore } from '@/features/route-collab/store';
import { storeErrorResponse } from '@/features/route-collab/store/httpErrors';
import { PresenceSchema } from '../../_teamSchemas';
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

  try {
    const store = await getRouteCollabStore();
    const res = await store.updateWorkspacePresence({
      workspaceId: id,
      actorId: actor.userId,
      actorName: actor.displayName,
      ...parsed.data,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json(res);
  } catch (error) {
    return storeErrorResponse(error);
  }
}
