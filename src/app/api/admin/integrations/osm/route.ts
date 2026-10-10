import { NextRequest } from 'next/server';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { ok } from '@/server/admin/respond';
import { readCorrelationId } from '@/lib/observability/correlation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/integrations/osm — état de l'intégration OSM.
 * État DÉGRADÉ documenté (triage #8) : `fetch-osm-trails` = stub
 * `export {};`, `verify_jwt=false` (constat 2026-10-05). Aucune valeur
 * live inventée : tant que la fonction n'est pas réparée, le statut reste
 * dégradé avec la raison exacte.
 */
export async function GET(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('admin.access');
  if (!gate.ok) return gate.response;

  const res = ok(
    {
      provider: 'osm',
      function: 'fetch-osm-trails',
      status: 'degraded',
      reason: 'stub export {} — verify_jwt=false (constat 2026-10-05, triage #8)',
      last_run: null,
      source: 'docs/admin-os/SECURITY_TRIAGE_P0.md',
    },
    { correlationId: correlationId ?? undefined }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
