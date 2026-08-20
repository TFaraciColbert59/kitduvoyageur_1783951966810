import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';

export interface KitsKpi {
  active: number;
  avgCompletionPct: number;
  totalWeightG: number;
  trash: number;
}

/** W-K-1 KitsKpiBar — 4 tuiles KPI (données materiel_kits réelles). */
export function KitsKpiBar({ kpi }: { kpi: KitsKpi }) {
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-label="Indicateurs clés">
      <GlassCard className="p-4"><Eyebrow>Kits actifs</Eyebrow><Metric value={kpi.active} /></GlassCard>
      <GlassCard className="p-4"><Eyebrow>Complétude moyenne</Eyebrow><Metric value={`${Math.round(kpi.avgCompletionPct)}%`} tone="sage" /></GlassCard>
      <GlassCard className="p-4"><Eyebrow>Poids total</Eyebrow><Metric value={(kpi.totalWeightG / 1000).toFixed(1)} unit="kg" /></GlassCard>
      <GlassCard className="p-4"><Eyebrow>En corbeille</Eyebrow><Metric value={kpi.trash} /></GlassCard>
    </section>
  );
}
