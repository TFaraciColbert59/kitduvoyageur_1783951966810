import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRouteCollabStore } from '@/features/route-collab/store';
import { storeErrorResponse } from '@/features/route-collab/store/httpErrors';
import { getAuthenticatedRouteActor } from '../_auth';

export const dynamic = 'force-dynamic';

const KitSchema = z.object({
  action: z.enum(['assign', 'revalidate', 'add']),
  itemId: z.string().min(1).max(80).optional(),
  assigneeUserId: z.string().max(120).nullable().optional(),
  newItem: z
    .object({
      id: z.string().min(1).max(80),
      inventoryItemId: z.string().max(80).nullable().optional(),
      name: z.string().min(1).max(160),
      category: z.string().max(80),
      weightGrams: z.number().min(0).max(50000).nullable(),
      quantity: z.number().int().min(1).max(50),
      shared: z.boolean(),
      assigneeUserId: z.string().max(120).nullable(),
      assigneeName: z.string().max(120).nullable(),
      dependsOn: z.array(z.enum(['overnight', 'water', 'weather', 'duration', 'distance'])),
      status: z.enum(['confirmed', 'needs_revalidation', 'unassigned']),
    })
    .optional(),
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
  const parsed = KitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête kit invalide.' }, { status: 400 });
  }

  try {
    const store = await getRouteCollabStore();
    const res = await store.updateWorkspaceKitItem({
      workspaceId: id,
      actorId: actor.userId,
      action: parsed.data.action,
      itemId: parsed.data.itemId,
      assigneeUserId: parsed.data.assigneeUserId,
      newItem: parsed.data.newItem,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json(res);
  } catch (error) {
    return storeErrorResponse(error);
  }
}
