import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CART_IDEMPOTENCY_METADATA_KEY,
  CART_MAX_LINES,
  type CartLine,
  type CartLineMetadata,
} from '../cartTypes';
import { computeCartTotals, clampCartQuantity, roundEur } from '../engine/cartMath';
import {
  sanitizeCartMetadata,
  type AddCartLineInput,
  type UpdateCartLineInput,
} from '../schemas/cartSchemas';
import { CART_ERROR_CODES, CartError } from './cartErrors';
import {
  callTripPermissionRpc,
  deleteCartLine,
  findCartLineById,
  findCartLineByRef,
  insertCartLine,
  isUniqueViolation,
  listCartLines,
  patchCartLine,
  selectBookingReference,
  selectProductReference,
  selectTripOwner,
  type CartReferencePrice,
} from './cartRepository';

export interface CartContext {
  supabase: SupabaseClient;
  userId: string;
  tripId: string;
}

export interface CartView {
  tripId: string;
  lines: CartLine[];
  totals: ReturnType<typeof computeCartTotals>;
}

export interface AddCartLineResult {
  line: CartLine;
  /** true si la ligne vient d'être insérée, false si fusionnée. */
  created: boolean;
  /** true si l'ajout a été absorbé par une clé d'idempotence déjà vue. */
  deduplicated: boolean;
}

/**
 * Lecture du panier : le voyage doit être lisible par l'utilisateur.
 * Le RLS `cart_lines_owner_read` reste le filet de sécurité ; on filtre en
 * plus sur `user_id` pour n'exposer que le panier de l'appelant.
 */
export async function assertTripReadable(context: CartContext): Promise<void> {
  const trip = await selectTripOwner(context.supabase, context.tripId);
  if (!trip) {
    throw new CartError({ code: CART_ERROR_CODES.trip_not_found, message: '[cart] voyage inconnu' });
  }
  if (trip.userId === context.userId) return;
  const allowed = await callTripPermissionRpc(context.supabase, 'can_read_trip', context.tripId);
  if (!allowed) {
    throw new CartError({
      code: CART_ERROR_CODES.forbidden,
      message: '[cart] lecture du voyage refusée',
    });
  }
}

/** Écriture : propriétaire du panier ET droits d'édition sur le voyage. */
export async function assertTripWritable(context: CartContext): Promise<void> {
  const trip = await selectTripOwner(context.supabase, context.tripId);
  if (!trip) {
    throw new CartError({ code: CART_ERROR_CODES.trip_not_found, message: '[cart] voyage inconnu' });
  }
  if (trip.userId === context.userId) return;
  const allowed = await callTripPermissionRpc(context.supabase, 'can_edit_trip', context.tripId);
  if (!allowed) {
    throw new CartError({
      code: CART_ERROR_CODES.forbidden,
      message: '[cart] écriture du voyage refusée',
    });
  }
}

export async function listTripCart(context: CartContext): Promise<CartView> {
  await assertTripReadable(context);
  const lines = await listCartLines(context.supabase, {
    userId: context.userId,
    tripId: context.tripId,
  });
  if (lines.length > CART_MAX_LINES) {
    throw new CartError({
      code: CART_ERROR_CODES.conflict,
      message: '[cart] panier volumineux : ' + String(lines.length) + ' lignes',
    });
  }
  return { tripId: context.tripId, lines, totals: computeCartTotals(lines) };
}

async function resolveReference(
  context: CartContext,
  kind: AddCartLineInput['kind'],
  refId: string
): Promise<CartReferencePrice> {
  const reference =
    kind === 'product'
      ? await selectProductReference(context.supabase, refId)
      : await selectBookingReference(context.supabase, {
          refId,
          userId: context.userId,
          tripId: context.tripId,
        });

  if (!reference) {
    throw new CartError({
      code: CART_ERROR_CODES.invalid_reference,
      message: '[cart] référence ' + kind + ' inconnue, inactive ou non possédée',
    });
  }
  return {
    unitPriceEur: roundEur(Math.max(reference.unitPriceEur, 0)),
    currency: reference.currency,
    metadata: { ...reference.metadata },
  };
}

/** Fusion immuable : le serveur (prix, vérité) gagne sur le client (libellés). */
function mergeMetadata(
  current: CartLineMetadata,
  client: CartLineMetadata,
  server: CartLineMetadata,
  idempotencyKey?: string
): CartLineMetadata {
  const next: CartLineMetadata = { ...current, ...client, ...server };
  const key = idempotencyKey ?? current[CART_IDEMPOTENCY_METADATA_KEY];
  if (typeof key === 'string' && key) next[CART_IDEMPOTENCY_METADATA_KEY] = key;
  else delete next[CART_IDEMPOTENCY_METADATA_KEY];
  return next;
}

