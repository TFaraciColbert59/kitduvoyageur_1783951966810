import { Card, EmptyState } from '@/components/ui';
import { Eyebrow } from '@/components/ui/Eyebrow';

/** W-A-6 LoanHeatmap — carte de chaleur des retours (dérivée des prêts). */
export function LoanHeatmap({ byMonth }: { byMonth: { month: string; count: number }[] }) {
  const max = Math.max(1, ...byMonth.map((m) => m.count));
  return (
    <Card as="article" ariaLabelledBy="heatmap-title" className="p-4">
      <Eyebrow>Carte des prêts</Eyebrow>
      <h3 id="heatmap-title" className="sr-only">Carte de chaleur des prêts</h3>
      <div className="mt-3 flex items-end gap-2">
        {byMonth.map((m) => (
          <div key={m.month} className="flex flex-col items-center gap-1">
            <div className="w-8 rounded-t-[var(--lkv-radius-sm)] bg-[var(--sage-500)]" style={{ height: `${10 + (m.count / max) * 60}px` }} />
            <span className="text-[10px] text-[color:var(--lkv-text-muted)]">{m.month}</span>
          </div>
        ))}
        {byMonth.length === 0 && <EmptyState compact title="Aucune donnée." />}
      </div>
    </Card>
  );
}
