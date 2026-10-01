'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getTripById } from '@/lib/queries-trips';
import { addTripItem } from '@/lib/queries-trip-kit';
import { HUB_HOME_HREF, hubSectionHref } from '@/features/hub/registry/hubSectionRegistry';
import { tripSegmentPath } from '@/features/trips/registry/tripPaths';

/**
 * Compas — actions serveur propres à l'écran.
 *
 * Les actions génériques du kit (emballer, retirer, ajouter depuis l'inventaire,
 * détails) restent celles de `src/app/voyages/kit-actions.ts` : le Compas les
 * appelle directement. Ce fichier ne contient que ce qui manquait :
 *   - choisir le porteur d'un objet parmi TOUTE l'équipe (propriétaire du
 *     voyage, collaborateurs, membres actifs de l'équipage) ;
 *   - relier un objet du kit à un produit précis de la boutique ;
 *   - ajouter au kit un produit de la boutique ;
 *   - ajouter à l'inventaire un objet réel (poids facultatif, jamais inventé).
 *
 * Chaque action valide ses entrées (zod), vérifie la session et le droit
 * d'édition, puis laisse la RLS trancher : 0 ligne modifiée = échec explicite.
 */

export type CompasActionResult = { success: true } | { success: false; error: string };

const uuid = z.string().uuid('Identifiant invalide');
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide')
  .max(120);

function revalidateTrip(tripSlug: string) {
  revalidatePath('/compas');
  revalidatePath(tripSegmentPath(tripSlug, ''));
  revalidatePath(tripSegmentPath(tripSlug, 'kit'));
  revalidatePath(HUB_HOME_HREF);
  revalidatePath(hubSectionHref({ nature: 'sortie', slug: tripSlug }, 'gear'));
}

async function requireEditor(tripId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Connecte-toi pour modifier le voyage.' } as const;
  const trip = await getTripById(tripId, user.id);
  if (!trip) return { error: 'Voyage introuvable ou non autorisé.' } as const;
  if (!trip.permissions.canEdit) return { error: 'Seuls les organisateurs et éditeurs peuvent modifier le kit.' } as const;
  return { supabase, userId: user.id, trip } as const;
}

/** Personnes réellement rattachées au voyage : propriétaire, collaborateurs, équipage actif. */
async function tripPeople(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trip: { id: string; user_id: string; collaborators: Array<{ user_id: string }> },
): Promise<Set<string>> {
  const people = new Set<string>([trip.user_id, ...trip.collaborators.map((c) => c.user_id)]);
  const { data: row } = await supabase.from('trips').select('crew_id').eq('id', trip.id).maybeSingle();
  const crewId = (row as { crew_id?: string | null } | null)?.crew_id;
  if (crewId) {
    const { data } = await supabase
      .from('crew_members')
      .select('user_id, status')
      .eq('crew_id', crewId)
      .eq('status', 'active');
    for (const m of (data ?? []) as Array<{ user_id: string }>) people.add(m.user_id);
  }
  return people;
}

/* ---------- Porteur ---------- */

const carrierSchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  itemId: uuid,
  carrierId: uuid.nullable(),
  shared: z.boolean(),
});

