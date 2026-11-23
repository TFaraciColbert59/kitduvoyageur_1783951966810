import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { exportWorkspaceGpx } from '@/features/route-collab/engine';
import { getRouteCollabStore } from '@/features/route-collab/store';
import { storeErrorResponse } from '@/features/route-collab/store/httpErrors';
import { getAuthenticatedRouteActor } from '../_auth';

export const dynamic = 'force-dynamic';

const StageIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const ShareTokenSchema = z.string().min(8).max(200);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await getAuthenticatedRouteActor();
  const rawToken = request.nextUrl.searchParams.get('token');
  const rawStageId = request.nextUrl.searchParams.get('stageId');
  const stageParse = rawStageId === null ? null : StageIdSchema.safeParse(rawStageId);
  if (stageParse && !stageParse.success) {
    return new NextResponse('Identifiant d’étape invalide.', { status: 400 });
  }
  const tokenParse = rawToken === null ? null : ShareTokenSchema.safeParse(rawToken);
  if (tokenParse && !tokenParse.success) {
    return new NextResponse('Jeton de partage invalide.', { status: 400 });
  }
  const stageId = stageParse?.success ? stageParse.data : undefined;
  const shareToken = tokenParse?.success ? tokenParse.data : null;

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
  // Nom ASCII sûr pour `filename` (aucun guillemet, saut de ligne ni point-virgule) ; le titre réel,
  // accents compris, passe par `filename*` encodé RFC 5987.
  const asciiName =
    res.workspace.title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'itineraire';
  const filename = stageId ? `${asciiName}-${stageId}.gpx` : `${asciiName}.gpx`;
  const utf8Name = encodeURIComponent(
    `${res.workspace.title.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80) || 'itineraire'}${stageId ? `-${stageId}` : ''}.gpx`,
  ).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

  return new NextResponse(gpxXml, {
    status: 200,
    headers: {
      'Content-Type': 'application/gpx+xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${utf8Name}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}
