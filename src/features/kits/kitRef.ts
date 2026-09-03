/**
 * Cookie d'attribution signé lkdv_kit_ref (chantier lignées, Lot 6.3).
 *
 * Le cookie est un SECRET SERVEUR : httpOnly, secure, sameSite=lax, signé
 * HMAC-SHA256 avec KIT_REF_SECRET (jamais en dur). Payload { kit_id, exp },
 * TTL 30 jours. Une signature invalide ou un jeton expiré est ignoré
 * SILENCIEUSEMENT — c'est la parade à la seule vraie faille économique du
 * système (forger une attribution vers son propre kit).
 *
 * Web Crypto API (crypto.subtle) : disponible en edge (middleware) comme en
 * Node 18+ — un seul module pour les deux runtimes, testable en Vitest.
 */

/** Nom du cookie posé par le middleware / les routes serveur. */
export const KIT_REF_COOKIE = 'lkdv_kit_ref';

/** Durée de vie : 30 jours. */
export const KIT_REF_TTL_MS = 30 * 24 * 3600 * 1000;

function base64urlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64urlDecode(input: string): string | null {
  try {
    return Buffer.from(input, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

async function hmacSha256(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Buffer.from(new Uint8Array(sig)).toString('base64url');
}

export interface KitRefPayload {
  kit_id: string;
}

export async function signKitRef(kitId: string, secret: string, now = Date.now()): Promise<string> {
  const body = JSON.stringify({ kit_id: kitId, exp: now + KIT_REF_TTL_MS });
  return `${base64urlEncode(body)}.${await hmacSha256(body, secret)}`;
}

export async function verifyKitRef(
  token: string | null | undefined,
  secret: string,
  now = Date.now()
): Promise<KitRefPayload | null> {
  if (!token || !secret) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;

  const payloadText = base64urlDecode(payloadB64);
  if (payloadText == null) return null;

  const expected = await hmacSha256(payloadText, secret);
  if (expected !== sig) return null; // signature invalide → ignoré silencieusement

  try {
    const parsed = JSON.parse(payloadText) as { kit_id?: unknown; exp?: unknown };
    if (typeof parsed.kit_id !== 'string' || !parsed.kit_id) return null;
    if (typeof parsed.exp !== 'number' || parsed.exp < now) return null; // expiré
    return { kit_id: parsed.kit_id };
  } catch {
    return null;
  }
}