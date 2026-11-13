import { NextResponse } from 'next/server';
import { getLiveSegment } from '@/lib/live-segments/server/catalog';
import { LIVE_SEGMENTS_NO_STORE, notFound } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/live-segments/[id]
 *
 * Définition complète et assainie d'un segment : trace ordonnée, distance
 * cumulée, dénivelé et fantômes autorisés. Aucune donnée personnelle.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  const entry = getLiveSegment(id);
  if (!entry) return notFound();

  return NextResponse.json(
    {
      segment: entry.definition,
      region: entry.region,
      dataSource: entry.dataSource,
    },
    { headers: LIVE_SEGMENTS_NO_STORE },
  );
}
