import 'server-only';

import { z } from 'zod';

import { getServiceSupabase } from '@/lib/ai/serviceClient';

/**
 * Journal d'audit admin — SERVEUR UNIQUEMENT.
 * Écrit dans `public.action_logs` via service_role (bypass RLS volontaire :
 * l'acteur est posé par le serveur, jamais par le client).
 * Ne lève jamais : en cas d'échec, log console et poursuit.
 */

export const auditInputSchema = z.object({
  action: z.string().min(1).max(120),
  actor_id: z.string().uuid(),
  target_table: z.string().max(63).optional(),
  target_id: z.string().max(255).optional(),
  diff: z.unknown().optional(),
  ip: z.string().max(64).optional(),
  user_agent: z.string().max(512).optional(),
  risk_tier: z.number().int().min(0).max(4).optional(),
  correlation_id: z.string().uuid().optional(),
  command_id: z.string().uuid().optional(),
  approval_id: z.string().uuid().optional(),
  reason: z.string().max(2000).optional(),
  result: z.enum(['succeeded', 'failed', 'partial', 'unknown', 'cancelled']).optional(),
  error_code: z.string().max(120).optional(),
});

export type AuditInput = z.infer<typeof auditInputSchema>;

/** Borne anti-abus : un diff > 16 Ko est tronqué (ligne action_logs légère). */
const MAX_DIFF_BYTES = 16 * 1024;

function toJsonb(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  const wrapped: Record<string, unknown> =
    typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : { value };
  try {
    const raw = JSON.stringify(wrapped);
    if (raw.length > MAX_DIFF_BYTES) {
      return { truncated: true, bytes: raw.length, head: raw.slice(0, MAX_DIFF_BYTES) };
    }
  } catch {
    return { unserializable: true };
  }
  return wrapped;
}

export async function logAdminAction(input: AuditInput): Promise<void> {
  const parsed = auditInputSchema.safeParse(input);
  if (!parsed.success) {
    console.error('[admin/audit] entrée invalide', parsed.error.flatten());
    return;
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    console.error('[admin/audit] service_role indisponible — action non journalisée', {
      action: parsed.data.action,
      actor_id: parsed.data.actor_id,
    });
    return;
  }

  const { error } = await supabase.from('action_logs').insert({
    actor_id: parsed.data.actor_id,
    action: parsed.data.action,
    target_table: parsed.data.target_table ?? null,
    target_id: parsed.data.target_id ?? null,
    diff: toJsonb(parsed.data.diff),
    ip: parsed.data.ip ?? null,
    user_agent: parsed.data.user_agent ?? null,
    source: 'app',
    risk_tier: parsed.data.risk_tier ?? 1,
    correlation_id: parsed.data.correlation_id ?? null,
    command_id: parsed.data.command_id ?? null,
    approval_id: parsed.data.approval_id ?? null,
    reason: parsed.data.reason ?? null,
    result: parsed.data.result ?? 'succeeded',
    error_code: parsed.data.error_code ?? null,
  });

  if (error) {
    console.error('[admin/audit] insert échoué', {
      code: error.code,
      message: error.message,
    });
  }
}
