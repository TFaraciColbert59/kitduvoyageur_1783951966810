/**
 * Checkout Stripe — metadata de session (chantier lignées, Lot 3).
 *
 * Construites EXCLUSIVEMENT depuis les items validés côté serveur (jamais du
 * body client — le prix et l'attribution ne viennent que du serveur).
 *
 * Limite Stripe : 500 caractères max par valeur de metadata. Au-delà, le panier
 * validé est stocké dans `checkout_intents` et seul son uuid passe en metadata.
 */

/** Plafond interne (marge de sécurité sous les 500 caractères Stripe). */
export const STRIPE_METADATA_LIMIT_CHARS = 480;

export interface StripeCartItemRef {
  id: string;
  name: string;
  quantity: number;
}

export interface StripeMetadataPlan {
  /** Metadata à poser sur checkout.sessions.create. */
  metadata: Record<string, string>;
  /** Vrai si le panier a dû être externalisé (checkout_intents). */
  needsIntent: boolean;
  /** Panier validé à stocker dans checkout_intents (null si inline). */
  intentPayload: StripeCartItemRef[] | null;
}

export function buildStripeCheckoutMetadata(
  userId: string | null,
  items: StripeCartItemRef[]
): StripeMetadataPlan {
  const refs: StripeCartItemRef[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
  }));

  const metadata: Record<string, string> = {};
  if (userId) metadata.user_id = userId;

  const itemsJson = JSON.stringify(refs);
  if (itemsJson.length <= STRIPE_METADATA_LIMIT_CHARS) {
    metadata.items = itemsJson;
    return { metadata, needsIntent: false, intentPayload: null };
  }

  return {
    metadata: { ...metadata, intent_id: crypto.randomUUID() },
    needsIntent: true,
    intentPayload: refs,
  };
}

/** Parse `metadata.items` — [] si absent, invalide, ou non-tableau. */
export function parseMetadataItems(
  raw: string | null | undefined
): StripeCartItemRef[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as StripeCartItemRef[];
  } catch {
    /* JSON invalide → fallback propre */
  }
  return [];
}