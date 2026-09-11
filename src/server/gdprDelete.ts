/**
 * A14 — Suppression RGPD (effacement, article 17) du compte et des données du
 * domaine.
 *
 * Le cœur est testable avec des dépendances injectées :
 *   - `deleteAuthUser` (service_role) déclenche les cascades `ON DELETE CASCADE`
 *     vers `user_profiles` puis toutes les tables du domaine (vérifié A9) ;
 *   - `countUserRows` recompte les données après suppression : toute donnée
 *     résiduelle est une ERREUR bloquante, jamais un succès silencieux.
 *
 * La confirmation explicite est une phrase exacte, jamais un booléen : une
 * suppression de compte ne peut pas être déclenchée par un simple appel.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { GDPR_USER_TABLES } from './gdprExport';

/** Phrase de confirmation exacte exigée dans le corps de la requête. */
export const DELETE_CONFIRMATION_PHRASE = 'SUPPRIMER MON COMPTE';

export interface GdprDeleteDeps {
  deleteAuthUser(userId: string): Promise<void>;
  countUserRows(userId: string): Promise<Record<string, number>>;
}

export interface GdprDeleteSuccess {
  deleted: true;
  deletedAt: string;
  residual: Record<string, number>;
}

export type GdprDeleteResult =
  | GdprDeleteSuccess
  | { deleted: false; error: 'confirmation_invalide' }
  | { deleted: false; error: 'donnees_residuelles'; residual: Record<string, number> };

/** Vrai si la phrase de confirmation est exactement celle attendue. */
export function isDeleteConfirmationValid(value: unknown): boolean {
  return value === DELETE_CONFIRMATION_PHRASE;
}

/** Erreur levée quand des données subsistent après suppression (jamais muette). */
export class ResidualDataError extends Error {
  readonly residual: Record<string, number>;

  constructor(residual: Record<string, number>) {
    super(
      `Suppression RGPD incomplète : ${Object.entries(residual)
        .filter(([, count]) => count > 0)
        .map(([table, count]) => `${table}=${count}`)
        .join(', ')}`
    );
    this.name = 'ResidualDataError';
    this.residual = residual;
  }
}

/**
 * Supprime le compte (cascades) puis vérifie l'absence de données résiduelles
 * pour chaque table du registre. Retourne la preuve chiffrée.
 */
export async function deleteAccountData(
  input: { userId: string; confirmation: unknown },
  deps: GdprDeleteDeps,
  options: { now?: string } = {}
): Promise<GdprDeleteResult> {
  if (!isDeleteConfirmationValid(input.confirmation)) {
    return { deleted: false, error: 'confirmation_invalide' };
  }

  const deletedAt = options.now ?? new Date().toISOString();
  await deps.deleteAuthUser(input.userId);

  const residual = await deps.countUserRows(input.userId);
  const remaining = Object.fromEntries(
    Object.entries(residual).filter(([, count]) => Number(count) > 0)
  );
  if (Object.keys(remaining).length > 0) {
    throw new ResidualDataError(remaining);
  }

  return { deleted: true, deletedAt, residual };
}

/** Adaptateur service_role : suppression auth + recomptage du registre. */
export function createSupabaseGdprDeleteDeps(supabase: SupabaseClient): GdprDeleteDeps {
  return {
    async deleteAuthUser(userId) {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw new Error(`suppression auth: ${error.message}`);
    },

    async countUserRows(userId) {
      const counts: Record<string, number> = {};
      for (const { table, userColumn } of GDPR_USER_TABLES) {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq(userColumn, userId);
        if (error) throw new Error(`recomptage ${table}: ${error.message}`);
        counts[table] = count ?? 0;
      }
      return counts;
    },
  };
}
