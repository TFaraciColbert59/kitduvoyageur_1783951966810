import { NextResponse } from 'next/server';
import { z } from 'zod';
import { relocateWorkspaceComment } from '@/features/route-collab/serverStore';
import { getAuthenticatedRouteActor } from '../../../_auth';

export const dynamic = 'force-dynamic';

const RelocateSchema = z.object({
  newAnchor: z.object({
    anchorType: z.enum(['point', 'section', 'stage', 'position']),
    entityId: z.string().min(1),
    entityVersion: z.number().int().nonnegative(),
    fraction: z.number().min(0).max(1).optional(),
    originalLat: z.number().min(-90).max(90),
    originalLon: z.number().min(-180).max(180),
    maxRelocateMeters: z.number().positive().default(250),
  }),
});

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
  const res = relocateWorkspaceComment({
    workspaceId: id,
    commentId,
    actorId: actor.userId,
    newAnchor: parsed.data.newAnchor,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res);
}
