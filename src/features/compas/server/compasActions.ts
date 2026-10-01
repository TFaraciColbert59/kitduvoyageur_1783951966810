'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getTripById } from '@/lib/queries-trips';
import { addTripItem } from '@/lib/queries-trip-kit';
import { HUB_HOME_HREF, hubSectionHref } from '@/features/hub/registry/hubSectionRegistry';
import { tripSegmentPath } from '@/features/trips/registry/tripPaths';
import { askAI } from '@/lib/ai/askAI';
import type { AIFailureReason } from '@/lib/ai/providers/types';
import {
  MAX_INTENT_CHARS,
  COMPAS_INTENT_SPEC,
  buildCompasIntentPrompt,
  buildCompasIntentSystem,
  extractIntentJson,
  parseCompasIntentOutput,
} from '@/lib/ai/features/compasIntent';
import {
  groundingIssue,
  mergeActions,
  parseIntentRules,
  validateActions,
  type CompasIntentAction,
  type CompasProposal,
} from '../engine/intent';
import { readCompasMeta } from '../engine/meta';
import { localToday } from './weather';

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
  if (!trip.permissions.canEdit)
    return { error: 'Seuls les organisateurs et éditeurs peuvent modifier le kit.' } as const;
  return { supabase, userId: user.id, trip } as const;
}

