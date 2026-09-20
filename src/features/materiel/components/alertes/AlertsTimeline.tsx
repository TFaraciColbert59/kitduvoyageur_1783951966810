import { Badge, Card, EmptyState } from '@/components/ui';

interface AlertEntry { id: string; date: string; message: string; severity: 'info' | 'warning' | 'critical' }

const severityTone = { info: 'info', warning: 'warn', critical: 'danger' } as const;

/** W-L-5 AlertsTimeline — chrono verticale des alertes. */
export function AlertsTimeline({ entries }: { entries: AlertEntry[] }) {
  return (
    <Card className="p-4">
      <ol className="relative border-l border-[color:var(--lkv-border)] pl-4 flex flex-col gap-4">
        {entries.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[var(--space-5)] top-1 h-2.5 w-2.5 rounded-full bg-[var(--sage-500)]" aria-hidden="true" />
            <p className="text-xs text-[color:var(--lkv-text-muted)]">{e.date}</p>
            <p className="text-sm text-[color:var(--lkv-text-primary)]">{e.message}</p>
            <Badge tone={severityTone[e.severity]}>{e.severity}</Badge>
          </li>
        ))}
        {entries.length === 0 && (
          <li>
            <EmptyState compact title="Aucune alerte." />
          </li>
        )}
      </ol>
    </Card>
  );
}
