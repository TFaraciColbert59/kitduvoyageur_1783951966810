import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { listBookings, type PublicBooking } from '@/features/booking/server/bookingPersistence';
import { listTripCart } from '@/features/cart/server/cartService';
import type { CartLine, CartLineKind, CartTotals } from '@/features/cart/cartTypes';

/**
 * W6 (P4) — reservations et panier lus pour une section du hub.
 *
 * Le hub n'etait cable ni sur `bookings` ni sur `cart_lines` : les deux tables
 * existaient sans jamais etre lues. On les branche dans la section budget,
 * qui est leur section naturelle — une reservation et une ligne de panier
 * portent chacune un montant.
 *
 * D-02 : le hub n'est pas reconstruit. Ce module fait une lecture et renvoie
 * un objet serialisable ; le rendu est porte par un composant presentatif
 * separe, insere a cote de la vue budget existante.
 *
 * Migration absente = etat legitime. Les quatre migrations du chantier ne sont
 * pas appliquees sur tous les environnements : une table manquante doit
 * degrader l'apercu, pas faire tomber la page budget en 500. D'ou les deux
 * drapeaux d'availability, distincts pour ne pas masquer l'une des deux tables
 * parce que l'autre a echoue.
 */

export interface BookingOverviewEntry {
  id: string;
  vertical: string;
  provider: string;
  title: string;
  amountEur: number;
  currency: string;
  status: string;
  checkoutMode: string;
  /**
   * `deeplink` / `acp` / `external`. L'enum BDD `booking_checkout_mode` ne
   * porte que les deux premiers : le mode externe vit dans les metadonnees.
   */
  checkoutChannel: string | null;
  createdAt: string;
}

export interface CartOverviewEntry {
  kind: CartLineKind;
  refId: string;
  quantity: number;
  unitPriceEur: number;
  title: string | null;
}

export interface TripBookingOverview {
  /** false quand `bookings` n'est pas interrogeable (migration absente). */
  bookingsAvailable: boolean;
  /** false quand `cart_lines` n'est pas interrogeable (migration absente). */
  cartAvailable: boolean;
  reservations: BookingOverviewEntry[];
  /** Total des reservations `pending`, en EUR. Une reservation n'est pas une depense. */
  pendingEur: number;
  cartLines: CartOverviewEntry[];
  cartTotals: CartTotals;
}

const EMPTY_TOTALS: CartTotals = {
  lineCount: 0,
  itemCount: 0,
  totalEur: 0,
  currency: 'EUR',
};

export const EMPTY_OVERVIEW: TripBookingOverview = {
  bookingsAvailable: false,
  cartAvailable: false,
  reservations: [],
  pendingEur: 0,
  cartLines: [],
  cartTotals: EMPTY_TOTALS,
};

const VERTICAL_LABELS: Record<string, string> = {
  flight: 'Vol',
  hotel: 'Hebergement',
  car: 'Vehicule',
  activity: 'Activite',
};

/**
 * Codes Postgres/PostgREST d'une relation absente. On les distingue pour
 * journaliser une information (« migration a appliquer ») plutot qu'une
 * erreur, tout en degradant l'ecran dans les deux cas.
 */
const MISSING_RELATION_CODES = new Set(['42P01', '42883', 'PGRST205']);

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function toBookingOverviewEntry(booking: PublicBooking): BookingOverviewEntry {
  const title = optionalString(booking.metadata.title);
  return {
    id: booking.id,
    vertical: booking.vertical,
    provider: booking.provider,
    title: title ?? VERTICAL_LABELS[booking.vertical] ?? 'Reservation',
    amountEur: toFiniteNumber(booking.amount_eur),
    currency: booking.currency,
    status: booking.status,
    checkoutMode: booking.checkout_mode,
    checkoutChannel: optionalString(booking.metadata.checkout_channel),
    createdAt: booking.created_at,
  };
}

export function toCartOverviewEntry(line: CartLine): CartOverviewEntry {
  return {
    kind: line.kind,
    refId: line.refId,
    quantity: toFiniteNumber(line.quantity),
    unitPriceEur: toFiniteNumber(line.unitPriceEur),
    // Le titre vient de la reference resolue cote serveur (metadata de la
    // ligne). Absent pour une ligne boutique : l'appelant affiche le kind.
    title: optionalString(line.metadata.title),
  };
}

function reportDegraded(source: string, code: string | undefined): void {
  // On ne journalise JAMAIS le message Postgres : il peut contenir du SQL et
  // des noms d'objets. Le code suffit a diagnostiquer.
  if (code && MISSING_RELATION_CODES.has(code)) {
    console.warn(`[hub] ${source} indisponible (migration absente)`);
    return;
  }
  console.error(`[hub] ${source} illisible`, { code: code ?? 'unknown' });
}

function readErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

export async function getTripBookingOverview(
  supabase: SupabaseClient,
  { tripId, userId }: { tripId: string; userId: string }
): Promise<TripBookingOverview> {
  const store = supabase as unknown as Parameters<typeof listBookings>[0];

  let reservations: BookingOverviewEntry[] = [];
  let bookingsAvailable = true;
  try {
    const { data, error } = await listBookings(store, tripId);
    if (error) {
      bookingsAvailable = false;
      reportDegraded('bookings', error.code);
    } else {
      reservations = (data ?? []).map(toBookingOverviewEntry);
    }
  } catch (error) {
    bookingsAvailable = false;
    reportDegraded('bookings', readErrorCode(error));
  }

  let cartLines: CartOverviewEntry[] = [];
  let cartTotals = EMPTY_TOTALS;
  let cartAvailable = true;
  try {
    const view = await listTripCart({ supabase, userId, tripId });
    cartLines = view.lines.map(toCartOverviewEntry);
    cartTotals = view.totals;
  } catch (error) {
    cartAvailable = false;
    reportDegraded('cart_lines', readErrorCode(error));
  }

  if (!bookingsAvailable && !cartAvailable) return EMPTY_OVERVIEW;

  const pendingEur = reservations
    .filter((entry) => entry.status === 'pending')
    .reduce((sum, entry) => sum + entry.amountEur, 0);

  return {
    bookingsAvailable,
    cartAvailable,
    reservations,
    pendingEur: Math.round(pendingEur * 100) / 100,
    cartLines,
    cartTotals,
  };
}
