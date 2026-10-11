/** Requests server proof checks; publication/checklist success never implies XP. */
export const PROGRESSION_AWARD_CONFIRMED_EVENT = 'lkdv:progression-award-confirmed';
const CONFIRMED_OUTCOMES = new Set(['awarded', 'awarded_lifetime_only', 'duplicate']);

interface ConfirmedAwardDetail {
  ownerId: string;
  outcome: string;
}

/** Refresh signal only: it can never create a grant or choose a points amount. */
export function listenForConfirmedProgressionAwards(ownerId: string, onConfirmed: () => void): () => void {
  if (!ownerId || typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const detail: unknown = (event as CustomEvent<unknown>).detail;
    if (!detail || typeof detail !== 'object') return;
    const value = detail as Partial<ConfirmedAwardDetail>;
    if (value.ownerId === ownerId && typeof value.outcome === 'string' && CONFIRMED_OUTCOMES.has(value.outcome)) {
      onConfirmed();
    }
  };
  window.addEventListener(PROGRESSION_AWARD_CONFIRMED_EVENT, listener);
  return () => window.removeEventListener(PROGRESSION_AWARD_CONFIRMED_EVENT, listener);
}

async function requestAward(url: string, ownerId: string): Promise<void> {
  if (!ownerId) return;
  try {
    const response = await fetch(url, { method: 'POST', keepalive: true, cache: 'no-store' });
    if (!response.ok) return;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object') return;
    const value = payload as { ok?: unknown; awarded?: unknown; outcome?: unknown };
    // These routes expose producer.success as `awarded`; a 200 or ok alone
    // includes refusal and swallowed infrastructure errors. Replay is accepted.
    if (value.ok !== true || value.awarded !== true || typeof value.outcome !== 'string' || !CONFIRMED_OUTCOMES.has(value.outcome)) return;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<ConfirmedAwardDetail>(PROGRESSION_AWARD_CONFIRMED_EVENT, {
        detail: { ownerId, outcome: value.outcome },
      }));
    }
  } catch {
    // Best effort: proof attribution cannot block the underlying user action.
  }
}

/** ownerId is the initiating account captured before the underlying async write. */
export function requestCarnetPublicationAward(carnetId: string, ownerId: string): void {
  void requestAward(`/api/carnets/${encodeURIComponent(carnetId)}/publish`, ownerId);
}

export function requestChecklistCompletionAward(tripId: string, ownerId: string): void {
  void requestAward(`/api/trips/${encodeURIComponent(tripId)}/checklist/complete`, ownerId);
}
