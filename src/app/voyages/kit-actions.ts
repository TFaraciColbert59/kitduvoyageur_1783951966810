'use server';

import { revalidatePath } from 'next/cache';
import { tripSegmentPath } from '@/features/trips/registry/tripPaths';
import { HUB_HOME_HREF, hubSectionHref } from '@/features/hub/registry/hubSectionRegistry';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  toggleTripItemPacked,
  addTripItem,
  deleteTripItem,
  addRecommendedItemToTrip,
  setTripItemPurchaseState,
} from '@/lib/queries-trip-kit';
import { getTripById } from '@/lib/queries-trips';
import type { ContextualGearRecommendation } from '@/features/trips/types/kit.types';

// ── Schémas de validation (réception serveur, ne jamais faire confiance au client)

const uuidSchema = z.string().uuid('Identifiant invalide');
const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide')
  .max(120);

const togglePackedSchema = z.object({
  itemId: uuidSchema,
  isPacked: z.boolean(),
  tripSlug: slugSchema,
});

const purchaseStateSchema = z.object({
  itemId: uuidSchema,
  state: z.enum(['needed', 'added', 'in_cart', 'shipping']),
  tripSlug: slugSchema,
});

const addCustomItemSchema = z.object({
  tripId: uuidSchema,
  tripSlug: slugSchema,
  itemName: z.string().trim().min(1, 'Le nom de l’équipement est requis.').max(160),
  category: z.enum(['safety', 'shelter', 'sleep', 'clothing', 'cook', 'water', 'tech', 'misc']),
  weightGrams: z.number().int().min(0).max(1_000_000).optional(),
  quantity: z.number().int().min(1).max(999),
  isVital: z.boolean(),
  isWorn: z.boolean(),
  isConsumable: z.boolean(),
});

const deleteItemSchema = z.object({
  itemId: uuidSchema,
  tripSlug: slugSchema,
});

const addRecommendedSchema = z.object({
  tripId: uuidSchema,
  tripSlug: slugSchema,
  recommendation: z.object({
    id: z.string().max(160),
    key: z.string().max(160).optional(),
    name: z.string().max(160),
    category: z.string().max(40),
    reason: z.string().max(600).optional(),
    weightGrams: z.number().int().min(0).max(1_000_000).optional(),
    priority: z.enum(['vital', 'recommended']).optional(),
    shopProduct: z
      .object({
        id: uuidSchema,
        slug: z.string().max(160),
        name: z.string().max(160),
        brand: z.string().max(120),
        price_eur: z.number().min(0).max(1_000_000),
        weight_g: z.number().min(0).max(1_000_000),
        category_main: z.string().max(80),
        image: z.string().max(1000).nullable().optional(),
        image_alt: z.string().max(300).nullable().optional(),
        score_kdv: z.number().nullable().optional(),
      })
      .nullable()
      .optional(),
  }).passthrough(),
});

/** Auth + permission d'édition du voyage (contrôle applicatif en plus de la RLS). */
async function requireTripEditor(tripId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Vous devez être connecté pour modifier l’équipement' } as const;

  const trip = await getTripById(tripId, user.id);
  if (!trip) return { error: 'Voyage introuvable ou non autorisé' } as const;
  if (!trip.permissions.canEdit) {
    return { error: 'Seuls les organisateurs et éditeurs peuvent modifier l’équipement' } as const;
  }
  return { userId: user.id } as const;
}

