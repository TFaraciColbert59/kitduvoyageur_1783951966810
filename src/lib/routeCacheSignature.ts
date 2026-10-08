import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signature des écritures du cache de routage (`POST /api/route/cache`).
 *
 * Audit du 8 octobre : la route acceptait l'écriture de n'importe qui, sans
 * connexion. Une distance inventée, déposée sous une clé légitime, était
 * ensuite servie comme une mesure. Seul le serveur (`/api/route`, qui vient de
 * mesurer) signe désormais ses écritures ; la route refuse le reste.
 *
 * Le secret est dérivé d'une clé déjà présente côté serveur (aucune variable
 * nouvelle à poser) ; `ROUTE_CACHE_SECRET` la remplace si elle existe. Il ne
 * quitte jamais le serveur : seule la signature de la clé voyage.
 */
export const ROUTE_CACHE_SIGNATURE_HEADER = 'x-route-cache-signature';

function secret(): string | null {
  const base = process.env.ROUTE_CACHE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  return base ? createHmac('sha256', base).update('route-cache-write:v1').digest('hex') : null;
}

/** La signature d'une clé de cache, ou une chaîne vide sans secret (écriture refusée). */
export function signRouteCacheKey(key: string): string {
  const s = secret();
  return s ? createHmac('sha256', s).update(key).digest('hex') : '';
}

/** La signature reçue est-elle celle de cette clé ? Comparaison à temps constant. */
export function verifyRouteCacheSignature(key: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = signRouteCacheKey(key);
  if (!expected) return false;
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
