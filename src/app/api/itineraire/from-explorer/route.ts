// « Préparer avec ce tracé » (10.4) : rattache un tracé de l'Explorer à un voyage puis renvoie le lien vers
// /compas/itineraire. Le tracé est relu côté serveur ; entrée validée par zod ; droits par RLS + requireEditor.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prepareTripWithExplorerRoute } from '@/features/explorer-v2/server/prepareWithTrack';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    routeId: z.number().int().positive().max(2_000_000_000),
    tripId: z.string().uuid().optional(),
  })
  .strict();

const HTTP: Record<string, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  no_geometry: 422,
  error: 500,
};

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ status: 'invalid' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ status: 'invalid' }, { status: 400 });
  const result = await prepareTripWithExplorerRoute(parsed.data);
  return NextResponse.json(result, { status: HTTP[result.status] ?? 200 });
}
