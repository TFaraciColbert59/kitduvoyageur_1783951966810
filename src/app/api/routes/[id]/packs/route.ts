import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
  const revRaw = request.nextUrl.searchParams.get('revisionNo');
  const revisionNo = revRaw != null ? Number(revRaw) : undefined;
  try {
    const store = await getRouteCollabStore();
    const res = await store.getPackManifestForRevision(
      id,
      actor?.userId ?? null,
      revisionNo != null && Number.isFinite(revisionNo) ? revisionNo : undefined,
    );
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ manifest: res.manifest });
  } catch (error) {
    return storeErrorResponse(error);
  }
}

const PackStateSchema = z.object({
  downloadedRevisionNo: z.number().int().positive().nullable().optional(),
  preparedRevisionNo: z.number().int().positive().nullable().optional(),
  status: z.enum(['not_downloaded', 'downloading', 'ready', 'outdated', 'failed']),
  verifiedLocalAt: z.string().nullable().optional(),
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
  const parsed = PackStateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'État de pack invalide.' }, { status: 400 });
  }
  try {
    const store = await getRouteCollabStore();
    const res = await store.markParticipantPackState({
      workspaceId: id,
      userId: actor.userId,
      displayName: actor.displayName,
      ...parsed.data,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 403 });
    return NextResponse.json(res);
  } catch (error) {
    return storeErrorResponse(error);
  }
}
