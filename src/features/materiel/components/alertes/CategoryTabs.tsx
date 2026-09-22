'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, Chip, EmptyState, ListItem } from '@/components/ui';
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
    <Card as="article" ariaLabelledBy="cat-tabs-title" className="p-4">
      <h3 id="cat-tabs-title" className="sr-only">Alertes par catégorie</h3>
      <div className="flex gap-1 overflow-x-auto md:flex-col">
        <Chip
          selected={active === 'all'}
          onClick={() => setActive('all')}
          className="whitespace-nowrap"
        >
          Toutes ({alerts.length})
        </Chip>
        {types.map((t) => (
          <Chip
            key={t}
            selected={active === t}
            onClick={() => setActive(t)}
            className="whitespace-nowrap"
          >
            {t} ({alerts.filter((a) => a.type === t).length})
          </Chip>
        ))}
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {filtered.map((a) => (
          <li key={a.id}>
            <ListItem
              as="div"
              className="bg-[color:var(--glass-bg-medium)]"
              title={a.message}
              trailing={
                <span className="flex items-center gap-2">
                  <Badge tone={TONE[a.severity]}>{a.severity}</Badge>
                  <Button variant="secondary" size="sm" onClick={() => resolve(a.id)}>Résoudre</Button>
                </span>
              }
            />
          </li>
        ))}
        {filtered.length === 0 && (
          <li>
            <EmptyState compact title="Aucune alerte dans cette catégorie." />
          </li>
        )}
      </ul>
    </Card>
  );
}
