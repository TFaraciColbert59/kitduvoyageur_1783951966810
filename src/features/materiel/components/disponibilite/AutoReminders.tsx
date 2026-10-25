import { Badge, Card, EmptyState } from '@/components/ui';
import { Eyebrow } from '@/components/ui/Eyebrow';

export interface Reminder { id: string; label: string; due: string }

/** W-A-8 AutoReminders — rappels automatiques de retour. */
export function AutoReminders({ reminders }: { reminders: Reminder[] }) {
  return (
    <Card as="article" ariaLabelledBy="reminders-title" className="p-4">
      <Eyebrow>Rappels automatiques</Eyebrow>
      <h3 id="reminders-title" className="sr-only">Rappels de retour de prêt</h3>
      <ol className="mt-2 relative border-l border-[color:var(--lkv-border)] pl-4 flex flex-col gap-3">
        {reminders.map((r) => (
          <li key={r.id} className="relative">
            <span className="absolute -left-[var(--space-5)] top-1 h-2.5 w-2.5 rounded-full bg-[var(--lkv-warning)]" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-[color:var(--lkv-text-primary)]">{r.label}</span>
              <Badge tone="warn">{new Date(r.due).toLocaleDateString('fr-FR')}</Badge>
            </div>
          </li>
        ))}
        {reminders.length === 0 && (
          <li>
            <EmptyState compact title="Aucun rappel planifié." />
          </li>
        )}
      </ol>
    </Card>
  );
}
