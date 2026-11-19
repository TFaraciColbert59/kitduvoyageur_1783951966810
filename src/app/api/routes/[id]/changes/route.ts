import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceChangesAfter } from '@/features/route-collab/serverStore';
import { getAuthenticatedRouteActor } from '../_auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await getAuthenticatedRouteActor();
  const shareToken = request.nextUrl.searchParams.get('token');
  const afterRaw = Number(request.nextUrl.searchParams.get('after') ?? '0');
  const afterSeq = Number.isFinite(afterRaw) && afterRaw >= 0 ? Math.floor(afterRaw) : 0;

  const res = getWorkspaceChangesAfter(id, actor?.userId ?? null, afterSeq, shareToken);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(res);
}
