import { NextRequest, NextResponse } from 'next/server';
import { exportWorkspaceGpx } from '@/features/route-collab/engine';
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
  const stageId = request.nextUrl.searchParams.get('stageId') ?? undefined;

  let res;
  try {
    const store = await getRouteCollabStore();
    res = await store.getWorkspaceForActor(id, actor?.userId ?? null, shareToken);
  } catch (error) {
    return storeErrorResponse(error);
  }
  if (!res.ok) {
    return new NextResponse(res.error, { status: res.status });
  }

  const gpxXml = exportWorkspaceGpx(res.workspace, stageId);
  const safeName = res.workspace.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'itineraire';
  const filename = stageId ? `${safeName}-${stageId}.gpx` : `${safeName}.gpx`;

  return new NextResponse(gpxXml, {
    status: 200,
    headers: {
      'Content-Type': 'application/gpx+xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
