import 'server-only';
import { apiError } from '../lib/errors';
import { bearerToken } from './http';

/**
 * Authentification des tâches planifiées : `Authorization: Bearer ${CRON_SECRET}`.
 * Secret absent → 401 clair (aucune exécution implicite) ; secret faux → 401.
 * Comparaison à temps constant.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function requireCronAuth(request: Request): void {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 8) throw apiError('cron_secret_missing');
  const provided = bearerToken(request);
  if (!provided || !timingSafeEqual(provided, expected)) throw apiError('cron_secret_invalid');
}

/** Clé d'idempotence stable : fenêtre de N minutes (UTC), ex. `2026-11-09T05:20`. */
export function cronBucket(minutes = 5, now = new Date()): string {
  const windowMs = Math.max(1, minutes) * 60_000;
  const floored = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  return floored.toISOString().slice(0, 16);
}

/** Clé quotidienne (purge), en UTC. */
export function dayBucket(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Bornes sûres pour une purge : jamais moins de 30 jours. */
export function purgeDays(raw: unknown): number {
  const value = Number(raw ?? process.env.CRM_PURGE_DAYS ?? 90);
  if (!Number.isFinite(value)) return 90;
  return Math.min(Math.max(Math.floor(value), 30), 3650);
}
