import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';

/** W-A-9 DispoScore — score de fiabilité de disponibilité. */
export function DispoScore({ score, overdue }: { score: number; overdue: number }) {
  return (
    <GlassCard as="article" ariaLabelledBy="dispo-score-title" className="p-4">
      <Eyebrow>Score fiabilité</Eyebrow>
      <h3 id="dispo-score-title" className="sr-only">Score de fiabilité</h3>
      <Metric value={`${score}/100`} tone={overdue > 0 ? 'danger' : score >= 70 ? 'sage' : 'default'} />
      {overdue > 0 && <p className="mt-1 text-xs text-[color:var(--label-tertiary)]">{overdue} prêt(s) en retard</p>}
    </GlassCard>
  );
}
