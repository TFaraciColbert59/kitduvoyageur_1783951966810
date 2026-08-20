'use client';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface DispoData { unavailableCount: number; total: number; hasConflict: boolean; nextReturnLabel: string | null }

export function GearCardDispo({ data, className }: { data: DispoData; className?: string }) {
  const availablePct = data.total > 0 ? ((data.total - data.unavailableCount) / data.total) * 100 : 100;
  const tone = availablePct === 100 ? 'sage' : data.unavailableCount <= 2 ? 'warn' : 'danger';
  return (
    <GlassCard as="article" interactive ariaLabelledBy="dispo-title" className={className}>
      <div className="p-4 flex flex-col gap-3">
        <Eyebrow>Disponibilité</Eyebrow>
        <h2 id="dispo-title" className="sr-only">Disponibilité</h2>
        <Metric value={data.unavailableCount} tone={data.unavailableCount > 0 ? 'danger' : 'default'} />
        <ProgressBar value={availablePct} label="Équipement disponible" tone={tone} />
        {data.hasConflict && <Badge tone="danger">Conflit détecté</Badge>}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[color:var(--label-quaternary)]">{data.nextReturnLabel ?? 'Tout disponible'}</span>
          <Link href="/materiel/disponibilite" className="text-sm font-medium text-sage-600">Voir prêts →</Link>
        </div>
      </div>
    </GlassCard>
  );
}
