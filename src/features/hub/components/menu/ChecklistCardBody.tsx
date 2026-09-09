'use client';

import type { HubChecklistItem } from '../../server/getHubAdventureData';

export interface ChecklistCardBodyProps {
  /** Items réels de trip_checklist_items (chargés côté serveur). */
  items: HubChecklistItem[];
}

/** Buckets de préparation dérivés de due_offset_days (J-30+, J-7+, départ). */
function bucketOf(dueOffsetDays: number): 'j30' | 'j7' | 'start' {
  if (dueOffsetDays >= 30) return 'j30';
  if (dueOffsetDays >= 8) return 'j7';
  return 'start';
}

const BUCKET_LABELS: Record<'j30' | 'j7' | 'start', string> = {
  j30: 'J-30',
  j7: 'J-7',
  start: 'Départ',
};

/**
 * Hub V4 — Micro-carte Checklist : total + barres J-30 / J-7 / Départ.
 * 100% données réelles (trip_checklist_items via getHubAdventureData) —
 * plus de localStorage ni de liste fabriquée.
 */
export function ChecklistCardBody({ items }: ChecklistCardBodyProps) {
  const groups = (['j30', 'j7', 'start'] as const)
    .map((key) => {
      const bucketItems = items.filter((i) => bucketOf(i.dueOffsetDays) === key);
      return { key, label: BUCKET_LABELS[key], items: bucketItems };
    })
    .filter((g) => g.items.length > 0);

  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : null;

  return (
    <div className="mt-1">
      <p className="text-2xl font-extrabold text-[var(--lkv-text-primary)]">
        {pct ?? '—'}
        {pct !== null && (
          <span className="text-sm text-[var(--lkv-text-secondary)]">% · {done}/{total}</span>
        )}
      </p>
      {groups.length === 0 ? (
        <p className="mt-1.5 text-xs text-[var(--lkv-text-secondary)]">Aucune tâche de préparation.</p>
      ) : (
        <div className="mt-1.5 space-y-1.5">
          {groups.map((g) => {
            const gDone = g.items.filter((i) => i.done).length;
            const gPct = Math.round((gDone / g.items.length) * 100);
            return (
              <div key={g.key} className="flex items-center gap-2">
                <span className="w-8 shrink-0 font-semibold text-[10px] text-[var(--lkv-text-muted)]">{g.label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/5">
                  <div className="h-full rounded-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]" style={{ width: `${gPct}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right font-semibold text-[10px] text-[var(--lkv-text-muted)]">
                  {gDone}/{g.items.length}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ChecklistCardBody;
