import Link from 'next/link';
import { getDepartDetail } from '@/features/materiel/services/getDepartDetail';
import { TerrainReadinessScore } from '@/features/materiel/components/depart/TerrainReadinessScore';
import { AssignedKitCard } from '@/features/materiel/components/depart/AssignedKitCard';
import { WeightDistributionDonut } from '@/features/materiel/components/depart/WeightDistributionDonut';
import { ChecklistDonut } from '@/features/materiel/components/depart/ChecklistDonut';
import { DepartActionsBar } from '@/features/materiel/components/depart/DepartActionsBar';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';

export const dynamic = 'force-dynamic';

export default async function DepartPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  const depart = await getDepartDetail(id);

  if (!depart) {
    return (
      <main className="max-w-[var(--page-max-w)] mx-auto px-4 py-8">
        <GlassCard className="p-6 flex flex-col gap-3 items-start">
          <Eyebrow>Prochain départ</Eyebrow>
          <p className="text-sm text-[color:var(--label-secondary)]">Aucun kit assigné. Créez un kit pour préparer votre départ.</p>
          <Link href="/materiel/kits" className="glass interactive h-9 px-4 rounded-full flex items-center text-sm font-medium text-sage-600">
            Mes kits →
          </Link>
        </GlassCard>
      </main>
    );
  }

  return (
    <main className="max-w-[var(--page-max-w)] mx-auto px-4 py-8 pb-24">
      <header className="flex items-center justify-between mb-6">
        <h1 className="font-display font-semibold text-[32px] tracking-tight text-[color:var(--label)]">{depart.destination}</h1>
        <Link href="/materiel" className="glass interactive h-9 px-4 rounded-full flex items-center text-sm font-medium text-sage-600">
          ← Retour
        </Link>
      </header>

      <div className="grid grid-cols-12 gap-4">
        <GlassCard className="col-span-12 md:col-span-8 h-[320px] flex items-center justify-center" aria-labelledby="map-title">
          <div className="text-center">
            <h2 id="map-title" className="sr-only">Carte immersive</h2>
            <p className="text-sm text-[color:var(--label-tertiary)]">Carte immersive (MapLibre) — à brancher sur la géométrie du kit/itinéraire.</p>
          </div>
        </GlassCard>
        <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
          <TerrainReadinessScore score={depart.readinessScore} />
          <GlassCard className="p-4">
            <Eyebrow>Météo 48h</Eyebrow>
            <p className="text-sm text-[color:var(--label-tertiary)] mt-1">Timeline météo à brancher (API météo).</p>
          </GlassCard>
        </div>
        <div className="col-span-12 md:col-span-4"><AssignedKitCard kit={depart.assignedKit} /></div>
        <div className="col-span-12 md:col-span-4"><ChecklistDonut pct={50} /></div>
        <div className="col-span-12 md:col-span-4"><WeightDistributionDonut items={depart.weightBreakdown} /></div>
      </div>

      <DepartActionsBar departId={depart.id} className="sticky bottom-0 mt-4" />
    </main>
  );
}
