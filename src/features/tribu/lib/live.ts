/**
 * Phase 7 TRIBU — formatage du temps restant d'une session live.
 */
export function formatSessionRemaining(
  expiresAt: string | null | undefined,
  now: number = Date.now()
): string | null {
  if (!expiresAt) return null;
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return null;

  const diffMs = target - now;
  if (diffMs <= 0) return 'Session terminée';

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min restantes`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0
      ? `${hours} h ${remainingMinutes} min restantes`
      : `${hours} h restantes`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 jour restant' : `${days} jours restants`;
}
