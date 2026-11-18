import { NextResponse } from 'next/server';
import { getWorkspaceForActor } from '@/features/route-collab/serverStore';
import { getAuthenticatedRouteActor } from '../_auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await getAuthenticatedRouteActor();
  const res = getWorkspaceForActor(id, actor?.userId ?? null);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({
    workspace: res.workspace,
    notifications: res.notifications,
  });
}
