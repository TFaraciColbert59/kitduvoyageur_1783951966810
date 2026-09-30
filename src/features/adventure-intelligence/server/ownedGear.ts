/**
 * Chantier configurateur (P0) — lecture serveur de l'inventaire.
 * Module séparé : la route l'injecte comme dépendance de `generateAdventure`.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OwnedGearRow } from '../domain/gearInventory';

/**
 * Chantier configurateur (P0) — lecture de l'inventaire du propriétaire.
 * Le client service_role contourne la RLS : le filtre `user_id` est donc
 * OBLIGATOIRE ici et n'est jamais délégué à l'appelant.
 */
export function createSupabaseOwnedGearReader(
  client: SupabaseClient
): (userId: string) => Promise<OwnedGearRow[]> {
  return async (userId) => {
    const { data, error } = await client
      .from('product_ownership')
      .select(
        'id, name, category, weight_g, condition, is_lent, maintenance_due_at, expiry_date, quantity'
      )
      .eq('user_id', userId)
      .limit(500);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      category: row.category == null ? null : String(row.category),
      weight_g: typeof row.weight_g === 'number' ? row.weight_g : null,
      condition: row.condition == null ? null : String(row.condition),
      is_lent: row.is_lent === true,
      maintenance_due_at: row.maintenance_due_at == null ? null : String(row.maintenance_due_at),
      expiry_date: row.expiry_date == null ? null : String(row.expiry_date),
      quantity: typeof row.quantity === 'number' ? row.quantity : null,
    }));
  };
}
