import type { BookingCandidate, BookingVertical } from '@/features/booking/server/bookingProviderTypes';

export interface BookingCartTransportResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export interface BookingCartTransportInit {
  method: 'GET' | 'POST';
  headers?: { 'Content-Type': 'application/json' };
  body?: string;
  cache: 'no-store';
}

export type BookingCartTransport = (
  url: string,
  init: BookingCartTransportInit
) => Promise<BookingCartTransportResponse>;

export interface BookingCreatePayload {
  vertical: BookingVertical;
  provider: Exclude<BookingCandidate['provider'], 'unavailable'>;
  external_ref: string;
  amount_eur: number;
  currency: string;
  status: 'pending';
  checkout_mode: 'deeplink' | 'acp';
  metadata: Record<string, string | number | boolean>;
}

export interface BookingCartMetadata {
  title: string;
  vertical: BookingVertical;
  provider: Exclude<BookingCandidate['provider'], 'unavailable'>;
  status: 'pending';
  deeplink?: string;
  requiresRevalidation: boolean;
}

export interface AddOfferToTripCartInput {
  tripId: string;
  offer: BookingCandidate;
  transport: BookingCartTransport;
}

export interface AddOfferToTripCartResult {
  bookingId: string;
  created: boolean;
  deduplicated: boolean;
}

export class BookingCartFlowError extends Error {
  readonly code:
    | 'booking_create_failed'
    | 'booking_create_invalid'
    | 'bookings_lookup_failed'
    | 'cart_add_failed';

  constructor(
    code: BookingCartFlowError['code'],
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'BookingCartFlowError';
    this.code = code;
  }
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function boundedAmount(value: number | null): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0;
  return Math.round(Math.min(value, 10_000_000) * 100) / 100;
}

function normalizedCurrency(value: string | null): string {
  return value && /^[A-Z]{3}$/.test(value) ? value : 'EUR';
}

function referenceFragment(offer: BookingCandidate): string {
  const raw = (offer.providerReference ?? offer.id).trim();
  const safe = raw.replace(/[^A-Za-z0-9._:-]+/g, '_').slice(0, 180);
  return safe || 'candidate';
}

/** Référence déterministe : un même candidat ne peut être créé qu'une fois par voyage. */
export function buildBookingExternalRef(tripId: string, offer: BookingCandidate): string {
  return `trip:${tripId}:${offer.provider}:${referenceFragment(offer)}`.slice(0, 255);
}

export function buildBookingCreatePayload(
  tripId: string,
  offer: BookingCandidate
): BookingCreatePayload {
  const deeplink = safeExternalUrl(offer.deeplink);
  return {
    vertical: offer.vertical,
    provider: offer.provider,
    external_ref: buildBookingExternalRef(tripId, offer),
    amount_eur: boundedAmount(offer.amount),
    currency: normalizedCurrency(offer.currency),
    status: 'pending',
    checkout_mode: offer.bookingKind === 'acp' ? 'acp' : 'deeplink',
    metadata: {
      title: offer.title,
      description: offer.description ?? '',
      bookingKind: offer.bookingKind,
      requiresRevalidation: offer.requiresRevalidation,
      providerReference: offer.providerReference ?? '',
      candidateId: offer.id,
      ...(deeplink ? { deeplink } : {}),
    },
  };
}

export function buildCartMetadata(offer: BookingCandidate): BookingCartMetadata {
  const deeplink = safeExternalUrl(offer.deeplink);
  return {
    title: offer.title,
    vertical: offer.vertical,
    provider: offer.provider,
    status: 'pending',
    ...(deeplink ? { deeplink } : {}),
    requiresRevalidation: offer.requiresRevalidation,
  };
}

async function readJson(response: BookingCartTransportResponse): Promise<Record<string, unknown>> {
  try {
    const value = (await response.json()) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function postJson(body: unknown): BookingCartTransportInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  };
}

function bookingIdFrom(payload: Record<string, unknown>): string | null {
  const data = payload.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const id = (data as Record<string, unknown>).id;
  return typeof id === 'string' && UUID.test(id) ? id : null;
}

/**
 * Ajoute un candidat au panier du voyage :
 *  1. crée (ou retrouve) une réservation `pending` côté serveur ;
 *  2. passe son UUID au panier, qui résout seul le prix depuis `bookings`.
 */
export async function addOfferToTripCart(
  input: AddOfferToTripCartInput
): Promise<AddOfferToTripCartResult> {
  const { tripId, offer, transport } = input;
  const payload = buildBookingCreatePayload(tripId, offer);
  const created = await transport(`/api/trips/${tripId}/bookings`, postJson(payload));
  const createdBody = await readJson(created);
  let bookingId = bookingIdFrom(createdBody);

  if (created.status === 409 && !bookingId) {
    const listed = await transport(`/api/trips/${tripId}/bookings`, {
      method: 'GET',
      cache: 'no-store',
    });
    const listBody = await readJson(listed);
    const data = listBody.data;
    if (listed.ok && Array.isArray(data)) {
      const match = data.find(
        (row): row is Record<string, unknown> =>
          Boolean(row) &&
          typeof row === 'object' &&
          !Array.isArray(row) &&
          (row as Record<string, unknown>).external_ref === payload.external_ref
      );
      const id = match?.id;
      if (typeof id === 'string' && UUID.test(id)) bookingId = id;
    }
  }

  if (!bookingId) {
    if (created.status === 409) {
      throw new BookingCartFlowError(
        'bookings_lookup_failed',
        'Cette offre existe déjà mais sa réservation est introuvable.',
        { cause: createdBody }
      );
    }
    if (created.ok && created.status === 201) {
      throw new BookingCartFlowError(
        'booking_create_invalid',
        'La réservation créée est invalide.',
        { cause: createdBody }
      );
    }
    throw new BookingCartFlowError(
      'booking_create_failed',
      'Impossible d’enregistrer cette réservation.',
      { cause: createdBody }
    );
  }

  const cart = await transport(`/api/trips/${tripId}/cart-lines`, postJson({
    kind: 'booking',
    refId: bookingId,
    quantity: 1,
    metadata: buildCartMetadata(offer),
    idempotencyKey: `booking-cart:${bookingId}`,
  }));
  const cartBody = await readJson(cart);
  if (!cart.ok || cartBody.success !== true) {
    throw new BookingCartFlowError(
      'cart_add_failed',
      'La réservation est créée, mais l’ajout au panier a échoué.',
      { cause: cartBody }
    );
  }

  return {
    bookingId,
    created: cartBody.created === true,
    deduplicated: cartBody.deduplicated === true,
  };
}



