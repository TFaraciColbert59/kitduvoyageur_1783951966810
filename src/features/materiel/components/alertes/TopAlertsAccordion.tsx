'use client';
import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import type { AlertItem } from '@/features/materiel/services/getAlerts';

const TONE: Record<string, 'danger' | 'warn' | 'info'> = { critical: 'danger', warning: 'warn', info: 'info' };
const RANK = { critical: 0, warning: 1, info: 2 } as const;

/** W-L-2 TopAlertsAccordion — top 3 alertes à surveiller (accordéon). */
export function TopAlertsAccordion({ alerts }: { alerts: AlertItem[] }) {
  const top = [...alerts].sort((a, b) => (RANK[a.severity] ?? 3) - (RANK[b.severity] ?? 3)).slice(0, 3);
  const [open, setOpen] = useState<string | null>(top[0]?.id ?? null);

  return (
    <GlassCard as="article" ariaLabelledBy="top-alerts-title" className="p-4">
      <Eyebrow>Top à surveiller</Eyebrow>
      <h3 id="top-alerts-title" className="sr-only">Top 3 des alertes à surveiller</h3>
      <div className="mt-2 flex flex-col gap-2">
        {top.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setOpen(open === a.id ? null : a.id)}
            aria-expanded={open === a.id}
            className="bg-white/35 rounded-[var(--r-sm)] p-3 text-left"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[color:var(--label)]">{a.type}</span>
              <Badge tone={TONE[a.severity]}>{a.severity}</Badge>
            </div>
            {open === a.id && <p className="mt-2 text-sm text-[color:var(--label-secondary)]">{a.message}</p>}
          </button>
        ))}
        {top.length === 0 && <p className="text-sm text-[color:var(--label-secondary)]">Aucune alerte active.</p>}
      </div>
    </GlassCard>
  );
}
