'use client';

import { useEffect, useState } from 'react';

export interface ChecklistCardBodyProps {
  tripId: string;
  href: string;
}

/**
 * Hub V4 — Micro-carte Checklist : % coché (persisté localStorage) + mini barre.
 * Composant client car les cases sont en localStorage.
 */
export function ChecklistCardBody({ tripId }: ChecklistCardBodyProps) {
  const [counts, setCounts] = useState<{ checked: number; total: number } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`lkv_trip_checklist_${tripId}`);
      const parsed = stored ? (JSON.parse(stored) as string[]) : [];
      setCounts({ checked: parsed.length, total: 0 });
    } catch {
      setCounts({ checked: 0, total: 0 });
    }
  }, [tripId]);

  // Total inconnu sans moteur de checklist (J-30/J-7/J-1) — affichage relatif.
  const pct = counts && counts.total > 0 ? Math.round((counts.checked / counts.total) * 100) : null;

  return (
    <div className="mt-1.5 space-y-1">
      {counts && (
        <p className="text-xs text-[var(--lkv-text-secondary)]">
          {counts.checked} case{counts.checked > 1 ? 's' : ''} cochée{counts.checked > 1 ? 's' : ''}
        </p>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)]"
          style={{ width: pct === null ? '12%' : `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default ChecklistCardBody;