// src/features/discovery/types/discovery.types.ts
// Modèle interne normalisé, indépendant du fournisseur. Les composants Pays
// consomment ce type — jamais le format brut Tripadvisor.

export type DiscoveryProvider = 'tripadvisor' | 'viator';

export type DiscoveryCategory = 'attractions' | 'restaurants' | 'hotels';

/** Section Pays d'où provient la requête (gating serveur par provider). */
export type DiscoverySectionName = 'destinations' | 'activites' | 'gastronomie' | 'hebergements';

export type DiscoveryBookingMode = 'external' | 'in_app';

export type DiscoveryStatus = 'ok' | 'empty' | 'unconfigured' | 'quota' | 'error';

export type DiscoveryErrorReason =
  | 'missing_config'
  | 'unknown_country'
  | 'referential_error'
  | 'quota'
  | 'timeout'
  | 'auth'
  | 'upstream'
  | 'empty'
  | 'invalid_response';

export interface DiscoveryAttribution {
  provider: DiscoveryProvider;
  label: string;
  logoUrl: string;
  sourceUrl: string;
}

export interface DiscoveryItem {
  id: string;
  provider: DiscoveryProvider;
  type: DiscoveryCategory;
  name: string;
  description: string | null;
  countryCode: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  reviewCount: number | null;
  photoUrl: string | null;
  ratingImageUrl: string | null;
  tripadvisorUrl: string | null;
  category: string | null;
  /**
   * Signifie « réservable DANS l'application LKDV ». Toujours `false` ici :
   * aucune réservation in-app. Pour un produit réservable ailleurs (Viator),
   * voir `bookingMode`/`bookingProvider`.
   */
  isBookable: boolean;
  /** Mode de réservation. `external` = la transaction se termine chez le partenaire. */
  bookingMode?: DiscoveryBookingMode | null;
  /** Partenaire qui finalise la réservation (ex. `viator`). */
  bookingProvider?: string | null;
  /** Champs affiliés optionnels (Viator). Absents ⇒ non affichés. */
  affiliateUrl?: string | null;
  priceFrom?: number | null;
  currency?: string | null;
  freeCancellation?: boolean | null;
  productCode?: string | null;
  /** Durée indicative en minutes (Viator). */
  durationMinutes?: number | null;
}

export interface DiscoverySearchParams {
  countryCode: string;
  /** Requête textuelle passée au fournisseur (ex. capitale du pays). */
  searchQuery: string;
  category: DiscoveryCategory;
  limit: number;
  signal?: AbortSignal;
}

export interface DiscoveryProviderAdapter {
  id: DiscoveryProvider;
  search(params: DiscoverySearchParams): Promise<DiscoveryItem[]>;
}

export interface DiscoveryResponse {
  status: DiscoveryStatus;
  reason?: DiscoveryErrorReason;
  provider: DiscoveryProvider;
  category: DiscoveryCategory;
  countryCode: string;
  items: DiscoveryItem[];
  attribution: DiscoveryAttribution;
  message?: string;
}
