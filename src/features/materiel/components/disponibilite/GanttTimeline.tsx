import { Card, EmptyState } from '@/components/ui';
import { Eyebrow } from '@/components/ui/Eyebrow';

export interface GanttLoan { id: string; label: string; start: string; end: string }

function dayIndex(date: string, anchor: Date): number {
  return Math.round((new Date(date).getTime() - anchor.getTime()) / 86400000);
}

/** W-A-3 GanttTimeline — timeline 30j, une ligne par prêt. */
export function GanttTimeline({ loans, days = 30 }: { loans: GanttLoan[]; days?: number }) {
  const anchor = new Date();
  const cols = Array.from({ length: days }, (_, i) => i);
  return (
    <Card as="article" ariaLabelledBy="gantt-title" className="p-4">
      <Eyebrow>Timeline prêts (30 j)</Eyebrow>
      <h3 id="gantt-title" className="sr-only">Timeline des prêts sur 30 jours</h3>
      <div className="mt-3 flex flex-col gap-2">
        {loans.map((l) => {
          const s = dayIndex(l.start, anchor);
          const e = dayIndex(l.end, anchor);
          const start = Math.max(0, s);
          const width = Math.max(1, Math.min(e, days - 1) - start + 1);
          return (
            <div key={l.id} className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate text-xs text-[color:var(--lkv-text-primary)]">{l.label}</span>
              <div className="relative h-4 flex-1 rounded-full bg-[color:var(--btn-tint)]">
                {start <= days - 1 && (
                  <div
                    className="absolute top-0 h-4 rounded-full bg-[var(--sage-500)]"
                    style={{ left: `${(start / days) * 100}%`, width: `${(width / days) * 100}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
        {loans.length === 0 && <EmptyState compact title="Aucun prêt sur la période." />}
      </div>
    </Card>
  );
}
