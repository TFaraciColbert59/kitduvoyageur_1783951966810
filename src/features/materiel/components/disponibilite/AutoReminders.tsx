import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';

export interface Reminder { id: string; label: string; due: string }

/** W-A-8 AutoReminders — rappels automatiques de retour. */
export function AutoReminders({ reminders }: { reminders: Reminder[] }) {
  return (
    <GlassCard as="article" ariaLabelledBy="reminders-title" className="p-4">
      <Eyebrow>Rappels automatiques</Eyebrow>
      <h3 id="reminders-title" className="sr-only">Rappels de retour de prêt</h3>
      <ol className="mt-2 relative border-l border-glass-border pl-4 flex flex-col gap-3">
        {reminders.map((r) => (
          <li key={r.id} className="relative">
            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-warn" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-[color:var(--label)]">{r.label}</span>
              <Badge tone="warn">{new Date(r.due).toLocaleDateString('fr-FR')}</Badge>
            </div>
          </li>
        ))}
        {reminders.length === 0 && <li className="text-sm text-[color:var(--label-secondary)]">Aucun rappel planifié.</li>}
      </ol>
    </GlassCard>
  );
}
