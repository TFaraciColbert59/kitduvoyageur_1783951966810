/**
 * Erreurs métier du panier.
 *
 * Règle : `code` est la seule information exposée au client. Le message et la
 * cause restent côté serveur (`console.error`) — aucune fuite de stack, de
 * détail Supabase ou de credential dans la réponse HTTP.
 */

export const CART_ERROR_CODES = {
  invalid_request: 'invalid_request',
  payload_too_large: 'payload_too_large',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  trip_not_found: 'trip_not_found',
  line_not_found: 'line_not_found',
  invalid_reference: 'invalid_reference',
  conflict: 'conflict',
  rate_limited: 'rate_limited',
  service_unavailable: 'service_unavailable',
  internal: 'internal',
} as const;

export type CartErrorCode = (typeof CART_ERROR_CODES)[keyof typeof CART_ERROR_CODES];

const STATUS_BY_CODE: Record<CartErrorCode, number> = {
  invalid_request: 400,
  payload_too_large: 413,
  unauthorized: 401,
  forbidden: 403,
  trip_not_found: 404,
  line_not_found: 404,
  invalid_reference: 422,
  conflict: 409,
  rate_limited: 429,
  service_unavailable: 503,
  internal: 500,
};

export function statusForCartErrorCode(code: CartErrorCode): number {
  return STATUS_BY_CODE[code] ?? 500;
}

export interface CartErrorInit {
  code: CartErrorCode;
  /** Message serveur (logs uniquement). Ne jamais renvoyer au client. */
  message: string;
  /** Champs refusés, exposables (chemins Zod). */
  fields?: string[];
  cause?: unknown;
}

export class CartError extends Error {
  readonly code: CartErrorCode;
  readonly fields: string[];

  constructor({ code, message, fields, cause }: CartErrorInit) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'CartError';
    this.code = code;
    this.fields = fields ?? [];
  }

  get status(): number {
    return statusForCartErrorCode(this.code);
  }
}

export function isCartError(error: unknown): error is CartError {
  return error instanceof CartError;
}

/** Corps public normalisé — jamais de message interne. */
export function toPublicCartError(error: CartError): {
  error: CartErrorCode;
  fields?: string[];
} {
  return error.fields.length > 0 ? { error: error.code, fields: error.fields } : { error: error.code };
}
