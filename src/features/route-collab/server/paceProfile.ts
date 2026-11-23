import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { paceProfileFromRow, type PaceProfileRow, type UserPaceProfile } from '../paceProfile';

/**
 * Allure apprise d'une personne, lue dans `user_performance_profiles` (10.8). RÉUTILISE l'existant : le
 * profil est construit à partir des sorties terminées (`hike_sessions` → observations → `buildUserProfile`,
 * avec consentement) ; ici on ne fait que le lire, avec le client de la personne. La RLS (propriétaire en
 * lecture seule) fait que seule SA propre allure est lisible : celle des autres participants vaut `null`
 * (l'itinéraire utilise alors l'allure par défaut ou celle qu'ils renseignent), jamais de donnée de tiers.
 * `null` aussi pour un profil à froid ou vide (voir `paceProfileFromRow`).
 */
export async function getPaceProfileForUser(userId: string, supabase?: SupabaseClient): Promise<UserPaceProfile | null> {
  try {
    const client = supabase ?? ((await createClient()) as unknown as SupabaseClient);
    const { data: auth } = await client.auth.getUser();
    if (!auth.user || auth.user.id !== userId) return null;
    const { data, error } = await client
      .from('user_performance_profiles')
      .select('flat_speed_kmh, ascent_speed_m_per_h, calibration_level, sample_count')
      .eq('user_id', userId)
      .eq('activity_type', 'hiking')
      .maybeSingle();
    if (error) return null;
    return paceProfileFromRow(data as PaceProfileRow | null);
  } catch {
    return null;
  }
}
