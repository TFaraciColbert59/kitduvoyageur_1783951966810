import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { readCorrelationId } from '@/lib/observability/correlation';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { PERMISSION_REGISTRY } from '@/server/admin/permissions';
import {
  isElevationActive,
  validateElevationRequest,
} from '@/features/admin-os/access/elevations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/access/elevations — élévations actives (admin.access).
 * Expiration calculée serveur (jamais de confiance client).
 */
export async function GET(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('admin.access');
  if (!gate.ok) return gate.response;

  const { data, error } = await gate.ctx.supabase
    .from('admin_elevations')
    .select('id, user_id, permission_code, reason, ticket_id, granted_at, expires_at, revoked_at, is_break_glass')
    .is('revoked_at', null)
    .order('expires_at', { ascending: true })
    .limit(50);
  if (error) {
    return fail('read_failed', 'Lecture impossible', 500, correlationId ?? undefined);
  }
  const now = Date.now();
  const rows = ((data ?? []) as {
    id: string;
    user_id: string;
    permission_code: string;
    reason: string;
    ticket_id: string | null;
    granted_at: string;
    expires_at: string;
    revoked_at: string | null;
    is_break_glass: boolean;
  }[]).map((e) => ({ ...e, active: isElevationActive(e, now) }));
  const res = ok(
    { data: rows.filter((r) => r.active), expired: rows.filter((r) => !r.active).length },
    { correlationId: correlationId ?? undefined }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

const requestSchema = z.object({
  permission_code: z.string().min(1).max(120),
  reason: z.string().min(10).max(2000),
  ticket_id: z.string().max(120).optional(),
  duration_min: z.number().int().positive().max(480),
});

/**
 * POST — demande d'élévation JIT (auto-limitée ≤ 8 h). Gate `access.elevate`
 * (Tier3, AAL2 auto) : pas d'auto-octroi au premier rôle venu. Tier4 =
 * break-glass : ticket obligatoire + action d'audit dédiée (alerte d'usage).
 */
export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('access.elevate');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return fail('csrf_invalid', 'Jeton CSRF invalide', 403, correlationId ?? undefined);
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-access-elevations',
    limit: 20,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const body = requestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return fail('invalid_body', 'Requête invalide', 400, correlationId ?? undefined);
  }
  const def = PERMISSION_REGISTRY[body.data.permission_code];
  if (!def) {
    return fail('unknown_permission', 'Permission inconnue', 400, correlationId ?? undefined);
  }
  const invalid = validateElevationRequest({ ...body.data, tier: def.tier });
  if (invalid) {
    const status = invalid === 'break_glass_ticket_required' ? 409 : 400;
    return fail(invalid, 'Élévation refusée', status, correlationId ?? undefined);
  }

  const isBreakGlass = def.tier >= 4;
  const { data, error } = await supabase
    .from('admin_elevations')
    .insert({
      user_id: user.id,
      permission_code: body.data.permission_code,
      reason: body.data.reason.trim(),
      ticket_id: body.data.ticket_id ?? null,
      granted_by: user.id,
      expires_at: new Date(Date.now() + body.data.duration_min * 60000).toISOString(),
      is_break_glass: isBreakGlass,
    })
    .select('id, expires_at')
    .single();
  if (error || !data) {
    return fail('elevation_failed', 'Élévation impossible', 500, correlationId ?? undefined);
  }

  await logAdminAction({
    action: isBreakGlass ? 'break_glass.use' : 'elevation.grant',
    actor_id: user.id,
    target_table: 'admin_elevations',
    target_id: (data as { id: string }).id,
    diff: { permission_code: body.data.permission_code, duration_min: body.data.duration_min },
    risk_tier: 4,
    correlation_id: correlationId ?? undefined,
    reason: body.data.reason,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });

  const res = ok(
    { elevation: data },
    { correlationId: correlationId ?? undefined, status: 201 }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
