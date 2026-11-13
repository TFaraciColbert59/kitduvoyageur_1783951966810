import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/api/serviceClient';
import {
  isExplicitlySharedOutingVisibility,
  isFollowerOutingVisibility,
  metricVisibilityFromKeys,
  type OutingMetricViewer,
  type OutingMetricVisibility,
} from '../domain/metricVisibility';

/**
 * S6.15 — lecture et écriture des choix de partage par métrique.
 *
 * La table `outing_share_metrics` n'est lisible que par son propriétaire en
 * RLS. Un visiteur ne peut donc pas la lire avec son client de session. La
 * projection serveur passe par `service_role` UNIQUEMENT après avoir vérifié
 * le rôle réel du lecteur sur la sortie (propriétaire, participant, abonné
 * vérifié ou visiteur d'une sortie explicitement partagée).
 *
 * Si la clé service n'est pas configurée, la lecture retombe sur « aucun choix
 * enregistré » : le socle agrégé par défaut s'applique. Le partage se dégrade,
 * il ne s'ouvre jamais davantage.
 */

export interface OutingMetricPolicyRead {
  /** Politique brute, à passer à `resolveOutingMetricVisibility`. */
  visibility: unknown;
  /** Vrai si une ligne existe réellement pour cette sortie. */
  configured: boolean;
}

const EMPTY_POLICY: OutingMetricPolicyRead = Object.freeze({
  visibility: undefined,
  configured: false,
});

async function readWith(
  client: SupabaseClient,
  sessionId: string
): Promise<OutingMetricPolicyRead> {
  const { data, error } = await client
    .from('outing_share_metrics')
    .select('visibility')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error || !data || Array.isArray(data)) return EMPTY_POLICY;
  const row = data as { visibility?: unknown } | null;
  if (!row || typeof row !== 'object') return EMPTY_POLICY;
  if (row.visibility === undefined) return EMPTY_POLICY;
  return { visibility: row.visibility, configured: true };
}

/**
 * Lit la politique utile au lecteur.
 *
 * - propriétaire : lecture avec son client (RLS) pour alimenter l'interface ;
 * - participant : aucune politique n'est nécessaire, il voit toutes les
 *   métriques de la sortie ;
 * - visiteur/abonné : lecture `service_role` seulement si la sortie est
 *   explicitement partageable ou si l'abonné a été vérifié par l'appelant.
 */
export async function readOutingMetricPolicy(
  supabase: SupabaseClient,
  sessionId: string,
  viewer: OutingMetricViewer,
  sessionVisibility: string | null
): Promise<OutingMetricPolicyRead> {
  if (viewer === 'participant') return EMPTY_POLICY;

  const explicitlyShared = isExplicitlySharedOutingVisibility(sessionVisibility);
  const followerShared =
    viewer === 'follower' && isFollowerOutingVisibility(sessionVisibility);
  if (viewer !== 'owner' && !explicitlyShared && !followerShared) {
    return EMPTY_POLICY;
  }

  if (viewer === 'owner') return readWith(supabase, sessionId);

  const service = createServiceClient();
  if (!service) return EMPTY_POLICY;
  return readWith(service, sessionId);
}

/** Vérifie que l'appelant est bien le propriétaire de la sortie. */
async function assertSessionOwner(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('hike_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();
  return !error && Boolean((data as { id?: string | null } | null)?.id);
}

/**
 * Enregistre le choix complet du propriétaire. Le tableau de clés est converti
 * en liste fermée de booléens : une clé inconnue est ignorée, une clé absente
 * vaut `false`. La base revérifie la forme et refuse toute clé inconnue ou
 * valeur non booléenne.
 */
export async function saveOutingMetricVisibility(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  keys: readonly unknown[]
): Promise<OutingMetricVisibility> {
  if (!(await assertSessionOwner(supabase, userId, sessionId))) {
    throw new Error('not_found');
  }

  const visibility = metricVisibilityFromKeys(keys);
  const { error } = await supabase.from('outing_share_metrics').upsert(
    {
      session_id: sessionId,
      user_id: userId,
      visibility,
    },
    { onConflict: 'session_id' }
  );
  if (error) throw error;
  return visibility;
}

/**
 * Réinitialise le réglage : la ligne disparaît et la sortie revient au socle
 * agrégé déjà publié par sa visibilité. Aucune valeur simulée n'est écrite à
 * la place.
 */
export async function resetOutingMetricVisibility(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<void> {
  if (!(await assertSessionOwner(supabase, userId, sessionId))) {
    throw new Error('not_found');
  }

  const { error } = await supabase
    .from('outing_share_metrics')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', userId);
  if (error) throw error;
}
