import {
  accountVisibilityUpdate,
  type AccountVisibility,
  type ProfileVisibilityEventDetail,
} from './accountVisibility';

/**
 * Client Supabase minimal utilisé par le pont de confidentialité.
 *
 * Volontairement structurel : le pont doit rester testable avec un faux client
 * (lecture de confirmation incluse) sans dépendre du type complet de
 * `@supabase/supabase-js`.
 */
export interface ProfileVisibilityClient {
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): {
        select(columns: string): {
          maybeSingle(): Promise<{
            data: { profile_visibility?: string | null } | null;
            error: unknown;
          }>;
        };
      };
    };
  };
}

export interface PersistProfileVisibilityOptions {
  client: unknown;
  userId: string;
  /** Valeur demandée par le runtime (`public` | `prive`). */
  value: unknown;
  /** Dernière valeur réellement persistée, pour un rétablissement honnête. */
  previous: AccountVisibility | null;
  /** Appelé uniquement après relecture de la valeur écrite. */
  onPersisted: (value: AccountVisibility) => void;
  /** Appelé pour tout échec (erreur PostgREST ou valeur relue différente). */
  onFailed: (detail: ProfileVisibilityEventDetail) => void;
  /** Rétablit le runtime/host avant `onFailed` si une valeur précédente existe. */
  onRollback?: (value: AccountVisibility) => void;
}

/**
 * Écrit `user_profiles.profile_visibility` puis **relit** la valeur.
 *
 * Le succès n'est signalé qu'après confirmation de la valeur écrite : une
 * erreur RLS, une ligne non retournée ou une valeur différente déclenchent un
 * échec et, si elle est connue, le rétablissement de la valeur précédente.
 * Aucun service role n'est utilisé : le client fourni reste RLS-scopé.
 */
export async function persistProfileVisibility(
  options: PersistProfileVisibilityOptions
): Promise<boolean> {
  const update = accountVisibilityUpdate(options.value);
  if (!update) return false;

  try {
    const { data, error } = await (options.client as ProfileVisibilityClient)
      .from('user_profiles')
      .update({
        profile_visibility: update.profile_visibility,
        updated_at: new Date().toISOString(),
      })
      .eq('id', options.userId)
      .select('profile_visibility')
      .maybeSingle();

    if (error || data?.profile_visibility !== update.profile_visibility) {
      throw error ?? new Error('profile_visibility_not_persisted');
    }
  } catch {
    const revertedTo = options.previous;
    if (revertedTo) options.onRollback?.(revertedTo);
    options.onFailed({
      value: update.profile_visibility,
      persisted: false,
      ...(revertedTo ? { revertedTo } : {}),
    });
    return false;
  }

  // Callbacks hors du try : un bug d'affichage ne doit jamais être confondu
  // avec un échec de persistance ni déclencher un faux rollback.
  options.onPersisted(update.profile_visibility);
  return true;
}

export interface RejectProfileVisibilityOptions {
  value: unknown;
  previous: AccountVisibility | null;
  onRollback?: (value: AccountVisibility) => void;
  onFailed: (detail: ProfileVisibilityEventDetail) => void;
}

/**
 * Réponse honnête quand aucune écriture n'est possible (session démo,
 * bootstrap en échec, pont non installé) : rétablit la valeur précédente si
 * elle est connue et signale toujours `persisted: false`.
 */
export function rejectProfileVisibility(
  options: RejectProfileVisibilityOptions
): boolean {
  const update = accountVisibilityUpdate(options.value);
  if (!update) return false;
  if (options.previous) options.onRollback?.(options.previous);
  options.onFailed({
    value: update.profile_visibility,
    persisted: false,
    ...(options.previous ? { revertedTo: options.previous } : {}),
  });
  return true;
}
