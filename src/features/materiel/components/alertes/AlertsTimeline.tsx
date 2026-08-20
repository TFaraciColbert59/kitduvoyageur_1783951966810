import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';

interface AlertEntry { id: string; date: string; message: string; severity: 'info' | 'warning' | 'critical' }

const severityTone = { info: 'info', warning: 'warn', critical: 'danger' } as const;

/** W-L-5 AlertsTimeline — chrono verticale des alertes. */
export function AlertsTimeline({ entries }: { entries: AlertEntry[] }) {
  return (
    <GlassCard className="p-4">
      <ol className="relative border-l border-glass-border pl-4 flex flex-col gap-4">
        {entries.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-sage-500" aria-hidden="true" />
            <p className="text-xs text-[color:var(--label-quaternary)]">{e.date}</p>
            <p className="text-sm text-[color:var(--label)]">{e.message}</p>
            <Badge tone={severityTone[e.severity]}>{e.severity}</Badge>
          </li>
        ))}
        {entries.length === 0 && <li className="text-sm text-[color:var(--label-secondary)]">Aucune alerte.</li>}
      </ol>
    </GlassCard>
  );
}
