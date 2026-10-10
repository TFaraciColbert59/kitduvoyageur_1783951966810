import { NextRequest } from 'next/server';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { ok } from '@/server/admin/respond';
import { readCorrelationId } from '@/lib/observability/correlation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/data/catalog — catalogue des tables du schéma public.
 * Lecture `information_schema` (métadonnées, pas de données métier).
 * Best-effort : dégradé explicite si indisponible via Data API.
 */
export async function GET(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('admin.access');
  if (!gate.ok) return gate.response;

  // information_schema n'est pas exposé via PostgREST : aucune requête
  // factice n'est émise. Voie outillée : `supabase inspect` / Studio ;
  // RLS explorer + lineage en P4+.
  const res = ok(
    {
      status: 'degraded',
      reason: 'catalogue information_schema non exposé via Data API — utiliser `supabase inspect` / Studio ; RLS explorer en P4+',
      source: 'static',
    },
    { correlationId: correlationId ?? undefined }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
