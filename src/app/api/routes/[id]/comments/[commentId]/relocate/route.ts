import { NextResponse } from 'next/server';
import { getRouteCollabStore } from '@/features/route-collab/store';
import { storeErrorResponse } from '@/features/route-collab/store/httpErrors';
import { RelocateSchema } from '../../../../_teamSchemas';
import { getAuthenticatedRouteActor } from '../../../_auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const { id, commentId } = await params;
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
  const parsed = RelocateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ancre invalide.' }, { status: 400 });
  }
  try {
    const store = await getRouteCollabStore();
    const res = await store.relocateWorkspaceComment({
      workspaceId: id,
      commentId,
      actorId: actor.userId,
      newAnchor: parsed.data.newAnchor,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json(res);
  } catch (error) {
    return storeErrorResponse(error);
  }
}
