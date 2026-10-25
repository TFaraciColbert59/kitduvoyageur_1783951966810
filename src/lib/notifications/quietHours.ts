/**
 * A-186 — heures calmes des notifications.
 * Fonctions pures (testables) : heure locale d'un fuseau, appartenance à la
 * plage calme (avec chevauchement minuit), délai avant la fin de plage.
 */

export function currentHourInZone(timeZone: string, now: Date = new Date()): number {
  try {
    return Number(
      new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone }).format(now)
    ) % 24;
  } catch {
    return now.getUTCHours();
  }
}

export function isWithinQuietHours(
  hour: number,
  start: number | null | undefined,
  end: number | null | undefined
): boolean {
  if (start == null || end == null || start === end) return false;
  if (start < end) return hour >= start && hour < end;
  // Plage qui traverse minuit (ex. 22 → 7).
  return hour >= start || hour < end;
}

export function hoursUntilQuietEnd(hour: number, end: number | null | undefined): number {
  if (end == null) return 1;
  const diff = (end - hour + 24) % 24;
  return diff === 0 ? 24 : diff;
}
