import { NextRequest, NextResponse } from 'next/server';
import { getRouteCollabStore } from '@/features/route-collab/store';
import { storeErrorResponse } from '@/features/route-collab/store/httpErrors';
import { getAuthenticatedRouteActor } from '../_auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await getAuthenticatedRouteActor();
  const shareToken = request.nextUrl.searchParams.get('token');
  try {
    const store = await getRouteCollabStore();
    const res = await store.getWorkspaceForActor(id, actor?.userId ?? null, shareToken);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({
      workspace: res.workspace,
      notifications: res.notifications,
      presence: res.presence,
      accessMode: res.accessMode,
    });
  } catch (error) {
    return storeErrorResponse(error);
  }
}