export async function compasSetCarrierAction(input: z.input<typeof carrierSchema>): Promise<CompasActionResult> {
  const parsed = carrierSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Requête invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    if (parsed.data.carrierId) {
      const people = await tripPeople(auth.supabase, auth.trip);
      if (!people.has(parsed.data.carrierId)) return { success: false, error: 'Cette personne ne fait pas partie du voyage.' };
    }
    const { data, error } = await auth.supabase
      .from('trip_items')
      .update({
        owner_id: parsed.data.carrierId,
        ownership: parsed.data.shared ? 'shared' : 'personal',
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.itemId)
      .eq('trip_id', parsed.data.tripId)
      .select('id');
    if (error || !data?.length) return { success: false, error: 'Impossible de changer le porteur.' };
    revalidateTrip(parsed.data.tripSlug);
    return { success: true };
  } catch (err) {
    console.error('[compas] compasSetCarrierAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

/* ---------- Boutique ---------- */

async function loadActiveProduct(supabase: Awaited<ReturnType<typeof createClient>>, productId: string) {
  const { data } = await supabase
    .from('shop_products')
    .select('id, name, brand, category_main, category, weight_g, weight_grams, is_active, deleted_at')
    .eq('id', productId)
    .maybeSingle();
  const row = data as
    | {
        id: string;
        name: string;
        brand: string | null;
        category_main: string | null;
        category: string | null;
        weight_g: number | null;
        weight_grams: number | null;
        is_active: boolean | null;
        deleted_at: string | null;
      }
    | null;
  if (!row || row.is_active === false || row.deleted_at) return null;
  return row;
}

const pickSchema = z.object({ tripId: uuid, tripSlug: slug, itemId: uuid, shopProductId: uuid });

/** Relie l'objet manquant au produit précis choisi et le marque « dans le panier ». */
export async function compasPickShopProductAction(input: z.input<typeof pickSchema>): Promise<CompasActionResult> {
  const parsed = pickSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const product = await loadActiveProduct(auth.supabase, parsed.data.shopProductId);
    if (!product) return { success: false, error: 'Produit indisponible.' };
    const patch: Record<string, unknown> = {
      shop_product_id: product.id,
      purchase_state: 'in_cart',
      updated_at: new Date().toISOString(),
    };
    const weight = product.weight_g ?? product.weight_grams;
    if (weight != null && weight > 0) patch.weight_grams = weight;
    const { data, error } = await auth.supabase
      .from('trip_items')
      .update(patch)
      .eq('id', parsed.data.itemId)
      .eq('trip_id', parsed.data.tripId)
      .select('id');
    if (error || !data?.length) return { success: false, error: 'Impossible de relier ce produit.' };
    revalidateTrip(parsed.data.tripSlug);
    return { success: true };
  } catch (err) {
    console.error('[compas] compasPickShopProductAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const addShopSchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  shopProductId: uuid,
  isVital: z.boolean().default(false),
});

/** Ajoute au kit un produit de la boutique (à acquérir). */
export async function compasAddShopProductToTripAction(input: z.input<typeof addShopSchema>): Promise<CompasActionResult> {
  const parsed = addShopSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const product = await loadActiveProduct(auth.supabase, parsed.data.shopProductId);
    if (!product) return { success: false, error: 'Produit indisponible.' };
    const weight = product.weight_g ?? product.weight_grams;
    const item = await addTripItem({
      tripId: parsed.data.tripId,
      itemName: product.name,
      category: product.category_main ?? product.category ?? 'misc',
      weightGrams: weight != null && weight > 0 ? weight : undefined,
      isVital: parsed.data.isVital,
      shopProductId: product.id,
      purchaseState: 'needed',
      ownerId: auth.userId,
      source: 'compas',
    });
    if (!item) return { success: false, error: 'Impossible d’ajouter ce produit au kit.' };
    revalidateTrip(parsed.data.tripSlug);
    return { success: true };
  } catch (err) {
    console.error('[compas] compasAddShopProductToTripAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

/* ---------- Inventaire ---------- */

const inventorySchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(160),
  brand: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
  weightG: z.number().int().min(1).max(1_000_000).nullable().optional(),
  condition: z.enum(['neuf', 'bon', 'use', 'a_remplacer', 'pour_pieces']).optional(),
  fromShopProductId: uuid.optional(),
});

/**
 * Ajoute un objet réel à l'inventaire de la personne connectée. Le poids reste
 * vide s'il n'est pas connu : l'écran l'affiche « à peser », il ne l'invente pas.
 */
export async function compasAddInventoryItemAction(
  input: z.input<typeof inventorySchema>,
): Promise<CompasActionResult & { itemId?: string }> {
  const parsed = inventorySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Requête invalide' };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Connecte-toi pour gérer ton inventaire.' };

    let { name, brand, category, weightG } = parsed.data;
    if (parsed.data.fromShopProductId) {
      const product = await loadActiveProduct(supabase, parsed.data.fromShopProductId);
      if (!product) return { success: false, error: 'Produit indisponible.' };
      name = product.name;
      brand = product.brand ?? undefined;
      category = product.category_main ?? product.category ?? undefined;
      weightG = product.weight_g ?? product.weight_grams ?? null;
    }

    const { data, error } = await supabase
      .from('product_ownership')
      .insert({
        user_id: user.id,
        name,
        brand: brand || null,
        category: category || 'Autre',
        weight_g: weightG ?? null,
        condition: parsed.data.condition ?? 'bon',
        is_lent: false,
      })
      .select('id')
      .single();
    if (error || !data) return { success: false, error: 'Impossible d’ajouter cet objet à l’inventaire.' };
    revalidatePath('/compas');
    revalidatePath('/hub/inventaire');
    return { success: true, itemId: String((data as { id: string }).id) };
  } catch (err) {
    console.error('[compas] compasAddInventoryItemAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const returnedSchema = z.object({ inventoryItemId: uuid });

/** L'objet prêté est revenu : il redevient disponible dans l'inventaire (et le kit). */
export async function compasMarkReturnedAction(input: z.input<typeof returnedSchema>): Promise<CompasActionResult> {
  const parsed = returnedSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Connecte-toi pour gérer ton inventaire.' };
    const { data, error } = await supabase
      .from('product_ownership')
      .update({ is_lent: false, updated_at: new Date().toISOString() })
      .eq('id', parsed.data.inventoryItemId)
      .eq('user_id', user.id)
      .select('id');
    if (error || !data?.length) return { success: false, error: 'Impossible de mettre à jour cet objet.' };
    revalidatePath('/compas');
    revalidatePath('/hub/inventaire');
    return { success: true };
  } catch (err) {
    console.error('[compas] compasMarkReturnedAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const budgetSchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  amount: z.number().min(0).max(10_000_000).nullable(),
});

/** Enveloppe du voyage (montant total) : fixée par l'équipe, jamais proposée d'office. */
export async function compasSetBudgetAction(input: z.input<typeof budgetSchema>): Promise<CompasActionResult> {
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Montant invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const { data, error } = await auth.supabase
      .from('trips')
      .update({
        estimated_budget: parsed.data.amount == null ? null : Math.round(parsed.data.amount * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.tripId)
      .select('id');
    if (error || !data?.length) return { success: false, error: 'Impossible d’enregistrer l’enveloppe.' };
    revalidateTrip(parsed.data.tripSlug);
    return { success: true };
  } catch (err) {
    console.error('[compas] compasSetBudgetAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}
