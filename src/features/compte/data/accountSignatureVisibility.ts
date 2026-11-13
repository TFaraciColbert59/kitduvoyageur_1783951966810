import {
  signatureVisibilityForValue,
  type SignatureVisibility,
} from './accountVisibility';
import type { AccountProfileRow } from './accountBootstrap';

/** Index historique du runtime (`S.vis`) pour une valeur `signature_visibility`. */
export type SignatureVisibilityIndex = 0 | 1 | 2;

/**
 * Colonne SQL (`private | communaute | public`) → index runtime `S.vis`.
 *
 * L'inverse exact de `signatureVisibilityForValue` : par défaut la base est
 * `private`, donc le runtime doit démarrer sur `0` et jamais sur le `1`
 * historique de la maquette.
 */
export function signatureVisibilityIndex(value: unknown): SignatureVisibilityIndex | null {
  if (value === 'private') return 0;
  if (value === 'communaute') return 1;
  if (value === 'public') return 2;
  return null;
}

/**
 * Patch runtime minimal pour les deux réglages de visibilité du profil.
 *
 * `vis` est la visibilité de l'empreinte (`signature_visibility`) et
 * `profileVisibility` la confidentialité du compte (`profile_visibility`).
 * Une colonne absente ou inconnue n'écrase pas l'état runtime existant.
 */
export function mapProfileRuntimeVisibility(profile: AccountProfileRow | null): {
  vis?: SignatureVisibilityIndex;
  profileVisibility?: 'public' | 'prive';
} {
  const patch: {
    vis?: SignatureVisibilityIndex;
    profileVisibility?: 'public' | 'prive';
  } = {};
  const index = signatureVisibilityIndex(profile?.signature_visibility);
  if (index !== null) patch.vis = index;
  if (profile?.profile_visibility === 'public' || profile?.profile_visibility === 'prive') {
    patch.profileVisibility = profile.profile_visibility;
  }
  return patch;
}

/**
 * Client Supabase minimal pour relire la visibilité écrite. Structurel pour
 * rester testable avec un faux client, sans dépendre du type complet.
 */
export interface SignatureVisibilityClient {
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): {
        select(columns: string): {
          maybeSingle(): Promise<{
            data: { signature_visibility?: string | null } | null;
            error: unknown;
          }>;
        };
      };
    };
  };
}

export interface SignatureVisibilityFailureDetail {
  value: SignatureVisibility;
  persisted: false;
  revertedTo?: SignatureVisibility;
}

export interface PersistSignatureVisibilityOptions {
  client: unknown;
  userId: string;
  /** Index runtime demandé (`S.vis`) ou valeur SQL déjà résolue. */
  value: unknown;
  /** Index/valeur d'avant la mutation, pour un rétablissement exact. */
  previous: unknown;
  /** Appelé uniquement après relecture de la valeur écrite. */
  onPersisted: (value: SignatureVisibility) => void;
  /** Appelé pour tout échec (erreur PostgREST ou valeur relue différente). */
  onFailed: (detail: SignatureVisibilityFailureDetail) => void;
  /** Rétablit l'index runtime d'avant mutation si l'écriture échoue. */
  onRollback?: (index: SignatureVisibilityIndex) => void;
}

/**
 * Écrit `user_profiles.signature_visibility` puis **relit** la valeur.
 *
 * Le succès n'est signalé qu'après confirmation : une erreur RLS, une ligne
 * non retournée ou une valeur différente déclenchent un échec et le
 * rétablissement de l'index runtime précédent. Aucun service role.
 */
export async function persistSignatureVisibility(
  options: PersistSignatureVisibilityOptions
): Promise<boolean> {
  const target = signatureVisibilityForValue(options.value);
  if (!target) return false;

  const previous = signatureVisibilityForValue(options.previous);
  const previousIndex = signatureVisibilityIndex(previous);

  try {
    const { data, error } = await (options.client as SignatureVisibilityClient)
      .from('user_profiles')
      .update({
        signature_visibility: target,
        updated_at: new Date().toISOString(),
      })
      .eq('id', options.userId)
      .select('signature_visibility')
      .maybeSingle();

    if (error || data?.signature_visibility !== target) {
      throw error ?? new Error('signature_visibility_not_persisted');
    }
  } catch {
    if (previousIndex !== null) options.onRollback?.(previousIndex);
    options.onFailed({
      value: target,
      persisted: false,
      ...(previous ? { revertedTo: previous } : {}),
    });
    return false;
  }

  // Callback hors du try : un bug d'affichage ne devient pas un échec.
  options.onPersisted(target);
  return true;
}
