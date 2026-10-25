import { NextRequest, NextResponse } from 'next/server';
import { CART_ERROR_CODES, CartError, isCartError, toPublicCartError } from './cartErrors';

/**
 * Plaque HTTP du panier : aucune décision métier ici.
 * Invariants : `Cache-Control: no-store` partout, corps borné, erreurs
 * publiques normalisées (jamais de message Supabase, stack ou credential).
 */

export const CART_NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;
export const CART_MAX_BODY_BYTES = 32 * 1024;

export function cartJson(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...CART_NO_STORE_HEADERS, ...headers },
  });
}

/** Lit un JSON en bornant la taille ; refus explicite au-delà de 32 Kio. */
export async function readCartJsonBody(request: NextRequest): Promise<unknown> {
  const declared = request.headers.get('content-length');
  if (declared && Number(declared) > CART_MAX_BODY_BYTES) {
    throw new CartError({
      code: CART_ERROR_CODES.payload_too_large,
      message: '[cart] corps de requête trop volumineux',
    });
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new CartError({
      code: CART_ERROR_CODES.invalid_request,
      message: '[cart] corps de requête illisible',
    });
  }
  if (Buffer.byteLength(text, 'utf8') > CART_MAX_BODY_BYTES) {
    throw new CartError({
      code: CART_ERROR_CODES.payload_too_large,
      message: '[cart] corps de requête trop volumineux',
    });
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CartError({
      code: CART_ERROR_CODES.invalid_request,
      message: '[cart] JSON malformé',
    });
  }
}

export function invalidRequest(fields: string[] = []): CartError {
  return new CartError({
    code: CART_ERROR_CODES.invalid_request,
    message: '[cart] charge utile invalide',
    fields,
  });
}

/**
 * Convertit toute exception en réponse publique. Le détail reste dans les
 * logs serveur ; le client ne reçoit qu'un code stable.
 */
export function toCartErrorResponse(error: unknown, scope: string): NextResponse {
  if (isCartError(error)) {
    if (error.status >= 500) console.error(scope, error.code, error.message);
    return cartJson(toPublicCartError(error), error.status);
  }
  console.error(scope, 'erreur inattendue', error);
  return cartJson({ error: CART_ERROR_CODES.internal }, 500);
}

interface AuthLikeClient {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> };
}

/** Utilisateur authentifié, sinon refus 401 avant toute donnée Supabase. */
export async function requireAuthenticatedUser(supabase: AuthLikeClient): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new CartError({ code: CART_ERROR_CODES.unauthorized, message: '[cart] non authentifié' });
  }
  return user.id;
}
