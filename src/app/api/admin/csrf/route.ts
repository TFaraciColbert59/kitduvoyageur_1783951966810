import { NextRequest } from 'next/server';

import { getOrIssueCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';
import { ok } from '@/server/admin/respond';
import { readCorrelationId } from '@/lib/observability/correlation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/csrf — émet le jeton double-submit pour les îlots clients. */
export async function GET(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const token = await getOrIssueCsrfToken();
  const res = ok({ csrfToken: token }, { correlationId: correlationId ?? undefined });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
