'use client';

import React, { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';

export interface CountdownWidgetProps {
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  totalDays?: number | null;
}

function diffLabel(target: Date): { label: string; sub: string } {
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diff = Math.round((targetDay.getTime() - dayStart.getTime()) / 86400000);
  if (diff > 0) return { label: `J-${diff}`, sub: 'Avant départ' };
  if (diff === 0) return { label: "Aujourd'hui", sub: 'Départ' };
  return { label: `J+${Math.abs(diff)}`, sub: 'Depuis le départ' };
}

/**
 * Widget `countdown` — J-N / Aujourd'hui / Jour N.
 * Calculé côté client après montage (l'horloge figée Playwright ne s'applique
 * qu'au navigateur : un compteur rendu serveur casserait le déterminisme G5).
 */
export function CountdownWidget({ startDate, endDate, status, totalDays }: CountdownWidgetProps) {
  const [label, setLabel] = useState<{ label: string; sub: string } | null>(null);

  useEffect(() => {
    if (!startDate) return;
    const target = new Date(`${startDate}T00:00:00`);
    if (Number.isNaN(target.getTime())) return;

    if (status === 'active') {
      setLabel({ label: 'En cours', sub: totalDays ? 'Voyage en direct' : 'Cockpit terrain' });
      return;
    }
    setLabel(diffLabel(target));
  }, [startDate, status, totalDays]);

  return (
    <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs font-sans">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-xs text-[var(--lkv-primary)] flex items-center gap-1.5">
          <CalendarClock size={13} aria-hidden="true" />
          Compte à rebours
        </h3>
        <span className="glass-pill text-[9.5px] font-bold text-[var(--lkv-text-primary)]" aria-live="polite">
          {label ? label.label : '—'}
        </span>
      </div>
      <div className="text-sm font-bold text-[var(--lkv-text-primary)] tabular-nums">
        {label ? label.sub : 'Dates à définir'}
      </div>
    </div>
  );
}

export default CountdownWidget;
