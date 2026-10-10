import { NextRequest } from 'next/server';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { readCorrelationId } from '@/lib/observability/correlation';
import { flagDebt } from '@/features/admin-os/experiments/flags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/experiments/flags — registre + dette (stale/always-on). */
export async function GET(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('admin.access');
  if (!gate.ok) return gate.response;
  const { supabase } = gate.ctx;

  const { data: flags, error: flagsError } = await supabase
    .from('feature_flags')
    .select('id, enabled, scope, updated_at')
    .order('id');
  if (flagsError) {
    return fail('read_failed', 'Lecture impossible', 500, correlationId ?? undefined);
  }
  const { data: cohorts, error: cohortsError } = await supabase.rpc('get_feature_flag_cohorts');
  if (cohortsError) {
    return fail('read_failed', 'Cohortes illisibles', 500, correlationId ?? undefined);
  }
  const pct = new Map(
    ((cohorts ?? []) as { flag_id: string; percentage: number }[]).map((c) => [c.flag_id, c.percentage])
  );
  const rows = ((flags ?? []) as { id: string; enabled: boolean; scope: string; updated_at: string }[]).map(
    (f) => ({ ...f, rollout_percentage: pct.get(f.id) ?? null })
  );
  const res = ok(
    { data: rows, debt: flagDebt(rows), source: 'feature_flags' },
    { correlationId: correlationId ?? undefined }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
