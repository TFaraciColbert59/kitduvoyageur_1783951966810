import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Génère un jeton opaque aléatoire cryptographiquement sûr (256 bits, base64url).
 * Retourné une seule fois à l'appelant ; seul son hash SHA-256 doit être persisté.
 */
export function generateOpaqueToken(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new Error('Token byteLength must be an integer >= 16.');
  }
  return randomBytes(byteLength).toString('base64url');
}

/**
 * Calcule l'empreinte SHA-256 hexadécimale d'un jeton brut.
 */
export function hashTokenSha256(rawToken: string): string {
  const normalized = rawToken.trim();
  if (!normalized) {
    throw new Error('Cannot hash an empty token.');
  }
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Comparaison en temps constant de deux empreintes hexadécimales SHA-256.
 */
export function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length || aHex.length === 0) {
    return false;
  }
  const aBuf = Buffer.from(aHex, 'hex');
  const bBuf = Buffer.from(bHex, 'hex');
  if (aBuf.length !== bBuf.length || aBuf.length === 0) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}
