/**
 * Phase 4 — Projection servie d'une offre commerciale / affiliation.
 *
 * Règles d'honnêteté :
 *   • un prix n'est servi que s'il est horodaté (`priceCheckedAt`) ;
 *   • une disponibilité n'est servie que si horodatée ;
 *   • une offre expirée est signalée, jamais supprimée ni rafraîchie d'office ;
 *   • `hasAffiliateLink` n'est vrai que si un lien affilié réel existe et que
 *     sa divulgation est obligatoire — jamais déduit par défaut.
 *
 * Aucune valeur n'est inventée : absence de donnée ⇒ `null` + raison.
 */
export interface ServedOfferRaw {
  price: number | null;
  currency: string | null;
  priceCheckedAt: string | null;
  availability: boolean | null;
  availabilityCheckedAt: string | null;
  expiresAt: string | null;
  validTo: string | null;
  hasAffiliateLink: boolean;
  affiliateTargetUrl: string | null;
}

export type PriceState = 'served' | 'unknown' | 'missing_timestamp' | 'expired';
export type AvailabilityState = 'served' | 'unknown' | 'missing_timestamp';

export interface ServedOfferView {
  price: number | null;
  currency: string | null;
  priceCheckedAt: string | null;
  priceState: PriceState;
  availability: boolean | null;
  availabilityCheckedAt: string | null;
  availabilityState: AvailabilityState;
  isExpired: boolean;
  hasAffiliateLink: boolean;
  /** Divulgation « lien affilié » exigée dès qu'un lien réel est servi. */
  disclosureRequired: boolean;
}

function isHttps(url: string | null): boolean {
  return typeof url === 'string' && url.startsWith('https://');
}

export function evaluateServedOffer(raw: ServedOfferRaw, now: Date): ServedOfferView {
  const nowMs = now.getTime();
  const expiresMs = raw.expiresAt ? new Date(raw.expiresAt).getTime() : Number.NaN;
  const validToMs = raw.validTo ? new Date(raw.validTo).getTime() : Number.NaN;
  const expired =
    (Number.isFinite(expiresMs) && expiresMs < nowMs) ||
    (Number.isFinite(validToMs) && validToMs < nowMs);

  let priceState: PriceState;
  let price: number | null;
  if (raw.price === null) {
    priceState = 'unknown';
    price = null;
  } else if (!raw.priceCheckedAt) {
    priceState = 'missing_timestamp';
    price = null;
  } else if (expired) {
    priceState = 'expired';
    price = null;
  } else {
    priceState = 'served';
    price = raw.price;
  }

  let availabilityState: AvailabilityState;
  let availability: boolean | null;
  if (raw.availability === null) {
    availabilityState = 'unknown';
    availability = null;
  } else if (!raw.availabilityCheckedAt) {
    availabilityState = 'missing_timestamp';
    availability = null;
  } else {
    availabilityState = 'served';
    availability = raw.availability;
  }

  const hasAffiliateLink = raw.hasAffiliateLink === true && isHttps(raw.affiliateTargetUrl);

  return {
    price,
    currency: price === null ? null : raw.currency,
    priceCheckedAt: price === null ? null : raw.priceCheckedAt,
    priceState,
    availability,
    availabilityCheckedAt: availability === null ? null : raw.availabilityCheckedAt,
    availabilityState,
    isExpired: expired,
    hasAffiliateLink,
    disclosureRequired: hasAffiliateLink,
  };
}
