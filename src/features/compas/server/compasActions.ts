'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  compasMeta,
  patchTripMetadata,
  requireEditor,
  resplitSteps,
  type Supa,
} from './compasServer';
import { lookupDestination } from './placeLookup';
import { getTripById } from '@/lib/queries-trips';
import { addTripItem } from '@/lib/queries-trip-kit';
import { askAI } from '@/lib/ai/askAI';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { createBookingProvider } from '@/features/booking/server/bookingProvider';
import { BookingProviderError } from '@/features/booking/server/bookingProviderErrors';
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
import { planKitApply, type MyKit } from '../engine/kitApply';
import { simplifyOffers, stayDates, type CompasStayOffer } from '../engine/stays';
import { readCompasMeta } from '../engine/meta';
import { localToday } from './weather';
import {
  COMPAS_VERDICT_SPEC,
  buildCompasVerdictPrompt,
  buildCompasVerdictSystem,
} from '@/lib/ai/features/compasVerdict';
import { checkExplanation, verdictFacts } from '../engine/verdictExplain';
import { getCompasData } from './getCompasData';
import { setActiveAdventureAction } from '@/features/hub/context/activeAdventureServer';

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

/**
 * Volontairement vide. Les pages du voyage, du hub et du Compas sont
 * dynamiques (aucun cache côté navigateur en Next 15) : un `revalidatePath`
 * ne servait qu'à forcer le rendu COMPLET du Compas avant de répondre, soit
 * plusieurs secondes par geste. Le Compas se rafraîchit lui-même en
 * arrière-plan après chaque écriture (`router.refresh` dans une transition).
 */
function revalidateTrip(_tripSlug: string) {}

/** Personnes réellement rattachées au voyage : propriétaire, collaborateurs, équipage actif. */
async function tripPeople(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trip: { id: string; user_id: string }
): Promise<Set<string>> {
  const { data: collabs } = await supabase
    .from('trip_collaborators')
    .select('user_id')
    .eq('trip_id', trip.id);
  const people = new Set<string>([
    trip.user_id,
    ...((collabs ?? []) as Array<{ user_id: string }>).map((c) => c.user_id),
  ]);
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
    const { data, error } = await supabase.rpc('return_inventory_item', {
      p_id: parsed.data.inventoryItemId,
    });
    if (error || !data)
      return { success: false, error: 'Impossible de mettre à jour cet objet.' };
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

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide');

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

const destinationSchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  /** Lieu tel que nommé (pays, région, ville, massif) ; null efface la destination. */
  place: z.string().trim().min(2).max(80).nullable(),
});

/**
 * Destination du voyage, retrouvée sur la carte (OpenStreetMap) : nom, code
 * pays et position servent ensuite au préremplissage. Un lieu que la carte ne
 * connaît pas est refusé, jamais deviné.
 */
