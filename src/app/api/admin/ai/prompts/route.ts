import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { readCorrelationId } from '@/lib/observability/correlation';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/ai/prompts — registre des prompts (versions courantes).
 * Écriture : création de brouillon/version uniquement (POST) ; toute
 * promotion vers production passe par /promote (commande + approbation).
 */
export async function GET(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('admin.access');
  if (!gate.ok) return gate.response;
  const { data, error } = await gate.ctx.supabase
    .from('ai_prompts')
    .select('key, status, current_version, updated_at')
    .order('key');
  if (error) {
    return fail('read_failed', 'Lecture impossible', 500, correlationId ?? undefined);
  }
  const res = ok(
    { data: data ?? [], source: 'ai_prompts' },
    { correlationId: correlationId ?? undefined }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

const createSchema = z.object({
  key: z.string().min(1).max(120),
  content: z.string().min(1).max(200000),
  test_set: z
    .array(z.unknown())
    .max(500)
    .refine((a) => JSON.stringify(a).length <= 65536, 'test_set trop volumineux (64 Ko max)')
    .optional(),
});

/** POST — nouveau brouillon ou nouvelle version (jamais production direct). */
export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('ai.prompt.promote');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return fail('csrf_invalid', 'Jeton CSRF invalide', 403, correlationId ?? undefined);
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-ai-prompts',
    limit: 30,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const body = createSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return fail('invalid_body', 'Requête invalide', 400, correlationId ?? undefined);
  }

  // Écriture atomique via create_prompt_version() (insert version + bump).
  const { data: version, error: versionError } = await supabase.rpc('create_prompt_version', {
    p_key: body.data.key,
    p_content: body.data.content,
    p_test_set: (body.data.test_set ?? []) as unknown as never,
  });
  if (versionError || typeof version !== 'number') {
    const msg = versionError?.message ?? '';
    return fail(
      msg.includes('prompt_forbidden') ? 'prompt_forbidden' : 'version_create_failed',
      'Version impossible',
      msg.includes('prompt_forbidden') ? 403 : 500,
      correlationId ?? undefined
    );
  }
  const nextVersion = version as number;

  await logAdminAction({
    action: 'ai.prompt.draft',
    actor_id: user.id,
    target_table: 'ai_prompts',
    target_id: body.data.key,
    diff: { version: nextVersion },
    risk_tier: 2,
    correlation_id: correlationId ?? undefined,
    reason: `brouillon v${nextVersion}`,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });

  return ok(
    { key: body.data.key, version: nextVersion, status: 'draft' },
    { correlationId: correlationId ?? undefined, status: 201 }
  );
}