/** Personnes réellement rattachées au voyage : propriétaire, collaborateurs, équipage actif. */
async function tripPeople(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trip: { id: string; user_id: string; collaborators: Array<{ user_id: string }> }
): Promise<Set<string>> {
  const people = new Set<string>([trip.user_id, ...trip.collaborators.map((c) => c.user_id)]);
  const { data: row } = await supabase
    .from('trips')
    .select('crew_id')
    .eq('id', trip.id)
    .maybeSingle();
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

export async function compasSetCarrierAction(
  input: z.input<typeof carrierSchema>
): Promise<CompasActionResult> {
  const parsed = carrierSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Requête invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    if (parsed.data.carrierId) {
      const people = await tripPeople(auth.supabase, auth.trip);
      if (!people.has(parsed.data.carrierId))
        return { success: false, error: 'Cette personne ne fait pas partie du voyage.' };
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
    if (error || !data?.length)
      return { success: false, error: 'Impossible de changer le porteur.' };
    revalidateTrip(parsed.data.tripSlug);
    return { success: true };
  } catch (err) {
    console.error('[compas] compasSetCarrierAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

/* ---------- Boutique ---------- */

async function loadActiveProduct(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string
) {
  const { data } = await supabase
    .from('shop_products')
    .select(
      'id, name, brand, category_main, category, weight_g, weight_grams, is_active, deleted_at'
    )
    .eq('id', productId)
    .maybeSingle();
  const row = data as {
    id: string;
    name: string;
    brand: string | null;
    category_main: string | null;
    category: string | null;
    weight_g: number | null;
    weight_grams: number | null;
    is_active: boolean | null;
    deleted_at: string | null;
  } | null;
  if (!row || row.is_active === false || row.deleted_at) return null;
  return row;
}

const pickSchema = z.object({ tripId: uuid, tripSlug: slug, itemId: uuid, shopProductId: uuid });

/** Relie l'objet manquant au produit précis choisi et le marque « dans le panier ». */
export async function compasPickShopProductAction(
  input: z.input<typeof pickSchema>
): Promise<CompasActionResult> {
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
    if (error || !data?.length)
      return { success: false, error: 'Impossible de relier ce produit.' };
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
export async function compasAddShopProductToTripAction(
  input: z.input<typeof addShopSchema>
): Promise<CompasActionResult> {
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
  input: z.input<typeof inventorySchema>
): Promise<CompasActionResult & { itemId?: string }> {
  const parsed = inventorySchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Requête invalide' };
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
    if (error || !data)
      return { success: false, error: 'Impossible d’ajouter cet objet à l’inventaire.' };
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
export async function compasMarkReturnedAction(
  input: z.input<typeof returnedSchema>
): Promise<CompasActionResult> {
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
    if (error || !data?.length)
      return { success: false, error: 'Impossible de mettre à jour cet objet.' };
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
export async function compasSetBudgetAction(
  input: z.input<typeof budgetSchema>
): Promise<CompasActionResult> {
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Montant invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const { data, error } = await auth.supabase
      .from('trips')
      .update({
        estimated_budget:
          parsed.data.amount == null ? null : Math.round(parsed.data.amount * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.tripId)
      .select('id');
    if (error || !data?.length)
      return { success: false, error: 'Impossible d’enregistrer l’enveloppe.' };
    revalidateTrip(parsed.data.tripSlug);
    return { success: true };
  } catch (err) {
    console.error('[compas] compasSetBudgetAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

/* =============================================================================
   Lot 1 — Où et quand : dates et durée, activité, préférences, taille du
   groupe, parcours du catalogue (recherche, mes sorties, application).
   ============================================================================= */

type Supa = Awaited<ReturnType<typeof createClient>>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide');

/** Fusionne une clé dans trips.metadata sans écraser le reste. */
async function patchTripMetadata(
  supabase: Supa,
  tripId: string,
  patch: (meta: Record<string, unknown>) => Record<string, unknown>
) {
  const { data } = await supabase.from('trips').select('metadata').eq('id', tripId).maybeSingle();
  const meta = ((data as { metadata?: Record<string, unknown> | null } | null)?.metadata ??
    {}) as Record<string, unknown>;
  return patch({ ...meta });
}

function compasMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const c = meta.compas;
  return c && typeof c === 'object' && !Array.isArray(c)
    ? { ...(c as Record<string, unknown>) }
    : {};
}

/**
 * Redécoupe la géométrie réelle du parcours en `days` jours et met les étapes
 * à jour SANS rien perdre : la première étape de chaque jour reçoit le
 * tronçon (titre et hébergement conservés), les autres étapes du même jour
 * gardent leur texte mais plus de distance (pas de double compte), les jours
 * manquants sont créés, et les jours en trop ne sont supprimés que s'ils ont
 * été générés par le Compas sans hébergement.
 */
async function resplitSteps(supabase: Supa, tripId: string, routeId: number, days: number) {
  const [{ data: stages, error }, { data: route }, { data: existing }] = await Promise.all([
    supabase.rpc('compas_route_stages', { p_route_id: routeId, p_days: days }),
    supabase.from('hiking_routes').select('name').eq('id', routeId).maybeSingle(),
    supabase
      .from('trip_steps')
      .select('id, day_number, order_index, source, accommodation_name')
      .eq('trip_id', tripId)
      .order('day_number', { ascending: true })
      .order('order_index', { ascending: true }),
  ]);
  if (error || !Array.isArray(stages) || stages.length === 0)
    throw new Error('Découpage du parcours impossible.');
  const routeName = (route as { name?: string | null } | null)?.name ?? 'Parcours';
  const rows = (existing ?? []) as Array<{
    id: string;
    day_number: number;
    order_index: number;
    source: string | null;
    accommodation_name: string | null;
  }>;
  const now = new Date().toISOString();
  let kept = 0;

  for (const st of stages as Array<{
    day: number;
    start_lat: number;
    start_lng: number;
    distance_km: number;
    elevation_gain_m: number | null;
    elevation_loss_m: number | null;
  }>) {
    const ofDay = rows.filter((r) => r.day_number === st.day);
    const geo = {
      latitude: Math.round(st.start_lat * 1e5) / 1e5,
      longitude: Math.round(st.start_lng * 1e5) / 1e5,
      distance_km: st.distance_km,
      elevation_gain_m: st.elevation_gain_m,
      elevation_loss_m: st.elevation_loss_m,
      updated_at: now,
    };
    if (ofDay.length) {
      await supabase.from('trip_steps').update(geo).eq('id', ofDay[0].id);
      for (const extra of ofDay.slice(1)) {
        await supabase
          .from('trip_steps')
          .update({
            distance_km: null,
            elevation_gain_m: null,
            elevation_loss_m: null,
            updated_at: now,
          })
          .eq('id', extra.id);
      }
    } else {
      await supabase.from('trip_steps').insert({
        trip_id: tripId,
        day_number: st.day,
        order_index: 0,
        title: `Jour ${st.day} · ${routeName}`,
        description:
          'Tronçon du parcours découpé par le Compas. Dénivelé du parcours réparti à parts égales entre les jours.',
        transport_mode: 'foot',
        source: 'compas',
        ...geo,
      });
    }
  }
  for (const r of rows.filter((r) => r.day_number > days)) {
    const generated = r.source === 'compas' || r.source === 'demo';
    if (generated && !r.accommodation_name) {
      await supabase.from('trip_steps').delete().eq('id', r.id);
    } else {
      kept += 1;
      await supabase
        .from('trip_steps')
        .update({
          distance_km: null,
          elevation_gain_m: null,
          elevation_loss_m: null,
          updated_at: now,
        })
        .eq('id', r.id);
    }
  }
  return { kept };
}

const datesSchema = z
  .object({
    tripId: uuid,
    tripSlug: slug,
    startDate: isoDate,
    endDate: isoDate,
    /** Durée en heures pour une sortie de moins d'un jour, sinon null. */
    durationHours: z.number().min(0.25).max(23.99).nullable(),
    resplit: z.boolean().default(false),
  })
  .refine((v) => v.endDate >= v.startDate, { message: 'La fin doit suivre le début.' });

export async function compasSetDatesAction(
  input: z.input<typeof datesSchema>
): Promise<CompasActionResult & { kept?: number }> {
  const parsed = datesSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dates invalides' };
  const { tripId, tripSlug, startDate, durationHours, resplit } = parsed.data;
  const endDate = durationHours != null ? startDate : parsed.data.endDate;
  try {
    const auth = await requireEditor(tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const metadata = await patchTripMetadata(auth.supabase, tripId, (meta) => {
      const c = compasMeta(meta);
      if (durationHours != null) c.duration_h = durationHours;
      else delete c.duration_h;
      return { ...meta, compas: c };
    });
    const { data, error } = await auth.supabase
      .from('trips')
      .update({
        start_date: startDate,
        end_date: endDate,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId)
      .select('id');
    if (error || !data?.length)
      return { success: false, error: 'Impossible d’enregistrer les dates.' };

    let kept = 0;
    const routeId = Number((metadata as { route_id?: unknown }).route_id);
    if (resplit && Number.isFinite(routeId) && routeId > 0) {
      const days =
        Math.round(
          (Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86_400_000
        ) + 1;
      kept = (await resplitSteps(auth.supabase, tripId, routeId, days)).kept;
    }
    revalidateTrip(tripSlug);
    return { success: true, kept };
  } catch (err) {
    console.error('[compas] compasSetDatesAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const ACTIVITIES = [
  'hiking',
  'trekking',
  'bivouac',
  'roadtrip',
  'cultural',
  'bushcraft',
  'mixed',
] as const;
const activitySchema = z.object({ tripId: uuid, tripSlug: slug, activity: z.enum(ACTIVITIES) });

export async function compasSetActivityAction(
  input: z.input<typeof activitySchema>
): Promise<CompasActionResult> {
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Activité invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const { data, error } = await auth.supabase
      .from('trips')
      .update({ primary_activity: parsed.data.activity, updated_at: new Date().toISOString() })
      .eq('id', parsed.data.tripId)
      .select('id');
    if (error || !data?.length)
      return { success: false, error: 'Impossible de changer l’activité.' };
    revalidateTrip(parsed.data.tripSlug);
    return { success: true };
  } catch (err) {
    console.error('[compas] compasSetActivityAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const shortList = z.array(z.string().trim().min(1).max(40)).max(8);
const prefsSchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  preferences: z.object({
    pace: z.enum(['tranquille', 'normal', 'soutenu']),
    nights: z.enum(['bivouac', 'refuge', 'hebergement', 'mixte']).nullable(),
    avoid: shortList,
    wishes: shortList,
  }),
});

export async function compasSetPreferencesAction(
  input: z.input<typeof prefsSchema>
): Promise<CompasActionResult> {
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Préférences invalides' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const metadata = await patchTripMetadata(auth.supabase, parsed.data.tripId, (meta) => ({
      ...meta,
      compas: { ...compasMeta(meta), prefs: parsed.data.preferences },
    }));
    const { data, error } = await auth.supabase
      .from('trips')
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('id', parsed.data.tripId)
      .select('id');
    if (error || !data?.length)
      return { success: false, error: 'Impossible d’enregistrer les préférences.' };
    revalidateTrip(parsed.data.tripSlug);
    return { success: true };
  } catch (err) {
    console.error('[compas] compasSetPreferencesAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const partySchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  partySize: z.number().int().min(1).max(50),
});

export async function compasSetPartySizeAction(
  input: z.input<typeof partySchema>
): Promise<CompasActionResult> {
  const parsed = partySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Nombre de personnes invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const { data, error } = await auth.supabase
      .from('trips')
      .update({ party_size: parsed.data.partySize, updated_at: new Date().toISOString() })
      .eq('id', parsed.data.tripId)
      .select('id');
    if (error || !data?.length)
      return { success: false, error: 'Impossible de changer le nombre de personnes.' };
    revalidateTrip(parsed.data.tripSlug);
    return { success: true };
  } catch (err) {
    console.error('[compas] compasSetPartySizeAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

/* ---------- Parcours ---------- */

export interface CompasRouteOption {
  routeId: number;
  name: string;
  region: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  durationHours: number | null;
  difficulty: string | null;
  distanceFromKm: number | null;
  communitySessions: number;
  /** Mes sorties sur ce parcours (date de la dernière), le cas échéant. */
  mine: { count: number; last: string | null } | null;
}

const searchSchema = z.object({
  lat: z.number().min(-90).max(90).nullable(),
  lon: z.number().min(-180).max(180).nullable(),
  query: z.string().trim().max(80).nullable(),
});

export async function compasSearchRoutesAction(
  input: z.input<typeof searchSchema>
): Promise<{ success: true; routes: CompasRouteOption[] } | { success: false; error: string }> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Recherche invalide' };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Connecte-toi pour chercher un parcours.' };
    const { lat, lon, query } = parsed.data;
    const [{ data, error }, { data: sessions }] = await Promise.all([
      supabase.rpc('compas_search_routes', {
        p_lat: lat,
        p_lng: lon,
        p_radius_km: query ? 500 : 80,
        p_query: query || null,
        p_limit: 12,
      }),
      supabase
        .from('hike_sessions')
        .select('route_id, started_at')
        .eq('user_id', user.id)
        .not('route_id', 'is', null)
        .limit(200),
    ]);
    if (error) return { success: false, error: 'Recherche indisponible.' };
    const mine = new Map<number, { count: number; last: string | null }>();
    for (const s of (sessions ?? []) as Array<{ route_id: number; started_at: string | null }>) {
      const m = mine.get(Number(s.route_id)) ?? { count: 0, last: null };
      m.count += 1;
      if (s.started_at && (!m.last || s.started_at > m.last)) m.last = s.started_at;
      mine.set(Number(s.route_id), m);
    }
    const routes = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      routeId: Number(r.route_id),
      name: (r.name as string | null) ?? (r.ref as string | null) ?? `Parcours n° ${r.route_id}`,
      region: (r.region as string | null) ?? null,
      distanceKm: r.distance_km == null ? null : Number(r.distance_km),
      elevationGainM: r.elevation_gain_m == null ? null : Number(r.elevation_gain_m),
      durationHours: r.duration_hours == null ? null : Number(r.duration_hours),
      difficulty: (r.difficulty as string | null) ?? null,
      distanceFromKm:
        r.distance_from_m == null ? null : Math.round(Number(r.distance_from_m) / 100) / 10,
      communitySessions: Number(r.community_sessions ?? 0),
      mine: mine.get(Number(r.route_id)) ?? null,
    }));
    return { success: true, routes };
  } catch (err) {
    console.error('[compas] compasSearchRoutesAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

/** Les parcours que j'ai déjà parcourus (sessions enregistrées), du plus récent au plus ancien. */
export async function compasMyRoutesAction(): Promise<
  { success: true; routes: CompasRouteOption[] } | { success: false; error: string }
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Connecte-toi pour voir tes sorties.' };
    const { data: sessions } = await supabase
      .from('hike_sessions')
      .select('route_id, started_at')
      .eq('user_id', user.id)
      .not('route_id', 'is', null)
      .order('started_at', { ascending: false })
      .limit(200);
    const mine = new Map<number, { count: number; last: string | null }>();
    for (const s of (sessions ?? []) as Array<{ route_id: number; started_at: string | null }>) {
      const m = mine.get(Number(s.route_id)) ?? { count: 0, last: s.started_at };
      m.count += 1;
      mine.set(Number(s.route_id), m);
    }
    if (!mine.size) return { success: true, routes: [] };
    const ids = [...mine.keys()];
    const [{ data: routes }, { data: metas }] = await Promise.all([
      supabase.from('hiking_routes').select('id, name, ref, region, distance_km').in('id', ids),
      supabase
        .from('trail_metadata')
        .select('trail_id, elevation_gain, duration_hours, difficulty')
        .in('trail_id', ids),
    ]);
    const metaById = new Map(
      ((metas ?? []) as Array<Record<string, unknown>>).map((m) => [Number(m.trail_id), m])
    );
    const out = ((routes ?? []) as Array<Record<string, unknown>>)
      .map((r) => {
        const id = Number(r.id);
        const m = metaById.get(id);
        return {
          routeId: id,
          name: (r.name as string | null) ?? (r.ref as string | null) ?? `Parcours n° ${id}`,
          region: (r.region as string | null) ?? null,
          distanceKm: r.distance_km == null ? null : Math.round(Number(r.distance_km) * 10) / 10,
          elevationGainM: m?.elevation_gain == null ? null : Number(m.elevation_gain),
          durationHours: m?.duration_hours == null ? null : Number(m.duration_hours),
          difficulty: (m?.difficulty as string | null) ?? null,
          distanceFromKm: null,
          communitySessions: 0,
          mine: mine.get(id) ?? null,
        };
      })
      .sort((a, b) => (b.mine?.last ?? '').localeCompare(a.mine?.last ?? ''));
    return { success: true, routes: out };
  } catch (err) {
    console.error('[compas] compasMyRoutesAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const applyRouteSchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  routeId: z.number().int().positive(),
  days: z.number().int().min(1).max(30),
});

/** Choisit un parcours du catalogue pour le voyage et le découpe en `days` jours. */
export async function compasApplyRouteAction(
  input: z.input<typeof applyRouteSchema>
): Promise<CompasActionResult & { kept?: number }> {
  const parsed = applyRouteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Parcours invalide' };
  const { tripId, tripSlug, routeId, days } = parsed.data;
  try {
    const auth = await requireEditor(tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const { data: exists } = await auth.supabase
      .from('hiking_routes')
      .select('id')
      .eq('id', routeId)
      .maybeSingle();
    if (!exists) return { success: false, error: 'Parcours introuvable.' };
    const metadata = await patchTripMetadata(auth.supabase, tripId, (meta) => ({
      ...meta,
      route_id: routeId,
    }));
    const { data, error } = await auth.supabase
      .from('trips')
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('id', tripId)
      .select('id');
    if (error || !data?.length)
      return { success: false, error: 'Impossible de choisir ce parcours.' };
    const { kept } = await resplitSteps(auth.supabase, tripId, routeId, days);
    revalidateTrip(tripSlug);
    return { success: true, kept };
  } catch (err) {
    console.error('[compas] compasApplyRouteAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

/* ---------- « Dis-le » ---------- */

const AI_NOTES: Record<AIFailureReason, string> = {
  delai_depasse: 'L’IA a mis trop de temps : lu par les règles du Compas.',
  quota_epuise: 'Quota IA du jour atteint : lu par les règles du Compas.',
  provider_indisponible: 'IA indisponible : lu par les règles du Compas.',
  reponse_invalide: 'Réponse IA inexploitable : lu par les règles du Compas.',
};

const interpretSchema = z.object({
  tripId: uuid,
  text: z.string().trim().min(2).max(MAX_INTENT_CHARS),
});

/**
 * Comprend une phrase et renvoie des actions PROPOSÉES, jamais appliquées.
 * L'IA traduit, les règles complètent, le moteur vérifie (ancrage dans la
 * phrase, limites réelles) ; l'écran n'applique que ce que l'utilisateur coche.
 */
export async function compasInterpretAction(
  input: z.input<typeof interpretSchema>
): Promise<
  | { success: true; proposals: CompasProposal[]; usedAi: boolean; note: string | null }
  | { success: false; error: string }
> {
  const parsed = interpretSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Phrase trop courte ou trop longue' };
  const { tripId, text } = parsed.data;
  try {
    const auth = await requireEditor(tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const trip = auth.trip;
    const today = localToday('Europe/Paris');
    const startDate = trip.start_date ?? null;
    const endDate = trip.end_date ?? null;
    const days =
      startDate && endDate
        ? Math.round(
            (Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86_400_000
          ) + 1
        : null;
    const prefs = readCompasMeta(trip.metadata).preferences;
    const engaged = (trip.expenses ?? []).reduce((t, e) => t + (Number(e.amount) || 0), 0);

    const rules = parseIntentRules(text, today);
    let ai: CompasIntentAction[] = [];
    let usedAi = false;
    let note: string | null = null;
    try {
      const res = await askAI({
        feature: 'compas-intent',
        tier: COMPAS_INTENT_SPEC.tier,
        system: buildCompasIntentSystem(),
        prompt: buildCompasIntentPrompt({ text, today, startDate, days }),
        maxTokens: 700,
        cacheTtlSeconds: 0,
        userId: auth.userId,
      });
      if (res.degraded || res.provider === 'fallback') {
        note = AI_NOTES[res.failureReason ?? 'provider_indisponible'];
      } else {
        ai = parseCompasIntentOutput(extractIntentJson(res.text));
        usedAi = true;
      }
    } catch {
      note = AI_NOTES.provider_indisponible;
    }

    // L'IA ne propose que ce que la phrase dit ; ce qu'elle invente est montré refusé.
    const grounded = ai.filter((a) => groundingIssue(a, text) == null);
    const refused = ai
      .filter((a) => groundingIssue(a, text) != null)
      .map((a) => ({ action: a, source: 'ia' as const, issue: groundingIssue(a, text) }));
    const merged = mergeActions(grounded, rules);
    const taken = new Set(merged.map((m) => m.action.type));
    const list = [...merged, ...refused.filter((r) => !taken.has(r.action.type))];

    const proposals = validateActions(list, {
      today,
      startDate,
      endDate,
      engaged,
      currency: trip.budget_currency ?? 'EUR',
      avoid: prefs?.avoid ?? [],
      wishes: prefs?.wishes ?? [],
    });
    return { success: true, proposals, usedAi, note };
  } catch (err) {
    console.error('[compas] compasInterpretAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}
