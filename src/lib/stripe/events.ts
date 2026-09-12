/**
 * Phase 8 — Classification serveur des événements Stripe (pur, sans réseau).
 *
 * Aucun appel Stripe ici : uniquement la lecture d'un événement déjà vérifié
 * par `stripe.webhooks.constructEvent`. Les prix et entitlements restent
 * résolus côté serveur ; ce module ne fait que qualifier l'événement et
 * extraire le grant éventuel porté par les métadonnées Stripe (jamais un prix).
 */

export type StripeEventKind =
  | 'checkout_completed'
  | 'subscription_renewed'
  | 'payment_failed'
  | 'refund'
  | 'subscription_canceled'
  | 'ignored';

/** Forme minimale d'un événement Stripe consommé par le webhook. */
export interface StripeEventLike {
  id: string;
  type: string;
  livemode?: boolean;
  created?: number;
  data?: { object?: Record<string, unknown> | null };
}

export interface StripeEventSummary {
  eventId: string;
  type: string;
  kind: StripeEventKind;
  livemode: boolean;
  objectId: string | null;
}

/** Mapping canonique type Stripe → catégorie interne. */
export const STRIPE_EVENT_KIND_BY_TYPE: Record<string, StripeEventKind> = {
  'checkout.session.completed': 'checkout_completed',
  'invoice.paid': 'subscription_renewed',
  'invoice.payment_succeeded': 'subscription_renewed',
  'invoice.payment_failed': 'payment_failed',
  'charge.refunded': 'refund',
  'refund.updated': 'refund',
  'customer.subscription.deleted': 'subscription_canceled',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Classe un événement Stripe ; tout type inconnu devient `ignored`. */
export function classifyStripeEvent(event: StripeEventLike): StripeEventKind {
  if (!event || typeof event.type !== 'string') return 'ignored';
  return STRIPE_EVENT_KIND_BY_TYPE[event.type] ?? 'ignored';
}

/** Résumé non sensible destiné à `stripe_events` (aucune PII). */
export function summarizeStripeEvent(event: StripeEventLike): StripeEventSummary {
  const object = isRecord(event?.data?.object) ? event.data.object : null;
  const rawId = object?.id;
  return {
    eventId: event.id,
    type: event.type,
    kind: classifyStripeEvent(event),
    livemode: event.livemode === true,
    objectId: typeof rawId === 'string' && rawId.length > 0 ? rawId : null,
  };
}

export interface ExtractedEntitlementGrant {
  userId: string;
  metadata: Record<string, unknown>;
  source: 'checkout_session' | 'invoice_subscription' | 'invoice_line';
}

function metadataRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

/**
 * Extrait un grant d'entitlement (`user_id` + `plan`/`pass`) éventuellement
 * porté par les métadonnées serveur d'un événement Stripe. Sans `user_id`
 * reconnu, retourne `null` : le webhook n'écrit alors jamais d'entitlement.
 */
export function extractEntitlementGrant(
  event: StripeEventLike
): ExtractedEntitlementGrant | null {
  const object = isRecord(event?.data?.object) ? event.data.object : null;
  if (!object) return null;

  const direct = metadataRecord(object.metadata);
  if (direct) {
    const userId = direct.user_id;
    if (typeof userId === 'string' && userId.length > 0 && userId !== 'anonymous') {
      return { userId, metadata: direct, source: 'checkout_session' };
    }
  }

  const subscriptionDetails = metadataRecord(object.subscription_details);
  const subscriptionMetadata = subscriptionDetails
    ? metadataRecord(subscriptionDetails.metadata)
    : null;
  if (subscriptionMetadata) {
    const userId = subscriptionMetadata.user_id;
    if (typeof userId === 'string' && userId.length > 0 && userId !== 'anonymous') {
      return { userId, metadata: subscriptionMetadata, source: 'invoice_subscription' };
    }
  }

  const lines = isRecord(object.lines) ? object.lines : null;
  const lineData = lines && Array.isArray(lines.data) ? lines.data : null;
  if (lineData) {
    for (const line of lineData) {
      const lineMetadata = isRecord(line) ? metadataRecord(line.metadata) : null;
      if (!lineMetadata) continue;
      const userId = lineMetadata.user_id;
      if (typeof userId === 'string' && userId.length > 0 && userId !== 'anonymous') {
        return { userId, metadata: lineMetadata, source: 'invoice_line' };
      }
    }
  }

  return null;
}
