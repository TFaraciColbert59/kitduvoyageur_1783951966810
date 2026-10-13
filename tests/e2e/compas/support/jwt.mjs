// JWT HS256 minimal (node:crypto) : le serveur de doublures et le test s'en servent
// pour jouer le rôle de GoTrue/Kong face à PostgREST. Clé de test uniquement.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const E2E_JWT_SECRET = 'e2e-compas-jwt-secret-not-a-secret-0123456789';

const b64u = (buf) => Buffer.from(buf).toString('base64url');

export function signJwt(claims, secret = E2E_JWT_SECRET) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(claims));
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

/** Les revendications si la signature et l'expiration tiennent, sinon null. */
export function verifyJwt(token, secret = E2E_JWT_SECRET, nowS = Math.floor(Date.now() / 1000)) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) return null;
  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  let given;
  try {
    given = Buffer.from(parts[2], 'base64url');
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof claims.exp === 'number' && claims.exp < nowS) return null;
    return claims;
  } catch {
    return null;
  }
}
