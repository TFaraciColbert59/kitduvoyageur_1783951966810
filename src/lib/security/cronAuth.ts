import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Vérifie le Bearer `CRON_SECRET` d'une requête de job.
 * Rejet par défaut : secret absent, en-tête absent ou comparaison invalide.
 * Comparaison à temps constant sur des buffers de même longueur.
 */
export function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get('authorization');
  if (!header) return false;

  const provided = Buffer.from(header, 'utf8');
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}
