import type { SupabaseClient } from '@supabase/supabase-js';
import type { CartLine, CartLineKind } from '../cartTypes';
import { CART_ERROR_CODES, CartError } from './cartErrors';

/**
 * Accès données du panier — strictement un accès, aucune décision métier.
 * Le client Supabase passé est celui de la requête (SSR + RLS) : le rôle
 * `authenticated` est donc appliqué par PostgreSQL en dernier rempart.
 */

export interface CartLineRow {
  id: string;
  user_id: string;
  trip_id: string;
  kind: CartLineKind;
  ref_id: string;
  quantity: number;
  unit_price_eur: number | string;
  currency: string;
  metadata: unknown;
  created_at: string;
  updated_at: string;
}

export interface CartReferencePrice {
  unitPriceEur: number;
  currency: string;
  /** Métadonnées d'affichage déduites de la source serveur. */
  metadata: CartLine['metadata'];
}

export interface ProductReferenceRow {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  category: string | null;
  image: string | null;
  image_alt: string | null;
  weight_g: number | null;
  price_eur: number | string;
  available: boolean | null;
  is_active: boolean | null;
}

export interface BookingReferenceRow {
  id: string;
  amount_eur: number | string;
  currency: string;
  vertical: string;
  provider: string;
  status: string;
  metadata: unknown;
}

