import 'server-only';

import { z } from 'zod';

import { getServiceSupabase } from '@/lib/ai/serviceClient';

/**
 * Journal d'audit admin — SERVEUR UNIQUEMENT.
 * Écrit dans `public.action_logs` via service_role (bypass RLS volontaire :
 * l'acteur est posé par le serveur, jamais par le client).
 * Ne lève jamais : en cas d'échec, log console et poursuit.
 */

const auditInputSchema = z.object({
  action: z.string().min(1).max(120),
  actor_id: z.string().uuid(),
  target_table: z.string().max(63).optional(),
  target_id: z.string().max(255).optional(),
  diff: z.unknown().optional(),
  ip: z.string().max(64).optional(),
  user_agent: z.string().max(512).optional(),
});

export type AuditInput = z.infer<typeof auditInputSchema>;

function toJsonb(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
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
  });

  if (error) {
    console.error('[admin/audit] insert échoué', {
      code: error.code,
      message: error.message,
    });
  }
}
