/**
 * Moteur mobile Checklist (sortie) — pur, testable sans DOM.
 * Regroupement par échéance + progression + prochaine tâche.
 */

export interface ChecklistItemLike {
  id: string;
  done: boolean;
  due_offset_days: number;
  position: number;
}

export type ChecklistBucketKey = 'j30' | 'j7' | 'j1';

export interface ChecklistBuckets<T extends ChecklistItemLike> {
  j30: T[];
  j7: T[];
  j1: T[];
}

/** Bornes identiques à la vue legacy : ≥30 → j30, 8-29 → j7, <8 → j1. */
export function checklistBucket(dueOffsetDays: number): ChecklistBucketKey {
  if (dueOffsetDays >= 30) return 'j30';
  if (dueOffsetDays >= 8) return 'j7';
  return 'j1';
}

export function bucketChecklist<T extends ChecklistItemLike>(items: T[]): ChecklistBuckets<T> {
  const buckets: ChecklistBuckets<T> = { j30: [], j7: [], j1: [] };
  for (const item of items) {
    buckets[checklistBucket(item.due_offset_days)].push(item);
  }
  return buckets;
}

export interface ChecklistProgress {
  done: number;
  total: number;
  pct: number;
  remaining: number;
}

export function checklistProgress(items: ChecklistItemLike[]): ChecklistProgress {
  const total = items.length;
  const done = items.filter((item) => item.done).length;
  return {
    done,
    total,
    pct: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0,
    remaining: total - done,
  };
}

/** Prochaine tâche : non faite, échéance la plus proche puis position. */
export function nextChecklistItem<T extends ChecklistItemLike>(items: T[]): T | null {
  const pending = items.filter((item) => !item.done);
  if (pending.length === 0) return null;
  return [...pending].sort(
    (a, b) => a.due_offset_days - b.due_offset_days || a.position - b.position
  )[0];
}
