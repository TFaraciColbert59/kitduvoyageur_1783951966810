import Link from 'next/link';
import { getDepartDetail } from '@/features/materiel/services/getDepartDetail';
import { TerrainReadinessScore } from '@/features/materiel/components/depart/TerrainReadinessScore';
import { AssignedKitCard } from '@/features/materiel/components/depart/AssignedKitCard';
import { WeightDistributionDonut } from '@/features/materiel/components/depart/WeightDistributionDonut';
import { ChecklistDonut } from '@/features/materiel/components/depart/ChecklistDonut';
import { DepartActionsBar } from '@/features/materiel/components/depart/DepartActionsBar';
import { WeatherTimeline48h } from '@/features/materiel/components/depart/WeatherTimeline48h';
import { ConsumablesTiles } from '@/features/materiel/components/depart/ConsumablesTiles';
import { ParticipantsEmergency } from '@/features/materiel/components/depart/ParticipantsEmergency';
import { SimilarCommunityKits } from '@/features/materiel/components/depart/SimilarCommunityKits';
import { LazyMap3D } from '@/features/materiel/components/depart/LazyMap3D';
import { CountdownLive } from '@/features/materiel/components/cards/CountdownLive';
import { getWeather } from '@/features/materiel/services/getWeather';
import { getPublicKits } from '@/features/materiel/services/getPublicKits';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { Metric } from '@/components/ui/Metric';

export const dynamic = 'force-dynamic';

export default async function DepartPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  const [depart, weather, publicKits] = await Promise.all([getDepartDetail(id), getWeather(), getPublicKits()]);
  const similarKits = publicKits.map((k) => ({
    id: k.id,
    name: k.name,
    author: 'Communauté',
    likes: 0,
    totalWeightG: k.total_weight_g,
    itemsCount: k.itemsCount,
  }));

  if (!depart) {
    return (
      <div className="max-w-[var(--page-max-w)] mx-auto px-4 py-8">
        <GlassCard className="p-6 flex flex-col gap-3 items-start">
          <Eyebrow>Prochain départ</Eyebrow>
          <p className="text-sm text-[color:var(--label-secondary)]">Aucun kit assigné. Créez un kit pour préparer votre départ.</p>
          <Link href="/materiel/kits" className="glass-capsule-btn secondary">
            Mes kits →
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-[var(--page-max-w)] mx-auto px-4 py-8 pb-28">
      {/* En-tête */}
      <header className="flex items-center justify-between mb-5">
        <div>
          <Eyebrow>Prochain départ</Eyebrow>
          <h1 className="font-display font-semibold text-[32px] tracking-tight text-[color:var(--label)]">{depart.destination}</h1>
        </div>
        <Link href="/materiel" className="glass interactive h-9 px-4 rounded-full flex items-center text-sm font-medium text-sage-600">
          ← Retour
        </Link>
      </header>

      {/* HERO — carte pleine largeur + overlay glass */}
      <div className="relative mb-5 h-[340px] md:h-[400px]">
        <LazyMap3D route={depart.route} className="h-full w-full" />
        <div className="absolute left-4 top-4 max-w-xs glass size-hero p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[color:var(--label)]">{depart.destination}</span>
            <Badge tone={depart.readinessScore.grade === 'E' ? 'danger' : depart.checklistPct >= 80 ? 'sage' : 'warn'}>
              {depart.checklistPct}% prêt
            </Badge>
          </div>
          <Metric value={<CountdownLive target={depart.startsAt} />} size="md" />
          <span className="text-xs text-[color:var(--label-tertiary)]">
            Poids total {(depart.assignedKit.totalWeightG / 1000).toFixed(1)} kg · {depart.assignedKit.items.length} article(s)
          </span>
        </div>
      </div>

      {/* Rangée A — Kit, checklist, score terrain */}
      <div className="grid grid-cols-12 gap-[var(--grid-gap)] mb-5">
        <div className="col-span-12 md:col-span-4"><AssignedKitCard kit={depart.assignedKit} /></div>
        <div className="col-span-12 md:col-span-4"><ChecklistDonut pct={depart.checklistPct} /></div>
        <div className="col-span-12 md:col-span-4"><TerrainReadinessScore score={depart.readinessScore} /></div>
      </div>

      {/* Rangée B — Consommables + répartition poids */}
      <div className="grid grid-cols-12 gap-[var(--grid-gap)] mb-5">
        <div className="col-span-12 md:col-span-6"><ConsumablesTiles kitId={depart.id} initial={depart.consumables} /></div>
        <div className="col-span-12 md:col-span-6"><WeightDistributionDonut items={depart.weightBreakdown} /></div>
      </div>

      {/* Rangée C — Météo 48h (pleine largeur) */}
      <div className="mb-5"><WeatherTimeline48h forecast={weather} /></div>

      {/* Rangée D — Participants & urgence */}
      <div className="mb-5">
        <ParticipantsEmergency participants={depart.participants} emergencyContact={depart.emergencyContact} kitId={depart.id} />
      </div>

      {/* Rangée E — Kits communauté */}
      <div><SimilarCommunityKits kits={similarKits} /></div>

      <DepartActionsBar departId={depart.id} className="sticky bottom-0 mt-5" />
    </div>
  );
}