/**
 * G01 — écritures du partage d'activité (K5.20).
 *
 * Le client injecté reste soumis à la RLS de `community_posts` : la fonction ne
 * contourne aucun droit et n'utilise jamais de clé service_role. L'idempotence
 * s'appuie sur l'index unique `(author_id, client_request_id)` déjà en place.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildActivityShareDraft,
  buildRevokedActivityContent,
  revokeActivityShareMeta,
  type ActivityShareMeta,
  type ActivityShareOptions,
} from './activityShare';
import type { SportSessionMetrics } from './sportStats';

export type PublishActivityShareResult =
  | { ok: true; id: string; duplicate: boolean; meta: ActivityShareMeta }
  | { ok: false; reason: string; message: string };

export type RevokeActivityShareResult =
  | { ok: true; meta: ActivityShareMeta }
  | { ok: false; reason: string; message: string };

function messageOf(error: { message?: string | null } | null | undefined): string {
  return typeof error?.message === 'string' && error.message
    ? error.message
    : 'Publication impossible.';
}

/**
 * Publie une séance dans `community_posts` via `creation_meta`. Aucun snapshot,
 * aucun média, aucun lien carnet : le trigger d'audience restreinte ne peut pas
 * refuser la ligne pour un média public.
 */
export async function publishActivityShare(
  supabase: SupabaseClient,
  session: SportSessionMetrics,
  options: ActivityShareOptions
): Promise<PublishActivityShareResult> {
  const draft = buildActivityShareDraft(session, options);
  if (!draft.ok) {
    return { ok: false, reason: draft.reason, message: 'Partage refusé par le contrat G01.' };
  }

  const { data, error } = await supabase
    .from('community_posts')
    .insert(draft.post)
    .select('id')
    .single();

  if (!error && data?.id) {
    return { ok: true, id: data.id, duplicate: false, meta: draft.meta };
  }

  // Course entre deux requêtes identiques : l'index unique tranche et on relit
  // la ligne gagnante plutôt que de créer un doublon.
  if (error?.code === '23505') {
    const { data: existing, error: lookupError } = await supabase
      .from('community_posts')
      .select('id')
      .eq('author_id', draft.meta.owner_id)
      .eq('client_request_id', options.requestId)
      .maybeSingle();
    if (!lookupError && existing?.id) {
      return { ok: true, id: existing.id, duplicate: true, meta: draft.meta };
    }
  }

  return { ok: false, reason: 'insert_failed', message: messageOf(error) };
}

/**
 * Retire le partage : la carte disparaît du fil G01 et le contenu est remplacé
 * par un texte neutre, sans statistiques ni titre de sortie.
 */
export async function revokeActivityShare(
  supabase: SupabaseClient,
  postId: string,
  meta: ActivityShareMeta,
  now = new Date().toISOString()
): Promise<RevokeActivityShareResult> {
  if (!postId || !meta || meta.status !== 'shared') {
    return { ok: false, reason: 'invalid_share', message: 'Partage déjà retiré ou inconnu.' };
  }
  const updated = revokeActivityShareMeta(meta, now);
  const { data, error } = await supabase
    .from('community_posts')
    .update({
      content: buildRevokedActivityContent(),
      creation_meta: updated,
    })
    .eq('id', postId)
    .eq('author_id', meta.owner_id)
    .select('id')
    .maybeSingle();

  if (error || !data?.id) {
    return {
      ok: false,
      reason: 'revoke_failed',
      message: messageOf(error),
    };
  }
  return { ok: true, meta: updated };
}
