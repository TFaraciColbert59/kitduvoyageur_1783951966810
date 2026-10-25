/**
 * Moteur mobile Sécurité (sortie) — pur, testable sans DOM.
 * Statuts, progression des pointages, tri par criticité, prochain point, retard.
 */

export type SafetyStatus = 'pending' | 'checked' | 'missed' | 'alert_sent';

export interface SafetyCheckpointLike {
  id: string;
  status: SafetyStatus;
  scheduled_at: string;
  title?: string | null;
}

const STATUS_LABELS: Record<SafetyStatus, string> = {
  pending: 'En attente',
  checked: 'Validé',
  missed: 'En retard',
  alert_sent: 'Alerte envoyée',
};

/** Poids de criticité (plus bas = plus critique, affiché en premier). */
const STATUS_WEIGHT: Record<SafetyStatus, number> = {
  alert_sent: 0,
  missed: 1,
  pending: 2,
  checked: 3,
};

export function safetyStatusLabel(status: SafetyStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export interface SafetyProgress {
  checked: number;
  total: number;
  pct: number;
}

export function safetyProgress(checkpoints: SafetyCheckpointLike[]): SafetyProgress {
  const total = checkpoints.length;
  const checked = checkpoints.filter((checkpoint) => checkpoint.status === 'checked').length;
  return {
    checked,
    total,
    pct: total > 0 ? Math.min(100, Math.round((checked / total) * 100)) : 0,
  };
}

export function sortSafetyCheckpoints<T extends SafetyCheckpointLike>(checkpoints: T[]): T[] {
  return [...checkpoints].sort((a, b) => {
    const weight = STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status];
    if (weight !== 0) return weight;
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
  });
}

/** Prochain point à pointer : pending le plus proche dans le temps. */
export function nextSafetyCheckpoint<T extends SafetyCheckpointLike>(
  checkpoints: T[],
  _now: Date = new Date()
): T | null {
  const pending = checkpoints
    .filter((checkpoint) => checkpoint.status === 'pending')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  return pending[0] ?? null;
}

/** Un point en attente dont l'horaire est passé est en retard. */
export function isSafetyOverdue(checkpoint: SafetyCheckpointLike, now: Date = new Date()): boolean {
  if (checkpoint.status !== 'pending') return false;
  const scheduled = new Date(checkpoint.scheduled_at).getTime();
  if (Number.isNaN(scheduled)) return false;
  return scheduled < now.getTime();
}
