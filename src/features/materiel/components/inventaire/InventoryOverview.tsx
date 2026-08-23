import { GlassCard } from '@/components/ui/GlassCard';
import { Metric } from '@/components/ui/Metric';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ProgressBar } from '@/components/ui/ProgressBar';

export interface InventoryOverviewData {
  count: number;
  totalWeightG: number;
  lentCount: number;
  reliabilityPct: number;
}

/** W-I-1 InventoryOverview — 3 KPI + barre de fiabilité (product_ownership). */
export function InventoryOverview({ data }: { data: InventoryOverviewData }) {
  return (
    <GlassCard className="p-4" aria-labelledby="inv-overview">
      <h2 id="inv-overview" className="sr-only">Vue d'ensemble de l'inventaire</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 items-center">
        <div>
          <Metric value={data.count} size="xl" />
          <Eyebrow>Objets</Eyebrow>
        </div>
        <div>
          <Metric value={(data.totalWeightG / 1000).toFixed(1)} unit="kg" />
          <Eyebrow>Poids total</Eyebrow>
        </div>
        <div>
          <Metric value={data.lentCount} tone={data.lentCount > 0 ? 'danger' : 'default'} />
          <Eyebrow>En prêt</Eyebrow>
        </div>
      </div>
      <div className="mt-4">
        <Eyebrow>Fiabilité</Eyebrow>
        <ProgressBar value={data.reliabilityPct} label="Fiabilité de l'équipement" tone={data.reliabilityPct >= 80 ? 'sage' : 'warn'} />
      </div>
    </GlassCard>
  );
}
