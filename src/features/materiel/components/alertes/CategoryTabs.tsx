'use client';
import { useMemo, useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import type { AlertItem } from '@/features/materiel/services/getAlerts';

const TONE: Record<string, 'danger' | 'warn' | 'info'> = { critical: 'danger', warning: 'warn', info: 'info' };

/** W-L-3 CategoryTabs — onglets verticaux par type d'alerte. */
export function CategoryTabs({ alerts }: { alerts: AlertItem[] }) {
  const types = useMemo(() => Array.from(new Set(alerts.map((a) => a.type))), [alerts]);
  const [active, setActive] = useState<string>('all');
  const filtered = active === 'all' ? alerts : alerts.filter((a) => a.type === active);

  return (
    <GlassCard as="article" ariaLabelledBy="cat-tabs-title" className="p-4">
      <h3 id="cat-tabs-title" className="sr-only">Alertes par catégorie</h3>
      <div className="flex md:flex-col gap-1 overflow-x-auto">
        <button type="button" onClick={() => setActive('all')} className={`glass-segmented-item whitespace-nowrap ${active === 'all' ? 'active' : ''}`}>
          Toutes ({alerts.length})
        </button>
        {types.map((t) => (
          <button key={t} type="button" onClick={() => setActive(t)} className={`glass-segmented-item whitespace-nowrap ${active === t ? 'active' : ''}`}>
            {t} ({alerts.filter((a) => a.type === t).length})
          </button>
        ))}
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {filtered.map((a) => (
          <li key={a.id} className="glass p-2 flex items-center justify-between">
            <span className="text-sm text-[color:var(--label)]">{a.message}</span>
            <Badge tone={TONE[a.severity]}>{a.severity}</Badge>
          </li>
        ))}
        {filtered.length === 0 && <li className="text-sm text-[color:var(--label-secondary)]">Aucune alerte dans cette catégorie.</li>}
      </ul>
    </GlassCard>
  );
}
