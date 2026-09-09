'use client';

import { useEffect, useState } from 'react';
import { getPreDepartureChecklist } from '@/features/trips/components/TripChecklistView';

export interface ChecklistCardBodyProps {
  tripId: string;
  daysUntil?: number | null;
  countryCode?: string | null;
}

/**
 * Hub V4 — Micro-carte Checklist : total + barres J-30 / J-7 / J-1.
 * Cases persistées en localStorage (même clé que TripChecklistView).
 */
export function ChecklistCardBody({ tripId, daysUntil, countryCode }: ChecklistCardBodyProps) {
  const [checked, setChecked] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`lkv_trip_checklist_${tripId}`);
      setChecked(stored ? (JSON.parse(stored) as string[]) : []);
    } catch {
      setChecked([]);
    }
  }, [tripId]);

  let groups: Array<{ label: string; items: string[] }> = [];
  try {
    const checklist = getPreDepartureChecklist(daysUntil ?? null, countryCode ?? null);
    groups = [
      { label: 'J-30', items: checklist.j30.map((i) => i.id) },
      { label: 'J-7', items: checklist.j7.map((i) => i.id) },
      { label: 'J-1', items: checklist.j1.map((i) => i.id) },
    ];
  } catch {
    groups = [];
  }

  const total = groups.reduce((s, g) => s + g.items.length, 0);
  const done = groups.reduce((s, g) => s + g.items.filter((id) => checked.includes(id)).length, 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="mt-1">
      <p className="text-2xl font-extrabold text-[var(--lkv-text-primary)]">
        {pct}
        <span className="text-sm text-[var(--lkv-text-secondary)]">% · {done}/{total}</span>
      </p>
      <div className="mt-1.5 space-y-1.5">
        {groups.map((g) => {
          const gDone = g.items.filter((id) => checked.includes(id)).length;
          const gPct = g.items.length > 0 ? Math.round((gDone / g.items.length) * 100) : 0;
          return (
            <div key={g.label} className="flex items-center gap-2">
              <span className="w-8 shrink-0 font-mono text-[10px] text-[var(--lkv-text-muted)]">{g.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/5">
                <div className="h-full rounded-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]" style={{ width: `${gPct}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right font-mono text-[10px] text-[var(--lkv-text-muted)]">
                {gDone}/{g.items.length}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ChecklistCardBody;