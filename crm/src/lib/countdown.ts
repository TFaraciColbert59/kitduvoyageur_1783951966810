export type CountdownTone = 'gris' | 'orange' | 'rouge' | 'fleche';

/**
 * EX-INBOX-03 : gris (> 5 min), orange (≤ 5 min ou ≤ 20 % du délai), rouge (dépassé).
 * `remainingMs` négatif = dépassé.
 */
export function countdownTone(remainingMs: number, totalMs: number | null): CountdownTone {
  if (remainingMs <= 0) return 'rouge';
  if (remainingMs <= 5 * 60_000) return 'orange';
  if (totalMs && totalMs > 0 && remainingMs <= totalMs * 0.2) return 'orange';
  return 'gris';
}

export function formatRemaining(remainingMs: number): string {
  if (remainingMs <= 0) {
    const over = Math.abs(remainingMs);
    const m = Math.floor(over / 60_000);
    if (m < 1) return 'Dépassé';
    if (m < 60) return `Dépassé de ${m} min`;
    return `Dépassé de ${Math.floor(m / 60)} h`;
  }
  const m = Math.ceil(remainingMs / 60_000);
  if (m < 60) return `Reste ${m} min`;
  return `Reste ${Math.floor(m / 60)} h ${m % 60} min`;
}

/** EX-INBOX-02 : urgence haute > délai le plus proche > ancienneté. */
export function sortInbox<T extends { urgency: 'haute' | 'normale'; due_at: string | null; created_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if ((a.urgency === 'haute') !== (b.urgency === 'haute')) return a.urgency === 'haute' ? -1 : 1;
    const ad = a.due_at ? Date.parse(a.due_at) : Number.POSITIVE_INFINITY;
    const bd = b.due_at ? Date.parse(b.due_at) : Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    return Date.parse(a.created_at) - Date.parse(b.created_at);
  });
}
