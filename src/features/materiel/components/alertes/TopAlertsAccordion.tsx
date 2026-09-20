'use client';
import { useState } from 'react';
import { Badge, Button, Card, EmptyState } from '@/components/ui';
import { Eyebrow } from '@/components/ui/Eyebrow';
import type { AlertItem } from '@/features/materiel/services/getAlerts';

const TONE: Record<string, 'danger' | 'warn' | 'info'> = { critical: 'danger', warning: 'warn', info: 'info' };
const RANK = { critical: 0, warning: 1, info: 2 } as const;

/** W-L-2 TopAlertsAccordion — top 3 alertes à surveiller (accordéon). */
export function TopAlertsAccordion({ alerts }: { alerts: AlertItem[] }) {
  const top = [...alerts].sort((a, b) => (RANK[a.severity] ?? 3) - (RANK[b.severity] ?? 3)).slice(0, 3);
  const [open, setOpen] = useState<string | null>(top[0]?.id ?? null);

  return (
    <Card as="article" ariaLabelledBy="top-alerts-title" className="p-4">
      <Eyebrow>Top à surveiller</Eyebrow>
      <h3 id="top-alerts-title" className="sr-only">Top 3 des alertes à surveiller</h3>
      <div className="mt-2 flex flex-col gap-2">
        {top.map((a) => (
          <Button
            key={a.id}
            variant="ghost"
            onClick={() => setOpen(open === a.id ? null : a.id)}
            aria-expanded={open === a.id}
            className="h-auto w-full flex-col items-stretch justify-start whitespace-normal rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-surface-muted)] p-3 text-left font-normal"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[color:var(--lkv-text-primary)]">{a.type}</span>
              <Badge tone={TONE[a.severity]}>{a.severity}</Badge>
            </div>
            {open === a.id && <p className="mt-2 text-sm text-[color:var(--lkv-text-secondary)]">{a.message}</p>}
          </Button>
        ))}
        {top.length === 0 && <EmptyState compact title="Aucune alerte active." />}
      </div>
    </Card>
  );
}
