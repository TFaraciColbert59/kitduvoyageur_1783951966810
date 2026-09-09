'use client';

import React, { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

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
    <GlassCard tone="sage" className="p-3.5 space-y-1.5 rounded-[var(--lkv-radius-card)] border border-white/60">
      <span className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)] flex items-center gap-1.5">
        <CalendarClock size={12} />
        Échéance
      </span>
      <div className="text-2xl font-extrabold text-[var(--lkv-text-primary)] font-mono" aria-live="polite">
        {label ? label.label : '—'}
      </div>
      <div className="text-[11px] text-[var(--lkv-text-secondary)]">
        {label ? label.sub : 'Dates à définir'}
      </div>
    </GlassCard>
  );
}

export default CountdownWidget;
