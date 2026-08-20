'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/contexts/ToastContext';
import type { AlertItem } from '@/features/materiel/services/getAlerts';

const TONE: Record<string, 'danger' | 'warn' | 'info'> = { critical: 'danger', warning: 'warn', info: 'info' };

/** W-L-3 CategoryTabs — onglets verticaux par type d'alerte + résolution. */
export function CategoryTabs({ alerts }: { alerts: AlertItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const types = useMemo(() => Array.from(new Set(alerts.map((a) => a.type))), [alerts]);
  const [active, setActive] = useState<string>('all');
  const filtered = active === 'all' ? alerts : alerts.filter((a) => a.type === active);

  const resolve = async (id: string) => {
    const res = await fetch(`/api/materiel/alerts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_resolved: true }),
    });
    if (res.ok) { toast('Alerte résolue', 'success'); router.refresh(); }
    else toast('Erreur', 'error');
  };

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
          <li key={a.id} className="bg-white/60 rounded-[var(--r-sm)] p-2 flex items-center justify-between gap-2">
            <span className="text-sm text-[color:var(--label)]">{a.message}</span>
            <div className="flex items-center gap-2 shrink-0">
              <Badge tone={TONE[a.severity]}>{a.severity}</Badge>
              <button type="button" onClick={() => resolve(a.id)} className="glass interactive h-8 px-3 rounded-full text-xs font-medium text-sage-600">Résoudre</button>
            </div>
          </li>
        ))}
        {filtered.length === 0 && <li className="text-sm text-[color:var(--label-secondary)]">Aucune alerte dans cette catégorie.</li>}
      </ul>
    </GlassCard>
  );
}
