// Audit de modération (10.10) : traces publiques, commentaires et liens partagés d'itinéraire + journal
// d'audit. Réservé aux modérateurs (`is_moderateur()`), lecture et écriture sous RLS, entrée validée par zod.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { decideRouteModeration, listAuditLog, listRouteModeration } from '@/features/route-collab/server/adminModeration';
import { ROUTE_MODERATION_TYPES } from '@/features/route-collab/moderationModel';

export const dynamic = 'force-dynamic';

const HTTP: Record<string, number> = { unauthenticated: 401, forbidden: 403, error: 500 };

const decisionSchema = z
  .object({
    type: z.enum(ROUTE_MODERATION_TYPES),
    id: z.string().trim().min(1).max(80),
    decision: z.enum(['approve', 'reject', 'flag']),
  })
  .strict();

export async function GET(request: Request) {
  const view = new URL(request.url).searchParams.get('view');
  const result = view === 'audit' ? await listAuditLog() : await listRouteModeration();
  return NextResponse.json(result, { status: HTTP[result.status] ?? 200 });
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ status: 'invalid' }, { status: 400 });
  }
  const parsed = decisionSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ status: 'invalid' }, { status: 400 });
  const result = await decideRouteModeration(parsed.data);
  return NextResponse.json(result, { status: HTTP[result.status] ?? 200 });
}
