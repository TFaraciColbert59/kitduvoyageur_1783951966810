import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';

const SCORE_TONE: Record<string, 'default' | 'sage' | 'danger'> = {
  'A+': 'sage', A: 'sage', B: 'sage', C: 'default', D: 'danger', E: 'danger',
};

/** W-D-8 TerrainReadinessScore — score A+..E de préparation terrain. */
export function TerrainReadinessScore({ score }: { score: { grade: string; factors: string[] } }) {
  return (
    <GlassCard as="article" ariaLabelledBy="readiness-title" className="p-4">
      <Eyebrow>Terrain Readiness Score</Eyebrow>
      <h3 id="readiness-title" className="sr-only">Score de préparation terrain</h3>
      <Metric value={score.grade} size="xl" tone={SCORE_TONE[score.grade] ?? 'default'} />
      <ul className="mt-2 flex flex-col gap-1">
        {score.factors.map((f) => (
          <li key={f} className="text-xs text-[color:var(--label-tertiary)]">• {f}</li>
        ))}
      </ul>
    </GlassCard>
  );
}
