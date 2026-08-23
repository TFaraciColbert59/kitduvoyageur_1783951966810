import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { Badge } from '@/components/ui/Badge';

/** W-L-1 ReliabilityScore — score de fiabilité + compteurs. */
export function ReliabilityScore({ score, critical, warning }: { score: number; critical: number; warning: number }) {
  return (
    <GlassCard as="article" ariaLabelledBy="reliability-score-title" className="p-4">
      <Eyebrow>Score de fiabilité</Eyebrow>
      <h3 id="reliability-score-title" className="sr-only">Score de fiabilité</h3>
      <Metric value={`${score}/100`} tone={critical > 0 ? 'danger' : score >= 70 ? 'sage' : 'default'} />
      <div className="mt-2 flex gap-2">
        {critical > 0 && <Badge tone="danger">{critical} critiques</Badge>}
        {warning > 0 && <Badge tone="warn">{warning} avertissements</Badge>}
      </div>
    </GlassCard>
  );
}
