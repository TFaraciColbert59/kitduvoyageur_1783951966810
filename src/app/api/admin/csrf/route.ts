import { NextResponse } from 'next/server';

import { getOrIssueCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/csrf — émet le jeton double-submit pour les îlots clients. */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const token = await getOrIssueCsrfToken();
  const res = NextResponse.json({ csrfToken: token });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
