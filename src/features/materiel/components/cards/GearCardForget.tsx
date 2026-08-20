'use client';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface ForgetData { forgetRemaining: number; checkedItems: number; totalItems: number; nextDepartLabel: string | null }

export function GearCardForget({ data, className }: { data: ForgetData; className?: string }) {
  const pct = data.totalItems > 0 ? (data.checkedItems / data.totalItems) * 100 : 100;
  return (
    <GlassCard as="article" interactive ariaLabelledBy="forget-title" className={className}>
      <div className="p-4 flex flex-col gap-3">
        <Eyebrow>À ne pas oublier</Eyebrow>
        <h2 id="forget-title" className="sr-only">À ne pas oublier</h2>
        <Metric value={data.forgetRemaining} tone={data.forgetRemaining === 0 ? 'sage' : 'danger'} />
        <ProgressBar value={pct} label="Checklist de départ" tone={pct === 100 ? 'sage' : 'danger'} />
        {data.checkedItems === data.totalItems && data.totalItems > 0 && <Badge tone="sage">Prêt</Badge>}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[color:var(--label-quaternary)]">{data.nextDepartLabel ?? 'Aucun départ prévu'}</span>
          <Link href="/materiel/forget" className="text-sm font-medium text-sage-600">Voir tout →</Link>
        </div>
      </div>
    </GlassCard>
  );
}
