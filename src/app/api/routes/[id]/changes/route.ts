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
  const afterRaw = Number(request.nextUrl.searchParams.get('after') ?? '0');
  const afterSeq = Number.isFinite(afterRaw) && afterRaw >= 0 ? Math.floor(afterRaw) : 0;

  try {
    const store = await getRouteCollabStore();
    const res = await store.getWorkspaceChangesAfter(id, actor?.userId ?? null, afterSeq, shareToken);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json(res);
  } catch (error) {
    return storeErrorResponse(error);
  }
}
