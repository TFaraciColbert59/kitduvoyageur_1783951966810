import { NextRequest } from 'next/server';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { readCorrelationId } from '@/lib/observability/correlation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/countries/freshness — fraîcheur du contenu destination.
 * Source : country_sync_log (statut ok/error/pending/stale + cache_valid_until).
 * Fraîcheur visible = donnée décisionnelle (principe : source + staleness).
 */
export async function GET(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('countries.read');
  if (!gate.ok) return gate.response;
  const { supabase } = gate.ctx;

  const { data, error } = await supabase
    .from('country_sync_log')
    .select('code_iso, synced_at, cache_valid_until, status, error_message, payload_size_bytes')
    .order('synced_at', { ascending: false })
    .limit(100);
  if (error) {
    return fail('read_failed', 'Lecture impossible', 500, correlationId ?? undefined);
  }
  const now = Date.now();
  const rows = ((data ?? []) as {
    code_iso: string;
    synced_at: string;
    cache_valid_until: string;
    status: string;
    error_message: string | null;
    payload_size_bytes: number | null;
  }[]).map((r) => ({
    ...r,
    stale: r.status !== 'ok' || Date.parse(r.cache_valid_until) < now,
  }));
  const staleCount = rows.filter((r) => r.stale).length;
  const res = ok(
    { data: rows, stale: staleCount, total: rows.length, source: 'country_sync_log' },
    { correlationId: correlationId ?? undefined }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