interface MergeInput {
  quantity: number;
  clientMetadata: CartLineMetadata;
  reference: CartReferencePrice;
  idempotencyKey?: string;
}

async function mergeExistingLine(
  context: CartContext,
  existing: CartLine,
  merge: MergeInput
): Promise<AddCartLineResult> {
  const { supabase, userId } = context;
  // Idempotence : même clé déjà appliquée, donc aucune nouvelle quantité.
  if (
    merge.idempotencyKey &&
    existing.metadata[CART_IDEMPOTENCY_METADATA_KEY] === merge.idempotencyKey
  ) {
    return { line: existing, created: false, deduplicated: true };
  }

  const patched = await patchCartLine(supabase, {
    userId,
    lineId: existing.id,
    patch: {
      quantity: clampCartQuantity(existing.quantity + merge.quantity),
      unit_price_eur: merge.reference.unitPriceEur,
      currency: merge.reference.currency,
      metadata: mergeMetadata(
        existing.metadata,
        merge.clientMetadata,
        merge.reference.metadata,
        merge.idempotencyKey
      ),
    },
  });

  if (!patched) {
    throw new CartError({ code: CART_ERROR_CODES.line_not_found, message: '[cart] ligne disparue' });
  }
  return { line: patched, created: false, deduplicated: false };
}

export async function addTripCartLine(
  context: CartContext,
  input: AddCartLineInput
): Promise<AddCartLineResult> {
  await assertTripWritable(context);
  const { supabase, userId, tripId } = context;
  const reference = await resolveReference(context, input.kind, input.refId);
  const clientMetadata = sanitizeCartMetadata(input.kind, input.metadata);
  const quantity = clampCartQuantity(input.quantity);

  const existing = await findCartLineByRef(supabase, {
    userId,
    tripId,
    kind: input.kind,
    refId: input.refId,
  });
  if (existing) {
    return mergeExistingLine(context, existing, {
      quantity,
      clientMetadata,
      reference,
      idempotencyKey: input.idempotencyKey,
    });
  }

  const inserted = await insertCartLine(supabase, {
    user_id: userId,
    trip_id: tripId,
    kind: input.kind,
    ref_id: input.refId,
    quantity,
    unit_price_eur: reference.unitPriceEur,
    currency: reference.currency,
    metadata: mergeMetadata({}, clientMetadata, reference.metadata, input.idempotencyKey),
  });

  if (inserted.line) {
    return { line: inserted.line, created: true, deduplicated: false };
  }

  // Course concurrente : l'index unique a tranché. On relit et on fusionne.
  if (isUniqueViolation(inserted.error)) {
    const raced = await findCartLineByRef(supabase, {
      userId,
      tripId,
      kind: input.kind,
      refId: input.refId,
    });
    if (raced) {
      return mergeExistingLine(context, raced, {
        quantity,
        clientMetadata,
        reference,
        idempotencyKey: input.idempotencyKey,
      });
    }
  }

  throw new CartError({
    code: CART_ERROR_CODES.internal,
    message: '[cart] insertion refusée : ' + (inserted.error?.message ?? 'cause inconnue'),
    cause: inserted.error,
  });
}

export async function updateTripCartLine(
  context: CartContext,
  lineId: string,
  input: UpdateCartLineInput
): Promise<CartLine> {
  await assertTripWritable(context);
  const { supabase, userId } = context;

  const existing = await findCartLineById(supabase, { userId, lineId });
  if (!existing) {
    throw new CartError({ code: CART_ERROR_CODES.line_not_found, message: '[cart] ligne inconnue' });
  }

  const patch: { quantity?: number; metadata?: CartLineMetadata } = {};
  if (input.quantity !== undefined) patch.quantity = clampCartQuantity(input.quantity);

  if (input.metadata !== undefined) {
    const preservedKey = existing.metadata[CART_IDEMPOTENCY_METADATA_KEY];
    patch.metadata = mergeMetadata(
      existing.metadata,
      sanitizeCartMetadata(existing.kind, input.metadata),
      {},
      typeof preservedKey === 'string' ? preservedKey : undefined
    );
  }

  const updated = await patchCartLine(supabase, { userId, lineId: existing.id, patch });
  if (!updated) {
    throw new CartError({ code: CART_ERROR_CODES.line_not_found, message: '[cart] ligne inconnue' });
  }
  return updated;
}

export async function removeTripCartLine(
  context: CartContext,
  lineId: string
): Promise<{ id: string; removed: true }> {
  await assertTripWritable(context);
  const removed = await deleteCartLine(context.supabase, { userId: context.userId, lineId });
  if (!removed) {
    throw new CartError({ code: CART_ERROR_CODES.line_not_found, message: '[cart] ligne inconnue' });
  }
  return { id: lineId, removed: true };
}
