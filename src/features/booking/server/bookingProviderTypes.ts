export type BookingVertical = 'flight' | 'hotel' | 'car' | 'activity';
export type BookingProviderId = 'routestack' | 'viator' | 'affiliate' | 'unavailable';
export type BookingProviderMode = 'sandbox' | 'live' | 'disabled';
export type BookingCandidateKind = 'search' | 'revalidation' | 'deeplink' | 'acp';

export interface BookingSearchRequestBase {
  travelers?: number;
  currency?: string;
  limit?: number;
}

export interface FlightBookingSearchRequest extends BookingSearchRequestBase {
  vertical: 'flight';
  origin: string;
  destination: string;
  departure: string;
  return?: string;
}

export interface HotelBookingSearchRequest extends BookingSearchRequestBase {
  vertical: 'hotel';
  destination: string;
  checkIn: string;
  checkOut: string;
}

export interface CarBookingSearchRequest extends BookingSearchRequestBase {
  vertical: 'car';
  destination: string;
  /** ISO 8601 avec fuseau, ex. 2026-11-12T10:00:00Z. */
  pickupAt: string;
  /** ISO 8601 avec fuseau, ex. 2026-11-21T10:00:00Z. */
  dropoffAt: string;
}

export interface ActivityBookingSearchRequest extends BookingSearchRequestBase {
  vertical: 'activity';
  destination: string;
  date: string;
}

export type BookingSearchRequest =
  | FlightBookingSearchRequest
  | HotelBookingSearchRequest
  | CarBookingSearchRequest
  | ActivityBookingSearchRequest;

export interface BookingCandidate {
  id: string;
  provider: Exclude<BookingProviderId, 'unavailable'>;
  vertical: BookingVertical;
  title: string;
  description: string | null;
  amount: number | null;
  /** Null quand l'amont ne confirme pas la devise : ne jamais inventer EUR. */
  currency: string | null;
  deeplink: string | null;
  bookingKind: BookingCandidateKind;
  requiresRevalidation: boolean;
  /** Référence opaque non secrète pour une revalidation future. */
  providerReference: string | null;
  metadata: Record<string, unknown>;
}

/** Alias de compatibilité : les résultats de recherche sont des candidats. */
export type BookingOffer = BookingCandidate;

export interface BookingSearchResult {
  provider: Exclude<BookingProviderId, 'unavailable'>;
  mode: Exclude<BookingProviderMode, 'disabled'>;
  offers: BookingCandidate[];
  fetchedAt: string;
}

export type BookingProviderEnv = Record<string, string | undefined>;

/** D-03 : `deeplink`/`acp` sortent chez le fournisseur, `external` hors plateforme. */
export type CheckoutMode = 'deeplink' | 'acp' | 'external';

export interface CheckoutContext {
  tripId: string;
  /**
   * `auth.uid()`. Provenance serveur obligatoire : une valeur fournie par le
   * client permettrait d'ouvrir un checkout au nom d'un autre voyageur.
   */
  userId: string;
  campaign?: string;
}

export interface CheckoutResult {
  mode: CheckoutMode;
  /** Null si le mode ne produit pas de lien (ACP) ou si le deeplink est refuse. */
  url: string | null;
  /** Renseigné par la couche de persistance, pas par le transport. */
  bookingId: string | null;
}

export interface BookingProvider {
  readonly id: BookingProviderId;
  readonly mode: BookingProviderMode;
  readonly supportedVerticals: readonly BookingVertical[];
  supports(vertical: BookingVertical): boolean;
  isConfigured(): boolean;
  search(request: BookingSearchRequest): Promise<BookingSearchResult>;
  /**
   * Rafraichit un candidat. Un fournisseur incapable de le faire retourne le
   * candidat avec `requiresRevalidation: true` : declarer un prix invente
   * serait pire que l'aveu d'une donnee perimee.
   */
  revalidate(candidate: BookingCandidate): Promise<BookingCandidate>;
  checkoutUrl(candidate: BookingCandidate, context: CheckoutContext): Promise<CheckoutResult>;
}

export interface BookingProviderRouter {
  readonly id: 'router';
  readonly mode: BookingProviderMode;
  readonly supportedVerticals: readonly BookingVertical[];
  supports(vertical: BookingVertical): boolean;
  isConfigured(): boolean;
  providerFor(vertical: BookingVertical): BookingProvider;
  search(request: BookingSearchRequest): Promise<BookingSearchResult>;
  revalidate(candidate: BookingCandidate): Promise<BookingCandidate>;
  checkoutUrl(candidate: BookingCandidate, context: CheckoutContext): Promise<CheckoutResult>;
}