export async function compasSetDestinationAction(
  input: z.input<typeof destinationSchema>
): Promise<CompasActionResult> {
  const parsed = destinationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Lieu invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const place = parsed.data.place ? await lookupDestination(parsed.data.place) : null;
    if (parsed.data.place && !place)
      return { success: false, error: `« ${parsed.data.place} » introuvable sur la carte.` };
    const metadata = await patchTripMetadata(auth.supabase, parsed.data.tripId, (m) => {
      const c = compasMeta(m);
      if (place)
        c.anchor = {
          name: place.name,
          lat: Math.round(place.lat * 1e5) / 1e5,
          lon: Math.round(place.lon * 1e5) / 1e5,
          countryCode: place.countryCode,
          country: place.country,
          kind: place.kind,
          extent: place.extent,
        };
      else delete c.anchor;
      return { ...m, compas: c };
    });
    // Titre encore générique (« Trek · nouvelle aventure ») : il prend le nom du lieu.
    const title = auth.trip.title ?? '';
    const generic = title.endsWith('nouvelle aventure');
    const { error } = await auth.supabase
      .from('trips')
      .update({
        destination_name: place?.name ?? null,
        destination_country_code: place?.countryCode ?? null,
        metadata,
        ...(place && generic ? { title: title.replace(/nouvelle aventure$/, place.name) } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.tripId);
    if (error) return { success: false, error: 'Impossible d’enregistrer la destination.' };
    return { success: true };
  } catch (err) {
    console.error('[compas] compasSetDestinationAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const spanSchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  days: z.number().int().min(1).max(60).nullable(),
});

/** Durée voulue quand la date de départ n'est pas encore choisie (« 20 jours »). */
export async function compasSetSpanAction(
  input: z.input<typeof spanSchema>
): Promise<CompasActionResult> {
  const parsed = spanSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Durée invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const metadata = await patchTripMetadata(auth.supabase, parsed.data.tripId, (m) => {
      const c = compasMeta(m);
      if (parsed.data.days == null) delete c.planned_days;
      else c.planned_days = parsed.data.days;
      return { ...m, compas: c };
    });
    const { error } = await auth.supabase
      .from('trips')
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('id', parsed.data.tripId);
    if (error) return { success: false, error: 'Impossible d’enregistrer la durée.' };
    return { success: true };
  } catch (err) {
    console.error('[compas] compasSetSpanAction', err);
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

const staySchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  day: z.number().int().min(1).max(60),
  /** Nom de l'hébergement ; vide = retirer la mention. */
  name: z.string().trim().max(120),
});

/** Déclare (ou retire) l'hébergement d'une nuit : aucune réservation n'est créée. */
export async function compasSetStayAction(
  input: z.input<typeof staySchema>
): Promise<CompasActionResult> {
  const parsed = staySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Hébergement invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const { data: steps, error: readError } = await auth.supabase
      .from('trip_steps')
      .select('id')
      .eq('trip_id', parsed.data.tripId)
      .eq('day_number', parsed.data.day)
      .order('order_index', { ascending: false })
      .limit(1);
    const target = (steps as Array<{ id: string }> | null)?.[0];
    if (readError || !target) return { success: false, error: 'Aucune étape pour cette nuit.' };
    const { data, error } = await auth.supabase
      .from('trip_steps')
      .update({
        accommodation_name: parsed.data.name || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', target.id)
      .select('id');
    if (error || !data?.length)
      return { success: false, error: 'Impossible d’enregistrer l’hébergement.' };
    revalidateTrip(parsed.data.tripSlug);
    return { success: true };
  } catch (err) {
    console.error('[compas] compasSetStayAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

/* ---------- Recherche d'hébergement (aucune réservation) ---------- */

export type CompasStaySearchResult =
  | {
      success: true;
      mode: 'sandbox' | 'live';
      offers: CompasStayOffer[];
      fetchedAt: string;
    }
  | { success: false; error: string };

const staySearchSchema = z.object({ tripId: uuid, day: z.number().int().min(1).max(60) });

/**
 * Cherche des hébergements pour la nuit d'un jour du voyage. Lecture seule :
 * aucune commande, aucun paiement, aucun lien de paiement n'est créé ici. Le
 * mode « test » du fournisseur est signalé pour que ses résultats ne passent
 * jamais pour de vraies offres.
 */
export async function compasSearchStaysAction(
  input: z.input<typeof staySearchSchema>
): Promise<CompasStaySearchResult> {
  const parsed = staySearchSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const trip = auth.trip as {
      start_date?: string | null;
      destination_name?: string | null;
      party_size?: number | null;
    };
    const dates = stayDates(trip.start_date ?? null, parsed.data.day);
    if (!dates) return { success: false, error: 'Choisis d’abord la date de départ du voyage.' };
    const destination = trip.destination_name?.trim();
    if (!destination) return { success: false, error: 'Le voyage n’a pas de destination.' };

    const provider = createBookingProvider({ env: process.env });
    if (!provider.supports('hotel'))
      return {
        success: false,
        error: 'Recherche en direct indisponible : les clés partenaires ne sont pas activées.',
      };

    const limited = await enforceRateLimit(auth.userId, {
      scope: 'booking-search',
      limit: 30,
      windowMs: 10 * 60_000,
      failMode: 'closed',
    });
    if (limited)
      return { success: false, error: 'Trop de recherches : réessaie dans quelques minutes.' };

    const result = await provider.search({
      vertical: 'hotel',
      destination,
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
      travelers: Math.max(1, Math.min(20, trip.party_size ?? 1)),
      limit: 8,
    });
    return {
      success: true,
      mode: result.mode,
      offers: simplifyOffers(result.offers),
      fetchedAt: result.fetchedAt,
    };
  } catch (err) {
    if (err instanceof BookingProviderError)
      return { success: false, error: 'Le fournisseur n’a pas répondu : réessaie plus tard.' };
    console.error('[compas] compasSearchStaysAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

/* ---------- Mes kits ---------- */

export type CompasMyKitsResult =
  { success: true; kits: MyKit[] } | { success: false; error: string };

/** Les kits de l'utilisateur connecté (hors corbeille), avec leurs objets. */
export async function compasListMyKitsAction(): Promise<CompasMyKitsResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Connecte-toi pour voir tes kits.' };
    const { data: kits, error } = await supabase
      .from('materiel_kits')
      .select('id, name, season')
      .eq('user_id', user.id)
      .eq('is_trashed', false)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (error) return { success: false, error: 'Impossible de lire tes kits.' };
    const ids = (kits ?? []).map((k) => k.id as string);
    if (!ids.length) return { success: true, kits: [] };
    const { data: items, error: itemsError } = await supabase
      .from('materiel_kit_items')
      .select('id, kit_id, name, category, weight_g, quantity, is_vital, product_ownership_id')
      .in('kit_id', ids)
      .limit(1000);
    if (itemsError) return { success: false, error: 'Impossible de lire les objets de tes kits.' };
    const byKit = new Map<string, MyKit['items']>();
    for (const row of (items ?? []) as Array<Record<string, unknown>>) {
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      if (!name) continue;
      const list = byKit.get(String(row.kit_id)) ?? [];
      list.push({
        id: String(row.id),
        name,
        category: typeof row.category === 'string' ? row.category : null,
        weightG: typeof row.weight_g === 'number' && row.weight_g > 0 ? row.weight_g : null,
        quantity: typeof row.quantity === 'number' && row.quantity > 0 ? row.quantity : 1,
        isVital: row.is_vital === true,
        productOwnershipId:
          typeof row.product_ownership_id === 'string' ? row.product_ownership_id : null,
      });
      byKit.set(String(row.kit_id), list);
    }
    return {
      success: true,
      kits: (kits ?? []).map((k) => ({
        id: k.id as string,
        name: String(k.name ?? 'Kit sans nom'),
        season: typeof k.season === 'string' ? k.season : null,
        items: byKit.get(k.id as string) ?? [],
      })),
    };
  } catch (err) {
    console.error('[compas] compasListMyKitsAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const applyKitSchema = z.object({ tripId: uuid, tripSlug: slug, kitId: uuid });

/**
 * Ajoute au voyage les objets d'un des kits de l'utilisateur qui n'y sont pas
 * déjà (même nom). Rien n'est retiré ni modifié ; objets personnels, non emballés.
 */
export async function compasApplyKitAction(
  input: z.input<typeof applyKitSchema>
): Promise<CompasActionResult> {
  const parsed = applyKitSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const listed = await compasListMyKitsAction();
    if (!listed.success) return listed;
    const kit = listed.kits.find((k) => k.id === parsed.data.kitId);
    if (!kit) return { success: false, error: 'Kit introuvable.' };
    const { data: existing, error: readError } = await auth.supabase
      .from('trip_items')
      .select('item_name')
      .eq('trip_id', parsed.data.tripId);
    if (readError) return { success: false, error: 'Impossible de lire le kit du voyage.' };
    const { toAdd } = planKitApply(
      kit,
      ((existing ?? []) as Array<{ item_name: string }>).map((r) => r.item_name)
    );
    if (!toAdd.length) return { success: true };
    const { data, error } = await auth.supabase
      .from('trip_items')
      .insert(
        toAdd.map((i) => ({
          trip_id: parsed.data.tripId,
          item_name: i.name,
          category: i.category,
          quantity: i.quantity,
          weight_grams: i.weightG,
          is_vital: i.isVital,
          priority: i.isVital ? 'vital' : 'recommended',
          source: 'kit',
          ownership: 'personal',
          owner_id: auth.userId,
          inventory_item_id: i.productOwnershipId,
        }))
      )
      .select('id');
    if (error || data?.length !== toAdd.length)
      return { success: false, error: 'Impossible d’ajouter les objets du kit.' };
    revalidateTrip(parsed.data.tripSlug);
    return { success: true };
  } catch (err) {
    console.error('[compas] compasApplyKitAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const createKitSchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  name: z.string().trim().min(2, 'Nom trop court').max(80, 'Nom trop long'),
  season: z.enum(['printemps', 'ete', 'automne', 'hiver', 'toute_saison']).nullable(),
});

/**
 * « Créer mon kit » : enregistre le kit du voyage comme un kit réutilisable
 * (materiel_kits, origine manuelle, privé). Les objets sont copiés tels quels ;
 * le lien d'inventaire n'est gardé que pour les objets de la personne.
 */
export async function compasCreateKitFromTripAction(
  input: z.input<typeof createKitSchema>
): Promise<CompasActionResult & { kitId?: string; count?: number }> {
  const parsed = createKitSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Requête invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const limited = await enforceRateLimit(auth.userId, {
      scope: 'compas-create-kit',
      limit: 10,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return { success: false, error: 'Trop de kits d’un coup : patiente une minute.' };
    const { data: rows, error: readError } = await auth.supabase
      .from('trip_items')
      .select(
        'item_name, category, quantity, weight_grams, is_vital, priority, owner_id, inventory_item_id'
      )
      .eq('trip_id', parsed.data.tripId)
      .limit(500);
    if (readError) return { success: false, error: 'Impossible de lire le kit du voyage.' };
    const items = ((rows ?? []) as Array<Record<string, unknown>>).filter(
      (r) => typeof r.item_name === 'string' && r.item_name.trim().length > 0
    );
    if (!items.length)
      return { success: false, error: 'Le kit du voyage est vide : ajoute d’abord des objets.' };
    const weight = (r: Record<string, unknown>) => {
      const w = Number(r.weight_grams);
      return Number.isFinite(w) && w > 0 ? Math.round(w) : null;
    };
    const qty = (r: Record<string, unknown>) => {
      const q = Number(r.quantity);
      return Number.isFinite(q) && q > 0 ? Math.round(q) : 1;
    };
    const total = items.reduce((t, r) => t + (weight(r) ?? 0) * qty(r), 0);
    const { data: kit, error: kitError } = await auth.supabase
      .from('materiel_kits')
      .insert({
        user_id: auth.userId,
        name: parsed.data.name,
        season: parsed.data.season,
        origin: 'manuel',
        total_weight_g: total,
        description: `Créé depuis le Compas (${auth.trip.title ?? 'voyage'})`,
      })
      .select('id')
      .single();
    if (kitError || !kit) return { success: false, error: 'Impossible de créer le kit.' };
    const kitId = (kit as { id: string }).id;
    const { error: itemsError } = await auth.supabase.from('materiel_kit_items').insert(
      items.map((r) => {
        const vital = r.is_vital === true;
        const priority =
          r.priority === 'vital' || r.priority === 'optional' ? String(r.priority) : 'recommended';
        return {
          kit_id: kitId,
          user_id: auth.userId,
          name: String(r.item_name).trim().slice(0, 120),
          category: typeof r.category === 'string' ? r.category : null,
          quantity: qty(r),
          weight_g: weight(r),
          is_vital: vital,
          priority: vital ? 'vital' : priority,
          ownership: 'personal',
          product_ownership_id:
            r.owner_id === auth.userId && typeof r.inventory_item_id === 'string'
              ? r.inventory_item_id
              : null,
        };
      })
    );
    if (itemsError) {
      // Pas de kit vide orphelin : on retire l'en-tête créé juste avant.
      await auth.supabase.from('materiel_kits').delete().eq('id', kitId).eq('user_id', auth.userId);
      return { success: false, error: 'Impossible d’enregistrer les objets du kit.' };
    }
    revalidateTrip(parsed.data.tripSlug);
    return { success: true, kitId, count: items.length };
  } catch (err) {
    console.error('[compas] compasCreateKitFromTripAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

/* ---------- Équipe (Nous · Qui) ---------- */

export interface CompasPerson {
  userId: string;
  name: string;
  avatarUrl: string | null;
  location: string | null;
  /** Personne que je suis (user_follows) : proposée sans recherche. */
  followed: boolean;
}

const peopleSchema = z.object({
  tripId: uuid,
  query: z.string().trim().max(60),
});

/**
 * Personnes à ajouter au voyage : sans texte, celles que je suis ; avec un
 * texte, recherche par nom sur les profils publics (jamais par e-mail : pas
 * d'énumération). Les membres déjà présents sont écartés.
 */
export async function compasSearchPeopleAction(
  input: z.input<typeof peopleSchema>
): Promise<{ success: true; people: CompasPerson[] } | { success: false; error: string }> {
  const parsed = peopleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Recherche invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const limited = await enforceRateLimit(auth.userId, {
      scope: 'compas-people',
      limit: 40,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return { success: false, error: 'Trop de recherches : patiente une minute.' };
    const present = await tripPeople(auth.supabase, auth.trip);
    const { data: follows } = await auth.supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', auth.userId)
      .limit(200);
    const followed = new Set(
      ((follows ?? []) as Array<{ following_id: string }>).map((f) => f.following_id)
    );
    const q = parsed.data.query;
    let rows: Array<Record<string, unknown>> = [];
    if (q.length >= 2) {
      const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const { data, error } = await auth.supabase
        .from('public_profiles')
        .select('id, full_name, avatar_url, location')
        .ilike('full_name', pattern)
        .limit(20);
      if (error) return { success: false, error: 'Recherche indisponible.' };
      rows = (data ?? []) as Array<Record<string, unknown>>;
    } else if (followed.size) {
      const { data, error } = await auth.supabase
        .from('public_profiles')
        .select('id, full_name, avatar_url, location')
        .in('id', [...followed].slice(0, 50));
      if (error) return { success: false, error: 'Recherche indisponible.' };
      rows = (data ?? []) as Array<Record<string, unknown>>;
    }
    const people = rows
      .filter((r) => typeof r.id === 'string' && !present.has(r.id) && r.id !== auth.userId)
      .map((r) => ({
        userId: String(r.id),
        name:
          typeof r.full_name === 'string' && r.full_name.trim() ? r.full_name.trim() : 'Voyageur',
        avatarUrl: typeof r.avatar_url === 'string' ? r.avatar_url : null,
        location: typeof r.location === 'string' && r.location.trim() ? r.location.trim() : null,
        followed: followed.has(String(r.id)),
      }))
      .sort((a, b) => Number(b.followed) - Number(a.followed) || a.name.localeCompare(b.name, 'fr'))
      .slice(0, 12);
    return { success: true, people };
  } catch (err) {
    console.error('[compas] compasSearchPeopleAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const memberSchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  userId: uuid,
  role: z.enum(['editor', 'viewer']),
  source: z.enum(['direct', 'friend', 'club', 'group', 'message', 'comment']).optional(),
});

/**
 * Invite une personne au voyage. Elle n'y accède qu'après avoir accepté
 * (notification, accepter / refuser sur place). La notification part d'un
 * déclencheur en base : aucune écriture dans les notifications d'autrui ici.
 */
export async function compasInviteMemberAction(
  input: z.input<typeof memberSchema>
): Promise<CompasActionResult & { invitationId?: string }> {
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    if (parsed.data.userId === auth.userId)
      return { success: false, error: 'Tu fais déjà partie du voyage.' };
    const limited = await enforceRateLimit(auth.userId, {
      scope: 'compas-invite',
      limit: 20,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return { success: false, error: 'Trop d’invitations d’un coup : patiente une minute.' };
    const present = await tripPeople(auth.supabase, auth.trip);
    if (present.has(parsed.data.userId))
      return { success: false, error: 'Cette personne fait déjà partie du voyage.' };
    const { data: profile } = await auth.supabase
      .from('public_profiles')
      .select('id')
      .eq('id', parsed.data.userId)
      .maybeSingle();
    if (!profile) return { success: false, error: 'Personne introuvable.' };
    const { data, error } = await auth.supabase
      .from('trip_invitations')
      .insert({
        trip_id: parsed.data.tripId,
        invitee_id: parsed.data.userId,
        invited_by: auth.userId,
        role: parsed.data.role,
        source: parsed.data.source ?? 'direct',
      })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505')
        return { success: false, error: 'Une invitation attend déjà sa réponse.' };
      console.warn('[compas] invitation', error.code, error.message);
      return { success: false, error: 'Impossible d’envoyer l’invitation.' };
    }
    return { success: true, invitationId: (data as { id: string }).id };
  } catch (err) {
    console.error('[compas] compasInviteMemberAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const invitationSchema = z.object({ tripId: uuid, invitationId: uuid });

/** Annule une invitation en attente (ou ferme le lien d'invitation). */
export async function compasCancelInvitationAction(
  input: z.input<typeof invitationSchema>
): Promise<CompasActionResult> {
  const parsed = invitationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const { data, error } = await auth.supabase
      .from('trip_invitations')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('id', parsed.data.invitationId)
      .eq('trip_id', parsed.data.tripId)
      .eq('status', 'pending')
      .select('id');
    if (error || !data?.length)
      return { success: false, error: 'Invitation déjà close ou introuvable.' };
    return { success: true };
  } catch (err) {
    console.error('[compas] compasCancelInvitationAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const linkSchema = z.object({ tripId: uuid, role: z.enum(['editor', 'viewer']) });

/**
 * Lien d'invitation pour l'extérieur (message, club, groupe, commentaire,
 * autre application). Un seul lien ouvert par voyage et par rôle : on le
 * réutilise. Chaque personne qui l'ouvre accepte ou refuse, puis seulement
 * accède au voyage.
 */
export async function compasInviteLinkAction(
  input: z.input<typeof linkSchema>
): Promise<{ success: true; path: string } | { success: false; error: string }> {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const { data: open } = await auth.supabase
      .from('trip_invitations')
      .select('token')
      .eq('trip_id', parsed.data.tripId)
      .is('invitee_id', null)
      .eq('role', parsed.data.role)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    let token = (open as { token?: string } | null)?.token ?? null;
    if (!token) {
      const { data, error } = await auth.supabase
        .from('trip_invitations')
        .insert({
          trip_id: parsed.data.tripId,
          invitee_id: null,
          invited_by: auth.userId,
          role: parsed.data.role,
          source: 'link',
        })
        .select('token')
        .single();
      if (error || !data) return { success: false, error: 'Impossible de créer le lien.' };
      token = (data as { token: string }).token;
    }
    return { success: true, path: `/invitation/${token}` };
  } catch (err) {
    console.error('[compas] compasInviteLinkAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

/**
 * Annuler un retrait (îlot « Annuler ») : la personne avait déjà accepté.
 * Réservé aux personnes ayant une invitation acceptée pour ce voyage, pour
 * qu'aucun ajout ne contourne le consentement.
 */
export async function compasRestoreMemberAction(
  input: z.input<typeof memberSchema>
): Promise<CompasActionResult> {
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    if (auth.trip.user_id !== auth.userId)
      return { success: false, error: 'Seul l’organisateur gère l’équipe.' };
    const { data: consent } = await auth.supabase
      .from('trip_invitations')
      .select('id')
      .eq('trip_id', parsed.data.tripId)
      .eq('invitee_id', parsed.data.userId)
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle();
    if (!consent) return { success: false, error: 'Invite à nouveau cette personne.' };
    const { error } = await auth.supabase.from('trip_collaborators').insert({
      trip_id: parsed.data.tripId,
      user_id: parsed.data.userId,
      role: parsed.data.role,
      invited_by: auth.userId,
    });
    if (error && error.code !== '23505')
      return { success: false, error: 'Impossible de remettre cette personne.' };
    return { success: true };
  } catch (err) {
    console.error('[compas] compasRestoreMemberAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

/** Change le rôle d'un membre ajouté au voyage (organisateur seulement, RLS). */
export async function compasSetMemberRoleAction(
  input: z.input<typeof memberSchema>
): Promise<CompasActionResult> {
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    if (auth.trip.user_id !== auth.userId)
      return { success: false, error: 'Seul l’organisateur change les rôles.' };
    const { data, error } = await auth.supabase
      .from('trip_collaborators')
      .update({ role: parsed.data.role })
      .eq('trip_id', parsed.data.tripId)
      .eq('user_id', parsed.data.userId)
      .select('id');
    if (error || !data?.length)
      return {
        success: false,
        error: 'Rôle modifiable seulement pour les personnes ajoutées au voyage.',
      };
    revalidateTrip(parsed.data.tripSlug);
    return { success: true };
  } catch (err) {
    console.error('[compas] compasSetMemberRoleAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const removeMemberSchema = memberSchema.omit({ role: true });

/** Retire une personne ajoutée au voyage (organisateur seulement, RLS). */
export async function compasRemoveMemberAction(
  input: z.input<typeof removeMemberSchema>
): Promise<CompasActionResult> {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  try {
    const auth = await requireEditor(parsed.data.tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    if (auth.trip.user_id !== auth.userId)
      return { success: false, error: 'Seul l’organisateur retire quelqu’un du voyage.' };
    if (parsed.data.userId === auth.userId)
      return { success: false, error: 'L’organisateur ne peut pas se retirer.' };
    const { data, error } = await auth.supabase
      .from('trip_collaborators')
      .delete()
      .eq('trip_id', parsed.data.tripId)
      .eq('user_id', parsed.data.userId)
      .select('id');
    if (error || !data?.length)
      return {
        success: false,
        error: 'Seules les personnes ajoutées au voyage peuvent être retirées ici.',
      };
    // Trace du consentement passé (membres d'avant les invitations) : elle
    // seule autorise « Annuler » à remettre la personne dans le voyage.
    const { data: consent } = await auth.supabase
      .from('trip_invitations')
      .select('id')
      .eq('trip_id', parsed.data.tripId)
      .eq('invitee_id', parsed.data.userId)
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle();
    if (!consent)
      await auth.supabase.from('trip_invitations').insert({
        trip_id: parsed.data.tripId,
        invitee_id: parsed.data.userId,
        invited_by: auth.userId,
        status: 'accepted',
        responded_at: new Date().toISOString(),
      });
    revalidateTrip(parsed.data.tripSlug);
    return { success: true };
  } catch (err) {
    console.error('[compas] compasRemoveMemberAction', err);
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

/** « Autour » : tous les parcours du catalogue à moins de 50 km, du plus proche au plus loin. */
const AROUND_RADIUS_KM = 50;

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
        p_radius_km: query ? 500 : AROUND_RADIUS_KM,
        p_query: query || null,
        p_limit: query ? 12 : 60,
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

/**
 * Libère un parcours tenu par un brouillon vide du Compas du même compte
 * (aucune étape, aucun objet) : ces brouillons naissent d'un geste abandonné.
 * Une aventure qui contient quoi que ce soit n'est jamais modifiée.
 */
async function freeRouteFromEmptyDraft(
  supabase: Supa,
  userId: string,
  tripId: string,
  routeId: number
): Promise<{ freed: boolean; title: string | null }> {
  const { data: other } = await supabase
    .from('trips')
    .select('id, title, status, metadata')
    .eq('user_id', userId)
    .neq('id', tripId)
    .eq('metadata->>route_id', String(routeId))
    .maybeSingle();
  if (!other) return { freed: false, title: null };
  const o = other as {
    id: string;
    title: string | null;
    status: string | null;
    metadata: Record<string, unknown> | null;
  };
  const [{ count: steps }, { count: items }] = await Promise.all([
    supabase.from('trip_steps').select('id', { count: 'exact', head: true }).eq('trip_id', o.id),
    supabase.from('trip_items').select('id', { count: 'exact', head: true }).eq('trip_id', o.id),
  ]);
  const emptyDraft =
    o.status === 'draft' &&
    o.metadata?.created_with === 'compas' &&
    (steps ?? 0) === 0 &&
    (items ?? 0) === 0;
  if (!emptyDraft) return { freed: false, title: o.title };
  const meta = { ...(o.metadata ?? {}) };
  delete meta.route_id;
  const { error } = await supabase
    .from('trips')
    .update({ metadata: meta, updated_at: new Date().toISOString() })
    .eq('id', o.id)
    .eq('user_id', userId);
  return { freed: !error, title: o.title };
}

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
    const write = () =>
      auth.supabase
        .from('trips')
        .update({ metadata, updated_at: new Date().toISOString() })
        .eq('id', tripId)
        .select('id');
    let { data, error } = await write();
    // Un compte ne peut avoir qu'une aventure par parcours (index unique
    // historique du flux « sentier »). Si le parcours est tenu par un de SES
    // brouillons vides du Compas, on le libère ; sinon on nomme l'aventure.
    if (error?.code === '23505') {
      const freed = await freeRouteFromEmptyDraft(auth.supabase, auth.userId, tripId, routeId);
      if (freed.freed) ({ data, error } = await write());
      else
        return {
          success: false,
          error: freed.title
            ? `Ce parcours est déjà celui de ton aventure « ${freed.title} ». Ouvre-la depuis le menu des aventures.`
            : 'Ce parcours est déjà utilisé par une autre de tes aventures.',
        };
    }
    if (error || !data?.length) {
      console.error('[compas] compasApplyRouteAction update', error?.code, error?.message);
      return { success: false, error: 'Impossible de choisir ce parcours.' };
    }
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
    const { data: expenseRows } = await auth.supabase
      .from('trip_expenses')
      .select('amount')
      .eq('trip_id', tripId);
    const engaged = ((expenseRows ?? []) as Array<{ amount: unknown }>).reduce(
      (t, e) => t + (Number(e.amount) || 0),
      0
    );

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
    const ctx = {
      today,
      startDate,
      endDate,
      engaged,
      currency: trip.budget_currency ?? 'EUR',
      avoid: prefs?.avoid ?? [],
      wishes: prefs?.wishes ?? [],
    };
    // Une proposition de l'IA que le Compas refuse (date passée, mauvaise année…)
    // ne masque pas la lecture correcte des règles pour le même réglage.
    const ruleTypes = new Set(rules.map((r) => r.type));
    const aiKept = grounded.filter(
      (a) =>
        !ruleTypes.has(a.type) ||
        validateActions([{ action: a, source: 'ia' as const }], ctx)[0]?.ok !== false
    );
    const merged = mergeActions(aiKept, rules);
    const taken = new Set(merged.map((m) => m.action.type));
    const list = [...merged, ...refused.filter((r) => !taken.has(r.action.type))];

    const proposals = validateActions(list, ctx);
    return { success: true, proposals, usedAi, note };
  } catch (err) {
    console.error('[compas] compasInterpretAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

/* ---------- Verdict expliqué par l'IA ---------- */

const explainSchema = z.object({ tripId: uuid });

/**
 * L'IA reformule le verdict à partir des seuls faits du moteur. Le niveau ne
 * change jamais ; une réponse qui invente un nombre, parle de score ou rassure
 * au-delà des faits est écartée et la raison est rendue.
 */
export async function compasExplainVerdictAction(
  input: z.input<typeof explainSchema>
): Promise<
  | { success: true; text: string | null; refused: string | null; note: string | null }
  | { success: false; error: string }
> {
  const parsed = explainSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Voyage invalide' };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Connecte-toi pour obtenir une explication.' };
    // Les mêmes données que l'écran, lues pour cette personne (RLS) : l'IA ne
    // voit que ce que le Compas affiche déjà.
    const data = await getCompasData();
    if (!data || data.model.tripId !== parsed.data.tripId)
      return { success: false, error: 'Voyage introuvable ou non autorisé.' };
    const facts = verdictFacts({
      level: data.model.verdict.level,
      reasons: data.model.verdict.reasons,
      danger: data.danger,
    });
    const res = await askAI({
      feature: 'compas-verdict',
      tier: COMPAS_VERDICT_SPEC.tier,
      system: buildCompasVerdictSystem(),
      prompt: buildCompasVerdictPrompt(facts),
      maxTokens: 400,
      cacheTtlSeconds: 0,
      userId: user.id,
    });
    if (res.degraded || res.provider === 'fallback') {
      return {
        success: true,
        text: null,
        refused: null,
        note: AI_NOTES[res.failureReason ?? 'provider_indisponible'].replace(
          'lu par les règles du Compas',
          'les signaux ci-dessus restent la référence'
        ),
      };
    }
    const check = checkExplanation(res.text, facts);
    return check.ok
      ? { success: true, text: check.text, refused: null, note: null }
      : { success: true, text: null, refused: check.reason, note: null };
  } catch (err) {
    console.error('[compas] compasExplainVerdictAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

/* ---------- Ouvrir une aventure dans le Compas ---------- */

/* ---------- Créer une aventure depuis le Compas ---------- */

const createTripSchema = z.object({ activity: z.enum(ACTIVITIES) });

const CREATE_LABEL: Record<(typeof ACTIVITIES)[number], string> = {
  hiking: 'Randonnée',
  trekking: 'Trek',
  bivouac: 'Bivouac',
  roadtrip: 'Road trip',
  cultural: 'Culturel',
  bushcraft: 'Bushcraft',
  mixed: 'Mixte',
};

/**
 * Le Compas est le seul préparateur : la première décision (l'activité) crée
 * le voyage en brouillon, sans date ni lieu inventés, puis l'ouvre comme
 * aventure active. Le propriétaire est posé par le trigger
 * `trg_trips_insert_owner` ; absent, le voyage est annulé.
 */
export async function compasCreateTripAction(
  input: z.input<typeof createTripSchema>
): Promise<CompasActionResult & { slug?: string }> {
  const parsed = createTripSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Activité invalide' };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Connecte-toi pour créer une aventure.' };
    const limited = await enforceRateLimit(user.id, {
      scope: 'compas-create-trip',
      limit: 10,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited)
      return { success: false, error: 'Trop de créations d’affilée : patiente une minute.' };

    const label = CREATE_LABEL[parsed.data.activity];
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const base = label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const { data: created, error } = await supabase
      .from('trips')
      .insert({
        user_id: user.id,
        slug: `${base}-${suffix}`,
        title: `${label} · nouvelle aventure`,
        status: 'draft',
        visibility: 'private',
        difficulty: 'moderate',
        primary_activity: parsed.data.activity,
        budget_currency: 'EUR',
        metadata: { created_with: 'compas' },
      })
      .select('id, slug, title')
      .single();
    if (error || !created) {
      console.error('[compas] compasCreateTripAction insert', error?.code);
      return { success: false, error: 'L’aventure n’a pas pu être créée. Réessaie.' };
    }
    const { data: owner } = await supabase
      .from('trip_collaborators')
      .select('role')
      .eq('trip_id', created.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (owner?.role !== 'owner') {
      await supabase.from('trips').delete().eq('id', created.id);
      return { success: false, error: 'L’aventure n’a pas pu être créée. Réessaie.' };
    }
    const res = await setActiveAdventureAction({
      nature: 'sortie',
      id: created.id,
      slug: created.slug,
      title: created.title,
    });
    if (!res.success)
      return {
        success: false,
        error: 'Aventure créée mais impossible de l’ouvrir : ouvre-la depuis le Hub.',
      };
    revalidatePath('/compas');
    return { success: true, slug: created.slug };
  } catch (err) {
    console.error('[compas] compasCreateTripAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const openTripSchema = z.object({ tripId: uuid });

/**
 * Fait de ce voyage l'aventure active (même cookie que le hub), après avoir
 * vérifié que la personne peut le lire. Le Compas s'ouvre alors dessus.
 */
export async function compasOpenTripAction(
  input: z.input<typeof openTripSchema>
): Promise<CompasActionResult> {
  const parsed = openTripSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Voyage invalide' };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Connecte-toi pour ouvrir un voyage.' };
    const trip = await getTripById(parsed.data.tripId, user.id);
    if (!trip?.slug) return { success: false, error: 'Voyage introuvable ou non autorisé.' };
    const res = await setActiveAdventureAction({
      nature: 'sortie',
      id: trip.id,
      slug: trip.slug,
      title: trip.title ?? 'Voyage',
    });
    if (!res.success) return { success: false, error: 'Impossible d’ouvrir ce voyage.' };
    revalidatePath('/compas');
    return { success: true };
  } catch (err) {
    console.error('[compas] compasOpenTripAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}
