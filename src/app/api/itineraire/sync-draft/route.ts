// Synchronise le tracé du Compas (`trips.metadata.compas.routeDraft`) avec la version publiée de
// l'itinéraire (P4 / 10.1). À appeler après une publication ; idempotent. Droit d'édition du voyage exigé
// (RLS + `requireEditor`), entrée validée par zod, aucun contenu de tracé renvoyé.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { syncTripRouteDraftFromPublished } from '@/features/route-collab/server/publishedRoute';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ tripId: z.string().uuid() }).strict();

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ status: 'invalid' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ status: 'invalid' }, { status: 400 });
  const result = await syncTripRouteDraftFromPublished(parsed.data.tripId);
  const status = result.status === 'forbidden' ? 403 : result.status === 'error' ? 500 : result.status === 'invalid' ? 422 : 200;
  return NextResponse.json(result, { status });
}
