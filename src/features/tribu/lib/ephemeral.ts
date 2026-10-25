/**
 * Groupe eclair (TRIBU Phase 2) — formatage du compte a rebours de dissolution.
 * Pur, testable, sans dependance UI.
 */
export function formatEphemeralCountdown(
  autoDissolveAt: string | null | undefined,
  now: number = Date.now()
): string | null {
  if (!autoDissolveAt) return null;
  const target = new Date(autoDissolveAt).getTime();
  if (Number.isNaN(target)) return null;

  const diffMs = target - now;
  if (diffMs <= 0) return 'Dissolution imminente';

  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 24) {
    return hours <= 1 ? 'Dissoute dans moins d’une heure' : `Dissoute dans ${hours} h`;
  }
  const days = Math.floor(hours / 24);
  return days <= 1 ? 'Dissoute dans 1 jour' : `Dissoute dans ${days} jours`;
}
