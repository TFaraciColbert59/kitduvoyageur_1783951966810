import 'server-only';

import { addTripCartLine, type CartContext } from '@/features/cart/server/cartService';
import {
  bookingCreateSchema,
  insertBooking,
  type BookingStore,
  type BookingCreateInput,
} from './bookingPersistence';
import {
  BOOKING_PROVIDER_ERROR_CODES,
  BookingProviderError,
} from './bookingProviderErrors';
import type {
  BookingCandidate,
  CheckoutContext,
  CheckoutResult,
} from './bookingProviderTypes';

/**
 * W5 / D-03 — orchestration d'un checkout.
 *
 * Un checkout laisse deux traces : une ligne `bookings` (la reservation) et une
 * ligne `cart_lines` de kind `booking` qui la reference. L'ordre est
 * imperative : un panier pointant vers une reservation inexistante est un
 * orphelin que rien ne re reconcilie. Si l'echec survient apres l'insert, on
 * le laisse remonter tel quel — la reservation existe, c'est elle la source de
 * verite, et l'annuler serait pire que l'echec visible.
 */

export interface StartCheckoutInput {
  store: BookingStore;
  /**
   * Obligatoire : une reservation sans ligne de panier est invisible pour
   * l'utilisateur. Un appelant sans panier n'est pas un cas legitime, c'est un
   * appelant mal branche — mieux vaut un rejet de compilation qu'un checkout
   * qui disparait en base.
   */
  cart: CartContext;
  userId: string;
  tripId: string;
  candidate: BookingCandidate;
  campaign?: string;
  metadata?: Record<string, unknown>;
  /** Resout l'URL aupres du fournisseur. Injecte pour rester testable. */
  checkoutUrl: (candidate: BookingCandidate, context: CheckoutContext) => Promise<CheckoutResult>;
}

export interface StartCheckoutDeps {
  addCartLine?: typeof addTripCartLine;
}

/**
 * L'enum BDD `booking_checkout_mode` ne contient que `deeplink` et `acp`, et
 * le plan interdit d'ajouter une migration. Le mode `external` (sortie vers
 * Viator) est donc encode dans les metadonnees : la colonne reste valide, et
 * l'information n'est pas perdue.
 */
function toStoredCheckoutMode(mode: CheckoutResult['mode']): 'deeplink' | 'acp' {
  return mode === 'acp' ? 'acp' : 'deeplink';
}

function buildMetadata(
  candidate: BookingCandidate,
  mode: CheckoutResult['mode'],
  currencyKnown: boolean,
  campaign: string | undefined,
  extra: Record<string, unknown> | undefined
): Record<string, unknown> {
  return {
    candidate_id: candidate.id,
    title: candidate.title,
    vertical: candidate.vertical,
    checkout_channel: mode,
    ...(currencyKnown ? {} : { currency_unknown: true }),
    ...(campaign ? { campaign } : {}),
    ...(extra ?? {}),
  };
}

export async function startCheckout(
  input: StartCheckoutInput,
  deps: StartCheckoutDeps = {}
): Promise<CheckoutResult> {
  const { store, userId, tripId, candidate, campaign, metadata } = input;

  const result = await input.checkoutUrl(candidate, { tripId, userId, campaign });

  // Le candidat est la source du montant. Une devise non confirmee n'est pas
  // devinée : on le signale dans les metadonnees plutot que d'ecrire EUR.
  const currencyKnown = candidate.currency !== null;
  const payload: BookingCreateInput = bookingCreateSchema.parse({
    vertical: candidate.vertical,
    provider: candidate.provider,
    external_ref: candidate.providerReference ?? candidate.id,
    amount_eur: candidate.amount ?? 0,
    currency: currencyKnown ? candidate.currency : 'EUR',
    status: 'pending',
    checkout_mode: toStoredCheckoutMode(result.mode),
    metadata: buildMetadata(candidate, result.mode, currencyKnown, campaign, metadata),
  });

  const { data: booking, error } = await insertBooking(store, { tripId, userId, payload });
  if (error || !booking) {
    throw new BookingProviderError({
      code: BOOKING_PROVIDER_ERROR_CODES.upstream,
      provider: candidate.provider,
      message: 'Réservation non enregistrée.',
      cause: new Error(error?.message ?? 'insert sans donnée'),
    });
  }

  const addCartLine = deps.addCartLine ?? addTripCartLine;
  await addCartLine(input.cart, {
    kind: 'booking',
    refId: booking.id,
    quantity: 1,
    metadata: { checkout_channel: result.mode, source: 'booking' },
  });

  return { ...result, bookingId: booking.id };
}
