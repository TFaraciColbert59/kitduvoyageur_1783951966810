import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * T24 — Validation des contributions (signalements de lieux/sentiers).
 *
 * Un rapport en attente ne rapporte RIEN ; l'acceptation exige un validateur
 * INDÉPENDANT (≠ auteur) et trace la raison d'un refus (recours). La décision
 * appartient à la fonction SQL `resolve_place_report` (verrou sur la ligne).
 */

export type ReportResolutionRefusal =
  | 'resolution_invalide'
  | 'raison_requise'
  | 'rapport_introuvable'
  | 'deja_resolu'
  | 'independant_requis'
  | 'unavailable';

export type ReportResolutionResult =
  | { ok: true; resolution: 'accepted' | 'rejected' }
  | { ok: false; reason: ReportResolutionRefusal };

const KNOWN_REASONS: readonly ReportResolutionRefusal[] = [
  'resolution_invalide',
  'raison_requise',
  'rapport_introuvable',
  'deja_resolu',
  'independant_requis',
];

function createValidationClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      '[progression] NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour la validation.'
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function resolvePlaceReport(input: {
  reportId: string;
  moderatorId: string;
  resolution: 'accepted' | 'rejected';
  reason?: string | null;
}): Promise<ReportResolutionResult> {
  const supabase = createValidationClient();
  const { data, error } = await supabase.rpc('resolve_place_report', {
    p_report_id: input.reportId,
    p_resolved_by: input.moderatorId,
    p_resolution: input.resolution,
    p_reason: input.reason ?? null,
  });
  if (error) throw new Error(error.message);

  const payload =
    data !== null && typeof data === 'object'
      ? (data as { ok?: unknown; reason?: unknown; resolution?: unknown })
      : null;
  if (payload?.ok === true) {
    return { ok: true, resolution: payload.resolution === 'rejected' ? 'rejected' : 'accepted' };
  }
  const reason =
    typeof payload?.reason === 'string' && (KNOWN_REASONS as readonly string[]).includes(payload.reason)
      ? (payload.reason as ReportResolutionRefusal)
      : 'unavailable';
  return { ok: false, reason };
}