export async function togglePackedAction(
  itemId: string,
  isPacked: boolean,
  tripSlug: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = togglePackedSchema.safeParse({ itemId, isPacked, tripSlug });
    if (!parsed.success) {
      return { success: false, error: 'Requête invalide' };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Vous devez être connecté' };

    // Autorisation d'écriture portée par la RLS (can_edit_trip) : un update
    // bloqué affecte 0 ligne et remonte en échec explicite.
    const ok = await toggleTripItemPacked(parsed.data.itemId, parsed.data.isPacked, user.id);
    if (!ok) return { success: false, error: 'Impossible de modifier le statut de l’équipement' };

    revalidatePath(tripSegmentPath(parsed.data.tripSlug, ''));
    revalidatePath(tripSegmentPath(parsed.data.tripSlug, 'kit'));
    revalidatePath(HUB_HOME_HREF);
    revalidatePath(hubSectionHref({ nature: 'sortie', slug: parsed.data.tripSlug }, 'gear'));
    return { success: true };
  } catch (err) {
    console.error('[LKDV Action] togglePackedAction error:', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

export async function setPurchaseStateAction(
  itemId: string,
  state: 'needed' | 'added' | 'in_cart' | 'shipping',
  tripSlug: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = purchaseStateSchema.safeParse({ itemId, state, tripSlug });
    if (!parsed.success) {
      return { success: false, error: 'Requête invalide' };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Vous devez être connecté' };

    const ok = await setTripItemPurchaseState(parsed.data.itemId, parsed.data.state);
    if (!ok) return { success: false, error: 'Impossible de mettre à jour le statut d’achat' };

    revalidatePath(HUB_HOME_HREF);
    revalidatePath(hubSectionHref({ nature: 'sortie', slug: parsed.data.tripSlug }, 'gear'));
    return { success: true };
  } catch (err) {
    console.error('[LKDV Action] setPurchaseStateAction error:', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

export async function addCustomTripItemAction(
  tripId: string,
  tripSlug: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = addCustomItemSchema.safeParse({
      tripId,
      tripSlug,
      itemName: String(formData.get('itemName') || ''),
      category: String(formData.get('category') || 'misc'),
      weightGrams: Number(formData.get('weightGrams')) > 0 ? Number(formData.get('weightGrams')) : undefined,
      quantity: Math.max(1, Number(formData.get('quantity')) || 1),
      isVital: formData.get('isVital') === 'true',
      isWorn: formData.get('isWorn') === 'true',
      isConsumable: formData.get('isConsumable') === 'true',
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Données invalides' };
    }

    const auth = await requireTripEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error };

    const item = await addTripItem({
      tripId: parsed.data.tripId,
      itemName: parsed.data.itemName,
      category: parsed.data.category,
      weightGrams: parsed.data.weightGrams,
      quantity: parsed.data.quantity,
      priority: parsed.data.isVital ? 'vital' : 'recommended',
      isVital: parsed.data.isVital,
      isWorn: parsed.data.isWorn,
      isConsumable: parsed.data.isConsumable,
      source: 'user',
    });

    if (!item) {
      return { success: false, error: 'Erreur lors de l’ajout de l’équipement' };
    }

    revalidatePath(tripSegmentPath(parsed.data.tripSlug, ''));
    revalidatePath(tripSegmentPath(parsed.data.tripSlug, 'kit'));
    return { success: true };
  } catch (err) {
    console.error('[LKDV Action] addCustomTripItemAction error:', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

export async function deleteTripItemAction(
  itemId: string,
  tripSlug: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = deleteItemSchema.safeParse({ itemId, tripSlug });
    if (!parsed.success) {
      return { success: false, error: 'Requête invalide' };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Vous devez être connecté' };

    // Suppression autorisée par la RLS (can_edit_trip) ; 0 ligne supprimée = échec.
    const ok = await deleteTripItem(parsed.data.itemId);
    if (!ok) return { success: false, error: 'Impossible de supprimer l’équipement' };

    revalidatePath(tripSegmentPath(parsed.data.tripSlug, ''));
    revalidatePath(tripSegmentPath(parsed.data.tripSlug, 'kit'));
    return { success: true };
  } catch (err) {
    console.error('[LKDV Action] deleteTripItemAction error:', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

export async function addRecommendedItemAction(
  tripId: string,
  tripSlug: string,
  recommendation: ContextualGearRecommendation
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = addRecommendedSchema.safeParse({ tripId, tripSlug, recommendation });
    if (!parsed.success) {
      return { success: false, error: 'Recommandation invalide' };
    }

    const auth = await requireTripEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error };

    // Données validées par zod (shopProduct compris) — jamais l'objet client brut.
    const item = await addRecommendedItemToTrip(
      parsed.data.tripId,
      parsed.data.recommendation as ContextualGearRecommendation
    );
    if (!item) return { success: false, error: 'Erreur lors de l’ajout de la recommandation' };

    revalidatePath(tripSegmentPath(parsed.data.tripSlug, ''));
    revalidatePath(tripSegmentPath(parsed.data.tripSlug, 'kit'));
    return { success: true };
  } catch (err) {
    console.error('[LKDV Action] addRecommendedItemAction error:', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const addInventoryItemSchema = z.object({
  tripId: uuidSchema,
  tripSlug: slugSchema,
  inventoryItemId: uuidSchema,
  itemName: z.string().trim().min(1, 'Le nom de l’équipement est requis.').max(160),
  category: z.string().max(60).optional(),
  weightGrams: z.number().int().min(0).max(1_000_000).optional(),
});

/**
 * Ajoute un équipement depuis l'inventaire personnel sans consommer ni modifier le stock
 * (Y6.3 — Pont matériel).
 */
export async function addInventoryItemToTripAction(
  tripId: string,
  tripSlug: string,
  inventoryItemId: string,
  itemName: string,
  category?: string,
  weightGrams?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = addInventoryItemSchema.safeParse({
      tripId,
      tripSlug,
      inventoryItemId,
      itemName,
      category,
      weightGrams,
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Données invalides' };
    }

    const auth = await requireTripEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error };

    // Important (Y6.3) : Le stock de l'inventaire n'est jamais consommé ni modifié.
    // L'équipement personnel est seulement référencé via inventory_item_id dans trip_items.
    const item = await addTripItem({
      tripId: parsed.data.tripId,
      itemName: parsed.data.itemName,
      category: parsed.data.category || 'misc',
      weightGrams: parsed.data.weightGrams,
      inventoryItemId: parsed.data.inventoryItemId,
      quantity: 1,
      priority: 'recommended',
      isVital: false,
      source: 'inventory',
    });

    if (!item) {
      return { success: false, error: 'Erreur lors de l’ajout du matériel au voyage' };
    }

    revalidatePath(tripSegmentPath(parsed.data.tripSlug, ''));
    revalidatePath(tripSegmentPath(parsed.data.tripSlug, 'kit'));
    return { success: true };
  } catch (err) {
    console.error('[LKDV Action] addInventoryItemToTripAction error:', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const applyConfiguratorKitSchema = z.object({
  tripId: uuidSchema,
  tripSlug: slugSchema,
  items: z.array(
    z.object({
      name: z.string().min(1).max(160),
      category: z.string().max(60).optional(),
      weightGrams: z.number().int().min(0).max(1_000_000).optional(),
      essential: z.boolean().optional(),
    })
  ).min(1, 'Au moins un équipement requis'),
});

/**
 * Applique une configuration de kit IA directement aux items du voyage (Y6.1).
 */
export async function applyConfiguratorKitToTripAction(
  tripId: string,
  tripSlug: string,
  items: Array<{ name: string; category?: string; weightGrams?: number; essential?: boolean }>
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const parsed = applyConfiguratorKitSchema.safeParse({ tripId, tripSlug, items });
    if (!parsed.success) {
      return { success: false, error: 'Données de configuration invalides' };
    }

    const auth = await requireTripEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error };

    let addedCount = 0;
    for (const item of parsed.data.items) {
      const isVital = Boolean(item.essential);
      const inserted = await addTripItem({
        tripId: parsed.data.tripId,
        itemName: item.name,
        category: item.category || 'misc',
        weightGrams: item.weightGrams,
        quantity: 1,
        priority: isVital ? 'vital' : 'recommended',
        isVital,
        source: 'configurator',
      });
      if (inserted) addedCount++;
    }

    revalidatePath(tripSegmentPath(parsed.data.tripSlug, ''));
    revalidatePath(tripSegmentPath(parsed.data.tripSlug, 'kit'));
    return { success: true, count: addedCount };
  } catch (err) {
    console.error('[LKDV Action] applyConfiguratorKitToTripAction error:', err);
    return { success: false, error: 'Erreur serveur' };
  }
}
