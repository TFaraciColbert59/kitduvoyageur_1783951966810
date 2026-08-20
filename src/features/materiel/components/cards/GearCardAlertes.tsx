'use client';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface AlertesData { count: number; criticalCount: number; warningCount: number; reliabilityScore: number; lastAlertLabel: string | null }

export function GearCardAlertes({ data, className }: { data: AlertesData; className?: string }) {
  const tone = data.criticalCount > 0 ? 'danger' : data.warningCount > 0 ? 'warn' : 'sage';
  return (
    <GlassCard
      as="article"
      interactive
      tone={data.criticalCount > 0 ? 'danger' : 'neutral'}
      ariaLabelledBy="alertes-title"
      className={className}
    >
      <div className="p-4 flex flex-col gap-3">
        <Eyebrow>Alertes & fiabilité</Eyebrow>
        <h2 id="alertes-title" className="sr-only">Alertes</h2>
        <Metric value={data.count} tone={data.criticalCount > 0 ? 'danger' : 'default'} />
        <ProgressBar value={data.reliabilityScore} label="Score de fiabilité" tone={tone} />
        <div className="flex gap-2">
          {data.criticalCount > 0 && <Badge tone="danger">{data.criticalCount} critiques</Badge>}
          {data.warningCount > 0 && <Badge tone="warn">{data.warningCount} avertissements</Badge>}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[color:var(--label-quaternary)]">{data.lastAlertLabel ?? 'Équipement sain'}</span>
          {data.count > 0 && <Link href="/materiel/alertes" className="text-sm font-medium text-sage-600">Voir détail →</Link>}
        </div>
      </div>
    </GlassCard>
  );
}
