import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRouteCollabStore } from '@/features/route-collab/store';
import { storeErrorResponse } from '@/features/route-collab/store/httpErrors';
import { getAuthenticatedRouteActor } from '../_auth';

export const dynamic = 'force-dynamic';

const PublishSchema = z.object({
  expectedHeadSeq: z.number().int().nonnegative(),
  summary: z.string().max(240).default(''),
  acknowledgedUnknowns: z.array(z.string().max(160)).optional(),
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
  const parsed = PublishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres de publication invalides.' }, { status: 400 });
  }

  try {
    const store = await getRouteCollabStore();
    const res = await store.publishWorkspace({
      workspaceId: id,
      actorId: actor.userId,
      actorName: actor.displayName,
      expectedHeadSeq: parsed.data.expectedHeadSeq,
      summary: parsed.data.summary,
      acknowledgedUnknowns: parsed.data.acknowledgedUnknowns,
    });
    if (res.status === 'not_found') {
      return NextResponse.json({ error: 'Itinéraire introuvable.' }, { status: 404 });
    }
    if (res.status === 'blocked') {
      return NextResponse.json(res, { status: 409 });
    }
    return NextResponse.json(res);
  } catch (error) {
    return storeErrorResponse(error);
  }
}
