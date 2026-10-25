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
 *
 * Montant et devise : `bookings.amount_eur numeric(12,2) NOT NULL DEFAULT 0` et
 * `bookings.currency text NOT NULL DEFAULT 'EUR'` avec `CHECK (currency ~ '^[A-Z]{3}$')`.
 * Le schema ne peut pas porter la valeur « inconnu ». Ecrire 0 pour un prix
 * non connu le rendrait indiscernable d'un vrai gratuit, et forcer EUR
 * convertirait un prix en yens en prix en euros sans conversion. On refuse
 * donc l'ecriture, et on le dit clairement a l'appelant.
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

/** Montant strictement positif et fini, ou `null`. Jamais 0. */
function strictAmount(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(Math.min(value, 10_000_000) * 100) / 100;
}

/** Code ISO 4217 a 3 majuscules, ou `null`. Jamais de repli sur 'EUR'. */
function strictCurrency(value: string | null): string | null {
  return value && /^[A-Z]{3}$/.test(value) ? value : null;
}

export async function startCheckout(
  input: StartCheckoutInput,
  deps: StartCheckoutDeps = {}
): Promise<CheckoutResult> {
  const { store, userId, tripId, candidate, campaign, metadata } = input;

  // Le candidat est la seule source du montant et de la devise. Une valeur
  // absente est un refus, pas une valeur a deviner.
  const amountEur = strictAmount(candidate.amount);
  if (amountEur === null) {
    throw new BookingProviderError({
      code: BOOKING_PROVIDER_ERROR_CODES.validation,
      provider: candidate.provider,
      message: 'Le prix de cette offre est inconnu : la réservation n’a pas été enregistrée.',
      cause: { candidateId: candidate.id, amount: candidate.amount },
    });
  }

  const currency = strictCurrency(candidate.currency);
  if (currency === null) {
    throw new BookingProviderError({
      code: BOOKING_PROVIDER_ERROR_CODES.validation,
      provider: candidate.provider,
      message: 'La devise de cette offre n’est pas confirmée : la réservation n’a pas été enregistrée.',
      cause: { candidateId: candidate.id, currency_unknown: true },
    });
  }

  const result = await input.checkoutUrl(candidate, { tripId, userId, campaign });

  const payload: BookingCreateInput = bookingCreateSchema.parse({
    vertical: candidate.vertical,
    provider: candidate.provider,
    external_ref: candidate.providerReference ?? candidate.id,
    amount_eur: amountEur,
    currency,
    status: 'pending',
    checkout_mode: toStoredCheckoutMode(result.mode),
    metadata: buildMetadata(candidate, result.mode, true, campaign, metadata),
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
