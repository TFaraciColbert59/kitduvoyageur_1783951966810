import { NextRequest } from 'next/server';
import { z } from 'zod';

import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { readCorrelationId } from '@/lib/observability/correlation';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const mfaActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('enrolled'), factor_id: z.string().uuid() }),
  z.object({ action: z.literal('unenroll'), factor_id: z.string().uuid() }),
]);

/**
 * POST /api/admin/mfa — journalise une inscription TOTP vérifiée côté
 * client, ou révoque un facteur. Accessible en AAL1 (l'inscription
 * précède l'élévation) ; chaque écriture est journalisée.
 */
export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return fail('invalid_csrf_token', 'Jeton CSRF invalide', 403, correlationId ?? undefined);
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-mfa',
    limit: 10,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const body = mfaActionSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return fail('invalid_request', 'Requête invalide', 400, correlationId ?? undefined);
  }

  // Le facteur doit appartenir à l'appelant (jamais de factor_id d'autrui).
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError || !factors) {
    return fail('factors_unreadable', 'Facteurs illisibles', 500, correlationId ?? undefined);
  }
  const owned = [...(factors.totp ?? []), ...(factors.phone ?? [])].some(
    (f) => f.id === body.data.factor_id
  );
  if (!owned) {
    return fail('unknown_factor', 'Facteur inconnu', 404, correlationId ?? undefined);
  }

  if (body.data.action === 'unenroll') {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: body.data.factor_id });
    if (error) {
      console.error('[admin/mfa] révocation impossible', { code: error.code });
      return fail('revocation_failed', 'Révocation impossible', 500, correlationId ?? undefined);
    }
  }

  await logAdminAction({
    action: body.data.action === 'enrolled' ? 'mfa.enrolled' : 'mfa.unenrolled',
    actor_id: user.id,
    target_table: 'mfa_factors',
    target_id: body.data.factor_id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });
  return ok({ success: true }, { correlationId: correlationId ?? undefined });
}