const CART_LINE_COLUMNS =
  'id, user_id, trip_id, kind, ref_id, quantity, unit_price_eur, currency, metadata, created_at, updated_at';

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Convertit une ligne SQL en ligne domaine, sans muter l'objet source. */
export function toCartLine(row: CartLineRow): CartLine {
  return {
    id: row.id,
    userId: row.user_id,
    tripId: row.trip_id,
    kind: row.kind,
    refId: row.ref_id,
    quantity: toNumber(row.quantity),
    unitPriceEur: toNumber(row.unit_price_eur),
    currency: row.currency,
    metadata:
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? ({ ...(row.metadata as CartLine['metadata']) })
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Erreur PostgREST « violate unique constraint » (course concurrente). */
export function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

export function throwRepositoryError(
  scope: string,
  error: { code?: string; message: string } | null
): never {
  const code = error?.code;
  const message = `[cart:${scope}] ${error?.message ?? 'erreur inconnue'}`;
  if (code === '42501') throw new CartError({ code: CART_ERROR_CODES.forbidden, message });
  if (code === '23503' || code === '23514' || code === '22023') {
    throw new CartError({ code: CART_ERROR_CODES.invalid_reference, message });
  }
  if (code === 'PGRST116') {
    throw new CartError({ code: CART_ERROR_CODES.line_not_found, message });
  }
  throw new CartError({ code: CART_ERROR_CODES.internal, message, cause: error });
}

export async function selectTripOwner(
  supabase: SupabaseClient,
  tripId: string
): Promise<{ id: string; userId: string } | null> {
  const { data, error } = await supabase
    .from('trips')
    .select('id, user_id')
    .eq('id', tripId)
    .maybeSingle();
  if (error) throwRepositoryError('trip', error);
  if (!data) return null;
  return { id: data.id as string, userId: data.user_id as string };
}

/**
 * Droits du voyage via les RPC RLS. Un échec RPC n'est pas un grant : on le
 * traite comme un refus (fail-closed) plutôt que d'ouvrir le panier.
 */
export async function callTripPermissionRpc(
  supabase: SupabaseClient,
  rpc: 'can_read_trip' | 'can_edit_trip',
  tripId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc(rpc, { p_trip_id: tripId });
  if (error) {
    console.error(`[cart:${rpc}] appel RPC refusé`, { code: error.code });
    return false;
  }
  return data === true;
}

export async function listCartLines(
  supabase: SupabaseClient,
  { userId, tripId }: { userId: string; tripId: string }
): Promise<CartLine[]> {
  const { data, error } = await supabase
    .from('cart_lines')
    .select(CART_LINE_COLUMNS)
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throwRepositoryError('list', error);
  return ((data ?? []) as CartLineRow[]).map(toCartLine);
}

export async function findCartLineByRef(
  supabase: SupabaseClient,
  { userId, tripId, kind, refId }: { userId: string; tripId: string; kind: CartLineKind; refId: string }
): Promise<CartLine | null> {
  const { data, error } = await supabase
    .from('cart_lines')
    .select(CART_LINE_COLUMNS)
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .eq('kind', kind)
    .eq('ref_id', refId)
    .maybeSingle();
  if (error) throwRepositoryError('find', error);
  return data ? toCartLine(data as CartLineRow) : null;
}

export async function findCartLineById(
  supabase: SupabaseClient,
  { userId, lineId }: { userId: string; lineId: string }
): Promise<CartLine | null> {
  const { data, error } = await supabase
    .from('cart_lines')
    .select(CART_LINE_COLUMNS)
    .eq('id', lineId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throwRepositoryError('find-line', error);
  return data ? toCartLine(data as CartLineRow) : null;
}

export interface InsertCartLineRow {
  user_id: string;
  trip_id: string;
  kind: CartLineKind;
  ref_id: string;
  quantity: number;
  unit_price_eur: number;
  currency: string;
  metadata: CartLine['metadata'];
}

export async function insertCartLine(
  supabase: SupabaseClient,
  row: InsertCartLineRow
): Promise<{ line: CartLine | null; error: { code?: string; message: string } | null }> {
  const { data, error } = await supabase
    .from('cart_lines')
    .insert({ ...row })
    .select(CART_LINE_COLUMNS)
    .maybeSingle();
  if (error) return { line: null, error };
  return { line: data ? toCartLine(data as CartLineRow) : null, error: null };
}

export async function patchCartLine(
  supabase: SupabaseClient,
  { userId, lineId, patch }: { userId: string; lineId: string; patch: Partial<InsertCartLineRow> }
): Promise<CartLine | null> {
  const { data, error } = await supabase
    .from('cart_lines')
    .update({ ...patch })
    .eq('id', lineId)
    .eq('user_id', userId)
    .select(CART_LINE_COLUMNS)
    .maybeSingle();
  if (error) throwRepositoryError('patch', error);
  return data ? toCartLine(data as CartLineRow) : null;
}

export async function deleteCartLine(
  supabase: SupabaseClient,
  { userId, lineId }: { userId: string; lineId: string }
): Promise<boolean> {
  const { data, error } = await supabase
    .from('cart_lines')
    .delete()
    .eq('id', lineId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throwRepositoryError('delete', error);
  return Boolean(data);
}

/**
 * Résolution serveur du prix d'un produit. `is_active` est tolérant au NULL
 * comme le trigger `validate_cart_line_reference` (COALESCE(is_active,true)).
 */
export async function selectProductReference(
  supabase: SupabaseClient,
  refId: string
): Promise<CartReferencePrice | null> {
  const { data, error } = await supabase
    .from('shop_products')
    .select('id, slug, name, brand, category, image, image_alt, weight_g, price_eur, available, is_active')
    .eq('id', refId)
    .maybeSingle();
  if (error) throwRepositoryError('product-reference', error);
  const row = data as ProductReferenceRow | null;
  if (!row) return null;
  if (row.available === false || row.is_active === false) return null;

  const metadata: CartReferencePrice['metadata'] = { title: row.name };
  if (row.slug) metadata.slug = row.slug;
  if (row.brand) metadata.brand = row.brand;
  if (row.category) metadata.category = row.category;
  if (row.image && /^https?:\/\//i.test(row.image)) metadata.image = row.image;
  if (row.image_alt) metadata.imageAlt = row.image_alt;
  if (typeof row.weight_g === 'number') metadata.weightG = row.weight_g;

  return { unitPriceEur: toNumber(row.price_eur), currency: 'EUR', metadata };
}

/** Résolution serveur du prix d'une réservation, scopée au voyage + propriétaire. */
export async function selectBookingReference(
  supabase: SupabaseClient,
  { refId, userId, tripId }: { refId: string; userId: string; tripId: string }
): Promise<CartReferencePrice | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, amount_eur, currency, vertical, provider, status, metadata')
    .eq('id', refId)
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throwRepositoryError('booking-reference', error);
  const row = data as BookingReferenceRow | null;
  if (!row) return null;

  const source = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
    ? (row.metadata as Record<string, unknown>)
    : {};
  const metadata: CartReferencePrice['metadata'] = {
    vertical: row.vertical,
    provider: row.provider,
    status: row.status,
  };
  if (typeof source.title === 'string' && source.title.trim()) metadata.title = source.title.slice(0, 200);
  if (typeof source.deeplink === 'string' && /^https?:\/\/\S+$/i.test(source.deeplink)) {
    metadata.deeplink = source.deeplink.slice(0, 1000);
  }
  if (source.requiresRevalidation === true) metadata.requiresRevalidation = true;

  return { unitPriceEur: toNumber(row.amount_eur), currency: row.currency, metadata };
}
