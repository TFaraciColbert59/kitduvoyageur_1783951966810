'use client';

import type { KitItemV2 } from '../engine/createSchemasV2';
import { createClient } from '@/lib/supabase/client';

/**
 * Points de départ du Kit — « Mon kit » et « Carnet » (maquette `FROM`, HTML
 * L3169). Lecture **seule** des données existantes de l'utilisateur, aucune
 * nouvelle persistance :
 *
 * - `materiel_kits` → `materiel_kit_items` (nom, catégorie, poids, quantité) ;
 * - `carnets` → `carnet_kit_items` (nom, détail, poids — pas de quantité).
 *
 * Toute erreur (RLS, table absente, réseau) est rendue comme un message honnête
 * et laisse l'inventaire intact : le point de départ est une commodité, jamais
 * un prérequis.
 */

export interface KitSourceOptionV2 {
  id: string;
  name: string;
  meta?: string;
}

export interface KitSourceResultV2<T> {
  data: T;
  error: string | null;
}

function toKitItem(
  id: string,
  name: string,
  category: string,
  weightG: number,
  quantity: number,
): KitItemV2 {
  return {
    id,
    name: name.trim() || 'Objet',
    category: category.trim() || 'Divers',
    weightG: Number.isFinite(weightG) ? Math.max(0, Math.round(weightG)) : 0,
    quantity: Number.isFinite(quantity) ? Math.max(1, Math.round(quantity)) : 1,
    productId: null,
    ownershipId: null,
    isChecked: false,
  };
}

/** Kits enregistrés de l'utilisateur (les plus récents d'abord). */
export async function loadMyKitsV2(userId: string): Promise<KitSourceResultV2<KitSourceOptionV2[]>> {
  if (!userId) return { data: [], error: null };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('materiel_kits')
      .select('id, name, total_weight_g')
      .eq('user_id', userId)
      .eq('is_trashed', false)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (error) return { data: [], error: 'Tes kits enregistrés sont indisponibles pour le moment.' };
    const kits = (Array.isArray(data) ? data : [])
      .map((row) => {
        const record = row as Record<string, unknown>;
        if (typeof record.id !== 'string') return null;
        const weight = typeof record.total_weight_g === 'number' ? record.total_weight_g : 0;
        return {
          id: record.id,
          name: String(record.name ?? 'Kit'),
          meta: weight > 0 ? `${(weight / 1000).toFixed(1).replace('.', ',')} kg` : undefined,
        } satisfies KitSourceOptionV2;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    return { data: kits, error: null };
  } catch {
    return { data: [], error: 'Tes kits enregistrés sont indisponibles pour le moment.' };
  }
}

/** Objets d'un kit enregistré (`materiel_kit_items`). */
export async function loadKitItemsV2(kitId: string): Promise<KitSourceResultV2<KitItemV2[]>> {
  if (!kitId) return { data: [], error: null };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('materiel_kit_items')
      .select('id, name, category, weight_g, quantity')
      .eq('kit_id', kitId)
      .order('slot_order', { ascending: true })
      .limit(100);
    if (error) return { data: [], error: 'Ce kit ne peut pas être repris pour le moment.' };
    const items = (Array.isArray(data) ? data : []).map((row) => {
      const record = row as Record<string, unknown>;
      return toKitItem(
        crypto.randomUUID(),
        String(record.name ?? 'Objet'),
        String(record.category ?? 'Divers'),
        typeof record.weight_g === 'number' ? record.weight_g : 0,
        typeof record.quantity === 'number' ? record.quantity : 1,
      );
    });
    return { data: items, error: null };
  } catch {
    return { data: [], error: 'Ce kit ne peut pas être repris pour le moment.' };
  }
}

/** Carnets de l'utilisateur (pour « Repris du carnet »). */
export async function loadMyCarnetsV2(
  userId: string,
): Promise<KitSourceResultV2<KitSourceOptionV2[]>> {
  if (!userId) return { data: [], error: null };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('carnets')
      .select('id, title, destination')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return { data: [], error: 'Tes carnets sont indisponibles pour le moment.' };
    const carnets = (Array.isArray(data) ? data : [])
      .map((row) => {
        const record = row as Record<string, unknown>;
        if (typeof record.id !== 'string') return null;
        return {
          id: record.id,
          name: String(record.title ?? 'Carnet'),
          meta: typeof record.destination === 'string' ? record.destination : undefined,
        } satisfies KitSourceOptionV2;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    return { data: carnets, error: null };
  } catch {
    return { data: [], error: 'Tes carnets sont indisponibles pour le moment.' };
  }
}

/**
 * Objets d'un carnet (`carnet_kit_items`). La table ne porte ni catégorie ni
 * quantité : la catégorie est `Divers` et la quantité 1 (repli documenté, pas
 * de fausse donnée).
 */
export async function loadCarnetKitItemsV2(
  carnetId: string,
): Promise<KitSourceResultV2<KitItemV2[]>> {
  if (!carnetId) return { data: [], error: null };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('carnet_kit_items')
      .select('id, nom, detail, poids_g')
      .eq('carnet_id', carnetId)
      .order('sort_order', { ascending: true })
      .limit(100);
    if (error) return { data: [], error: 'Ce carnet n’a pas de matériel repris possible.' };
    const items = (Array.isArray(data) ? data : []).map((row) => {
      const record = row as Record<string, unknown>;
      return toKitItem(
        crypto.randomUUID(),
        String(record.nom ?? 'Objet'),
        typeof record.detail === 'string' && record.detail.trim() ? record.detail : 'Divers',
        typeof record.poids_g === 'number' ? record.poids_g : 0,
        1,
      );
    });
    return { data: items, error: null };
  } catch {
    return { data: [], error: 'Ce carnet n’a pas de matériel repris possible.' };
  }
}
