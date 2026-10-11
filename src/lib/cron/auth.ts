import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Autorise un appel planifié : `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Vercel envoie cet en-tête tout seul quand la variable `CRON_SECRET` existe
 * dans le projet (page lue le 11 oct. 2026 :
 * https://vercel.com/docs/cron-jobs/manage-cron-jobs, « The value of the
 * variable will be automatically sent as an `Authorization` header »).
 *
 * - Sans secret configuré : refus (jamais « Bearer undefined » accepté).
 * - Comparaison en temps constant : on compare les empreintes SHA-256 des deux
 *   valeurs (même longueur, donc `timingSafeEqual` ne lève jamais), pas les
 *   chaînes elles-mêmes.
 */
export function isCronAuthorized(request: Request, secret: string | undefined = process.env.CRON_SECRET): boolean {
  if (!secret) return false;
  const received = request.headers.get('authorization') ?? '';
  const expected = createHash('sha256').update(`Bearer ${secret}`).digest();
  const actual = createHash('sha256').update(received).digest();
  return timingSafeEqual(expected, actual);
}
